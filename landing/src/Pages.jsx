import { useEffect } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { Brand } from './Brand.jsx';
import { RichText, useSite } from './site.jsx';
import './pages.css';

const EMAIL = 'info@motodoc.app';
const mail = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

export function Proof() {
  const { content, images } = useSite(),
    { product, faq } = content;
  return (
    <>
      <section className="section proof-section" id="product" aria-labelledby="proof-heading">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">{product.eyebrow}</span>
            <h2 id="proof-heading">{product.title}</h2>
            <p>{product.text}</p>
          </div>
          <figure className="browser-frame">
            <div className="browser-bar" aria-hidden="true">
              <span />
              <span />
              <span />
              <p>motodoc.app/dashboard</p>
            </div>
            <img
              src={images.product}
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
            {faq.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <div className="faq-answer">
                  <RichText text={answer} />
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function InfoPage({ kind }) {
  const page = useSite().content.legal[kind];
  useEffect(() => {
    document.title = `${page.title} — MotoDoc`;
    window.scrollTo(0, 0);
  }, [page]);
  return (
    <div className="info-page">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <span data-lang-switch />
          <a className="auth-home" href="/">
            <ArrowLeftIcon size={17} aria-hidden="true" /> Back to home
          </a>
        </div>
      </header>
      <main className="container info-main">
        <span className="eyebrow">MOTODOC</span>
        <h1>{page.title}</h1>
        <p className="info-intro">{page.intro}</p>
        {page.updated && <p className="info-updated">Last updated {page.updated}</p>}
        <div className="info-body">
          <RichText text={page.body} />
        </div>
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
