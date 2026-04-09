import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Vision Studios',
  description: 'Frontend skeleton for AI-powered room design',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <Navbar />
          <main className="mt-6 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
