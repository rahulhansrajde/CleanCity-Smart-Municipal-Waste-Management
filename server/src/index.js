import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from './db.js';
import { startLocalMongo, stopLocalMongo } from './localMongo.js';
import { seed, DEMO_USERS } from './seed.js';
import { authorize, protect } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import wardRoutes from './routes/wards.js';
import vehicleRoutes from './routes/vehicles.js';
import collectionRoutes from './routes/collections.js';
import plantRoutes from './routes/plants.js';
import landfillRoutes from './routes/landfills.js';
import analyticsRoutes from './routes/analytics.js';
import requestRoutes from './routes/requests.js';
import liveRoutes from './routes/live.js';
import { STAFF_ROLES } from './models/User.js';
import { startSimulation, stopSimulation } from './services/simulation.js';

const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
// The live map polls every second; keep those requests out of the log.
app.use(morgan('dev', { skip: (req) => req.originalUrl.startsWith('/api/live') }));

const staff = authorize(...STAFF_ROLES);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'down' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', protect, userRoutes);
app.use('/api/wards', protect, staff, wardRoutes);
app.use('/api/vehicles', protect, staff, vehicleRoutes);
app.use('/api/collections', protect, staff, collectionRoutes);
app.use('/api/plants', protect, staff, plantRoutes);
app.use('/api/landfills', protect, staff, landfillRoutes);
// City-wide analytics (dashboard, reports, alerts) are for admins and supervisors only.
app.use('/api/analytics', protect, authorize('admin', 'supervisor'), analyticsRoutes);
// Citizen requests and the live map; each route narrows what a citizen can see.
app.use('/api/requests', protect, requestRoutes);
app.use('/api/live', protect, liveRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found' }));

// Serve the production React build when present.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid value for ${err.path}` });
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `A record with this ${field} already exists` });
  }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
});

async function start() {
  await connectDB(process.env.MONGO_URI || (await startLocalMongo()));
  await seed();
  await startSimulation();
  app.listen(PORT, () => {
    console.log(`[api] CleanCity API listening on http://localhost:${PORT}`);
    console.log('[api] Demo logins:');
    DEMO_USERS.forEach((u) => console.log(`      ${u.role.padEnd(10)} ${u.email} / ${u.password}`));
  });
}

const shutdown = async () => {
  stopSimulation();
  await disconnectDB().catch(() => {});
  await stopLocalMongo().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('[api] Failed to start:', err);
  process.exit(1);
});
