import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/auth/me — return current user info
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
