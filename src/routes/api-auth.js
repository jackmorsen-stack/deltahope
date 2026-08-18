import { Router } from 'express';
import { loginLimiter } from '../security.js';
import { login, logout } from '../auth.js';

const router = Router();

// Admin/HR authentication
router.post('/login', loginLimiter, login);
router.post('/logout', logout);

router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ user: req.session.user });
});

export default router;