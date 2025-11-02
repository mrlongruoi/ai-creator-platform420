import { v } from "convex/values";
import { query } from "./_generated/server";

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

    let currentUser = null;
    let followedUserIds = [];

    if (identity) {
      currentUser = await ctx.db
        .query("users")
        .filter((q) =>
          q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier)
        )
        .unique();

      if (currentUser) {
        // Get users already being followed
        const follows = await ctx.db
          .query("follows")
          .filter((q) => q.eq(q.field("followerId"), currentUser._id))
          .collect();

        followedUserIds = follows.map((follow) => follow.followingId);
      }
    }

    // Get users with recent posts who aren't being followed
    // Build users query; avoid comparing Id<users> to an empty string
    let usersQuery = ctx.db.query("users");
    if (currentUser?._id) {
      usersQuery = usersQuery.filter((q) => q.neq(q.field("_id"), currentUser._id));
    }
    const allUsers = await usersQuery.collect();

    // Filter out already followed users and get their stats
    const suggestions = await Promise.all(
      allUsers
        .filter((user) => !followedUserIds.includes(user._id) && user.username)
        .map(async (user) => {
          // Get user's published posts
          const posts = await ctx.db
            .query("posts")
            .filter((q) =>
              q.and(
                q.eq(q.field("authorId"), user._id),
                q.eq(q.field("status"), "published")
              )
            )
            .order("desc")
            .take(5);

          // Get follower count
          const followers = await ctx.db
            .query("follows")
            .filter((q) => q.eq(q.field("followingId"), user._id))
            .collect();

          // Calculate engagement score for ranking
          const totalViews = posts.reduce(
            (sum, post) => sum + (post.viewCount ?? 0),
            0
          );
          const totalLikes = posts.reduce(
            (sum, post) => sum + (post.likeCount ?? 0),
            0
          );
          const engagementScore =
            totalViews + totalLikes * 5 + followers.length * 10;

          return {
            _id: user._id,
            name: user.name,
            username: user.username,
            imageUrl: user.imageUrl,
            followerCount: followers.length,
            postCount: posts.length,
            engagementScore,
            lastPostAt: posts.length > 0 ? posts[0].publishedAt ?? null : null,
            recentPosts: posts.slice(0, 2).map((post) => ({
              _id: post._id,
              title: post.title,
              viewCount: post.viewCount ?? 0,
              likeCount: post.likeCount ?? 0,
            })),
          };
        })
    );

    // Sort by engagement score and recent activity
    const rankedSuggestions = suggestions
      .filter((user) => user.postCount > 0) // Only users with posts
      .sort((a, b) => {
        // Prioritize recent activity
  const aRecent = (a.lastPostAt ?? 0) > Date.now() - 7 * 24 * 60 * 60 * 1000;
  const bRecent = (b.lastPostAt ?? 0) > Date.now() - 7 * 24 * 60 * 60 * 1000;

        if (aRecent && !bRecent) return -1;
        if (!aRecent && bRecent) return 1;

        // Then by engagement score
        return b.engagementScore - a.engagementScore;
      })
      .slice(0, limit);

    return rankedSuggestions;
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
