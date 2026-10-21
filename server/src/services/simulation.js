import Vehicle from '../models/Vehicle.js';
import Ward from '../models/Ward.js';
import User from '../models/User.js';
import ServiceRequest, { ACTIVE_STATUS, REQUEST_TYPES } from '../models/ServiceRequest.js';
import { httpError } from '../utils.js';

// City bounds and centre used for validation and vehicles without a depot.
export const CITY = { minLat: 18.42, maxLat: 18.7, minLng: 73.72, maxLng: 74.05, center: { lat: 18.53, lng: 73.87 } };

const KM_PER_TICK = 0.25; // distance a truck covers each second at 1x speed
const COLLECT_TICKS = 6; // seconds spent collecting at the site at 1x speed
export const SPEEDS = [1, 2, 5];
export const SIM_EMAIL = 'sim@cleancity.gov';

const sim = { running: true, speed: 1, autoRequests: false, ticks: 0, lastAuto: 0 };
const fleet = new Map(); // vehicleId -> live unit
let timer = null;

// All state changes go through this queue so dispatch and ticks never interleave.
let queue = Promise.resolve();
const exclusive = (fn) => {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
};

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function moveToward(unit, target, km) {
  const d = distanceKm(unit, target);
  if (d <= km) {
    unit.lat = target.lat;
    unit.lng = target.lng;
    return true;
  }
  const f = km / d;
  unit.lat += (target.lat - unit.lat) * f;
  unit.lng += (target.lng - unit.lng) * f;
  return false;
}

const inCity = (lat, lng) => lat >= CITY.minLat && lat <= CITY.maxLat && lng >= CITY.minLng && lng <= CITY.maxLng;

async function nearestWard(lat, lng) {
  const wards = await Ward.find({ lat: { $ne: null } }).select('lat lng').lean();
  let best = null;
  let bestD = Infinity;
  for (const w of wards) {
    const d = distanceKm({ lat, lng }, w);
    if (d < bestD) [best, bestD] = [w, d];
  }
  return best?._id;
}

// Keeps the in-memory fleet in step with the vehicles collection.
async function syncFleet() {
  const vehicles = await Vehicle.find().populate('ward', 'name lat lng').lean();
  const seen = new Set();
  const perWard = new Map();
  for (const v of vehicles) {
    const id = String(v._id);
    seen.add(id);
    const wardKey = String(v.ward?._id || 'none');
    const n = perWard.get(wardKey) || 0;
    perWard.set(wardKey, n + 1);
    // Small offset so vehicles sharing a depot don't overlap on the map.
    const base = v.ward?.lat != null ? { lat: v.ward.lat, lng: v.ward.lng } : CITY.center;
    const home = { lat: base.lat + n * 0.002, lng: base.lng + n * 0.002 };
    let unit = fleet.get(id);
    if (!unit) {
      unit = { id, lat: home.lat, lng: home.lng, state: 'idle', requestId: null, target: null, dwell: 0 };
      fleet.set(id, unit);
    }
    Object.assign(unit, {
      registrationNo: v.registrationNo,
      type: v.type,
      wardName: v.ward?.name || null,
      home,
      available: v.status === 'Active',
    });
  }
  for (const [id, unit] of fleet) {
    if (seen.has(id)) continue;
    if (unit.requestId) await ServiceRequest.updateOne({ _id: unit.requestId, status: { $in: ACTIVE_STATUS } }, { status: 'Open', $unset: { vehicle: 1 } });
    fleet.delete(id);
  }
}

async function setRequestStatus(requestId, status, note, extra = {}) {
  const r = await ServiceRequest.findById(requestId);
  if (!r || !ACTIVE_STATUS.includes(r.status)) return false;
  Object.assign(r, extra, { status });
  r.timeline.push({ status, note, at: new Date() });
  await r.save();
  return true;
}

// Sends the nearest free truck to every waiting request, oldest first.
async function dispatchPendingUnsafe() {
  const open = await ServiceRequest.find({ status: 'Open' }).sort('reportedAt');
  for (const r of open) {
    let best = null;
    let bestD = Infinity;
    for (const u of fleet.values()) {
      if (!u.available || !(u.state === 'idle' || u.state === 'returning')) continue;
      const d = distanceKm(u, r);
      if (d < bestD) [best, bestD] = [u, d];
    }
    if (!best) break;
    Object.assign(best, { state: 'to_job', requestId: String(r._id), target: { lat: r.lat, lng: r.lng } });
    r.status = 'Dispatched';
    r.vehicle = best.id;
    r.dispatchedAt = new Date();
    r.timeline.push({ status: 'Dispatched', note: `Truck ${best.registrationNo} sent (${bestD.toFixed(1)} km away)`, at: new Date() });
    await r.save();
  }
}

function releaseVehicle(requestId) {
  for (const u of fleet.values()) {
    if (u.requestId === String(requestId)) Object.assign(u, { requestId: null, state: 'returning', target: u.home });
  }
}

async function nextCode() {
  const last = await ServiceRequest.findOne().sort({ code: -1 }).select('code').lean();
  const n = last?.code ? parseInt(last.code.split('-')[1], 10) + 1 : 1001;
  return `REQ-${n}`;
}

