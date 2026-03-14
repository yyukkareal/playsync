// src/app/layout.tsx
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata = {
  title: 'PlaySync',
  description: 'Đồng bộ lịch học TMU vào Google Calendar',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-neutral-100 text-slate-900 antialiased">
        <main className="flex min-h-screen w-full items-center justify-center overflow-hidden px-0">
          {children}
        </main>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
