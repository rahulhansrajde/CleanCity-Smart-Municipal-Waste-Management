import mongoose from 'mongoose';

export const VEHICLE_TYPES = ['Compactor', 'Tipper', 'Auto Tipper', 'Hook Loader', 'Dumper Placer', 'E-Rickshaw'];
export const VEHICLE_STATUS = ['Active', 'Maintenance', 'Idle'];
export const FUEL_TYPES = ['Diesel', 'CNG', 'Electric'];

const vehicleSchema = new mongoose.Schema(
  {
    registrationNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    capacityTonnes: { type: Number, required: true, min: 0.1 },
    fuelType: { type: String, enum: FUEL_TYPES, default: 'Diesel' },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    ward: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward' },
    status: { type: String, enum: VEHICLE_STATUS, default: 'Active' },
    gpsEnabled: { type: Boolean, default: true },
    lastServiceDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Vehicle', vehicleSchema);
