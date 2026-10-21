import { Router } from 'express';
import User from '../models/User.js';
import { protect, signToken } from '../middleware/auth.js';
import { ah, httpError } from '../utils.js';

const router = Router();

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw httpError(400, 'Email and password are required');
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
    if (!user || !(await user.matchPassword(String(password)))) throw httpError(401, 'Invalid email or password');
    if (!user.active) throw httpError(403, 'This account has been deactivated');
    res.json({ token: signToken(user), user });
  })
);

// Public sign-up is for citizens only; staff accounts are created by an admin.
router.post(
  '/register',
  ah(async (req, res) => {
    const { name, email, phone, password } = req.body || {};
    if (!name || !email || !password) throw httpError(400, 'Name, email and password are required');
    if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');
    const user = await User.create({ name, email, phone, password, role: 'citizen', department: 'Citizen' });
    res.status(201).json({ token: signToken(user), user });
  })
);

router.get('/me', protect, (req, res) => res.json(req.user));

router.put(
  '/me',
  protect,
  ah(async (req, res) => {
    const { name, phone, department, currentPassword, newPassword } = req.body || {};
    const user = await User.findById(req.user._id).select('+password');
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (newPassword) {
      if (!currentPassword || !(await user.matchPassword(String(currentPassword))))
        throw httpError(400, 'Current password is incorrect');
      user.password = newPassword;
    }
    await user.save();
    res.json(user);
  })
);

export default router;
