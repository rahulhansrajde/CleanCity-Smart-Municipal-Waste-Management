import mongoose from 'mongoose';

export const SHIFTS = ['Morning', 'Afternoon', 'Night'];

const tonnes = { type: Number, min: 0, default: 0 };

// One record = one ward's collection for a shift, broken down by waste stream (tonnes).
const collectionSchema = new mongoose.Schema(
  {
    ward: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    date: { type: Date, required: true, index: true },
    shift: { type: String, enum: SHIFTS, default: 'Morning' },
    wet: tonnes,
    dry: tonnes,
    hazardous: tonnes,
    eWaste: tonnes,
    mixed: tonnes,
    total: tonnes,
    segregationRate: { type: Number, min: 0, max: 100, default: 0 },
    trips: { type: Number, min: 1, default: 1 },
    distanceKm: { type: Number, min: 0, default: 0 },
    fuelLitres: { type: Number, min: 0, default: 0 },
    housesCovered: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export function computeTotals(c) {
  const segregated = (c.wet || 0) + (c.dry || 0) + (c.hazardous || 0) + (c.eWaste || 0);
  const total = segregated + (c.mixed || 0);
  return {
    total: Math.round(total * 100) / 100,
    segregationRate: total ? Math.round((segregated / total) * 1000) / 10 : 0,
  };
}

collectionSchema.pre('validate', function () {
  Object.assign(this, computeTotals(this));
});

export default mongoose.model('Collection', collectionSchema);
