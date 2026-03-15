// src/app/layout.tsx
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata = {
  title: 'luu.tkb',
  description: 'Lưu thời khóa biểu TMU vào Google Calendar hoặc Apple Calendar',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-white text-slate-900 antialiased overflow-hidden lg:bg-neutral-100">
        <main className="flex h-screen w-full items-start justify-center overflow-hidden px-0 sm:items-center sm:px-4">
          {children}
        </main>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
