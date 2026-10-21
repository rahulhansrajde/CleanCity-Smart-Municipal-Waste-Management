import { Router } from 'express';
import Ward from '../models/Ward.js';
import RecyclingPlant from '../models/RecyclingPlant.js';
import Landfill from '../models/Landfill.js';
import ServiceRequest, { ACTIVE_STATUS } from '../models/ServiceRequest.js';
import { authorize } from '../middleware/auth.js';
import { ah, DAY } from '../utils.js';
import { CITY, createRandomRequest, fleetSnapshot, getSim, setSim } from '../services/simulation.js';

const router = Router();
const controllers = authorize('admin', 'supervisor');

// Fixed map features. Citizens only get ward centres.
router.get(
  '/places',
  ah(async (req, res) => {
    const wards = await Ward.find({ lat: { $ne: null } }).select('code name zone lat lng').sort('code').lean();
    if (req.user.role === 'citizen') return res.json({ city: CITY, wards, plants: [], landfills: [] });
    const [plants, landfills] = await Promise.all([
      RecyclingPlant.find({ lat: { $ne: null } }).select('code name type status lat lng').lean(),
      Landfill.find({ lat: { $ne: null } }).select('code name status lat lng').lean(),
    ]);
    res.json({ city: CITY, wards, plants, landfills });
  })
);

// Moving parts: trucks, requests and simulation settings.
router.get(
  '/',
  ah(async (req, res) => {
    const citizen = req.user.role === 'citizen';
    const filter = citizen
      ? { citizen: req.user._id }
      : { $or: [{ status: { $in: ACTIVE_STATUS } }, { resolvedAt: { $gte: new Date(Date.now() - DAY / 48) } }] };
    const requests = await ServiceRequest.find(filter)
      .sort({ reportedAt: -1 })
      .limit(citizen ? 30 : 120)
      .populate('ward', 'name code')
      .populate('vehicle', 'registrationNo type')
      .lean();
    const mine = citizen ? new Set(requests.filter((r) => ACTIVE_STATUS.includes(r.status)).map((r) => String(r._id))) : null;
    res.json({ sim: getSim(), vehicles: fleetSnapshot(mine), requests });
  })
);

router.post('/sim', controllers, (req, res) => res.json(setSim(req.body || {})));

router.post(
  '/sim/random',
  controllers,
  ah(async (_req, res) => {
    const id = await createRandomRequest();
    res.status(201).json({ id });
  })
);

export default router;
