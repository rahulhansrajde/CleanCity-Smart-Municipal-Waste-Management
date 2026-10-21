import mongoose from 'mongoose';
import { ZONES } from './Ward.js';

export const PLANT_TYPES = [
  'Composting',
  'Biomethanation',
  'Material Recovery Facility',
  'Plastic Recycling',
  'Paper Recycling',
  'E-Waste',
  'Waste-to-Energy',
  'C&D Waste',
];
export const PLANT_STATUS = ['Operational', 'Maintenance', 'Offline'];

const plantSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: PLANT_TYPES, required: true },
    location: { type: String, trim: true },
    zone: { type: String, enum: ZONES },
    capacityTPD: { type: Number, required: true, min: 0.1 },
    materials: [{ type: String, trim: true }],
    status: { type: String, enum: PLANT_STATUS, default: 'Operational' },
    operator: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    commissionedOn: { type: Date },
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model('RecyclingPlant', plantSchema);
