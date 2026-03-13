// src/app/layout.tsx
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'PlaySync',
  description: 'Đồng bộ lịch học TMU vào Google Calendar',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-neutral-100 text-slate-900 antialiased">
        <main className="flex min-h-screen items-center justify-center">
          {children}
        </main>
      </body>
    </html>
  );
}