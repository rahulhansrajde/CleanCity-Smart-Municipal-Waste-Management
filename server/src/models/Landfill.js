import mongoose from 'mongoose';
import { ZONES } from './Ward.js';

export const LANDFILL_STATUS = ['Active', 'Near Capacity', 'Closed', 'Under Remediation'];

const landfillSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    zone: { type: String, enum: ZONES },
    totalCapacityTonnes: { type: Number, required: true, min: 1 },
    // Tonnage already deposited before digital tracking started.
    baseUsedTonnes: { type: Number, min: 0, default: 0 },
    areaAcres: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: LANDFILL_STATUS, default: 'Active' },
    openedOn: { type: Date },
    leachateTreatment: { type: Boolean, default: false },
    methaneCapture: { type: Boolean, default: false },
    cells: { type: Number, min: 0, default: 1 },
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model('Landfill', landfillSchema);