async function createRequestUnsafe({ citizen, type, description, landmark, lat, lng, source }) {
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw httpError(400, 'Please pick the location on the map');
  if (!inCity(lat, lng)) throw httpError(400, 'This location is outside the city');
  if (!REQUEST_TYPES.includes(type)) throw httpError(400, 'Please choose a problem type');
  const r = await ServiceRequest.create({
    code: await nextCode(),
    citizen,
    type,
    description,
    landmark,
    lat,
    lng,
    ward: await nearestWard(lat, lng),
    source,
    timeline: [{ status: 'Open', note: 'Request received', at: new Date() }],
  });
  await dispatchPendingUnsafe();
  return r._id;
}

const DESCRIPTIONS = {
  'Overflowing bin': ['Community bin is full and spilling onto the road', 'Bin near the bus stop is overflowing', 'Garbage piling up around the bin'],
  'Missed collection': ['Door-to-door pickup did not come today', 'Collection vehicle skipped our lane', 'No pickup for two days'],
  'Illegal dumping': ['Construction debris dumped on footpath', 'Someone is dumping garbage in the open plot', 'Waste dumped near the canal'],
  'Dead animal': ['Dead animal on the roadside'],
  Other: ['Waste burning reported in the area', 'Broken bin needs replacement'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function createRandomUnsafe() {
  const wards = await Ward.find({ lat: { $ne: null } }).select('lat lng').lean();
  const simUser = await User.findOne({ email: SIM_EMAIL }).select('_id').lean();
  if (!wards.length || !simUser) return null;
  const w = pick(wards);
  const type = pick(['Overflowing bin', 'Overflowing bin', 'Missed collection', 'Missed collection', 'Illegal dumping', 'Dead animal', 'Other']);
  return createRequestUnsafe({
    citizen: simUser._id,
    type,
    description: pick(DESCRIPTIONS[type]),
    lat: w.lat + (Math.random() - 0.5) * 0.024,
    lng: w.lng + (Math.random() - 0.5) * 0.024,
    source: 'simulated',
  });
}

async function tick() {
  if (!sim.running) return;
  sim.ticks += 1;
  if (sim.ticks % 5 === 0) await syncFleet();
  const step = KM_PER_TICK * sim.speed;
  for (const u of fleet.values()) {
    if (u.state === 'to_job') {
      if (moveToward(u, u.target, step)) {
        const ok = await setRequestStatus(u.requestId, 'In progress', 'Truck arrived and is collecting the waste', { arrivedAt: new Date() });
        if (ok) Object.assign(u, { state: 'collecting', dwell: COLLECT_TICKS });
        else Object.assign(u, { requestId: null, state: 'returning', target: u.home });
      }
    } else if (u.state === 'collecting') {
      u.dwell -= sim.speed;
      if (u.dwell <= 0) {
        await setRequestStatus(u.requestId, 'Resolved', 'Waste collected. Area is clean.', { resolvedAt: new Date() });
        Object.assign(u, { requestId: null, state: 'returning', target: u.home });
      }
    } else if (u.state === 'returning') {
      if (moveToward(u, u.home, step)) Object.assign(u, { state: 'idle', target: null });
    }
  }
  const every = Math.max(2, Math.round(12 / sim.speed));
  if (sim.autoRequests && sim.ticks - sim.lastAuto >= every) {
    sim.lastAuto = sim.ticks;
    await createRandomUnsafe();
  }
  await dispatchPendingUnsafe();
}

// ---- Public API ----

export const getSim = () => ({ running: sim.running, speed: sim.speed, autoRequests: sim.autoRequests, speeds: SPEEDS });

export function setSim({ running, speed, autoRequests }) {
  if (typeof running === 'boolean') sim.running = running;
  if (SPEEDS.includes(Number(speed))) sim.speed = Number(speed);
  if (typeof autoRequests === 'boolean') sim.autoRequests = autoRequests;
  return getSim();
}

export const createRequest = (data) => exclusive(() => createRequestUnsafe(data));
export const createRandomRequest = () => exclusive(createRandomUnsafe);
export const dispatchPending = () => exclusive(dispatchPendingUnsafe);

export const resolveRequest = (id, note) =>
  exclusive(async () => {
    const ok = await setRequestStatus(id, 'Resolved', note, { resolvedAt: new Date() });
    if (ok) releaseVehicle(id);
    return ok;
  });

export const cancelRequest = (id, note) =>
  exclusive(async () => {
    const ok = await setRequestStatus(id, 'Cancelled', note);
    if (ok) {
      releaseVehicle(id);
      await dispatchPendingUnsafe();
    }
    return ok;
  });

// Live positions; `requestIds` limits the result to trucks serving those requests.
export function fleetSnapshot(requestIds = null) {
  const out = [];
  for (const u of fleet.values()) {
    if (requestIds && !requestIds.has(u.requestId)) continue;
    out.push({
      _id: u.id,
      registrationNo: u.registrationNo,
      type: u.type,
      wardName: u.wardName,
      available: u.available,
      state: u.state,
      requestId: u.requestId,
      lat: u.lat,
      lng: u.lng,
      target: u.target,
    });
  }
  return out;
}

export async function startSimulation() {
  await syncFleet();
  await dispatchPending();
  timer = setInterval(() => exclusive(tick).catch((e) => console.error('[sim]', e)), 1000);
  console.log(`[sim] Dispatch simulation running with ${fleet.size} vehicles`);
}

export function stopSimulation() {
  if (timer) clearInterval(timer);
}
