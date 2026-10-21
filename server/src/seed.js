import User from './models/User.js';
import Ward from './models/Ward.js';
import Vehicle from './models/Vehicle.js';
import Collection, { computeTotals } from './models/Collection.js';
import RecyclingPlant from './models/RecyclingPlant.js';
import PlantLog from './models/PlantLog.js';
import Landfill from './models/Landfill.js';
import LandfillEntry from './models/LandfillEntry.js';
import ServiceRequest from './models/ServiceRequest.js';
import { SIM_EMAIL } from './services/simulation.js';
import { DAY, utcDay, clamp } from './utils.js';

const HISTORY_DAYS = 150;

// Deterministic PRNG so the demo dataset is identical on every boot.
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261021);
const between = (min, max) => min + rand() * (max - min);
const jitter = (spread) => 1 + (rand() * 2 - 1) * spread;
const r2 = (n) => Math.round(n * 100) / 100;

export const DEMO_USERS = [
  { name: 'Anita Deshmukh', email: 'admin@cleancity.gov', password: 'admin123', role: 'admin', department: 'Solid Waste Management Dept.', phone: '+91 98200 11001' },
  { name: 'Rakesh Patil', email: 'supervisor@cleancity.gov', password: 'super123', role: 'supervisor', department: 'Zonal Operations', phone: '+91 98200 11002' },
  { name: 'Sameer Khan', email: 'operator@cleancity.gov', password: 'oper123', role: 'operator', department: 'Field Data Entry', phone: '+91 98200 11003' },
  { name: 'Priya Sharma', email: 'citizen@cleancity.gov', password: 'citizen123', role: 'citizen', department: 'Citizen', phone: '+91 98200 11004' },
];

// code, name, zone, population, area km², base segregation, supervisor, lat, lng
const WARDS = [
  ['W01', 'Green Park', 'North', 82000, 3.8, 0.66, 'Meena Joshi', 18.585, 73.835],
  ['W02', 'Rajiv Nagar', 'North', 95000, 4.6, 0.58, 'Vikas Rao', 18.575, 73.88],
  ['W03', 'Lake View', 'North', 61000, 5.2, 0.74, 'Priya Kulkarni', 18.6, 73.905],
  ['W04', 'Gandhi Chowk', 'Central', 110000, 2.9, 0.49, 'Imran Sheikh', 18.515, 73.855],
  ['W05', 'Station Road', 'Central', 74000, 3.1, 0.55, 'Neha Gupta', 18.528, 73.875],
  ['W06', 'Sector 21', 'South', 88000, 6.4, 0.71, 'Arjun Nair', 18.47, 73.86],
  ['W07', 'Industrial Estate', 'South', 52000, 8.7, 0.52, 'Sunil Pawar', 18.455, 73.9],
  ['W08', 'Shanti Vihar', 'East', 99000, 5.5, 0.63, 'Kavita Iyer', 18.53, 73.93],
  ['W09', 'Riverside', 'East', 67000, 4.9, 0.69, 'Rohan Mehta', 18.55, 73.91],
  ['W10', 'Hill Top', 'West', 58000, 7.3, 0.77, 'Farah Ali', 18.505, 73.8],
  ['W11', 'Civil Lines', 'West', 71000, 4.2, 0.72, 'Deepak Shinde', 18.535, 73.815],
  ['W12', 'Market Yard', 'Central', 104000, 3.4, 0.46, 'Pooja Verma', 18.497, 73.87],
];

const VEHICLE_SPECS = {
  Compactor: { cap: 8, kmpl: 3.6 },
  Tipper: { cap: 6, kmpl: 4.5 },
  'Hook Loader': { cap: 10, kmpl: 3.2 },
  'Dumper Placer': { cap: 4.5, kmpl: 5 },
  'Auto Tipper': { cap: 1.5, kmpl: 18 },
  'E-Rickshaw': { cap: 0.5, kmpl: 0 },
};

