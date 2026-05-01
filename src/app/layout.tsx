import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZANEVA BrandOps',
  description: 'Brand Operations Management System — ZANEVA Holding',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
