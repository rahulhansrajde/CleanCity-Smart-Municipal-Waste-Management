import mongoose from 'mongoose';

export const DAY = 24 * 60 * 60 * 1000;

// Wraps async route handlers so rejected promises reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const httpError = (status, message) => Object.assign(new Error(message), { status });

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export const round = (n, d = 1) => {
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
};

export const pct = (part, whole) => (whole ? round((part / whole) * 100, 1) : 0);

export function utcDay(d = new Date()) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

// Resolves ?from=&to= or ?days= into an inclusive UTC date range.
export function rangeFromQuery(q = {}, defaultDays = 30) {
  let end = q.to ? new Date(q.to) : new Date();
  if (isNaN(end)) end = new Date();
  end = new Date(utcDay(end).getTime() + DAY - 1);

  let start = q.from ? utcDay(new Date(q.from)) : null;
  if (!start || isNaN(start) || start > end) {
    const days = clamp(parseInt(q.days, 10) || defaultDays, 1, 730);
    start = new Date(utcDay(end).getTime() - (days - 1) * DAY);
  }
  const days = Math.round((end.getTime() + 1 - start.getTime()) / DAY);
  return { start, end, days };
}

export const toObjectId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null);
