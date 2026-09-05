import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZANEVA BrandOps',
  description: 'Brand Operations Management System — ZANEVA Holding',
  applicationName: 'ZANEVA BrandOps',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180' }],
  },
  themeColor: '#0A0E1A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
