import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, useSearchParams, useParams } from 'react-router-dom';
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
const StudioNewWizard = lazy(() => import('@/pages/StudioNewWizard'));
const Chat = lazy(() => import('@/pages/Chat'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** Legacy /upload → guided wizard (preserve query e.g. projectId). */
function UploadToWizardRedirect() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  if (!next.get('startMode')) next.set('startMode', 'upload');
  return <Navigate to={`/studio/new?${next.toString()}`} replace />;
}

/** Old project hub deep link /studio/project/:id/:spaceId → editor route. */
function LegacyProjectSpaceRedirect() {
  const { projectId, legacySpaceId } = useParams();
  if (!projectId || !legacySpaceId) return <Navigate to="/studio" replace />;
  if (['confirm', 'vision', 'editor', 'chat'].includes(legacySpaceId)) {
    return <Navigate to="/studio" replace />;
  }
  return <Navigate to={`/studio/project/${projectId}/editor/${legacySpaceId}`} replace />;
}

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
  const hideFooterOnChat = pathname === '/chat';
  const hideGlobalChrome =
    /^\/studio\/project\/[^/]+\/editor/.test(pathname) ||
    /^\/studio\/project\/[^/]+\/vision/.test(pathname) ||
    /^\/studio\/project\/[^/]+\/chat/.test(pathname);

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
        {!hideGlobalChrome && <Navbar />}
        <main id="main-content" className={`flex-1 ${hideGlobalChrome ? '' : 'pt-16'}`}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                {/* All features accessible without auth (guest/draft mode) */}
                <Route path="/upload" element={<UploadToWizardRedirect />} />
                <Route path="/studio/new" element={<StudioNewWizard />} />
                <Route path="/studio/project/:projectId/confirm" element={<Studio />} />
                <Route path="/studio/project/:projectId/vision" element={<Studio />} />
                <Route path="/studio/project/:projectId/chat" element={<Chat />} />
                <Route path="/studio/project/:projectId/editor/:editorSpaceId" element={<Studio />} />
                <Route path="/studio/project/:projectId/editor" element={<Studio />} />
                <Route path="/studio/project/:projectId/:legacySpaceId" element={<LegacyProjectSpaceRedirect />} />
                <Route path="/studio/project/:projectId" element={<Studio />} />
                <Route path="/studio/:roomId" element={<Studio />} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        {!hideGlobalChrome && !hideFooterOnChat && <Footer />}
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
