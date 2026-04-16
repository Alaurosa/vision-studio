import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/auth/AuthGuard';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import { ToastContainer } from './components/ui/Toast';

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route
          path="/editor/:roomId"
          element={
            <AuthGuard>
              <Editor />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
