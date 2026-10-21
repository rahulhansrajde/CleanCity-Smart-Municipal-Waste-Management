import { MongoMemoryServer } from 'mongodb-memory-server';

// Development fallback: starts a local MongoDB process when no MONGO_URI is configured.
let mongod;

export async function startLocalMongo() {
  mongod = await MongoMemoryServer.create();
  console.log('[db] No MONGO_URI set, started a local MongoDB for development');
  return mongod.getUri();
}

export async function stopLocalMongo() {
  if (mongod) await mongod.stop();
}
