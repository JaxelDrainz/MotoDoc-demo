# MotoDoc

Responsive UI prototype based on the selected September 30, 2026, 3:57 PM reference.

## Local development

Start the backend API and frontend dev server:

```sh
# Terminal 1: backend API server (runs on port 4174)
npm run dev:api

# Terminal 2: frontend Vite dev server (runs on port 4173 with /api and /dashboard proxies)
npm run dev

# Terminal 3: driver car dashboard (Next.js, port 4180), from ../dashboard-next
npm run dev
```

Open `http://localhost:4173`. The driver car dashboard is at `/dashboard` on that same origin, linked from **Car dashboard** in a driver account; see `../dashboard-next/README.md`. In production, set `DASHBOARD_URL` to the running dashboard server so the API host serves it at `/dashboard`.

To create demo accounts for trying out driver and garage accounts locally:

```sh
npm run seed:demo
```

## Google Sign-In

The Google option is present in the login and signup pages. To activate it, create a **Web application** OAuth client in Google Cloud, add `http://localhost:4173` to its authorized JavaScript origins, then copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID`. Restart the API server. Google sign-in works on a configured browser and creates either a driver or garage account according to the signup choice. An existing password account can connect Google from **Account** while signed in, using the Google account with the same email address. MotoDoc verifies Google's ID token on the server and uses Google's stable account ID; a matching email alone never links accounts.

No Google client credentials are included in this repository. Google Sign-In cannot complete until a Google Cloud client is configured for the running origin. For deployment, register that exact HTTPS origin in Google Cloud and set `GOOGLE_CLIENT_ID` in the server environment.

Run test suites:

```sh
# Backend integration tests
npm run test:backend

# Sites worker packaging tests
npm run test:sites
```

## Production build

```sh
npm run build
```

Outputs the frontend to `dist/client` and preserves the bundled Sites-ready worker in `dist/server` and configuration in `dist/.openai`. The Sites worker is a frontend preview only. The local SQLite API requires a persistent Node host and is not deployed by the Sites bundle.

## Vercel deployment

The repository root is this directory. Its `vercel.json` serves the Vite frontend and routes `/api/*` to the Express function. Set the project runtime to Node.js 24 (also declared in `package.json`).

1. Link this directory to a Vercel project, or import `JaxelDrainz/MotoDoc-demo` with **Root Directory** set to the repository root.
2. In the Vercel project's **Storage** tab, install/connect a Turso Cloud database. The integration supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to the project. Make sure both are available to Production and any Preview deployment you intend to test.
3. Deploy and verify `/api/health`, signup, login, and a driver/garage workflow. The API creates its tables on first startup. Hosted accounts are separate from accounts in the local SQLite file; no local user data is automatically uploaded.
4. To enable Google Sign-In, set `GOOGLE_CLIENT_ID` for the deployed environment and register the exact HTTPS deployment or custom-domain origin as an authorized JavaScript origin in the Google Cloud Web OAuth client. Add preview origins only if you intend to use Google Sign-In on those previews.

The server refuses to start in production if hosted persistence is missing, so a public deployment cannot appear to accept accounts that later disappear. Never put the database token in a `VITE_` variable or commit it. Password-reset email and live card payments still require separate providers; the production UI reports password recovery as unavailable.

## Scope

- **Landing page**: selected hero, all six driver features, all six garage features, membership, how it works, closing call to action, and footer info dialogs.
- **Authentication**: `/login`, `/signup`, `/signup?role=garage`, `/forgot-password`, and `/reset-password`. Uses the mechanic visual composition with emerald line contour.
- **Local backend**: SQLite persistence with transaction support, scrypt password hashing, HTTP-only cookie sessions, rate limiting, and CSRF protection.
- **Driver workflows (`/app`)**:
  - Vehicle management: add, edit, view, and remove vehicles with mileage tracking. Make and model fields search the vehicle catalogue (`server/catalog.js`: bundled makes and models by body type, with the public NHTSA vPIC database as a fallback for anything not listed). Each vehicle shows a photo of that model: the lead image of its Wikipedia article (`server/vehicle-images.js`), looked up once per make and model, cached in the `vehicle_images` table, and credited to its author and licence beside the photo. When no photo is found, the drawing for its body type from `server/vehicle-art.js` (`/api/catalog/art/<body>.svg`) is used instead.
  - Garage search: browse published garages and book hourly service appointments.
  - Service history: chronological log of completed repairs and maintenance.
  - Memberships: browse plans and request garage membership tiers.
  - Invoices & Reminders: view service invoices and track inspection/maintenance dates.
  - Car dashboard (`/dashboard`): vehicle readings, upcoming service, rescheduling, and messages with the garage.
- **Garage workflows (`/app`)**:
  - Profile & services: manage garage details, service offerings, and publish status.
  - Booking management: review appointment requests, confirm bookings, and complete services with mileage updates.
  - Automated service records: completing a booking records service history and updates vehicle mileage atomically.
  - Customer CRM: customer list, private garage notes, and tags.
  - Contact details & messages: phone, opening hours, and mechanic name shown to booked drivers; per-booking message threads.
  - Membership plans: create tiers and approve/manage driver membership requests.
  - Invoicing: generate invoices for completed bookings and record payments received outside the app.
- **Design & Limitations**:
  - External email delivery (password resets write to local outbox in development) and live card payments are deliberately not simulated.
  - Privacy and terms dialogs explicitly indicate placeholder legal copy.

## Assets and references

- Hero: `public/assets/mechanic-hero.png`, generated using the built-in image tool from the selected reference. Prompt: recreate only the minimal green line drawing of a mechanic leaning over an open car bonnet holding a spanner; sparse mint fills, white background; no text, logo, UI or booking card.
- Authentication illustration: `public/assets/mechanic-auth.png`, built-in image generation using the hero as its style reference. Minimal emerald mechanic cutout holding an invisible card edge; real HTML forms sit between the character and its fingertips.
- Garage visit photography: `public/assets/garage-visit.png`, generated editorial image of a driver and mechanic discussing service beside a car. Used beneath the driver features while keeping the selected line-art hero.
- Workshop photography: `public/assets/garage-work.png`, generated editorial image of a mechanic inspecting an engine. Used in the garage section.
- Selected mockup: `qa/selected-reference.jpg`, exact image from this task's user attachment.
- Typography: locally bundled Inter Variable, SIL Open Font License. https://github.com/rsms/inter
- Icons: Phosphor React, MIT License. https://github.com/phosphor-icons/react
- Logo: `public/assets/motodoc-logo.png` and `public/favicon.png`, resized from the user-supplied original. The wordmark beside it stays editable text.
- Reference app: https://tidy-pixel-lab.lovable.app/

Visual and interaction verification is documented in `design-qa.md`.
