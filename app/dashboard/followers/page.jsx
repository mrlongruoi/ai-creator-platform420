"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import { UserPlus, UserMinus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useConvexQuery, useConvexMutation } from "@/hooks/use-convex-query";
import { toast } from "sonner";

const UserCard = ({ user, isLoading = false, variant = "follower", onToggle }) => {
  // Precompute the action button to keep JSX simple and avoid nested ternaries
  let actionButton = null;
  if (variant === "follower") {
    if (!user?.followsBack) {
      actionButton = (
        <Button
          onClick={() => onToggle(user._id)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-1" />
              Follow Back
            </>
          )}
        </Button>
      );
    }
  } else {
    actionButton = (
      <Button
        onClick={() => onToggle(user._id)}
        disabled={isLoading}
        variant="ghost"
        size="sm"
        className="text-slate-400 hover:text-red-400"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <UserMinus className="h-4 w-4 mr-1" />
            Unfollow
          </>
        )}
      </Button>
    );
  }

  const avatar = (
    <div className="relative w-10 h-10 cursor-pointer">
      {user?.imageUrl ? (
        <Image
          src={user.imageUrl}
          alt={user?.name || user?.username || "User avatar"}
          fill
          className="rounded-full object-cover"
          sizes="40px"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold">
          {(user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || "?")}
        </div>
      )}
    </div>
  );

  const info = (
    <div className="cursor-pointer">
      <p className="font-medium text-white hover:text-purple-300">{user?.name || "Unknown"}</p>
      {user?.username && <p className="text-sm text-slate-400">@{user.username}</p>}
    </div>
  );

  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
      {/* Avatar + Info */}
      <div className="flex items-center space-x-3">
        {user?.username ? <Link href={`/${user.username}`}>{avatar}</Link> : avatar}
        {user?.username ? <Link href={`/${user.username}`}>{info}</Link> : info}
      </div>

      {/* Action Button */}
      {actionButton}
    </div>
  );
};

UserCard.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string,
    username: PropTypes.string,
    imageUrl: PropTypes.string,
    followsBack: PropTypes.bool,
  }).isRequired,
  isLoading: PropTypes.bool,
  variant: PropTypes.oneOf(["follower", "following"]),
  onToggle: PropTypes.func.isRequired,
};

// Lightweight loading skeleton list
const LoadingList = () => {
  const KEYS = ["k1", "k2", "k3", "k4", "k5"];
  return (
    <div className="space-y-3">
      {KEYS.map((k) => (
        <div
          key={k}
          className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg animate-pulse"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-700" />
            <div>
              <div className="h-3 w-32 bg-slate-700 rounded mb-2" />
              <div className="h-3 w-20 bg-slate-700 rounded" />
            </div>
          </div>
          <div className="h-8 w-28 bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );
};

const ErrorMessage = ({ message }) => (
  <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-md px-3 py-2">
    {message}
  </p>
);

ErrorMessage.propTypes = {
  message: PropTypes.string,
};

const FollowersPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingId, setPendingId] = useState(null);

  // Data fetching
  const {
    data: followers,
    isLoading: followersLoading,
    error: followersError,
  } = useConvexQuery(api.follows.getMyFollowers, { limit: 100 });

  const {
    data: following,
    isLoading: followingLoading,
    error: followingError,
  } = useConvexQuery(api.follows.getMyFollowing, { limit: 100 });

  // Mutations
  const { mutate: toggleFollow, isLoading: isToggling } = useConvexMutation(
    api.follows.toggleFollow
  );

  // Handle follow/unfollow
  const handleFollowToggle = async (userId) => {
    try {
      setPendingId(userId);
      await toggleFollow({ followingId: userId });
    } catch (error) {
      toast.error(error?.message || "Failed to update follow status");
    } finally {
      setPendingId(null);
    }
  };

  // Filter users based on search
  const filterUsers = (users) => {
    const list = users || [];
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter((u) =>
      (u?.name && u.name.toLowerCase().includes(q)) ||
      (u?.username && u.username.toLowerCase().includes(q))
    );
  };

  const filteredFollowers = filterUsers(followers);
  const filteredFollowing = filterUsers(following);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text-primary">Followers & Following</h1>
        <p className="text-slate-400 mt-2">Manage your connections and discover new creators</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="pl-10 bg-slate-800 border-slate-600"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="followers">
        <TabsList className="grid w-full grid-cols-2 bg-slate-900">
          <TabsTrigger value="followers">Followers ({filteredFollowers.length})</TabsTrigger>
          <TabsTrigger value="following">Following ({filteredFollowing.length})</TabsTrigger>
        </TabsList>

        {/* Followers Tab */}
        <TabsContent value="followers" className="mt-6 space-y-3">
          {followersError && (
            <ErrorMessage message={followersError.message || "Failed to load followers."} />
          )}
          {followersLoading && <LoadingList />}
          {!followersLoading && (
            filteredFollowers.length === 0 ? (
              <p className="text-slate-400">No followers found.</p>
            ) : (
              filteredFollowers.map((user) => (
                <UserCard
                  key={user._id}
                  user={user}
                  variant="follower"
                  isLoading={isToggling && pendingId === user._id}
                  onToggle={handleFollowToggle}
                />
              ))
            )
          )}
        </TabsContent>

        {/* Following Tab */}
        <TabsContent value="following" className="mt-6 space-y-3">
          {followingError && (
            <ErrorMessage message={followingError.message || "Failed to load following."} />
          )}
          {followingLoading && <LoadingList />}
          {!followingLoading && (
            filteredFollowing.length === 0 ? (
              <p className="text-slate-400">You're not following anyone yet.</p>
            ) : (
              filteredFollowing.map((user) => (
                <UserCard
                  key={user._id}
                  user={user}
                  variant="following"
                  isLoading={isToggling && pendingId === user._id}
                  onToggle={handleFollowToggle}
                />
              ))
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FollowersPage;
