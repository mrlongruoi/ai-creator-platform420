import { SignIn } from "@clerk/nextjs";

export default function Page() {
  const fallback =
    process.env.NEXT_PUBLIC_AFTER_AUTH_FALLBACK_REDIRECT_URL || "/feed";
  const force = process.env.NEXT_PUBLIC_AFTER_AUTH_FORCE_REDIRECT_URL;
  return (
    <SignIn fallbackRedirectUrl={fallback} forceRedirectUrl={force || undefined} />
  );
}
