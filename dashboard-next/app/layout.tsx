import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: 'Your car — MotoDoc', description: 'Your vehicle, bookings and garage in MotoDoc.' };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body className="font-sans antialiased">{children}</body></html>;
}
