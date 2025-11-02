import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";

export function useStoreUser() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  // When this state is set we know the server
  // has stored the user.
  const [userId, setUserId] = useState(null);
  const storeUser = useMutation(api.users.store);
  // Call the `storeUser` mutation function to store
  // the current user in the `users` table and return the `Id` value.
  useEffect(() => {
    // If the user is not logged in or we've already stored, do nothing
    if (!isAuthenticated || userId !== null) {
      return () => {};
    }

    let isMounted = true;
    async function createUser() {
      try {
        // Server gets identity via auth; nothing to pass
        const id = await storeUser();
        if (isMounted) setUserId(id);
      } catch (err) {
        // Non-fatal; log for debugging
        console.error("storeUser failed:", err);
      }
    }
    createUser();

    return () => {
      isMounted = false;
      setUserId(null);
    };
    // Rerun if user identity changes
  }, [isAuthenticated, storeUser, user?.id, userId]);
  // Combine the local state with the state from context
  return {
    isLoading: isLoading || (isAuthenticated && userId === null),
    isAuthenticated: isAuthenticated && userId !== null,
  };
}