const DRIVERS = ['Ramesh Yadav', 'Suresh Kale', 'Mahesh Gaikwad', 'Ganesh More', 'Iqbal Ansari', 'Prakash Jadhav', 'Santosh Bhosale', 'Ajay Chavan', 'Vinod Shirke', 'Manoj Salve', 'Dinesh Lokhande', 'Raju Thorat', 'Ashok Mane', 'Nitin Waghmare', 'Kiran Sonawane', 'Balu Kamble'];

const PLANTS = [
  { lat: 18.5, lng: 73.935, code: 'RP-01', name: 'Central Composting Plant', type: 'Composting', zone: 'South', location: 'Survey No. 42, Hadapsar Road', capacityTPD: 160, materials: ['Wet Waste', 'Garden Waste', 'Market Waste'], operator: 'GreenEarth Bio Pvt. Ltd.', contactPerson: 'S. Kulkarni', util: [0.74, 0.9], reject: 0.22, kwh: 0, commissioned: '2016-04-12' },
  { lat: 18.538, lng: 73.945, code: 'RP-02', name: 'Bio-CNG Biomethanation Unit', type: 'Biomethanation', zone: 'East', location: 'Ward 08 Transfer Station', capacityTPD: 40, materials: ['Food Waste', 'Hotel Waste', 'Wet Waste'], operator: 'Urja Renewables', contactPerson: 'M. Shah', util: [0.8, 0.96], reject: 0.1, kwh: 0, commissioned: '2019-09-01' },
  { lat: 18.488, lng: 73.866, code: 'RP-03', name: 'Dry Waste Material Recovery Facility', type: 'Material Recovery Facility', zone: 'Central', location: 'Gultekdi Industrial Area', capacityTPD: 90, materials: ['Plastic', 'Paper', 'Cardboard', 'Metal', 'Glass'], operator: 'SWaCH Cooperative', contactPerson: 'L. Pawar', util: [0.72, 0.9], reject: 0.27, kwh: 0, commissioned: '2017-02-20' },
  { lat: 18.515, lng: 73.775, code: 'RP-04', name: 'Plastic Recycling & Granulation Unit', type: 'Plastic Recycling', zone: 'West', location: 'MIDC Plot B-17', capacityTPD: 35, materials: ['PET', 'HDPE', 'LDPE', 'PP', 'Multilayer'], operator: 'PolyCycle Industries', contactPerson: 'R. Jain', util: [0.7, 0.88], reject: 0.12, kwh: 0, commissioned: '2020-11-15' },
  { lat: 18.625, lng: 73.85, code: 'RP-05', name: 'E-Waste Dismantling Centre', type: 'E-Waste', zone: 'North', location: 'Bhosari Industrial Estate', capacityTPD: 8, materials: ['IT Equipment', 'Batteries', 'Appliances', 'Cables'], operator: 'E-Cycle Solutions', contactPerson: 'A. Menon', util: [0.5, 0.72], reject: 0.05, kwh: 0, commissioned: '2021-06-10' },
  { lat: 18.508, lng: 73.918, code: 'RP-06', name: 'Waste-to-Energy Plant', type: 'Waste-to-Energy', zone: 'East', location: 'Ramtekdi Industrial Zone', capacityTPD: 120, materials: ['RDF', 'Mixed Combustibles'], operator: 'PowerGen Waste Energy Ltd.', contactPerson: 'V. Reddy', util: [0.65, 0.85], reject: 0.18, kwh: 520, commissioned: '2018-01-25', maintenanceDays: 5 },
  { lat: 18.58, lng: 73.98, code: 'RP-07', name: 'C&D Waste Processing Plant', type: 'C&D Waste', zone: 'South', location: 'Wagholi Quarry Site', capacityTPD: 60, materials: ['Concrete', 'Bricks', 'Debris', 'Sand'], operator: 'BuildBack Infra', contactPerson: 'K. Deshpande', util: [0.48, 0.7], reject: 0.08, kwh: 0, commissioned: '2022-03-08' },
];

