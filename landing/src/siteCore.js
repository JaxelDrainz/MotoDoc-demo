import { fiContent, fiGlossary, fiStrings } from './siteFi.js';

const EMAIL = '[info@motodoc.app](mailto:info@motodoc.app)';

export const siteDefaults = {
  translations: { fi: { content: fiContent, strings: fiStrings, glossary: fiGlossary } },
  theme: {
    light: {
      primary: '#087658',
      primaryDark: '#065c45',
      ink: '#111827',
      muted: '#626a72',
      line: '#d7dce0',
      surface: '#f4f8fa',
      tint: '#eaf6f0',
    },
    dark: {
      primary: '#34d399',
      ink: '#e7efe9',
      muted: '#9aa9a1',
      line: '#26332d',
      surface: '#0d1512',
      card: '#141d19',
      tint: '#12301f',
    },
    radius: { card: 12, hero: 24, button: 999 },
  },
  motion: {
    enabled: true,
    speed: 1,
    distance: 8,
    pixelFill: true,
    openingScreen: true,
    scrollReveal: true,
  },
  features: {
    darkMode: true,
    notifications: true,
    googleSignIn: true,
    carPhotos: true,
    reviews: true,
  },
  images: {
    hero: '/assets/mechanic-hero.png',
    auth: '/assets/mechanic-auth.png',
    drivers: '/assets/garage-visit.png',
    garages: '/assets/garage-work.png',
    product: '/assets/product-dashboard.webp',
  },
  content: {
    hero: {
      title: 'Your car.\nYour mechanic.',
      tagline: 'All in one place.',
      description:
        'Book a trusted garage, keep your service history together, and enjoy benefits from your mechanic.',
      cta: 'Get started',
      secondary: 'For garage owners',
    },
    drivers: {
      eyebrow: 'FOR DRIVERS',
      title: 'Your car care, clearly organised.',
      text: 'Everything your car needs, in one place. From the next service to the last repair, stay connected to the people who keep you moving.',
      features: [
        {
          title: 'Find your trusted garage',
          text: 'Discover trusted garages near you and stay connected to your mechanic.',
        },
        {
          title: 'Book appointments',
          text: 'Book with trusted garages directly — no calls needed.',
        },
        { title: 'Service history', text: 'Track every repair and service in one place.' },
        { title: 'Membership benefits', text: 'Unlock discounts and perks from your mechanic.' },
        { title: 'Bills & payments', text: 'Keep service invoices and payment records together.' },
        { title: 'Smart reminders', text: 'Keep inspection and maintenance dates in view.' },
      ],
    },
    garages: {
      eyebrow: 'FOR GARAGES',
      title: 'Your garage.\nFully connected.',
      text: 'Manage bookings, memberships, service records, and communication in one place — built for modern car care.',
      cta: 'Register your garage',
      caption: 'More time for what you do best.',
      features: [
        { title: 'Garage profile', text: 'Show drivers your services and where to find you.' },
        { title: 'Customer CRM', text: 'Keep customer history, private notes, and tags together.' },
        { title: 'Membership programs', text: 'Create plans with your own pricing and benefits.' },
        { title: 'Booking management', text: 'Review requests and confirm each appointment.' },
        {
          title: 'Garage overview',
          text: 'See upcoming work, completed services, and invoice totals.',
        },
        {
          title: 'Invoicing & records',
          text: 'Create service invoices and record payments received.',
        },
      ],
    },
    product: {
      eyebrow: 'THE PRODUCT',
      title: 'Your car, on one screen.',
      text: 'The driver dashboard shows your car’s readings, your next service and the garage looking after it. This is the real app, shown with demo data.',
    },
    closing: {
      eyebrow: 'CAR CARE MADE EASY',
      title: 'Your mechanic.\nYour service. Your MotoDoc.',
      text: 'Find a garage you can trust. Book services, track maintenance, and unlock member benefits — all in one app.',
      cta: 'Get early access',
      secondary: 'Register your garage',
    },
    faq: [
      {
        question: 'How do I book a service?',
        answer:
          'Add your car, find a listed garage, and pick a free hour from its calendar. Your request goes to the garage, which confirms it. You can move or cancel an upcoming booking from your dashboard.',
      },
      {
        question: 'Does MotoDoc take payment?',
        answer:
          'No. Garages can record invoices and payments they have received, so both sides see the same record, but the payment itself is arranged directly between you and the garage.',
      },
      {
        question: 'Where do the oil life, brake wear and inspection readings come from?',
        answer:
          'You enter them yourself from your car or your last inspection report. They are not live sensor data, and MotoDoc shows “Not recorded” until you add them.',
      },
      {
        question: 'Can I talk to my garage in MotoDoc?',
        answer:
          'Yes. Every booking has its own message thread, and the bell shows new messages, confirmations and reminders that are due.',
      },
      {
        question: 'How does a garage join?',
        answer:
          'Create a garage account, complete the profile with your services, contact details and opening hours, and publish it. Drivers can then find and book you.',
      },
      {
        question: 'What happens to my data?',
        answer:
          'Your account, vehicles, bookings and messages are stored so the service works, and are shared only with the garages you book. The details are in the [privacy policy](/privacy).',
      },
    ],
    legal: {
      privacy: {
        title: 'Privacy policy',
        intro:
          'This policy explains what MotoDoc stores about you, why, who can see it, and what you can ask us to do with it.',
        updated: '13 October 2026',
        body: `## Who is responsible
MotoDoc is run by the MotoDoc team. For any privacy question or request, write to ${EMAIL}.

## What we store
- **Your account:** name, email address and role (driver or garage). Your password is stored only as a salted scrypt hash, never in readable form. If you use Google Sign-In we store your Google account identifier.
- **Drivers:** your vehicles (make, model, year, registration, mileage), the readings you enter, bookings, service records, reviews, reminders and membership requests.
- **Garages:** your public profile, services, contact details, opening hours, plans, invoices you record, and private notes you keep about your customers.
- **Both:** messages you exchange about a booking, and a profile photo or logo if you upload one.

## Why we use it
To run the service you asked for: signing you in, showing your cars and bookings, passing booking requests and messages between drivers and garages, and reminding you of due dates. We do not sell your data and we do not use it for advertising.

## Who can see it
- A garage you book with sees your name, photo, the vehicle and service booked, your messages and your rating of the service.
- A driver sees a garage’s public profile, contact details, average rating and messages.
- Our hosting and database providers (Vercel and Turso) process the data on our behalf so the service can run.

## Cookies and browser storage
MotoDoc sets one cookie, \`motodoc_session\`, which keeps you signed in for up to seven days. It is strictly necessary and cannot be read by scripts. Your light or dark mode choice and the site’s display settings are kept in your browser’s local storage. We use no advertising or analytics cookies.

## Other services we call
- **Google Sign-In**, only if you choose to sign in with Google.
- **Wikipedia and Wikimedia Commons**, to find a photo of a car model. We send only the make and model. The photo itself loads from Wikimedia’s servers, which therefore see your IP address.
- **NHTSA vehicle database**, to look up a make or model that is not in our own catalogue. We send only the text you typed in the make or model field.

## How long we keep it
We keep your data while your account exists. To close your account and have your data deleted, write to ${EMAIL}. Service records and invoices a garage has recorded may be kept where the garage is legally required to retain them.

## Your rights
You can ask for a copy of your data, have it corrected or deleted, object to or restrict how we use it, and receive it in a portable format. Write to ${EMAIL} and we will answer within one month. If you are in the EU or EEA you may also complain to your national data protection authority.`,
      },
      terms: {
        title: 'Terms of service',
        intro: 'These terms apply when you create a MotoDoc account or use the service.',
        updated: '13 October 2026',
        body: `## What MotoDoc is
MotoDoc connects drivers with independent garages. Drivers keep their vehicle details, book services and message garages; garages manage bookings, customers, plans and invoice records. MotoDoc is not a garage and does not carry out any repair or service itself.

## Your account
Give accurate details, keep your password to yourself, and tell us at ${EMAIL} if you think someone else has used your account. You are responsible for what is done through it.

## Bookings
A booking is a request until the garage confirms it. Either side can cancel an upcoming booking in the app. The work, its quality, its price and any warranty are agreed between the driver and the garage.

## Payments and invoices
MotoDoc does not take or process payments. Invoices and “paid” markers in the app are records kept by the garage. Membership plans are offers made by garages, and their price and billing are arranged with the garage directly.

## Vehicle information
Readings such as oil life, brake wear and inspection dates are entered by you and shown as you entered them. Car photos are general photos of the model from Wikimedia Commons, not of your vehicle. Do not rely on MotoDoc in place of your car’s own warnings, the manufacturer’s service schedule or a mechanic’s advice.

## Reviews and messages
You may rate a service only after it has been completed. Keep reviews and messages honest and lawful. We may remove content or close accounts that are abusive, fraudulent or misuse the service.

## Availability and liability
We work to keep MotoDoc available and accurate but provide it as it is, without a guarantee of uninterrupted service. To the extent the law allows, MotoDoc is not liable for the work of garages, for missed bookings, or for indirect losses. Nothing in these terms limits rights you have under consumer law that cannot be excluded.

## Changes
If we change these terms in a way that matters, we will tell you in the app or by email before the change takes effect. You can stop using MotoDoc and ask us to close your account at any time.`,
      },
      contact: {
        title: 'Contact',
        intro:
          'Questions about MotoDoc, your account, or listing your garage? We are glad to help.',
        updated: '',
        body: `## Email
Write to ${EMAIL}. Tell us whether you are a driver or a garage and, for account questions, the email address you signed up with.

## A problem with a booking or a service
Message the garage first from the booking in your account; they can see the details and answer fastest. If that does not resolve it, write to us.

## Your data
To get a copy of your data or have your account deleted, see the [privacy policy](/privacy) and write to ${EMAIL}.`,
      },
    },
  },
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
export function mergeSite(base, override) {
  if (!isObject(override)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override))
    if (key in base) out[key] = isObject(base[key]) ? mergeSite(base[key], value) : value;
  return out;
}

