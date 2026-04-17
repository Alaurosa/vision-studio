import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import Studio from '@/pages/Studio';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-paper-50 text-ink-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/studio/:roomId" element={<Studio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