const LANDFILLS = [
  { lat: 18.455, lng: 73.97, code: 'LF-01', name: 'Eastern Sanitary Landfill', zone: 'East', location: 'Uruli Devachi', totalCapacityTonnes: 1800000, baseUsedTonnes: 1150000, areaAcres: 163, status: 'Active', openedOn: '2009-06-01', leachateTreatment: true, methaneCapture: true, cells: 6, daily: [100, 130] },
  { lat: 18.66, lng: 73.85, code: 'LF-02', name: 'Northern Landfill Site', zone: 'North', location: 'Moshi Kachra Depot', totalCapacityTonnes: 1200000, baseUsedTonnes: 1045000, areaAcres: 81, status: 'Near Capacity', openedOn: '2004-03-15', leachateTreatment: true, methaneCapture: false, cells: 4, daily: [55, 75] },
  { lat: 18.47, lng: 73.95, code: 'LF-03', name: 'Old City Dumpsite', zone: 'Central', location: 'Phursungi', totalCapacityTonnes: 850000, baseUsedTonnes: 850000, areaAcres: 43, status: 'Under Remediation', openedOn: '1991-01-01', leachateTreatment: false, methaneCapture: false, cells: 2, daily: null },
];

export async function seed() {
  if (await User.countDocuments()) return;
  const t0 = Date.now();
  const today = utcDay();
  const dayAt = (i) => new Date(today.getTime() - (HISTORY_DAYS - 1 - i) * DAY);

  const users = [];
  for (const u of DEMO_USERS) users.push(await User.create(u));
  const operator = users[2];
  const citizen = users[3];
  // Owner of simulated requests; it cannot sign in.
  await User.create({
    name: 'Simulated citizen',
    email: SIM_EMAIL,
    password: Math.random().toString(36).slice(2) + 'Aa1',
    role: 'citizen',
    department: 'Simulation',
    active: false,
  });

  const wards = await Ward.insertMany(
    WARDS.map(([code, name, zone, population, areaSqKm, , supervisor, lat, lng]) => ({
      code,
      name,
      zone,
      population,
      households: Math.round(population / 4.3),
      areaSqKm,
      supervisor,
      targetSegregation: 80,
      lat,
      lng,
    }))
  );

  // One primary collection vehicle per ward plus a few support vehicles.
  const vehicleDocs = wards.map((w, i) => {
    const type = i % 3 === 2 ? 'Tipper' : 'Compactor';
    return {
      registrationNo: `MH12 ${['GT', 'KX', 'PL', 'RN'][i % 4]} ${4021 + i * 137}`,
      type,
      capacityTonnes: VEHICLE_SPECS[type].cap,
      fuelType: i % 4 === 1 ? 'CNG' : 'Diesel',
      driverName: DRIVERS[i],
      driverPhone: `+91 97${String(30000000 + i * 104729).slice(0, 8)}`,
      ward: w._id,
      status: 'Active',
      gpsEnabled: true,
      lastServiceDate: new Date(today.getTime() - (10 + i * 7) * DAY),
    };
  });
  vehicleDocs.push(
    { registrationNo: 'MH12 HL 7710', type: 'Hook Loader', capacityTonnes: 10, fuelType: 'Diesel', driverName: DRIVERS[12], driverPhone: '+91 9730012012', ward: wards[3]._id, status: 'Maintenance', lastServiceDate: new Date(today.getTime() - 2 * DAY) },
    { registrationNo: 'MH12 DP 3302', type: 'Dumper Placer', capacityTonnes: 4.5, fuelType: 'Diesel', driverName: DRIVERS[13], driverPhone: '+91 9730012013', ward: wards[11]._id, status: 'Idle', lastServiceDate: new Date(today.getTime() - 40 * DAY) },
    { registrationNo: 'MH12 AT 1188', type: 'Auto Tipper', capacityTonnes: 1.5, fuelType: 'CNG', driverName: DRIVERS[14], driverPhone: '+91 9730012014', ward: wards[4]._id, status: 'Active', lastServiceDate: new Date(today.getTime() - 15 * DAY) },
    { registrationNo: 'MH12 EV 0451', type: 'E-Rickshaw', capacityTonnes: 0.5, fuelType: 'Electric', driverName: DRIVERS[15], driverPhone: '+91 9730012015', ward: wards[9]._id, status: 'Maintenance', lastServiceDate: new Date(today.getTime() - 1 * DAY) }
  );
  const vehicles = await Vehicle.insertMany(vehicleDocs);

  // Ward-level daily collection with a gradual segregation improvement over time.
  const collections = [];
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const date = dayAt(d);
    const progress = d / (HISTORY_DAYS - 1);
    const dow = date.getUTCDay();
    const weekday = dow === 0 ? 0.9 : dow === 1 ? 1.1 : 1;
    wards.forEach((w, i) => {
      const baseSeg = WARDS[i][5];
      const v = vehicles[i];
      const spec = VEHICLE_SPECS[v.type];
      const total = (w.population * 0.00045) * jitter(0.08) * weekday;
      const s = clamp(baseSeg + 0.12 * progress + (rand() * 2 - 1) * 0.05, 0.3, 0.96);
      const segregated = total * s;
      const wet = segregated * between(0.54, 0.6);
      const hazardous = segregated * between(0.025, 0.04);
      const eWaste = segregated * between(0.01, 0.02);
      const doc = {
        ward: w._id,
        vehicle: v._id,
        date,
        shift: 'Morning',
        wet: r2(wet),
        dry: r2(segregated - wet - hazardous - eWaste),
        hazardous: r2(hazardous),
        eWaste: r2(eWaste),
        mixed: r2(total * (1 - s)),
        housesCovered: Math.round(w.households * between(0.86, 0.99)),
        recordedBy: operator._id,
      };
      doc.trips = Math.max(1, Math.ceil(total / (spec.cap * between(0.78, 0.92))));
      doc.distanceKm = r2(doc.trips * between(9, 14));
      doc.fuelLitres = spec.kmpl ? r2(doc.distanceKm / (spec.kmpl * jitter(0.08))) : 0;
      Object.assign(doc, computeTotals(doc));
      collections.push(doc);
    });
  }
  await Collection.insertMany(collections);

  const plants = await RecyclingPlant.insertMany(
    PLANTS.map(({ util, reject, kwh, commissioned, maintenanceDays, ...p }) => ({
      ...p,
      commissionedOn: new Date(commissioned),
      status: maintenanceDays ? 'Maintenance' : 'Operational',
    }))
  );
  const plantLogs = [];
  PLANTS.forEach((spec, i) => {
    const plant = plants[i];
    for (let d = 0; d < HISTORY_DAYS; d++) {
      const inMaintenance = spec.maintenanceDays && d >= HISTORY_DAYS - spec.maintenanceDays;
      const downtime = inMaintenance ? 24 : rand() < 0.07 ? Math.round(between(2, 9)) : 0;
      const input = inMaintenance ? 0 : spec.capacityTPD * between(...spec.util) * (1 - downtime / 24);
      const processed = input * between(0.93, 0.98);
      const rejects = processed * spec.reject * jitter(0.15);
      plantLogs.push({
        plant: plant._id,
        date: dayAt(d),
        inputTonnes: r2(input),
        processedTonnes: r2(processed),
        recoveredTonnes: r2(processed - rejects),
        rejectTonnes: r2(rejects),
        downtimeHours: downtime,
        energyKwh: Math.round(processed * spec.kwh),
        notes: inMaintenance ? 'Boiler & turbine scheduled overhaul' : downtime ? 'Unplanned breakdown — conveyor repair' : undefined,
        recordedBy: operator._id,
      });
    }
  });
  await PlantLog.insertMany(plantLogs);

  const landfills = await Landfill.insertMany(
    LANDFILLS.map(({ daily, openedOn, ...l }) => ({ ...l, openedOn: new Date(openedOn) }))
  );
  const entries = [];
  LANDFILLS.forEach((spec, i) => {
    if (!spec.daily) return;
    for (let d = 0; d < HISTORY_DAYS; d++) {
      const total = between(...spec.daily);
      const rejectShare = between(0.25, 0.35);
      const ward = wards[Math.floor(rand() * wards.length)];
      entries.push(
        { landfill: landfills[i]._id, date: dayAt(d), tonnes: r2(total * (1 - rejectShare)), wasteType: 'Mixed', sourceWard: ward._id, vehicle: vehicles[wards.indexOf(ward)]._id, recordedBy: operator._id },
        { landfill: landfills[i]._id, date: dayAt(d), tonnes: r2(total * rejectShare), wasteType: 'Process Rejects', recordedBy: operator._id }
      );
    }
  });
  await LandfillEntry.insertMany(entries);

  // Three demo citizen requests: two already resolved, one new that the simulation dispatches on start.
  const now = Date.now();
  const min = 60 * 1000;
  const requests = [];
  const past = [
    { type: 'Missed collection', description: 'Door-to-door pickup did not come today', w: 0, daysAgo: 3 },
    { type: 'Illegal dumping', description: 'Construction debris dumped on the footpath', w: 4, daysAgo: 1 },
  ];
  for (const p of past) {
    const w = wards[p.w];
    const reportedAt = new Date(now - p.daysAgo * DAY);
    const dispatchedAt = new Date(reportedAt.getTime() + 2 * min);
    const arrivedAt = new Date(dispatchedAt.getTime() + 18 * min);
    const resolvedAt = new Date(arrivedAt.getTime() + 12 * min);
    const truck = vehicles[p.w];
    requests.push({
      citizen: citizen._id,
      type: p.type,
      description: p.description,
      lat: w.lat + 0.004,
      lng: w.lng + 0.005,
      ward: w._id,
      status: 'Resolved',
      vehicle: truck._id,
      source: 'citizen',
      reportedAt,
      dispatchedAt,
      arrivedAt,
      resolvedAt,
      timeline: [
        { status: 'Open', note: 'Request received', at: reportedAt },
        { status: 'Dispatched', note: `Truck ${truck.registrationNo} sent`, at: dispatchedAt },
        { status: 'In progress', note: 'Truck arrived and is collecting the waste', at: arrivedAt },
        { status: 'Resolved', note: 'Waste collected. Area is clean.', at: resolvedAt },
      ],
    });
  }
  requests.sort((a, b) => a.reportedAt - b.reportedAt).forEach((r, i) => (r.code = `REQ-${1001 + i}`));
  const fresh = [
    { citizen: citizen._id, type: 'Overflowing bin', description: 'Bin outside the vegetable market is overflowing', landmark: 'Near Gandhi Chowk market gate', w: 3, source: 'citizen' },
  ];
  fresh.forEach((f, i) => {
    const w = wards[f.w];
    const reportedAt = new Date(now - (1 - i) * min);
    requests.push({
      code: `REQ-${1001 + requests.length}`,
      citizen: f.citizen,
      type: f.type,
      description: f.description,
      landmark: f.landmark,
      lat: w.lat + 0.006,
      lng: w.lng - 0.008,
      ward: w._id,
      source: f.source,
      reportedAt,
      timeline: [{ status: 'Open', note: 'Request received', at: reportedAt }],
    });
  });
  await ServiceRequest.insertMany(requests);

  console.log(
    `[seed] ${users.length} users, ${wards.length} wards, ${vehicles.length} vehicles, ${collections.length} collections, ` +
      `${plants.length} plants (${plantLogs.length} logs), ${landfills.length} landfills (${entries.length} entries), ` +
      `${requests.length} citizen requests in ${Date.now() - t0}ms`
  );
}
