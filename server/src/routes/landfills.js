import { Router } from 'express';
import Landfill from '../models/Landfill.js';
import LandfillEntry from '../models/LandfillEntry.js';
import { authorize } from '../middleware/auth.js';
import { ah, httpError, rangeFromQuery } from '../utils.js';
import { landfillStats } from '../services/stats.js';
import { attachCrud } from './crud.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const { start, end, days } = rangeFromQuery(req.query, 30);
    res.json(await landfillStats(start, end, days));
  })
);

router.get(
  '/:id/entries',
  ah(async (req, res) => {
    const { start, end } = rangeFromQuery(req.query, 60);
    const entries = await LandfillEntry.find({ landfill: req.params.id, date: { $gte: start, $lte: end } })
      .sort({ date: -1, createdAt: -1 })
      .populate('sourceWard', 'name code')
      .populate('vehicle', 'registrationNo')
      .populate('recordedBy', 'name');
    res.json(entries);
  })
);

router.post(
  '/:id/entries',
  authorize('admin', 'supervisor', 'operator'),
  ah(async (req, res) => {
    const landfill = await Landfill.findById(req.params.id);
    if (!landfill) throw httpError(404, 'Landfill not found');
    if (landfill.status === 'Closed') throw httpError(400, 'This landfill is closed and cannot accept waste');
    const { date, tonnes, wasteType, vehicle, sourceWard, notes } = req.body || {};
    const entry = await LandfillEntry.create({
      landfill: landfill._id,
      date,
      tonnes,
      wasteType,
      vehicle: vehicle || undefined,
      sourceWard: sourceWard || undefined,
      notes,
      recordedBy: req.user._id,
    });
    res.status(201).json(entry);
  })
);

router.delete(
  '/entries/:entryId',
  authorize('admin', 'supervisor'),
  ah(async (req, res) => {
    const entry = await LandfillEntry.findByIdAndDelete(req.params.entryId);
    if (!entry) throw httpError(404, 'Entry not found');
    res.json({ message: 'Entry deleted', id: entry._id });
  })
);

attachCrud(router, Landfill, {
  beforeDelete: async (doc) => {
    await LandfillEntry.deleteMany({ landfill: doc._id });
  },
});

export default router;
