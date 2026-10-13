import type { ReactNode } from 'react';
import { BASE_PATH } from '../lib/paths';

export default function Splash({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <main className="md-splash">
      <div className="md-splash-logo">
        <img src={`${BASE_PATH}/images/motodoc-logo.svg`} alt="" />
      </div>
      <p className="md-splash-name">MotoDoc</p>
      <div className="md-splash-pixels" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p role="status" className="md-splash-status">
        {message}
      </p>
      {children}
    </main>
  );
}
