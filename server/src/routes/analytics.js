import { Router } from 'express';
import Collection from '../models/Collection.js';
import PlantLog from '../models/PlantLog.js';
import LandfillEntry from '../models/LandfillEntry.js';
import Vehicle from '../models/Vehicle.js';
import ServiceRequest from '../models/ServiceRequest.js';
import { ah, rangeFromQuery, round, pct, DAY } from '../utils.js';
import { collectionTotals, wardStats, vehicleStats, plantStats, landfillStats } from '../services/stats.js';

const router = Router();

const ACTIVE_LANDFILL = ['Active', 'Near Capacity'];

async function sumField(Model, field, start, end) {
  const [r] = await Model.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    { $group: { _id: null, v: { $sum: `$${field}` } } },
  ]);
  return r?.v || 0;
}

const byDay = (Model, start, end, fields) => {
  const group = { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } };
  for (const [k, f] of Object.entries(fields)) group[k] = { $sum: `$${f}` };
  return Model.aggregate([{ $match: { date: { $gte: start, $lte: end } } }, { $group: group }]);
};

async function dailyTrend(start, end) {
  const [rows, recRows, lfRows] = await Promise.all([
    byDay(Collection, start, end, { wet: 'wet', dry: 'dry', hazardous: 'hazardous', eWaste: 'eWaste', mixed: 'mixed', total: 'total' }),
    byDay(PlantLog, start, end, { recovered: 'recoveredTonnes' }),
    byDay(LandfillEntry, start, end, { landfilled: 'tonnes' }),
  ]);
  const m = new Map(rows.map((r) => [r._id, r]));
  const rec = new Map(recRows.map((r) => [r._id, r.recovered]));
  const lf = new Map(lfRows.map((r) => [r._id, r.landfilled]));
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const key = new Date(t).toISOString().slice(0, 10);
    const r = m.get(key) || {};
    const total = r.total || 0;
    const recovered = rec.get(key) || 0;
    const landfilled = lf.get(key) || 0;
    out.push({
      date: key,
      wet: round(r.wet, 1),
      dry: round(r.dry, 1),
      hazardous: round(r.hazardous, 1),
      eWaste: round(r.eWaste, 1),
      mixed: round(r.mixed, 1),
      total: round(total, 1),
      recovered: round(recovered, 1),
      landfilled: round(landfilled, 1),
      segregationRate: pct(total - (r.mixed || 0), total),
      recyclingRate: Math.min(100, pct(recovered, total)),
      diversionRate: total ? Math.max(0, round(100 - pct(landfilled, total), 1)) : 0,
    });
  }
  return out;
}

function zoneSummary(wards) {
  const zones = new Map();
  for (const w of wards) {
    const z = zones.get(w.zone) || { zone: w.zone, wards: 0, population: 0, total: 0, mixed: 0 };
    z.wards += 1;
    z.population += w.population || 0;
    z.total += w.stats.totalTonnes;
    z.mixed += w.stats.mixedTonnes;
    zones.set(w.zone, z);
  }
  return [...zones.values()].map((z) => ({
    zone: z.zone,
    wards: z.wards,
    population: z.population,
    totalTonnes: round(z.total, 1),
    segregationRate: pct(z.total - z.mixed, z.total),
  }));
}

