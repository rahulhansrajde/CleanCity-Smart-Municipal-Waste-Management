import Ward from '../models/Ward.js';
import Vehicle from '../models/Vehicle.js';
import Collection from '../models/Collection.js';
import RecyclingPlant from '../models/RecyclingPlant.js';
import PlantLog from '../models/PlantLog.js';
import Landfill from '../models/Landfill.js';
import LandfillEntry from '../models/LandfillEntry.js';
import { round, pct } from '../utils.js';

const byId = (rows) => new Map(rows.map((r) => [String(r._id), r]));

export async function collectionTotals(match) {
  const [s = {}] = await Collection.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        wet: { $sum: '$wet' },
        dry: { $sum: '$dry' },
        hazardous: { $sum: '$hazardous' },
        eWaste: { $sum: '$eWaste' },
        mixed: { $sum: '$mixed' },
        total: { $sum: '$total' },
        trips: { $sum: '$trips' },
        distanceKm: { $sum: '$distanceKm' },
        fuelLitres: { $sum: '$fuelLitres' },
        housesCovered: { $sum: '$housesCovered' },
        records: { $sum: 1 },
      },
    },
  ]);
  const total = s.total || 0;
  return {
    wet: round(s.wet, 2),
    dry: round(s.dry, 2),
    hazardous: round(s.hazardous, 2),
    eWaste: round(s.eWaste, 2),
    mixed: round(s.mixed, 2),
    total: round(total, 2),
    segregated: round(total - (s.mixed || 0), 2),
    segregationRate: pct(total - (s.mixed || 0), total),
    trips: s.trips || 0,
    distanceKm: round(s.distanceKm, 1),
    fuelLitres: round(s.fuelLitres, 1),
    housesCovered: s.housesCovered || 0,
    records: s.records || 0,
  };
}

export async function wardStats(start, end, days) {
  const [wards, rows] = await Promise.all([
    Ward.find().sort('code').lean(),
    Collection.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$ward',
          total: { $sum: '$total' },
          mixed: { $sum: '$mixed' },
          wet: { $sum: '$wet' },
          dry: { $sum: '$dry' },
          houses: { $sum: '$housesCovered' },
          records: { $sum: 1 },
        },
      },
    ]),
  ]);
  const m = byId(rows);
  return wards.map((w) => {
    const s = m.get(String(w._id)) || {};
    const total = s.total || 0;
    return {
      ...w,
      stats: {
        totalTonnes: round(total, 1),
        wetTonnes: round(s.wet, 1),
        dryTonnes: round(s.dry, 1),
        mixedTonnes: round(s.mixed, 1),
        segregationRate: pct(total - (s.mixed || 0), total),
        avgDailyTonnes: round(total / days, 1),
        perCapitaKg: w.population ? round((total * 1000) / w.population / days, 3) : 0,
        coverage: s.records && w.households ? Math.min(100, pct(s.houses / s.records, w.households)) : 0,
        records: s.records || 0,
      },
    };
  });
}

export async function vehicleStats(start, end) {
  const [vehicles, rows] = await Promise.all([
    Vehicle.find().populate('ward', 'name code zone').sort('registrationNo').lean(),
    Collection.aggregate([
      { $match: { date: { $gte: start, $lte: end }, vehicle: { $ne: null } } },
      {
        $group: {
          _id: '$vehicle',
          trips: { $sum: '$trips' },
          tonnes: { $sum: '$total' },
          distanceKm: { $sum: '$distanceKm' },
          fuelLitres: { $sum: '$fuelLitres' },
          activeDays: { $sum: 1 },
        },
      },
    ]),
  ]);
  const m = byId(rows);
  return vehicles.map((v) => {
    const s = m.get(String(v._id)) || {};
    const avgLoad = s.trips ? s.tonnes / s.trips : 0;
    return {
      ...v,
      stats: {
        trips: s.trips || 0,
        tonnes: round(s.tonnes, 1),
        distanceKm: round(s.distanceKm, 0),
        fuelLitres: round(s.fuelLitres, 0),
        activeDays: s.activeDays || 0,
        avgLoad: round(avgLoad, 2),
        loadFactor: pct(avgLoad, v.capacityTonnes),
        fuelPerTonne: s.tonnes ? round(s.fuelLitres / s.tonnes, 2) : 0,
        kmPerLitre: s.fuelLitres ? round(s.distanceKm / s.fuelLitres, 2) : 0,
      },
    };
  });
}

export async function plantStats(start, end) {
  const [plants, rows] = await Promise.all([
    RecyclingPlant.find().sort('code').lean(),
    PlantLog.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$plant',
          input: { $sum: '$inputTonnes' },
          processed: { $sum: '$processedTonnes' },
          recovered: { $sum: '$recoveredTonnes' },
          rejects: { $sum: '$rejectTonnes' },
          downtime: { $sum: '$downtimeHours' },
          energy: { $sum: '$energyKwh' },
          logs: { $sum: 1 },
        },
      },
    ]),
  ]);
  const m = byId(rows);
  return plants.map((p) => {
    const s = m.get(String(p._id)) || {};
    const logs = s.logs || 0;
    const avgDailyInput = logs ? s.input / logs : 0;
    return {
      ...p,
      stats: {
        inputTonnes: round(s.input, 1),
        processedTonnes: round(s.processed, 1),
        recoveredTonnes: round(s.recovered, 1),
        rejectTonnes: round(s.rejects, 1),
        energyKwh: round(s.energy, 0),
        downtimeHours: round(s.downtime, 1),
        logs,
        avgDailyInput: round(avgDailyInput, 1),
        utilization: pct(avgDailyInput, p.capacityTPD),
        recoveryRate: pct(s.recovered, s.processed),
        uptime: logs ? round(100 - (s.downtime / (logs * 24)) * 100, 1) : 0,
      },
    };
  });
}

export async function landfillStats(start, end, days) {
  const [landfills, allTime, inRange] = await Promise.all([
    Landfill.find().sort('code').lean(),
    LandfillEntry.aggregate([{ $group: { _id: '$landfill', tonnes: { $sum: '$tonnes' } } }]),
    LandfillEntry.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: '$landfill', tonnes: { $sum: '$tonnes' }, entries: { $sum: 1 } } },
    ]),
  ]);
  const all = byId(allTime);
  const rng = byId(inRange);
  return landfills.map((l) => {
    const used = (l.baseUsedTonnes || 0) + (all.get(String(l._id))?.tonnes || 0);
    const remaining = Math.max(0, l.totalCapacityTonnes - used);
    const r = rng.get(String(l._id)) || {};
    const avgDaily = (r.tonnes || 0) / days;
    const lifeDays = avgDaily > 0 ? remaining / avgDaily : null;
    return {
      ...l,
      stats: {
        usedTonnes: round(used, 0),
        remainingTonnes: round(remaining, 0),
        utilization: pct(used, l.totalCapacityTonnes),
        inflowTonnes: round(r.tonnes, 1),
        entries: r.entries || 0,
        avgDailyInflow: round(avgDaily, 1),
        estimatedLifeYears: lifeDays === null ? null : round(lifeDays / 365, 1),
      },
    };
  });
}
