import mongoose from 'mongoose';

export const REQUEST_TYPES = ['Overflowing bin', 'Missed collection', 'Illegal dumping', 'Dead animal', 'Other'];
export const REQUEST_STATUS = ['Open', 'Dispatched', 'In progress', 'Resolved', 'Cancelled'];
export const ACTIVE_STATUS = ['Open', 'Dispatched', 'In progress'];

const eventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: REQUEST_STATUS, required: true },
    note: { type: String, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// A citizen complaint at a map location, auto-dispatched to the nearest free truck.
const serviceRequestSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: REQUEST_TYPES, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    landmark: { type: String, trim: true, maxlength: 120 },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    ward: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward' },
    status: { type: String, enum: REQUEST_STATUS, default: 'Open', index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    source: { type: String, enum: ['citizen', 'staff', 'simulated'], default: 'citizen' },
    reportedAt: { type: Date, default: Date.now, index: true },
    dispatchedAt: { type: Date },
    arrivedAt: { type: Date },
    resolvedAt: { type: Date },
    timeline: [eventSchema],
  },
  { timestamps: true }
);

export default mongoose.model('ServiceRequest', serviceRequestSchema);
