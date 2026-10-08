# MotoDoc driver dashboard

Next.js App Router, TypeScript, Tailwind CSS 4, and Lucide React. This is the driver's car dashboard for the MotoDoc app in `../landing`; it has no data of its own.

## How it connects

The dashboard is served under `/dashboard` (`basePath` in `next.config.ts`) on the same origin as the landing app, so it shares the `motodoc_session` cookie and calls the Express API at `/api` directly:

- Development: Vite (`../landing`, port 4173) proxies `/dashboard` to this dev server (port 4180) and `/api` to the API (port 4174). Open `http://localhost:4173/dashboard`. Opening port 4180 directly redirects there.
- Production: `next build` exports the dashboard as static files (`out/`). The root `npm run build` copies them into `../landing/dist/client/dashboard`, so the landing app's host serves them at `/dashboard`: on Vercel through the top-level `vercel.json`, and on a Node host through `../landing/server/index.js`.

Signed-out visitors are sent to `/login`; garage accounts are sent to `/app`.

`components/ConnectedDashboard.tsx` loads `/auth/me`, `/vehicles`, `/bookings`, `/service-history`, and `/messages`, and maps them to the props of the presentational `components/MotoDocDashboard.tsx`. Its actions write back: vehicle readings (`PUT /vehicles/:id/condition`), rescheduling (`PUT /bookings/:id/schedule`, which returns the booking to pending for the garage to confirm), cancelling (`PATCH /bookings/:id`), and booking messages (`POST /bookings/:id/messages`). Adding vehicles and booking a garage stay in the landing app at `/app`, which the dashboard links to.

Only what the API stores is shown. Oil life, brake wear, and MOT date are entered by the driver and read "Not recorded" until then. The workshop card shows the garage of the vehicle's upcoming (or latest) booking with the contact details that garage has saved; the rating badge is the average of verified reviews, which drivers leave by rating a completed service in Service History, and is hidden until a garage has one. The API stores no photos, so accounts and mechanics show an initial. A vehicle photo appears for models with an image in `public/images` (currently the Volvo XC60); every other vehicle shows the photo of its model that the API finds on Wikimedia Commons, with the required credit, or the API's line drawing for its body type when there is none.

Calendar export downloads an ICS file for the booking's UTC start and a one-hour duration.

Commands: `npm run dev` (port 4180), `npm run build`, `npm run typecheck`.

## Assets

- `public/images/motodoc-logo.png`: exact user-supplied PNG, unmodified.
- `public/images/volvo-xc60.png`: generated with built-in image generation. Prompt: recreate only the reference's silver Volvo XC60 Recharge T8 as an isolated studio photo, matching its front three-quarter angle, proportions, metallic finish, rims, and grille; transparent background with subtle contact shadow, full car and small margins.
- `public/images/mechanic-avatar.png`: generated with built-in image generation. Prompt: square studio head-and-shoulders portrait of a fictional friendly male mechanic about 35, short dark brown hair, neatly trimmed short beard, plain dark forest-green work shirt, neutral light grey backdrop, natural skin texture and soft lighting, centered for a tiny circular avatar; no text, logos, tools, borders, or watermark. No longer referenced: accounts and mechanics show their initial, because the API stores no photos.

The stepped pixel motif is inline SVG as expressly requested. All UI icons come from Lucide.

## Verification

Strict TypeScript compilation and the production build pass. Driver and garage flows were exercised in the browser through `http://localhost:4173/dashboard` against the local API: readings, messaging in both directions, rescheduling, and garage confirmation. The pixel comparison against the original reference in `design-qa.md` has still not been done.
