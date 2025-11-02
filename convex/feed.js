import { v } from "convex/values";
import { query } from "./_generated/server";

// Helper: rank suggestions by recent activity then engagement
function rankSuggestions(list, limit) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const ordered = [...list].sort((a, b) => {
    const aRecent = (a.lastPostAt ?? 0) > weekAgo;
    const bRecent = (b.lastPostAt ?? 0) > weekAgo;
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    return b.engagementScore - a.engagementScore;
  });
  return ordered.slice(0, limit);
}

// Helper: fetch current user and list of followed user ids (may be empty)
async function getAuthContext(ctx, identity) {
  let currentUser = null;
  let followedUserIds = [];
  if (identity) {
    currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
      .unique();
    if (currentUser) {
      const follows = await ctx.db
        .query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", currentUser._id))
        .collect();
      followedUserIds = follows.map((f) => f.followingId);
    }
  }
  return { currentUser, followedUserIds };
}

// Get feed posts - can improve it to show following posts first
export const getFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const limit = args.limit || 10;

      // Use index optimized for published ordering by publishedAt
      const allPosts = await ctx.db
        .query("posts")
        .withIndex("by_published", (q) => q.eq("status", "published"))
        .order("desc")
        .take(limit + 1);

      const hasMore = allPosts.length > limit;
      const feedPosts = hasMore ? allPosts.slice(0, limit) : allPosts;

      const postsWithAuthors = await Promise.all(
        feedPosts.map(async (post) => {
          // Defensive: if for any reason authorId is missing, skip author lookup
          if (!post.authorId) {
            return { ...post, author: null };
          }
          let author = null;
          try {
            author = await ctx.db.get(post.authorId);
          } catch (e) {
            // Log and continue without author
            console.error("feed:getFeed author lookup failed", {
              postId: post._id,
              authorId: post.authorId,
              error: e?.message,
            });
          }
          return {
            ...post,
            author: author
              ? {
                  _id: author._id,
                  name: author.name,
                  username: author.username,
                  imageUrl: author.imageUrl,
                }
              : null,
          };
        })
      );

      return {
        posts: postsWithAuthors.filter((post) => post.author !== null),
        hasMore,
      };
    } catch (error) {
      console.error("feed:getFeed failed", { error: error?.message });
      throw new Error("Failed to load feed posts. Please try again later.");
    }
  },
});

// Get suggested users to follow
export const getSuggestedUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const limit = args.limit || 10;

    const { currentUser, followedUserIds } = await getAuthContext(ctx, identity);

    // Gather recent published posts and aggregate authors to avoid N+1 user scans
    const recentPosts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("status", "published"))
      .order("desc")
      .take(100);

    // Build author stats from recent posts
    const authorMap = new Map();
    for (const post of recentPosts) {
      const authorId = post.authorId;
      if (!authorId) { continue; }
      if (currentUser?._id && authorId.equals?.(currentUser._id)) { continue; }
      if (followedUserIds.some((id) => id.equals?.(authorId))) { continue; }

      let stat = authorMap.get(authorId);
      if (!stat) {
        stat = {
          authorId,
          postCount: 0,
          totalViews: 0,
          totalLikes: 0,
          lastPostAt: 0,
          recentPosts: [],
        };
        authorMap.set(authorId, stat);
      }
      stat.postCount += 1;
      stat.totalViews += post.viewCount ?? 0;
      stat.totalLikes += post.likeCount ?? 0;
      stat.lastPostAt = Math.max(stat.lastPostAt, post.publishedAt ?? 0);
      if (stat.recentPosts.length < 2) {
        stat.recentPosts.push({
          _id: post._id,
          title: post.title,
          viewCount: post.viewCount ?? 0,
          likeCount: post.likeCount ?? 0,
        });
      }
  // Map already updated when first created
    }

    // If nothing from recent posts, fall back to any users with a username (excluding current and followed)
    let candidateStats = Array.from(authorMap.values());
    if (candidateStats.length === 0) {
      let usersQuery = ctx.db.query("users");
      if (currentUser?._id) {
        usersQuery = usersQuery.filter((q) => q.neq(q.field("_id"), currentUser._id));
      }
      const fallbackUsers = (await usersQuery.collect()).filter(
        (u) => u.username && !followedUserIds.some((id) => id.equals?.(u._id))
      );
      // Seed minimal stats so UI has something reasonable
      candidateStats = fallbackUsers.map((u) => ({
        authorId: u._id,
        postCount: 0,
        totalViews: 0,
        totalLikes: 0,
        lastPostAt: 0,
        recentPosts: [],
      }));
    }

    // Load author profiles and follower counts for up to the top 30 candidates before ranking
    const enriched = await Promise.all(
      candidateStats.slice(0, 30).map(async (s) => {
        const user = await ctx.db.get(s.authorId);
        if (!user?.username) return null;
        const followers = await ctx.db
          .query("follows")
          .withIndex("by_following", (q) => q.eq("followingId", s.authorId))
          .collect();
        return {
          _id: user._id,
          name: user.name,
          username: user.username,
          imageUrl: user.imageUrl,
          followerCount: followers.length,
          postCount: s.postCount,
          engagementScore: s.totalViews + s.totalLikes * 5 + followers.length * 10,
          lastPostAt: s.lastPostAt || null,
          recentPosts: s.recentPosts,
        };
      })
    );

    const suggestions = enriched.filter((x) => x !== null);
    return rankSuggestions(suggestions, limit);
  },
});

// Get trending posts (high engagement in last 7 days)
export const getTrendingPosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Get recent published posts
    const recentPosts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("status", "published"))
      .filter((q) => q.gte(q.field("publishedAt"), weekAgo))
      .collect();

    // Calculate trending score and sort
    const trendingPosts = recentPosts
      .map((post) => ({
        ...post,
        trendingScore: (post.viewCount ?? 0) + (post.likeCount ?? 0) * 3,
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    // Add author information
    const postsWithAuthors = await Promise.all(
      trendingPosts.map(async (post) => {
        if (!post.authorId) {
          return { ...post, author: null };
        }
        let author = null;
        try {
          author = await ctx.db.get(post.authorId);
        } catch (e) {
          console.error("feed:getTrendingPosts author lookup failed", {
            postId: post._id,
            authorId: post.authorId,
            error: e?.message,
          });
        }
        return {
          ...post,
          author: author
            ? {
                _id: author._id,
                name: author.name,
                username: author.username,
                imageUrl: author.imageUrl,
              }
            : null,
        };
      })
    );

    return postsWithAuthors.filter((post) => post.author !== null);
  },
});
