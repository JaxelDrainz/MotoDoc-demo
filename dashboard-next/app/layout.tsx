import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Your car — MotoDoc',
  description: 'Your vehicle, bookings and garage in MotoDoc.',
};
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/i18n.js" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var r=document.documentElement;r.dataset.theme=localStorage.getItem('motodoc-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var s=JSON.parse(localStorage.getItem('motodoc-site')||'null');if(s&&s.style){var t=document.createElement('style');t.id='motodoc-site-style';t.textContent=s.style.css;document.head.appendChild(t);r.classList.add.apply(r.classList,s.style.classes);if(s.style.classes.indexOf('md-no-darkmode')>=0)r.dataset.theme='light'}}catch(e){}",
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
