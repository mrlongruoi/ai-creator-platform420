### Make sure to create a `.env` file with following variables -

```
# Deployment used by `npx convex dev`
CONVEX_DEPLOYMENT=

NEXT_PUBLIC_CONVEX_URL=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

CLERK_JWT_ISSUER_DOMAIN=

# Imagekit
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
IMAGEKIT_PRIVATE_KEY=

# Unsplash
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=

#Gemini
GEMINI_API_KEY=
```

## Convex + Clerk authentication setup

To avoid "Failed to authenticate: No auth provider found matching the given token" when calling Convex:

1. Create a Clerk JWT Template named `convex`

- Clerk Dashboard → JWT Templates → New → Name: `convex`
- Keep defaults or include any extra claims you need
- Copy the "JWT Issuer" value; you'll need it in step 3

1. Ensure the client sends the `convex` token

- This repo already does so via `ConvexProviderWithClerk` which calls `getToken({ template: 'convex' })`

1. Configure Convex to accept Clerk tokens

- Set the issuer domain in your Convex deployment env:
	- Via CLI: `npx convex env set CLERK_JWT_ISSUER_DOMAIN <the JWT Issuer from step 1>`
	- Or in the Convex dashboard → Environment Variables
- Convex reads `convex/auth.config.js` which references `CLERK_JWT_ISSUER_DOMAIN` and `applicationID: 'convex'`

1. Point the app to your Convex deployment

- Set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` to your Convex deployment URL

1. Rebuild and run

If you still see the auth error, double-check:

- The Clerk JWT template is named `convex`
- The Convex env var `CLERK_JWT_ISSUER_DOMAIN` exactly matches the JWT Issuer URL from the Clerk template
- The app has `NEXT_PUBLIC_CONVEX_URL` set and is using the updated environment variables

## Clerk redirect deprecation: use fallback/force redirects

Clerk deprecated the `redirectUrl` prop. This repo replaces it with explicit destinations:

- Provider defaults in `app/layout.js`:
	- `signInFallbackRedirectUrl="/feed"`
	- `signUpFallbackRedirectUrl="/feed"`
	- `afterSignInUrl="/feed"`
	- `afterSignUpUrl="/feed"`
- Component usage:
	- `SignInButton` and `SignUpButton` pass `fallbackRedirectUrl="/feed"`.
	- `SignIn` uses `afterSignInUrl="/feed"`; `SignUp` uses `afterSignUpUrl="/feed"`.

Optional environment-based configuration:

```bash
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/feed
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/feed
# Use the FORCE variants only if you want to always redirect to a fixed URL
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=
```

These settings ensure consistent, non-deprecated redirect handling across auth flows.
