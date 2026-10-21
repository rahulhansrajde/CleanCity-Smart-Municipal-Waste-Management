import mongoose from 'mongoose';

export const ZONES = ['North', 'South', 'East', 'West', 'Central'];

const wardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    zone: { type: String, enum: ZONES, required: true },
    population: { type: Number, min: 0, default: 0 },
    households: { type: Number, min: 0, default: 0 },
    areaSqKm: { type: Number, min: 0, default: 0 },
    supervisor: { type: String, trim: true },
    targetSegregation: { type: Number, min: 0, max: 100, default: 80 },
    // Ward centre; also used as the depot for vehicles assigned to the ward.
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model('Ward', wardSchema);
