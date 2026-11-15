# Stock Soul deployment

Stock Soul is a Vite single-page application. The frontend can be hosted on Vercel or Cloudflare Pages while Supabase continues to provide authentication, database access, and Edge Functions.

## Required build settings

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20 or newer

Set these frontend environment variables in the hosting provider:

- `VITE_SUPABASE_URL`: the existing Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable/anon key used by the browser client

`VITE_SUPABASE_PROJECT_ID` is supported as a compatibility fallback, but new deployments should set `VITE_SUPABASE_URL`.

Never put a Supabase service-role key or other server secret in a `VITE_*` variable. Vite embeds these values into browser assets.

## Vercel

1. Import this repository into Vercel.
2. Select the Vite framework preset (or Other).
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add the two required environment variables above for Preview and Production.
5. Deploy a preview first, verify routes, authentication, market data, and charts, then promote it to Production.

The included `vercel.json` rewrites SPA routes to `index.html`.

## Cloudflare Pages

1. Create a Pages project connected to this repository.
2. Set the build command to `npm run build` and output directory to `dist`.
3. Add the same environment variables for the production and preview environments.
4. Deploy a preview and verify the same user flows before changing the production domain.

The included `public/_redirects` supplies the SPA fallback. `wrangler.toml` records the Pages output directory for Wrangler-based deployments.

## Backend remains on Supabase

Changing the frontend host does not migrate the Supabase database, Auth configuration, RLS policies, or Edge Functions. Keep the existing Supabase project and deploy the `stock-chart` function there. Configure the production site's environment variables to point to that same project.

## Verification

Run:

```sh
npm install
npm run lint
npm test
npm run build
```

Also verify live ticker search and price/chart refresh in a deployed preview. Yahoo Finance is an upstream data source and may delay quotes or rate-limit requests; the app should show the last successful quote instead of silently replacing it with invalid data.
