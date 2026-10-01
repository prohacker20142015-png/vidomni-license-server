import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VidOmni AI Studio Pro — Cloud License & Key Manager',
  description: 'Serverless License and API Key Manager hosted on Vercel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="bg-background text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
