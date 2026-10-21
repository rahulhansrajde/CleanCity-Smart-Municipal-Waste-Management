import { Router } from 'express';
import Collection from '../models/Collection.js';
import Ward from '../models/Ward.js';
import { ah, clamp, rangeFromQuery, toObjectId } from '../utils.js';
import { collectionTotals } from '../services/stats.js';
import { attachCrud } from './crud.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const { start, end } = rangeFromQuery(req.query, 30);
    const filter = { date: { $gte: start, $lte: end } };

    const ward = toObjectId(req.query.ward);
    const vehicle = toObjectId(req.query.vehicle);
    if (ward) filter.ward = ward;
    else if (req.query.zone) filter.ward = { $in: await Ward.find({ zone: req.query.zone }).distinct('_id') };
    if (vehicle) filter.vehicle = vehicle;
    if (req.query.shift) filter.shift = req.query.shift;
    if (req.query.maxSegregation) filter.segregationRate = { $lt: Number(req.query.maxSegregation) };

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 500);

    const [items, count, summary] = await Promise.all([
      Collection.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('ward', 'name code zone')
        .populate('vehicle', 'registrationNo type')
        .populate('recordedBy', 'name'),
      Collection.countDocuments(filter),
      collectionTotals(filter),
    ]);

    res.json({ items, total: count, page, pages: Math.max(1, Math.ceil(count / limit)), summary });
  })
);

attachCrud(router, Collection, {
  populate: [
    { path: 'ward', select: 'name code zone' },
    { path: 'vehicle', select: 'registrationNo type' },
    { path: 'recordedBy', select: 'name' },
  ],
  writeRoles: ['admin', 'supervisor', 'operator'],
  deleteRoles: ['admin', 'supervisor'],
  beforeSave: async (data, req, existing) => {
    if (!existing) data.recordedBy = req.user._id;
    else delete data.recordedBy;
  },
});

export default router;
