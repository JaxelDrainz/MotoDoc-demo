# MotoDoc visual and interaction QA

final result: passed

Scope: first landing-page UI prototype, reviewed 30 September 2026. This is not a production authentication or payment release.

## Reference and comparison

Source: `qa/selected-reference.jpg`, the exact selected user attachment (1871 x 1312). Source and browser capture normalised to 1440 x 1010 for `qa/comparison-final.jpg`; both appear in the same image. Browser screenshots have a slight capture-scale/softness difference. Focused comparisons are `qa/comparison-typography.jpg` and `qa/comparison-booking.jpg`.

Reviewed surfaces: header alignment and navigation; headline hierarchy and supporting copy; illustration scale and green/mint treatment; booking-card anatomy; benefit row and transition into driver content. All retain the selected direction. Intentional differences: no quotation marks around the headline; live MotoDoc wordmark without the mockup's small MD badge; newly generated matching illustration rather than an exact traced asset. Small illustration contour and type-weight differences remain cosmetic.

## Corrections verified

- Enlarged and repositioned the hero illustration after the initial comparison.
- Removed the isolated white image field by correcting the image blend context.
- Restored dialog opener focus correctly under React StrictMode.
- Kept the login action visible at tablet widths and adjusted illustration/card position.
- Removed a body minimum width that caused 15px horizontal overflow at a 320px browser viewport with a classic scrollbar. Reduced the narrow headline slightly. Final document scroll width equals its client width (305px).

No outstanding actionable P0, P1, or P2 findings in this prototype scope.

## Responsive and lower-page evidence

- Desktop: 1440 x 1010 CSS viewport, `qa/desktop-final.png`.
- Tablet: 768 x 1024, `qa/tablet-final.png`; navigation and service card fit.
- Phone: 390 x 844, `qa/mobile-final.png`, `qa/mobile-menu.png`, `qa/mobile-features.png`, `qa/mobile-garage-dialog.png`.
- Narrow phone: 320 x 740, `qa/mobile-narrow.png`; no horizontal overflow.
- Lower sections inspected through viewport captures: `qa/drivers-desktop.png`, `qa/garages-desktop.png`, `qa/membership-desktop.png`, `qa/footer-desktop.png`.
- The stitched full-page capture (`desktop-full.png` and derived desktop-section images) contains capture duplication and is excluded from QA evidence. Individual viewport captures above show the actual layout.

## Interaction checks

- Header/section/footer anchor destinations resolve; no missing target IDs.
- Mobile menu opens, closes after navigation, and closes on Escape.
- Driver and garage calls to action open the role chooser with the correct initial selection; changing the selection updates its instructions.
- Account continuation opens the existing MotoDoc authentication page; the sign-in and signup controls were verified there without submitting credentials.
- Native dialogs open and close, Escape works, scrolling unlocks, and opener focus is restored. Keyboard navigation returns to the dialog controls; underlying page controls are inert while it is open.
- Privacy information dialog opens, clearly identifies unavailable policy content, and closes correctly.
- All six driver and six garage feature descriptions are present.
- Browser warning/error log was empty during verification. Production build completed successfully.

## Publication limitations

The booking card is example data. Login/account continuation uses the original app. No new database, authentication, payments, dashboards, or public deployment were added. Actual privacy and terms documents are still needed before publication; their notices are intentionally explicit. A broader accessibility audit and backend integration are outside this first-page review.

# Authentication design milestone — 1 October 2026

final result: passed

The user authorised a new composition with the mechanic holding the login/signup card. This extends the selected landing-page language rather than reproducing the original Lovable authentication layout. `qa/auth-style-comparison.jpg` places the selected style reference and both rendered authentication pages in one comparison image. The emerald contour illustration, mint accents, navy type, fine borders, and restrained card shadows are consistent. Hands overlap only the card edge and never cover inputs. On phones the mechanic peeks over the card to preserve readable form width.

