import { Router } from 'express';
import ServiceRequest, { ACTIVE_STATUS } from '../models/ServiceRequest.js';
import { STAFF_ROLES } from '../models/User.js';
import { authorize } from '../middleware/auth.js';
import { ah, clamp, httpError, round, DAY } from '../utils.js';
import { cancelRequest, createRequest, resolveRequest } from '../services/simulation.js';

const router = Router();
const staffOnly = authorize(...STAFF_ROLES);

const populated = (q) =>
  q.populate('ward', 'name code zone').populate('vehicle', 'registrationNo type').populate('citizen', 'name phone');

router.get(
  '/stats',
  staffOnly,
  ah(async (_req, res) => {
    const since = new Date(Date.now() - 7 * DAY);
    const [counts, resolved] = await Promise.all([
      ServiceRequest.aggregate([{ $match: { status: { $in: ACTIVE_STATUS } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      ServiceRequest.find({ status: 'Resolved', resolvedAt: { $gte: since } }).select('reportedAt arrivedAt resolvedAt').lean(),
    ]);
    const by = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    const withArrival = resolved.filter((r) => r.arrivedAt);
    const avgMs = withArrival.length ? withArrival.reduce((s, r) => s + (r.arrivedAt - r.reportedAt), 0) / withArrival.length : 0;
    res.json({
      waiting: by.Open || 0,
      onTheWay: by.Dispatched || 0,
      collecting: by['In progress'] || 0,
      resolvedWeek: resolved.length,
      avgResponseMin: round(avgMs / 60000, 1),
    });
  })
);

router.get(
  '/',
  ah(async (req, res) => {
    const filter = {};
    // Citizens only ever see their own requests.
    if (req.user.role === 'citizen') filter.citizen = req.user._id;
    if (req.query.status === 'active') filter.status = { $in: ACTIVE_STATUS };
    else if (req.query.status) filter.status = req.query.status;
    const limit = clamp(parseInt(req.query.limit, 10) || 100, 1, 300);
    res.json(await populated(ServiceRequest.find(filter).sort({ reportedAt: -1 }).limit(limit)));
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { type, description, landmark, lat, lng } = req.body || {};
    const id = await createRequest({
      citizen: req.user._id,
      type,
      description,
      landmark,
      lat,
      lng,
      source: req.user.role === 'citizen' ? 'citizen' : 'staff',
    });
    res.status(201).json(await populated(ServiceRequest.findById(id)));
  })
);

router.patch(
  '/:id/resolve',
  staffOnly,
  ah(async (req, res) => {
    if (!(await resolveRequest(req.params.id, `Marked resolved by ${req.user.name}`))) throw httpError(400, 'This request is already closed');
    res.json(await populated(ServiceRequest.findById(req.params.id)));
  })
);

router.patch(
  '/:id/cancel',
  ah(async (req, res) => {
    const r = await ServiceRequest.findById(req.params.id).select('citizen').lean();
    if (!r) throw httpError(404, 'Request not found');
    const own = String(r.citizen) === String(req.user._id);
    if (req.user.role === 'citizen' && !own) throw httpError(403, 'You can only cancel your own requests');
    if (!(await cancelRequest(req.params.id, own ? 'Cancelled by citizen' : `Cancelled by ${req.user.name}`)))
      throw httpError(400, 'This request is already closed');
    res.json(await populated(ServiceRequest.findById(req.params.id)));
  })
);

export default router;
