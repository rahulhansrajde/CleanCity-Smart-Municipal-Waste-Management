import { Router } from 'express';
import Ward from '../models/Ward.js';
import Collection from '../models/Collection.js';
import { ah, httpError, rangeFromQuery } from '../utils.js';
import { wardStats } from '../services/stats.js';
import { attachCrud } from './crud.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    // Operators only need the ward list for entry forms, not ward performance.
    if (req.user.role === 'operator') return res.json(await Ward.find().select('code name zone').sort('code').lean());
    const { start, end, days } = rangeFromQuery(req.query, 30);
    res.json(await wardStats(start, end, days));
  })
);

attachCrud(router, Ward, {
  beforeDelete: async (doc) => {
    if (await Collection.exists({ ward: doc._id }))
      throw httpError(409, 'This ward has collection records and cannot be deleted');
  },
});

export default router;
