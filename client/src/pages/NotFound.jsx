import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-lg text-center"
      >
        <div className="font-display text-[8rem] leading-none text-ink-300 mb-4">
          404
        </div>
        <h1 className="display-md mb-4">Page not found</h1>
        <p className="text-ink-600 leading-relaxed mb-10">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/" className="btn-ink">Back to Home</Link>
          <Link to="/studio" className="btn-ghost">Open Studio</Link>
        </div>
      </motion.div>
    </div>
  );
}
