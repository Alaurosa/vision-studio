import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy-loaded pages for code-splitting
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));
const Upload = lazy(() => import('@/pages/Upload'));
const Studio = lazy(() => import('@/pages/Studio'));
const Chat = lazy(() => import('@/pages/Chat'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-ink-300 border-t-ink-900 rounded-full animate-spin" />
        <span className="eyebrow text-ink-500">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <HelmetProvider>
      <Helmet>
        <title>Vision Studio — AI-Powered Spatial Layout Engine</title>
        <meta
          name="description"
          content="Upload a floorplan, let AI detect rooms and dimensions, then design layouts with real IKEA and Ashley furniture. Export to JSON, SVG, or DXF."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-paper-50 text-ink-900">
        <Navbar />
        <main id="main-content" className="flex-1 pt-16">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                {/* All features accessible without auth (guest/draft mode) */}
                <Route path="/upload" element={<Upload />} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/studio/:roomId" element={<Studio />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#100f0d',
            color: '#faf7f1',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            borderRadius: '9999px',
            padding: '12px 20px',
            letterSpacing: '0.02em',
          },
          success: {
            iconTheme: { primary: '#4f8f6b', secondary: '#faf7f1' },
          },
          error: {
            iconTheme: { primary: '#b35c42', secondary: '#faf7f1' },
            duration: 5000,
          },
        }}
      />
    </HelmetProvider>
  );
}
