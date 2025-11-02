"use client";

import { ConvexReactClient } from "convex/react";

import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { useMemo } from "react";
import PropTypes from "prop-types";

export function ConvexClientProvider({ children }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      console.error("NEXT_PUBLIC_CONVEX_URL is not set");
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    // If the Convex URL is missing, render without provider to avoid hard crash.
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

ConvexClientProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
