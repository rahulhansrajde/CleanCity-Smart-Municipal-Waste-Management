import mongoose from 'mongoose';

export const LANDFILL_WASTE_TYPES = ['Mixed', 'Process Rejects', 'Inert', 'C&D Waste', 'Legacy Waste'];

const landfillEntrySchema = new mongoose.Schema(
  {
    landfill: { type: mongoose.Schema.Types.ObjectId, ref: 'Landfill', required: true, index: true },
    date: { type: Date, required: true, index: true },
    tonnes: { type: Number, required: true, min: 0 },
    wasteType: { type: String, enum: LANDFILL_WASTE_TYPES, default: 'Mixed' },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    sourceWard: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward' },
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('LandfillEntry', landfillEntrySchema);
