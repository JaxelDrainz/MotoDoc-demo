import { useEffect, useRef, useState } from 'react';
import { AuthPage } from './AuthPage.jsx';
import { Dashboard } from './Dashboard.jsx';
import {
  ArrowRightIcon, ArrowUpRightIcon, BellIcon, CalendarBlankIcon,
  CarIcon, ChartLineUpIcon, CheckCircleIcon,
  ClockCounterClockwiseIcon, CreditCardIcon, GiftIcon, ListIcon,
  MapPinIcon, ReceiptIcon, SealCheckIcon, ShieldCheckIcon,
  StorefrontIcon, UsersIcon, WrenchIcon, XIcon,
} from '@phosphor-icons/react';

const APP_URL = '/login';
const driverFeatures = [
  { icon: MapPinIcon, title: 'Find your trusted garage', text: 'Discover trusted garages near you and stay connected to your mechanic.' },
  { icon: CalendarBlankIcon, title: 'Book appointments', text: 'Book with trusted garages directly — no calls needed.' },
  { icon: ClockCounterClockwiseIcon, title: 'Service history', text: 'Track every repair and service in one place.' },
  { icon: GiftIcon, title: 'Membership benefits', text: 'Unlock discounts and perks from your mechanic.' },
  { icon: CreditCardIcon, title: 'Bills & payments', text: 'Keep service invoices and payment records together.' },
  { icon: BellIcon, title: 'Smart reminders', text: 'Keep inspection and maintenance dates in view.' },
];
const garageFeatures = [
  { icon: StorefrontIcon, title: 'Garage profile', text: 'Show drivers your services and where to find you.' },
  { icon: UsersIcon, title: 'Customer CRM', text: 'Keep customer history, private notes, and tags together.' },
  { icon: SealCheckIcon, title: 'Membership programs', text: 'Create plans with your own pricing and benefits.' },
  { icon: CalendarBlankIcon, title: 'Booking management', text: 'Review requests and confirm each appointment.' },
  { icon: ChartLineUpIcon, title: 'Garage overview', text: 'See upcoming work, completed services, and invoice totals.' },
  { icon: ReceiptIcon, title: 'Invoicing & records', text: 'Create service invoices and record payments received.' },
];
const benefits = [
  [ShieldCheckIcon, 'Trusted garages'], [CalendarBlankIcon, 'Easy booking'],
  [ClockCounterClockwiseIcon, 'Service history'], [GiftIcon, 'Member benefits'],
];
const steps = [
  { icon: CarIcon, title: 'Add your car', text: 'Register your vehicle in seconds. All its information, in one profile.' },
  { icon: WrenchIcon, title: 'Choose your mechanic', text: 'Find trusted garages near you and connect with the right one.' },
  { icon: CalendarBlankIcon, title: 'Book & unlock benefits', text: 'Book services, track your history, and activate your perks.' },
];

function Brand({ footer = false }) {
  return <a href="#top" className={`brand${footer ? ' brand-footer' : ''}`} aria-label="MotoDoc home">MotoDoc</a>;
}

function Feature({ feature, compact = false }) {
  const Icon = feature.icon;
  return <article className={`feature${compact ? ' feature-compact' : ''}`}>
    <Icon className="feature-icon" size={29} weight="regular" aria-hidden="true" />
    <h3>{feature.title}</h3><p>{feature.text}</p>
  </article>;
}