const NEXT_GREEN = ['text-\\[\\#087658\\]', 'hover\\:text-\\[\\#087658\\]:hover'];
export function siteStyle(site) {
  const { light, dark, radius } = site.theme,
    m = site.motion;
  const ms = (value) => `${Math.round(value * m.speed)}ms`;
  const darkScope =
    ":root[data-theme='dark'] :is(.dashboard, .dash-dialog, .dash-more, .dash-fault, .md-splash, .md-connected)";
  const css = `:root{--green:${light.primary};--green-dark:${light.primaryDark};--ink:${light.ink};--muted:${light.muted};--line:${light.line};--surface:${light.surface};--mint:${light.tint};--radius-card:${radius.card}px;--radius-hero:${radius.hero}px;--radius-button:${radius.button}px;--motion-fast:${ms(150)};--motion-base:${ms(220)};--motion-slow:${ms(420)};--motion-distance:${m.distance}px}
${darkScope}{--green:${dark.primary};--green-dark:${dark.primary};--ink:${dark.ink};--muted:${dark.muted};--line:${dark.line};--mint:${dark.tint}}
:root[data-theme='dark'] :is(.dashboard, .dash-fault, .md-splash),:root[data-theme='dark']:has(.dashboard, .dash-fault, .md-splash) body,html[data-theme='dark'] body,html[data-theme='dark'] .bg-\\[\\#f4f8fa\\]{background:${dark.surface}}
:root[data-theme='dark'] :is(.dash-sidebar, .dash-page-header, .dash-stats article, .dash-list, .dash-tile, .dash-empty, .dash-overview-note, .dash-dialog, .dash-more[open], .dash-bottom-nav, .dash-bell-panel),html[data-theme='dark'] .bg-white,html[data-theme='dark'] dialog{background-color:${dark.card};border-color:${dark.line}}
:is(.feature, .dash-tile, .dash-list, .dash-stats article, .dash-empty, .dash-overview-note, .faq-list details, .browser-frame){border-radius:var(--radius-card)}
.dash-page-header,.md-connected section[aria-label='Vehicle health']{border-radius:var(--radius-hero)}
:is(.button, .button-small, .dash-secondary, .auth-card .auth-submit, .md-action){border-radius:var(--radius-button)}
html:not([data-theme='dark']) :is(${NEXT_GREEN.map((c) => '.' + c).join(', ')}){color:${light.primary}}
html:not([data-theme='dark']) .border-\\[\\#087658\\]{border-color:${light.primary}}
html:not([data-theme='dark']) :is(.bg-\\[\\#087658\\], .bg-\\[\\#0b7b5b\\]){background-color:${light.primary}}
html:not([data-theme='dark']) :is(.bg-\\[\\#eaf6f0\\], .hover\\:bg-\\[\\#eaf6f0\\]:hover){background-color:${light.tint}}
html:not([data-theme='dark']) .bg-\\[\\#f4f8fa\\]{background-color:${light.surface}}
html[data-theme='dark'] :is(${NEXT_GREEN.map((c) => '.' + c).join(', ')}){color:${dark.primary}}
html[data-theme='dark'] :is(.bg-\\[\\#087658\\], .bg-\\[\\#0b7b5b\\]){background-color:${dark.primary}}
html[data-theme='dark'] .border-\\[\\#087658\\]{border-color:${dark.primary}}`;
  const off = (on, name) => (on ? [] : [name]);
  const classes = [
    ...off(m.enabled, 'md-no-motion'),
    ...off(m.pixelFill, 'md-no-pixel'),
    ...off(m.openingScreen, 'md-no-splash'),
    ...off(m.scrollReveal, 'md-no-reveal'),
    ...off(site.features.darkMode, 'md-no-darkmode'),
    ...off(site.features.notifications, 'md-no-notifications'),
    ...off(site.features.googleSignIn, 'md-no-google'),
    ...off(site.features.carPhotos, 'md-no-photos'),
    ...off(site.features.reviews, 'md-no-reviews'),
  ];
  return { css, classes };
}
