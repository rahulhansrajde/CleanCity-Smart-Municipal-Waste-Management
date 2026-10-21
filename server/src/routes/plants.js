import { Router } from 'express';
import RecyclingPlant from '../models/RecyclingPlant.js';
import PlantLog from '../models/PlantLog.js';
import { authorize } from '../middleware/auth.js';
import { ah, httpError, rangeFromQuery } from '../utils.js';
import { plantStats } from '../services/stats.js';
import { attachCrud } from './crud.js';

const router = Router();
const LOG_WRITERS = ['admin', 'supervisor', 'operator'];

router.get(
  '/',
  ah(async (req, res) => {
    const { start, end } = rangeFromQuery(req.query, 30);
    res.json(await plantStats(start, end));
  })
);

router.get(
  '/:id/logs',
  ah(async (req, res) => {
    const { start, end } = rangeFromQuery(req.query, 60);
    const logs = await PlantLog.find({ plant: req.params.id, date: { $gte: start, $lte: end } })
      .sort({ date: -1 })
      .populate('recordedBy', 'name');
    res.json(logs);
  })
);

router.post(
  '/:id/logs',
  authorize(...LOG_WRITERS),
  ah(async (req, res) => {
    const plant = await RecyclingPlant.findById(req.params.id);
    if (!plant) throw httpError(404, 'Plant not found');
    const b = req.body || {};
    // Blank form fields arrive as '' and fall back to derived values.
    const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
    const input = num(b.inputTonnes) ?? 0;
    const processed = num(b.processedTonnes) ?? input;
    const rejects = num(b.rejectTonnes) ?? 0;
    const log = await PlantLog.create({
      plant: plant._id,
      date: b.date,
      inputTonnes: input,
      processedTonnes: processed,
      recoveredTonnes: num(b.recoveredTonnes) ?? Math.max(0, processed - rejects),
      rejectTonnes: rejects,
      downtimeHours: num(b.downtimeHours) ?? 0,
      energyKwh: num(b.energyKwh) ?? 0,
      notes: b.notes,
      recordedBy: req.user._id,
    });
    res.status(201).json(log);
  })
);

router.delete(
  '/logs/:logId',
  authorize('admin', 'supervisor'),
  ah(async (req, res) => {
    const log = await PlantLog.findByIdAndDelete(req.params.logId);
    if (!log) throw httpError(404, 'Log not found');
    res.json({ message: 'Log deleted', id: log._id });
  })
);

attachCrud(router, RecyclingPlant, {
  beforeDelete: async (doc) => {
    await PlantLog.deleteMany({ plant: doc._id });
  },
});

export default router;