function InfoDialog({ type, onClose }) {
  const dialog = useRef(null);
  const returnFocus = useRef(document.activeElement);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const node = dialog.current;
    node.showModal();
    document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previousOverflow; returnFocus.current?.focus(); };
  }, []);
  return <dialog ref={dialog} className="start-dialog info-dialog" aria-labelledby="info-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="icon-button dialog-close" onClick={onClose} aria-label="Close information"><XIcon size={22} /></button>
    <span className="eyebrow">MOTODOC</span><h2 id="info-title">{type}</h2>
    {type === 'About MotoDoc' ? <p>MotoDoc connects drivers and garages. Find a trusted mechanic, book services, keep your vehicle history together, and discover membership benefits — all in one place.</p>
      : <><p>The published {type.toLowerCase()} has not been supplied for this design preview.</p><p>For current information, contact the MotoDoc team.</p></>}
    <a className="text-link" href="mailto:info@motodoc.app">info@motodoc.app <ArrowUpRightIcon size={18} /></a>
  </dialog>;
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const menuButton = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = event => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);
  const openStart = role => { window.location.assign(role === 'garage' ? '/signup?role=garage' : '/signup'); };
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header" id="top">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#features">Features</a><a href="#membership">Membership</a><a href="#how-it-works">How it works</a>
        </nav>
        <div className="header-actions"><a className="login-link" href={APP_URL}>Log in</a><button className="button button-small" onClick={() => openStart('driver')}>Get started</button></div>
        <button ref={menuButton} className="icon-button menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <XIcon size={25} /> : <ListIcon size={25} />}</button>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#membership" onClick={() => setMenuOpen(false)}>Membership</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#garages" onClick={() => setMenuOpen(false)}>For garages</a><a href={APP_URL}>Log in</a>
      </nav>}
    </header>

    <main id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1 id="hero-title">Your car.<br />Your mechanic.</h1>
            <p className="hero-tagline">All in one place.</p>
            <p className="hero-description">Book a trusted garage, keep your service history together, and enjoy benefits from your mechanic.</p>
            <div className="hero-actions"><button className="button" onClick={() => openStart('driver')}>Get started</button><a className="text-link" href="#garages">For garage owners <ArrowRightIcon size={23} aria-hidden="true" /></a></div>
          </div>
          <div className="hero-visual">
            <img className="hero-art" src="/assets/mechanic-hero.png" alt="A mechanic caring for a car, illustrated in green." width="1536" height="1024" fetchPriority="high" />
            <div className="appointment-card" aria-label="Example upcoming service: Oil change at AutoFix Tampere, Monday at 10:00">
              <CheckCircleIcon size={21} weight="fill" className="confirmation-icon" aria-hidden="true" />
              <div><p className="appointment-label">Upcoming service</p><p className="appointment-title">Oil change</p><p className="appointment-meta">AutoFix Tampere · Mon, 10:00</p></div>
            </div>
          </div>
        </div>
        <div className="container benefits" aria-label="MotoDoc benefits">{benefits.map(([Icon, label]) => <div className="benefit" key={label}><Icon size={29} weight="regular" aria-hidden="true" /><span>{label}</span></div>)}</div>
      </section>

      <section id="features" className="section drivers-section" aria-labelledby="drivers-heading">
        <div className="container" id="drivers">
          <div className="section-heading"><span className="eyebrow">FOR DRIVERS</span><h2 id="drivers-heading">Your car care,<br className="mobile-break" /> clearly organised.</h2><p>Everything your car needs, in one place. From the next service to the last repair, stay connected to the people who keep you moving.</p></div>
          <div className="driver-grid">{driverFeatures.map(feature => <Feature key={feature.title} feature={feature} />)}</div>
          <figure className="context-photo"><img src="/assets/garage-visit.png" alt="A driver and mechanic reviewing a service note together beside a car in a garage." loading="lazy" width="1536" height="1024" /><figcaption><span>GOOD CAR CARE STARTS WITH TRUST</span><strong>Know the people who care for your car.</strong></figcaption></figure>
          <div className="section-bottom"><p>Less to keep track of. More peace of mind.</p><button className="text-link" onClick={() => openStart('driver')}>Get started with MotoDoc <ArrowRightIcon size={21} aria-hidden="true" /></button></div>
        </div>
      </section>

      <section className="section garage-section" id="garages" aria-labelledby="garages-heading">
        <div className="container garage-layout">
          <div className="garage-intro"><span className="eyebrow">FOR GARAGES</span><h2 id="garages-heading">Your garage.<br />Fully connected.</h2><p>Manage bookings, memberships, service records, and communication in one place — built for modern car care.</p><button className="button button-outline" onClick={() => openStart('garage')}>Register your garage <ArrowRightIcon size={20} aria-hidden="true" /></button><div className="garage-caption"><WrenchIcon size={22} aria-hidden="true" /><span>More time for what you do best.</span></div><img className="garage-photo" src="/assets/garage-work.png" alt="A mechanic inspecting a car engine in a bright workshop." loading="lazy" width="1024" height="1365" /></div>
          <div className="garage-grid">{garageFeatures.map(feature => <Feature key={feature.title} feature={feature} compact />)}</div>
        </div>
      </section>

      <section className="membership-section" id="membership" aria-labelledby="membership-heading">
        <div className="container membership-layout">
          <div><span className="eyebrow">A LITTLE MORE, FROM YOUR MECHANIC</span><h2 id="membership-heading">A trusted garage.<br />Benefits that stay with you.</h2><p>Get more from the garage you already know. Discover memberships with service discounts, priority booking, and perks from your mechanic.</p><button className="text-link" onClick={() => openStart('driver')}>Explore member benefits <ArrowRightIcon size={21} aria-hidden="true" /></button></div>
          <div className="membership-perks">
            {[[GiftIcon, 'Service discounts', 'More value when it’s time to look after your car.'], [CalendarBlankIcon, 'Priority booking', 'A little extra convenience for your next visit.'], [SealCheckIcon, 'Garage perks', 'Benefits created by your mechanic, for their members.']].map(([Icon, title, text]) => <div className="perk" key={title}><Icon size={29} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></div>)}
            <p className="membership-note">Memberships and benefits vary by garage.</p>
          </div>
        </div>
      </section>

      <section className="section steps-section" id="how-it-works" aria-labelledby="steps-heading">
        <div className="container"><div className="section-heading steps-heading"><span className="eyebrow">HOW IT WORKS</span><h2 id="steps-heading">Simple by design.</h2><p>Up and running in three steps.</p></div>
          <ol className="steps">{steps.map((step, index) => { const Icon = step.icon; return <li key={step.title}><div className="step-top"><span className="step-number">0{index + 1}</span><Icon size={31} aria-hidden="true" /></div><h3>{step.title}</h3><p>{step.text}</p></li>; })}</ol>
        </div>
      </section>

      <section className="closing-section" aria-labelledby="closing-heading"><div className="container closing-inner"><div><span className="eyebrow">CAR CARE MADE EASY</span><h2 id="closing-heading">Your mechanic.<br />Your service. Your MotoDoc.</h2><p>Find a garage you can trust. Book services, track maintenance, and unlock member benefits — all in one app.</p></div><div className="closing-actions"><button className="button button-white" onClick={() => openStart('driver')}>Get early access <ArrowRightIcon size={20} aria-hidden="true" /></button><button className="text-link" onClick={() => openStart('garage')}>Register your garage <ArrowRightIcon size={20} aria-hidden="true" /></button></div></div></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-main"><div className="footer-brand"><Brand footer /><p>The platform that connects drivers and garages. Digital car care, simplified.</p><a href="mailto:info@motodoc.app">info@motodoc.app</a></div>
      <nav aria-label="Driver links"><h3>For drivers</h3><a href="#drivers">Vehicle management</a><a href="#drivers">Service booking</a><a href="#drivers">Service history</a><a href="#drivers">Reminders</a></nav>
      <nav aria-label="Garage links"><h3>For garages</h3><a href="#garages">Customer CRM</a><a href="#garages">Booking management</a><a href="#membership">Memberships</a><a href="#garages">Analytics</a></nav>
      <nav aria-label="Company links"><h3>Company</h3><button onClick={() => setInfo('About MotoDoc')}>About</button><a href="mailto:info@motodoc.app">Contact</a><button onClick={() => setInfo('Privacy policy')}>Privacy policy</button><button onClick={() => setInfo('Terms of service')}>Terms of service</button></nav>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} MotoDoc. All rights reserved.</span><span>Made in Finland</span></div></div></footer>
    {info && <InfoDialog type={info} onClose={() => setInfo(null)} />}
  </>;
}

export function App() {
  const path = window.location.pathname.replace(/\/$/, "");
  if (path === "/app") return <Dashboard />;
  if (path === "/reset-password") return <AuthPage mode="reset" />;
  if (path === "/login" || path === "/auth") return <AuthPage mode="login" />;
  if (path === "/signup") return <AuthPage mode="signup" />;
  if (path === "/forgot-password") return <AuthPage mode="recovery" />;
  return <LandingPage />;
}
