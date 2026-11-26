import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { LayoutRouter } from '@/components/LayoutRouter';

export const metadata: Metadata = {
  title: {
    default: 'PackMY — Malaysian Travel Planning Platform',
    template: '%s · PackMY',
  },
  description: 'Destination recommendation and automated itinerary planning for Malaysian tourism.',
  icons: {
    icon: '/img/logo-full.png',
  },
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('packmy-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased selection:bg-brand-500/20 selection:text-brand-900 dark:selection:text-brand-100">
        <AppProvider>
          <LayoutRouter>{children}</LayoutRouter>
        </AppProvider>
      </body>
    </html>
  );
}
