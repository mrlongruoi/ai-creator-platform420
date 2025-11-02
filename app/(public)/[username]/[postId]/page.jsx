"use client";

import React, { useEffect, useMemo, useState } from "react";
import PublicHeader from "../_components/public-header";
import { useUser } from "@clerk/nextjs";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BarLoader } from "react-spinners";
// prop-types not needed for this Client Page

const PostPage = () => {
  // Next.js 15 + React 19: params for client components must be read via useParams()
  const routeParams = useParams();
  const username = routeParams?.username;
  const postId = routeParams?.postId;
  const { user: currentUser } = useUser();

  const { data: currentConvexUser } = useConvexQuery(
    api.users.getCurrentUser,
    currentUser ? {} : "skip"
  );

  const [commentContent, setCommentContent] = useState("");

  const {
    data: post,
    isLoading: postLoading,
    error: postError,
  } = useConvexQuery(api.public.getPublishedPost, { username, postId });

  const { data: comments, isLoading: commentsLoading } = useConvexQuery(
    api.comments.getPostComments,
    { postId }
  );

  // Get like status for current user
  const { data: hasLiked } = useConvexQuery(
    api.likes.hasUserLiked,
    currentUser ? { postId } : "skip"
  );

  const { mutate: toggleLike, isLoading: isTogglingLike } =
    useConvexMutation(api.likes.toggleLike);

  const { mutate: addComment, isLoading: isSubmittingComment } =
    useConvexMutation(api.comments.addComment);

  const { mutate: deleteComment } = useConvexMutation(
    api.comments.deleteComment
  );

  const { mutate: incrementView } = useConvexMutation(
    api.public.incrementViewCount
  );

  // Track view once per session when post loads (guards dev StrictMode double-invoke)
  const viewedKey = useMemo(
    () => (postId ? `viewed:${String(postId)}` : null),
    [postId]
  );

  useEffect(() => {
    if (!postId || !post || postLoading) return;

    try {
      if (globalThis.window !== undefined && viewedKey) {
        const already = sessionStorage.getItem(viewedKey);
        if (already) return;
        sessionStorage.setItem(viewedKey, "1");
      }
    } catch (e) {
      // Non-fatal; proceed to count once and surface a dev-only warning for diagnostics
      if (process.env.NODE_ENV !== "production") {
        console.warn("sessionStorage not available to dedupe views:", e);
      }
    }

    incrementView({ postId });
    // Only run when we transition into the loaded state for this postId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, postLoading, !!post]);

  if (postLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading post...</p>
        </div>
      </div>
    );
  }

  if (postError || !post) {
    notFound();
  }

  const handleLikeToggle = async () => {
    if (!currentUser) {
      toast.error("Please sign in to like posts");
      return;
    }

    try {
      await toggleLike({ postId });
    } catch (error) {
      // Log and surface a helpful message to satisfy analyzers and aid debugging
      console.error("toggleLike failed", error);
      const msg = typeof error?.message === "string" && error.message.trim()
        ? error.message
        : "Failed to update like";
      toast.error(msg);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error("Please sign in to comment");
      return;
    }

    if (!commentContent.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      await addComment({
        postId,
        content: commentContent.trim(),
      });
      setCommentContent("");
      toast.success("Comment added!");
    } catch (error) {
      toast.error(error.message || "Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
  await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error.message || "Failed to delete comment");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <PublicHeader link={`/${username}`} title="Back to Profile" />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <article className="space-y-8">
          {/* Featured Image */}
          {post.featuredImage && (
            <div className="relative w-full h-96 rounded-xl overflow-hidden">
              <Image
                src={post.featuredImage}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
                priority
              />
            </div>
          )}

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold gradient-text-primary">
              {post.title}
            </h1>

            <div className="flex items-center justify-between">
              <Link href={`/${username}`}>
                <div className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                  <div className="relative w-12 h-12">
                    {post.author?.imageUrl ? (
                      <Image
                        src={post.author.imageUrl}
                        alt={post.author?.name || "Author"}
                        fill
                        className="rounded-full object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-lg font-bold">
                        {(post.author?.name?.charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-white">
                      {post.author?.name || "Anonymous"}
                    </p>
                    <p className="text-sm text-slate-400">
                      @{post.author?.username || "unknown"}
                    </p>
                  </div>
                </div>
              </Link>

              <div className="text-right text-sm text-slate-400">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {(post.viewCount || 0).toLocaleString()} views
                </div>
              </div>
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-purple-500/20 text-purple-300 border-purple-500/30"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Post Content */}
          <div
            className="prose prose-lg max-w-none prose-invert prose-purple"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <div className="flex items-center gap-6 pt-4 border-t border-slate-800">
            <Button
              onClick={handleLikeToggle}
              variant="ghost"
              className={`flex items-center gap-2 ${
                hasLiked
                  ? "text-red-400 hover:text-red-300"
                  : "text-slate-400 hover:text-white"
              }`}
              disabled={isTogglingLike}
            >
              <Heart className={`h-5 w-5 ${hasLiked ? "fill-current" : ""}`} />
              {post.likeCount.toLocaleString()}
            </Button>

            <div className="flex items-center gap-2 text-slate-400">
              <MessageCircle className="h-5 w-5" />
              {comments?.length || 0} comments
            </div>
          </div>
        </article>

        {/* Comments Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-white">Comments</h2>

          {currentUser ? (
            <Card className="card-glass">
              <CardContent className="p-6">
                <form onSubmit={handleCommentSubmit} className="space-y-4">
                  <Textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="Write a comment..."
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 resize-none"
                    rows={3}
                    maxLength={1000}
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {commentContent.length}/1000 characters
                    </p>
                    <Button
                      type="submit"
                      disabled={isSubmittingComment || !commentContent.trim()}
                      variant="primary"
                    >
                      {isSubmittingComment ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Post Comment
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-glass">
              <CardContent className="p-6 text-center">
                <p className="text-slate-400 mb-4">
                  Sign in to join the conversation
                </p>
                <Link href="/sign-in">
                  <Button variant="primary">Sign In</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {commentsLoading && (
            <BarLoader width={"100%"} color="#D8B4FE" />
          )}

          {!commentsLoading && comments && comments.length > 0 && (
            <div className="space-y-4">
              {comments.map((comment) => (
                <Card key={comment._id} className="card-glass">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="relative w-8 h-8">
                          {comment.author?.imageUrl ? (
                            <Image
                              src={comment.author.imageUrl}
                              alt={comment.author.name}
                              fill
                              className="rounded-full object-cover"
                              sizes="32px"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold">
                              {comment.author?.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-white">
                            {comment.author?.name || "Anonymous"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(comment.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>

                      {/* delete button */}
                      {currentConvexUser &&
                        comment.author &&
                        (currentConvexUser._id === comment.authorId ||
                          currentConvexUser._id === post.authorId) && (
                          <Button
                            onClick={() => handleDeleteComment(comment._id)}
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>

                    <p className="text-slate-300 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!commentsLoading && (!comments || comments.length === 0) && (
            <Card className="card-glass">
              <CardContent className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No comments yet</p>
                <p className="text-slate-500 text-sm mt-1">
                  Be the first to share your thoughts!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// No props are passed to this Client Page; params are obtained via useParams()
PostPage.propTypes = {};

export default PostPage;