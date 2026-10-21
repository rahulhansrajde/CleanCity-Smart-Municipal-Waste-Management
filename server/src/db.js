import mongoose from 'mongoose';

// Connects Mongoose to the MongoDB server at `uri` (MONGO_URI in .env).
export async function connectDB(uri) {
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || 'cleancity' });
  const { host, port, name } = mongoose.connection;
  console.log(`[db] MongoDB connected: ${host}:${port}/${name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
