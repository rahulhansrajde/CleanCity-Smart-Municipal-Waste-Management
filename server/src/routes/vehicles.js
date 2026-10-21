import { Router } from 'express';
import Vehicle from '../models/Vehicle.js';
import { ah, rangeFromQuery } from '../utils.js';
import { vehicleStats } from '../services/stats.js';
import { attachCrud } from './crud.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    // Operators only need the vehicle list for entry forms, not fleet performance.
    if (req.user.role === 'operator')
      return res.json(await Vehicle.find().select('registrationNo type ward status').populate('ward', 'name code').sort('registrationNo').lean());
    const { start, end } = rangeFromQuery(req.query, 30);
    res.json(await vehicleStats(start, end));
  })
);

attachCrud(router, Vehicle, { populate: 'ward' });

export default router;
