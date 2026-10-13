import { useEffect } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { Brand } from './Brand.jsx';
import './pages.css';

const UPDATED = '13 October 2026';
const EMAIL = 'info@motodoc.app';
const mail = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

const faqs = [
  [
    'How do I book a service?',
    'Add your car, find a listed garage, and pick a free hour from its calendar. Your request goes to the garage, which confirms it. You can move or cancel an upcoming booking from your dashboard.',
  ],
  [
    'Does MotoDoc take payment?',
    'No. Garages can record invoices and payments they have received, so both sides see the same record, but the payment itself is arranged directly between you and the garage.',
  ],
  [
    'Where do the oil life, brake wear and inspection readings come from?',
    'You enter them yourself from your car or your last inspection report. They are not live sensor data, and MotoDoc shows “Not recorded” until you add them.',
  ],
  [
    'Can I talk to my garage in MotoDoc?',
    'Yes. Every booking has its own message thread, and the bell shows new messages, confirmations and reminders that are due.',
  ],
  [
    'How does a garage join?',
    'Create a garage account, complete the profile with your services, contact details and opening hours, and publish it. Drivers can then find and book you.',
  ],
  [
    'What happens to my data?',
    <>
      Your account, vehicles, bookings and messages are stored so the service works, and are shared
      only with the garages you book. The details are in the <a href="/privacy">privacy policy</a>.
    </>,
  ],
];

