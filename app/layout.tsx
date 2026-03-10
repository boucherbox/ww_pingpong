import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ping Pong Tournament',
  description: 'Live tournament bracket, match schedule, and leaderboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
