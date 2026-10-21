import { authorize } from '../middleware/auth.js';
import { ah, httpError } from '../utils.js';

const STRIP = ['_id', '__v', 'createdAt', 'updatedAt', 'stats'];

const clean = (body) => {
  const data = { ...(body || {}) };
  STRIP.forEach((k) => delete data[k]);
  // Accept populated objects from the client and reduce them to ids.
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v._id) data[k] = v._id;
    if (v === '') data[k] = undefined;
  }
  return data;
};

/**
 * Adds GET /:id, POST /, PUT /:id and DELETE /:id handlers for a model.
 * List endpoints are defined per resource since they carry their own stats.
 */
export function attachCrud(router, Model, opts = {}) {
  const {
    populate = '',
    writeRoles = ['admin', 'supervisor'],
    deleteRoles = ['admin'],
    beforeSave,
    beforeDelete,
  } = opts;
  const withPop = (q) => (populate ? q.populate(populate) : q);
  const docPop = (doc) => (populate ? doc.populate(populate) : doc);

  router.get(
    '/:id',
    ah(async (req, res) => {
      const doc = await withPop(Model.findById(req.params.id));
      if (!doc) throw httpError(404, `${Model.modelName} not found`);
      res.json(doc);
    })
  );

  router.post(
    '/',
    authorize(...writeRoles),
    ah(async (req, res) => {
      const data = clean(req.body);
      if (beforeSave) await beforeSave(data, req);
      const doc = await Model.create(data);
      res.status(201).json(await docPop(doc));
    })
  );

  router.put(
    '/:id',
    authorize(...writeRoles),
    ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw httpError(404, `${Model.modelName} not found`);
      const data = clean(req.body);
      if (beforeSave) await beforeSave(data, req, doc);
      doc.set(data);
      await doc.save();
      res.json(await docPop(doc));
    })
  );

  router.delete(
    '/:id',
    authorize(...deleteRoles),
    ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw httpError(404, `${Model.modelName} not found`);
      if (beforeDelete) await beforeDelete(doc, req);
      await doc.deleteOne();
      res.json({ message: `${Model.modelName} deleted`, id: doc._id });
    })
  );
}