export function Proof() {
  return (
    <>
      <section className="section proof-section" id="product" aria-labelledby="proof-heading">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">THE PRODUCT</span>
            <h2 id="proof-heading">Your car, on one screen.</h2>
            <p>
              The driver dashboard shows your car’s readings, your next service and the garage
              looking after it. This is the real app, shown with demo data.
            </p>
          </div>
          <figure className="browser-frame">
            <div className="browser-bar" aria-hidden="true">
              <span />
              <span />
              <span />
              <p>motodoc.app/dashboard</p>
            </div>
            <img
              src="/assets/product-dashboard.webp"
              width="2560"
              height="1460"
              loading="lazy"
              alt="MotoDoc driver dashboard showing a Volvo XC60 with oil life, brake wear and inspection countdown, an upcoming confirmed oil service, and the connected workshop with its rating and contact buttons."
            />
          </figure>
        </div>
      </section>
      <section className="section faq-section" id="faq" aria-labelledby="faq-heading">
        <div className="container faq-layout">
          <div className="section-heading">
            <span className="eyebrow">QUESTIONS</span>
            <h2 id="faq-heading">Good to know.</h2>
            <p>Still unsure about something? Write to {mail}.</p>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

const pages = {
  privacy: {
    title: 'Privacy policy',
    intro:
      'This policy explains what MotoDoc stores about you, why, who can see it, and what you can ask us to do with it.',
    sections: [
      [
        'Who is responsible',
        <p key="a">
          MotoDoc is run by the MotoDoc team. For any privacy question or request, write to {mail}.
        </p>,
      ],
      [
        'What we store',
        <ul key="a">
          <li>
            <strong>Your account:</strong> name, email address and role (driver or garage). Your
            password is stored only as a salted scrypt hash, never in readable form. If you use
            Google Sign-In we store your Google account identifier.
          </li>
          <li>
            <strong>Drivers:</strong> your vehicles (make, model, year, registration, mileage), the
            readings you enter, bookings, service records, reviews, reminders and membership
            requests.
          </li>
          <li>
            <strong>Garages:</strong> your public profile, services, contact details, opening hours,
            plans, invoices you record, and private notes you keep about your customers.
          </li>
          <li>
            <strong>Both:</strong> messages you exchange about a booking, and a profile photo or
            logo if you upload one.
          </li>
        </ul>,
      ],
      [
        'Why we use it',
        <p key="a">
          To run the service you asked for: signing you in, showing your cars and bookings, passing
          booking requests and messages between drivers and garages, and reminding you of due dates.
          We do not sell your data and we do not use it for advertising.
        </p>,
      ],
      [
        'Who can see it',
        <ul key="a">
          <li>
            A garage you book with sees your name, photo, the vehicle and service booked, your
            messages and your rating of the service.
          </li>
          <li>
            A driver sees a garage’s public profile, contact details, average rating and messages.
          </li>
          <li>
            Our hosting and database providers (Vercel and Turso) process the data on our behalf so
            the service can run.
          </li>
        </ul>,
      ],
      [
        'Cookies and browser storage',
        <p key="a">
          MotoDoc sets one cookie, <code>motodoc_session</code>, which keeps you signed in for up to
          seven days. It is strictly necessary and cannot be read by scripts. Your light or dark
          mode choice is kept in your browser’s local storage. We use no advertising or analytics
          cookies.
        </p>,
      ],
      [
        'Other services we call',
        <ul key="a">
          <li>
            <strong>Google Sign-In</strong>, only if you choose to sign in with Google.
          </li>
          <li>
            <strong>Wikipedia and Wikimedia Commons</strong>, to find a photo of a car model. We
            send only the make and model. The photo itself loads from Wikimedia’s servers, which
            therefore see your IP address.
          </li>
          <li>
            <strong>NHTSA vehicle database</strong>, to look up a make or model that is not in our
            own catalogue. We send only the text you typed in the make or model field.
          </li>
        </ul>,
      ],
      [
        'How long we keep it',
        <p key="a">
          We keep your data while your account exists. To close your account and have your data
          deleted, write to {mail}. Service records and invoices a garage has recorded may be kept
          where the garage is legally required to retain them.
        </p>,
      ],
      [
        'Your rights',
        <p key="a">
          You can ask for a copy of your data, have it corrected or deleted, object to or restrict
          how we use it, and receive it in a portable format. Write to {mail} and we will answer
          within one month. If you are in the EU or EEA you may also complain to your national data
          protection authority.
        </p>,
      ],
    ],
  },
  terms: {
    title: 'Terms of service',
    intro: 'These terms apply when you create a MotoDoc account or use the service.',
    sections: [
      [
        'What MotoDoc is',
        <p key="a">
          MotoDoc connects drivers with independent garages. Drivers keep their vehicle details,
          book services and message garages; garages manage bookings, customers, plans and invoice
          records. MotoDoc is not a garage and does not carry out any repair or service itself.
        </p>,
      ],
      [
        'Your account',
        <p key="a">
          Give accurate details, keep your password to yourself, and tell us at {mail} if you think
          someone else has used your account. You are responsible for what is done through it.
        </p>,
      ],
      [
        'Bookings',
        <p key="a">
          A booking is a request until the garage confirms it. Either side can cancel an upcoming
          booking in the app. The work, its quality, its price and any warranty are agreed between
          the driver and the garage.
        </p>,
      ],
      [
        'Payments and invoices',
        <p key="a">
          MotoDoc does not take or process payments. Invoices and “paid” markers in the app are
          records kept by the garage. Membership plans are offers made by garages, and their price
          and billing are arranged with the garage directly.
        </p>,
      ],
      [
        'Vehicle information',
        <p key="a">
          Readings such as oil life, brake wear and inspection dates are entered by you and shown as
          you entered them. Car photos are general photos of the model from Wikimedia Commons, not
          of your vehicle. Do not rely on MotoDoc in place of your car’s own warnings, the
          manufacturer’s service schedule or a mechanic’s advice.
        </p>,
      ],
      [
        'Reviews and messages',
        <p key="a">
          You may rate a service only after it has been completed. Keep reviews and messages honest
          and lawful. We may remove content or close accounts that are abusive, fraudulent or misuse
          the service.
        </p>,
      ],
      [
        'Availability and liability',
        <p key="a">
          We work to keep MotoDoc available and accurate but provide it as it is, without a
          guarantee of uninterrupted service. To the extent the law allows, MotoDoc is not liable
          for the work of garages, for missed bookings, or for indirect losses. Nothing in these
          terms limits rights you have under consumer law that cannot be excluded.
        </p>,
      ],
      [
        'Changes',
        <p key="a">
          If we change these terms in a way that matters, we will tell you in the app or by email
          before the change takes effect. You can stop using MotoDoc and ask us to close your
          account at any time.
        </p>,
      ],
    ],
  },
  contact: {
    title: 'Contact',
    intro: 'Questions about MotoDoc, your account, or listing your garage? We are glad to help.',
    sections: [
      [
        'Email',
        <p key="a">
          Write to {mail}. Tell us whether you are a driver or a garage and, for account questions,
          the email address you signed up with.
        </p>,
      ],
      [
        'A problem with a booking or a service',
        <p key="a">
          Message the garage first from the booking in your account; they can see the details and
          answer fastest. If that does not resolve it, write to us.
        </p>,
      ],
      [
        'Your data',
        <p key="a">
          To get a copy of your data or have your account deleted, see the{' '}
          <a href="/privacy">privacy policy</a> and write to {mail}.
        </p>,
      ],
    ],
  },
};

export function InfoPage({ kind }) {
  const page = pages[kind];
  useEffect(() => {
    document.title = `${page.title} — MotoDoc`;
    window.scrollTo(0, 0);
  }, [page]);
  return (
    <div className="info-page">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <a className="auth-home" href="/">
            <ArrowLeftIcon size={17} aria-hidden="true" /> Back to home
          </a>
        </div>
      </header>
      <main className="container info-main">
        <span className="eyebrow">MOTODOC</span>
        <h1>{page.title}</h1>
        <p className="info-intro">{page.intro}</p>
        {kind !== 'contact' && <p className="info-updated">Last updated {UPDATED}</p>}
        {page.sections.map(([heading, body]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            {body}
          </section>
        ))}
      </main>
      <footer className="container info-footer">
        <span>© {new Date().getFullYear()} MotoDoc</span>
        <nav aria-label="Legal">
          <a href="/privacy">Privacy policy</a>
          <a href="/terms">Terms of service</a>
          <a href="/contact">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
