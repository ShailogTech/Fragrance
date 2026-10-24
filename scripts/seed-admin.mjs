// Seed / update the admin user in the local MongoDB.
// Usage: node scripts/seed-admin.mjs [password]
//   (password defaults to Admin@Fragrance2026 — change it after first login)

import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'
import { MongoClient } from 'mongodb'

const scrypt = promisify(scryptCb)

function loadEnv() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const m = raw.match(/^MONGODB_URI=(.+)$/m)
    if (m) return m[1].trim()
  } catch { /* no .env */ }
  throw new Error('Set MONGODB_URI (env var or .env file).')
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt:16384:8:1:${salt.toString('hex')}:${key.toString('hex')}`
}

const ADMIN_EMAIL = 'admin@shrifragrance.com'
const password = process.argv[2] || 'Admin@Fragrance2026'

const uri = loadEnv()
const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'shrifragrance')
  const users = db.collection('users')
  await users.createIndex({ email: 1 }, { unique: true })
  const existing = await users.findOne({ email: ADMIN_EMAIL })
  if (existing) {
    await users.updateOne(
      { email: ADMIN_EMAIL },
      { $set: { passwordHash: await hashPassword(password), role: 'admin', name: existing.name || 'Admin' } },
    )
    console.log('Admin password updated for', ADMIN_EMAIL)
  } else {
    await users.insertOne({
      email: ADMIN_EMAIL,
      name: 'Admin',
      passwordHash: await hashPassword(password),
      role: 'admin',
      createdAt: new Date(),
    })
    console.log('Admin user created:', ADMIN_EMAIL)
  }
  console.log('Password:', password)
} finally {
  await client.close()
}
