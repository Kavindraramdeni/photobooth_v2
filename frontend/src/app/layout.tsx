import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SnapBooth AI - Next-Gen Photobooth Platform',
  description: 'Turn events into viral memories with Apple-grade tactile iPad photobooths, AI transformations, and instant QR delivery.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SnapBooth AI',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f8f9fc',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-[#f8f9fc] text-slate-900 antialiased font-sans selection:bg-purple-500/20 selection:text-purple-700 min-h-screen">
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'rgba(255, 255, 255, 0.92)',
                color: '#0f172a',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '18px',
                fontSize: '13px',
                fontWeight: '600',
                padding: '12px 18px',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12)',
              },
              duration: 3200,
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
