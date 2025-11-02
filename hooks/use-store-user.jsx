import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";

export function useStoreUser() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  // When this state is set we know the server has stored the user.
  const [userId, setUserId] = useState(null);
  const storeUser = useMutation(api.users.store);
  // Guard against duplicate calls (React 18/19 StrictMode, rerenders)
  const hasStoredRef = useRef(false);

  // Call the `storeUser` mutation function to store the current user in the `users` table
  useEffect(() => {
    if (!isAuthenticated) return;
    if (hasStoredRef.current || userId !== null) return;

    let isMounted = true;
    hasStoredRef.current = true;

    // Safety timeout to avoid an infinite loading bar if the mutation never resolves
    const timeout = setTimeout(() => {
      if (isMounted && userId === null) {
        // Treat as stored to unblock UI; server will eventually reconcile
        setUserId("timeout");
      }
    }, 8000);

    (async () => {
      try {
        const id = await storeUser();
        if (isMounted) setUserId(id || "stored");
      } catch (err) {
        console.error("storeUser failed:", err);
        // Even on failure, stop the global loader to avoid a stuck UI.
        if (isMounted && userId === null) setUserId("error");
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      // Do NOT reset userId here; that caused StrictMode double-run to re-trigger loaders
    };
    // Rerun only when auth state flips or Clerk identity changes
  }, [isAuthenticated, storeUser, user?.id, userId]);

  // Combine the local state with the state from context
  return {
    isLoading: isLoading || (isAuthenticated && userId === null),
    isAuthenticated: !!(isAuthenticated && userId !== null),
  };
}
