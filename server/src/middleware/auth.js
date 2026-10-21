import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'cleancity-dev-secret-change-me';

export const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(id);
    if (!user || !user.active) return res.status(401).json({ message: 'Session is no longer valid' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'You do not have permission to perform this action' });
