// MongoDB Atlas connection (server-side only — never import this from a
// client component). Uses a cached client across hot-reloads in dev, the
// standard Next.js pattern.

import { MongoClient, type Db } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'shrifragrance'

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient> | null = null

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env',
    )
  }
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect()
    }
    return global._mongoClientPromise
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect()
  }
  return clientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db(dbName)
}

// Whether the backend is configured (used to return a clear error vs crash).
export const isMongoConfigured = Boolean(uri)