Implemented routes: `/login` (also `/auth`), `/signup`, `/signup?role=garage`, `/forgot-password`. Landing account buttons now use these local screens. Signup role selection changes the supporting copy; garage CTAs preselect Garage owner.

Verified in browser:
- Desktop 1440 x 1000: login and garage signup, saved as `qa/auth-login-desktop-final.png` and `qa/auth-signup-desktop-final.png`.
- Tablet 768 x 1024: form and mechanic fit, `qa/auth-signup-tablet.png`.
- Phone 390 x 844: fields, role choices, recovery, feedback, and navigation remain usable. Recovery feedback evidence: `qa/auth-recovery-feedback-mobile.png`.
- Narrow phone 320 x 740: signup remains readable, scroll width equals client width at 305px with classic scrollbar; `qa/auth-signup-narrow.png`.
- Empty signup/login show field-specific errors and focus the first invalid field. Invalid email and short signup password are rejected. Radio choices and password show/hide work. Sample submissions display explicit preview feedback, focus that feedback, and clear password state. Recovery states explicitly say no email was sent.
- Links between login, signup, recovery, and home work. The actual landing garage CTA was followed and reached `/signup?role=garage` with the correct role selected.
- One main heading remains on mobile. Inputs have associated labels, error descriptions, autocomplete purposes, and visible keyboard focus. Images are decorative and do not intercept input.
- Browser warning/error log empty. Final production build passed.

No outstanding actionable P0/P1/P2 visual findings within this UI milestone. Actual authentication is intentionally not connected: no credentials are transmitted or persisted, no user account is created, and no recovery email is sent. The forms explain this and offer an explicit live-app link after preview completion. No deployment was made. These notes supersede the earlier landing-only description of account handoff.

# Authenticated car-care and local backend milestone — October 2026

final result: passed

Scope: Local SQLite backend (`server/app.js`, `server/database.js`, `server/seed.js`), authentication persistence with session cookies and scrypt password hashing, and core driver/garage car-care workflows in `/app` (`Dashboard.jsx`).

Verified features & workflows:
- **Authentication & Sessions**: Real user signup, login, session rotation, session expiration, and logout. Protected API routes reject unauthenticated requests and cross-origin writes.
- **Driver experience (`/app`)**:
  - Vehicle management: full CRUD for vehicles (make, model, year, registration plate, mileage). Deletion prevented when bookings exist.
  - Garages directory & search: filter listed garages by name, city, or service offering.
  - Appointment booking: hourly slot booking against published garages with service selection and notes.
  - Service history: chronological display of completed services with mechanic notes, date, and recorded vehicle mileage.
  - Memberships: browse active plans published by garages and submit membership requests.
  - Invoices & Reminders: view service invoices and create personal reminders for inspections, renewals, and tyre changes.
- **Garage experience (`/app`)**:
  - Profile & publishing: edit garage name, city, address, services list, description, and draft/published visibility toggle.
  - Bookings lifecycle: view incoming bookings, confirm pending appointments, and complete services with work summary and updated vehicle mileage.
  - Atomic service records: completing a service writes a `service_records` entry and updates the vehicle's mileage within a single database transaction.
  - Customer CRM: driver directory with private notes and custom tags scoped per garage.
  - Membership programs: create tiers with pricing and benefits; approve or cancel driver membership requests.
  - Invoicing: generate invoices against completed bookings, with recording of outside-app payments.
- **Automated verification**:
  - `npm run test:backend`: 7/7 backend tests passed (tenant isolation, password hashing, SQL injection resistance, unique booking slots, rate limiting, and password reset token handling).
  - `npm run test:sites`: 4/4 tests passed (static asset serving, SPA fallback routing, API pass-through protection, and Sites artifact emission).
  - `npm run build`: successfully generates `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
- **Integrity**: Zero simulated external email delivery (resets safely write to local outbox in development) and zero simulated credit card processing. Pure local prototype adhering strictly to requirements.
