import type { ReactNode } from 'react';
import { BASE_PATH } from '../lib/paths';

/** Opening screen: the logo builds up in pixel steps from its bottom-left corner. Styles are in app/globals.css. */
export default function Splash({ message, children }: { message: string; children?: ReactNode }) {
  return <main className="md-splash">
    {/* eslint-disable-next-line @next/next/no-img-element -- the clip-path animation needs a plain image */}
    <div className="md-splash-logo"><img src={`${BASE_PATH}/images/motodoc-logo.png`} alt="" /></div>
    <p className="md-splash-name">MotoDoc</p>
    <div className="md-splash-pixels" aria-hidden="true"><span /><span /><span /><span /><span /></div>
    <p role="status" className="md-splash-status">{message}</p>
    {children}
  </main>;
}
