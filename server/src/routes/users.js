import { Router } from 'express';
import User from '../models/User.js';
import { authorize } from '../middleware/auth.js';
import { ah, httpError } from '../utils.js';
import { attachCrud } from './crud.js';

const router = Router();

router.use(authorize('admin'));

router.get(
  '/',
  ah(async (_req, res) => {
    res.json(await User.find().sort({ role: 1, name: 1 }));
  })
);

attachCrud(router, User, {
  writeRoles: ['admin'],
  deleteRoles: ['admin'],
  beforeSave: async (data, req, existing) => {
    if (!data.password) delete data.password;
    if (existing && String(existing._id) === String(req.user._id) && data.active === false)
      throw httpError(400, 'You cannot deactivate your own account');
  },
  beforeDelete: async (doc, req) => {
    if (String(doc._id) === String(req.user._id)) throw httpError(400, 'You cannot delete your own account');
  },
});

export default router;
