import mongoose from 'mongoose';

const tonnes = { type: Number, min: 0, default: 0 };

// Daily throughput log of a recycling / processing plant.
const plantLogSchema = new mongoose.Schema(
  {
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'RecyclingPlant', required: true, index: true },
    date: { type: Date, required: true, index: true },
    inputTonnes: tonnes,
    processedTonnes: tonnes,
    recoveredTonnes: tonnes,
    rejectTonnes: tonnes,
    downtimeHours: { type: Number, min: 0, max: 24, default: 0 },
    energyKwh: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('PlantLog', plantLogSchema);
