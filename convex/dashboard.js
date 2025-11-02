import { v } from "convex/values";
import { query } from "./_generated/server";

// Utility helpers to keep handlers simple and readable
async function getAuthenticatedUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
    .unique();
  return user ?? null;
}

async function getUserPosts(ctx, userId) {
  if (!userId) return [];
  return ctx.db
    .query("posts")
    .filter((q) => q.eq(q.field("authorId"), userId))
    .collect();
}

// Build a safe OR expression. Returns null when ids is empty so you can wrap with q.and(null, ...)
function buildOrEq(q, field, ids) {
  if (!ids || ids.length === 0) return null;
  return q.or(...ids.map((id) => q.eq(q.field(field), id)));
}

// Get dashboard analytics for the authenticated user
export const getAnalytics = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (!user) {
      return null;
    }

    // Get all user's posts
    const posts = await getUserPosts(ctx, user._id);

    // Get user's followers count
    const followers = await ctx.db
      .query("follows")
      .filter((q) => q.eq(q.field("followingId"), user._id))
      .collect();

    // Calculate analytics
  const totalViews = posts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0);
  const totalLikes = posts.reduce((sum, post) => sum + (post.likeCount ?? 0), 0);

    // Get comments count for user's posts
    const postIds = posts.map((p) => p._id);
    let totalComments = 0;
    if (postIds.length > 0) {
      const comments = await ctx.db
        .query("comments")
        .filter((q) =>
          q.and(buildOrEq(q, "postId", postIds), q.eq(q.field("status"), "approved"))
        )
        .collect();
      totalComments = comments.length;
    }

    // Calculate growth percentages (simplified - you might want to implement proper date-based calculations)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const recentPosts = posts.filter((p) => p.createdAt > thirtyDaysAgo);
    const recentViews = recentPosts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0);
    const recentLikes = recentPosts.reduce((sum, post) => sum + (post.likeCount ?? 0), 0);

    // Simple growth calculation (you can enhance this)
    const viewsGrowth = totalViews > 0 ? (recentViews / totalViews) * 100 : 0;
    const likesGrowth = totalLikes > 0 ? (recentLikes / totalLikes) * 100 : 0;
    const commentsGrowth = totalComments > 0 ? 15 : 0; // Placeholder
    const followersGrowth = followers.length > 0 ? 12 : 0; // Placeholder

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalFollowers: followers.length,
      viewsGrowth: Math.round(viewsGrowth * 10) / 10,
      likesGrowth: Math.round(likesGrowth * 10) / 10,
      commentsGrowth,
      followersGrowth,
    };
  },
});

// Get recent activity for the dashboard
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) return [];

    const posts = await getUserPosts(ctx, user._id);
  const activities = [];

  // Build activities in parts, then merge once to keep lint happy
  const likeActs = await getRecentLikesActivities(ctx, posts, 5);
  const commentActs = await getRecentCommentsActivities(ctx, posts, 5);
  const followerActs = await getRecentFollowersActivities(ctx, user._id, 5);
  activities.push(...likeActs, ...commentActs, ...followerActs);

    // Sort all activities by time and limit
    activities.sort((a, b) => b.time - a.time);
    return activities.slice(0, args.limit || 10);
  },
});

// Helper to build recent like activities
async function getRecentLikesActivities(ctx, posts, perPost) {
  const activities = [];
  for (const post of posts) {
    const likes = await ctx.db
      .query("likes")
      .filter((q) => q.eq(q.field("postId"), post._id))
      .order("desc")
      .take(perPost);
    for (const like of likes) {
      if (!like.userId) continue;
      const likeUser = await ctx.db.get(like.userId);
      if (!likeUser) continue;
      activities.push({
        type: "like",
        user: likeUser.name,
        post: post.title,
        time: like.createdAt,
      });
    }
  }
  return activities;
}

// Helper to build recent comment activities
async function getRecentCommentsActivities(ctx, posts, perPost) {
  const activities = [];
  for (const post of posts) {
    const comments = await ctx.db
      .query("comments")
      .filter((q) =>
        q.and(
          q.eq(q.field("postId"), post._id),
          q.eq(q.field("status"), "approved")
        )
      )
      .order("desc")
      .take(perPost);
    for (const comment of comments) {
      activities.push({
        type: "comment",
        user: comment.authorName,
        post: post.title,
        time: comment.createdAt,
      });
    }
  }
  return activities;
}

// Helper to build recent follower activities
async function getRecentFollowersActivities(ctx, userId, limit) {
  const activities = [];
  const recentFollowers = await ctx.db
    .query("follows")
    .filter((q) => q.eq(q.field("followingId"), userId))
    .order("desc")
    .take(limit);
  for (const follow of recentFollowers) {
    const follower = await ctx.db.get(follow.followerId);
    if (follower) {
      activities.push({
        type: "follow",
        user: follower.name,
        time: follow.createdAt,
      });
    }
  }
  return activities;
}

// Get posts with analytics for dashboard
export const getPostsWithAnalytics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    // Get recent posts with enhanced data
    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("authorId"), user._id))
      .order("desc")
      .take(args.limit || 5);

    // Add comment counts to each post
    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        const comments = await ctx.db
          .query("comments")
          .filter((q) =>
            q.and(
              q.eq(q.field("postId"), post._id),
              q.eq(q.field("status"), "approved")
            )
          )
          .collect();

        return {
          ...post,
          commentCount: comments.length,
        };
      })
    );

    return postsWithComments;
  },
});

// Get daily views data for chart (last 30 days) - Assignment
export const getDailyViews = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (!user) {
      throw new Error("User not found");
    }

    // Get user's posts
    const userPosts = await getUserPosts(ctx, user._id);

    const postIds = userPosts.map((post) => post._id);

    // Generate last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD
      days.push({
        date: dateString,
        views: 0,
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        fullDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }

    // Get daily stats for all user's posts
    let dailyStats = [];
    if (postIds.length > 0) {
      dailyStats = await ctx.db
        .query("dailyStats")
        .filter((q) => buildOrEq(q, "postId", postIds))
        .collect();
    }

    // Aggregate views by date
    const viewsByDate = {};
    for (const stat of dailyStats) {
      if (viewsByDate[stat.date]) {
        viewsByDate[stat.date] += stat.views;
      } else {
        viewsByDate[stat.date] = stat.views;
      }
    }

    // Merge with days array
    const chartData = days.map((day) => ({
      ...day,
      views: viewsByDate[day.date] || 0,
    }));

    return chartData;
  },
});