function buildAlerts({ wards, plants, landfills, vehicles, segregationRate, waiting = 0 }) {
  const alerts = [];
  if (waiting)
    alerts.push({
      level: 'serious',
      module: 'requests',
      title: `${waiting} citizen request${waiting > 1 ? 's' : ''} waiting for a truck`,
      message: 'All trucks are busy. The next free truck will be sent automatically.',
    });
  for (const l of landfills) {
    if (!ACTIVE_LANDFILL.includes(l.status)) continue;
    if (l.stats.utilization >= 85)
      alerts.push({
        level: l.stats.utilization >= 95 ? 'critical' : 'serious',
        module: 'landfills',
        title: `${l.name} is ${Math.round(l.stats.utilization)}% full`,
        message: `About ${l.stats.estimatedLifeYears ?? '—'} years of space left.`,
      });
  }
  for (const p of plants) {
    if (p.status !== 'Operational')
      alerts.push({
        level: p.status === 'Offline' ? 'critical' : 'warning',
        module: 'plants',
        title: `${p.name} is ${p.status === 'Maintenance' ? 'under maintenance' : 'offline'}`,
        message: `${p.capacityTPD} tonnes/day of capacity is not available.`,
      });
    else if (p.stats.utilization > 95)
      alerts.push({
        level: 'warning',
        module: 'plants',
        title: `${p.name} is overloaded`,
        message: `Receiving ${Math.round(p.stats.utilization)}% of its capacity.`,
      });
  }
  const lagging = wards.filter((w) => w.stats.records && w.stats.segregationRate < 60);
  if (lagging.length)
    alerts.push({
      level: 'warning',
      module: 'wards',
      title: `${lagging.length} ward${lagging.length > 1 ? 's' : ''} below 60% segregation`,
      message: lagging.map((w) => `${w.name} (${Math.round(w.stats.segregationRate)}%)`).join(', '),
    });
  const maint = vehicles.filter((v) => v.status === 'Maintenance');
  if (maint.length)
    alerts.push({
      level: 'info',
      module: 'fleet',
      title: `${maint.length} vehicle${maint.length > 1 ? 's' : ''} in repair`,
      message: maint.map((v) => v.registrationNo).join(', '),
    });
  if (segregationRate && segregationRate < 80)
    alerts.push({
      level: 'info',
      module: 'segregation',
      title: `City segregation is ${Math.round(segregationRate)}%`,
      message: 'Target is 80%.',
    });
  const order = { critical: 0, serious: 1, warning: 2, info: 3 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

router.get(
  '/overview',
  ah(async (req, res) => {
    const { start, end, days } = rangeFromQuery(req.query, 30);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(start.getTime() - days * DAY);

    const [cur, prev, trend, wards, plants, landfills, vehicles, prevRecovered, prevLandfilled] = await Promise.all([
      collectionTotals({ date: { $gte: start, $lte: end } }),
      collectionTotals({ date: { $gte: prevStart, $lte: prevEnd } }),
      dailyTrend(start, end),
      wardStats(start, end, days),
      plantStats(start, end),
      landfillStats(start, end, days),
      vehicleStats(start, end),
      sumField(PlantLog, 'recoveredTonnes', prevStart, prevEnd),
      sumField(LandfillEntry, 'tonnes', prevStart, prevEnd),
    ]);

    const recovered = plants.reduce((s, p) => s + p.stats.recoveredTonnes, 0);
    const landfilled = landfills.reduce((s, l) => s + l.stats.inflowTonnes, 0);
    const activeLandfills = landfills.filter((l) => ACTIVE_LANDFILL.includes(l.status));
    const lfUsed = activeLandfills.reduce((s, l) => s + l.stats.usedTonnes, 0);
    const lfCap = activeLandfills.reduce((s, l) => s + l.totalCapacityTonnes, 0);
    const operational = plants.filter((p) => p.status === 'Operational');
    const plantCap = operational.reduce((s, p) => s + p.capacityTPD, 0);
    const plantInput = operational.reduce((s, p) => s + p.stats.avgDailyInput, 0);
    const activeVehicles = vehicles.filter((v) => v.status === 'Active').length;
    const wardsWithData = wards.filter((w) => w.stats.records);

    const recyclingRate = Math.min(100, pct(recovered, cur.total));
    const prevRecyclingRate = Math.min(100, pct(prevRecovered, prev.total));
    const diversionRate = Math.max(0, round(100 - pct(landfilled, cur.total), 1));
    const prevDiversionRate = prev.total ? Math.max(0, round(100 - pct(prevLandfilled, prev.total), 1)) : 0;

    const kpis = {
      totalCollected: cur.total,
      avgDailyCollected: round(cur.total / days, 1),
      collectedChange: prev.total ? round(((cur.total - prev.total) / prev.total) * 100, 1) : null,
      segregationRate: cur.segregationRate,
      segregationChange: prev.total ? round(cur.segregationRate - prev.segregationRate, 1) : null,
      recoveredTonnes: round(recovered, 1),
      recyclingRate,
      recyclingChange: prev.total ? round(recyclingRate - prevRecyclingRate, 1) : null,
      landfilledTonnes: round(landfilled, 1),
      diversionRate,
      diversionChange: prev.total ? round(diversionRate - prevDiversionRate, 1) : null,
      landfillUtilization: pct(lfUsed, lfCap),
      plantUtilization: pct(plantInput, plantCap),
      fleetAvailability: pct(activeVehicles, vehicles.length),
      activeVehicles,
      totalVehicles: vehicles.length,
      fuelPerTonne: cur.total ? round(cur.fuelLitres / cur.total, 2) : 0,
      tonnesPerTrip: cur.trips ? round(cur.total / cur.trips, 2) : 0,
      householdCoverage: wardsWithData.length
        ? round(wardsWithData.reduce((s, w) => s + w.stats.coverage, 0) / wardsWithData.length, 1)
        : 0,
    };

    res.json({
      range: { start, end, days },
      kpis,
      composition: [
        { key: 'dry', name: 'Dry', value: cur.dry },
        { key: 'mixed', name: 'Mixed (not separated)', value: cur.mixed },
        { key: 'wet', name: 'Wet', value: cur.wet },
        { key: 'hazardous', name: 'Hazardous', value: cur.hazardous },
        { key: 'eWaste', name: 'E-Waste', value: cur.eWaste },
      ],
      trend,
      wards: wards
        .map((w) => ({
          _id: w._id,
          code: w.code,
          name: w.name,
          zone: w.zone,
          target: w.targetSegregation,
          totalTonnes: w.stats.totalTonnes,
          segregationRate: w.stats.segregationRate,
        }))
        .sort((a, b) => b.segregationRate - a.segregationRate),
      zones: zoneSummary(wards),
      plants: plants.map((p) => ({
        _id: p._id,
        code: p.code,
        name: p.name,
        type: p.type,
        status: p.status,
        capacityTPD: p.capacityTPD,
        utilization: p.stats.utilization,
        recoveryRate: p.stats.recoveryRate,
        recoveredTonnes: p.stats.recoveredTonnes,
      })),
      landfills: landfills.map((l) => ({
        _id: l._id,
        code: l.code,
        name: l.name,
        status: l.status,
        totalCapacityTonnes: l.totalCapacityTonnes,
        ...l.stats,
      })),
      fleet: ['Active', 'Maintenance', 'Idle'].map((s) => ({
        status: s,
        count: vehicles.filter((v) => v.status === s).length,
      })),
      alerts: buildAlerts({ wards, plants, landfills, vehicles, segregationRate: cur.segregationRate, waiting: await ServiceRequest.countDocuments({ status: 'Open' }) }),
    });
  })
);

// Lightweight feed for the notification bell.
router.get(
  '/alerts',
  ah(async (req, res) => {
    const { start, end, days } = rangeFromQuery(req.query, 30);
    const [cur, wards, plants, landfills, vehicles, waiting] = await Promise.all([
      collectionTotals({ date: { $gte: start, $lte: end } }),
      wardStats(start, end, days),
      plantStats(start, end),
      landfillStats(start, end, days),
      Vehicle.find().lean(),
      ServiceRequest.countDocuments({ status: 'Open' }),
    ]);
    res.json(buildAlerts({ wards, plants, landfills, vehicles, segregationRate: cur.segregationRate, waiting }));
  })
);

async function monthly(Model, start, end, fields) {
  const group = { _id: { $dateToString: { format: '%Y-%m', date: '$date' } } };
  for (const [k, f] of Object.entries(fields)) group[k] = { $sum: `$${f}` };
  return Model.aggregate([{ $match: { date: { $gte: start, $lte: end } } }, { $group: group }]);
}

router.get(
  '/report',
  ah(async (req, res) => {
    const { start, end, days } = rangeFromQuery(req.query, 90);
    const [totals, wards, plants, landfills, vehicles, colM, plantM, lfM] = await Promise.all([
      collectionTotals({ date: { $gte: start, $lte: end } }),
      wardStats(start, end, days),
      plantStats(start, end),
      landfillStats(start, end, days),
      vehicleStats(start, end),
      monthly(Collection, start, end, {
        wet: 'wet',
        dry: 'dry',
        hazardous: 'hazardous',
        eWaste: 'eWaste',
        mixed: 'mixed',
        total: 'total',
      }),
      monthly(PlantLog, start, end, { recovered: 'recoveredTonnes' }),
      monthly(LandfillEntry, start, end, { landfilled: 'tonnes' }),
    ]);

    const months = new Map();
    const get = (k) => months.get(k) || months.set(k, { month: k }).get(k);
    colM.forEach((r) => Object.assign(get(r._id), r));
    plantM.forEach((r) => (get(r._id).recovered = r.recovered));
    lfM.forEach((r) => (get(r._id).landfilled = r.landfilled));
    const monthlyRows = [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(({ _id, ...m }) => ({
        month: m.month,
        wet: round(m.wet, 1),
        dry: round(m.dry, 1),
        hazardous: round(m.hazardous, 1),
        eWaste: round(m.eWaste, 1),
        mixed: round(m.mixed, 1),
        total: round(m.total, 1),
        recovered: round(m.recovered, 1),
        landfilled: round(m.landfilled, 1),
        segregationRate: pct((m.total || 0) - (m.mixed || 0), m.total),
        diversionRate: m.total ? Math.max(0, round(100 - pct(m.landfilled, m.total), 1)) : 0,
      }));

    const recovered = plants.reduce((s, p) => s + p.stats.recoveredTonnes, 0);
    const landfilled = landfills.reduce((s, l) => s + l.stats.inflowTonnes, 0);

    res.json({
      range: { start, end, days },
      totals: {
        ...totals,
        recovered: round(recovered, 1),
        landfilled: round(landfilled, 1),
        recyclingRate: Math.min(100, pct(recovered, totals.total)),
        diversionRate: Math.max(0, round(100 - pct(landfilled, totals.total), 1)),
      },
      monthly: monthlyRows,
      zones: zoneSummary(wards),
      wards,
      plants,
      landfills,
      vehicles,
    });
  })
);

export default router;
