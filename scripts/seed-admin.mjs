// Create or reset the store's admin account.
//
//   node scripts/seed-admin.mjs                generate a strong password and print it once
//   node scripts/seed-admin.mjs <password>     set this password instead
//
// The admin address is the first entry of ADMIN_EMAILS (.env or environment);
// nothing about the identity is fixed in this file. Running the script
// changes the password and the token version, which signs out every device.

import { randomBytes, randomInt, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'
import { MongoClient } from 'mongodb'

const scrypt = promisify(scryptCb)

function fromEnv(name) {
  if (process.env[name]) return process.env[name]
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const match = raw.match(new RegExp(`^${name}=(.+)$`, 'm'))
    if (match) return match[1].trim()
  } catch {
    /* no .env */
  }
  return ''
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt:16384:8:1:${salt.toString('hex')}:${key.toString('hex')}`
}

// 256 short, unambiguous words: five of them plus three digits make a
// passphrase with about 50 bits of entropy that can still be typed by hand.
const WORDS = `
river ocean cloud stone coral maple cedar birch fern moss lotus tulip basil honey amber
jade opal pearl flame ember frost storm breeze meadow grove island dune pebble tide dawn dusk star
tiger eagle crane heron otter panda koala camel zebra bison moose raven robin finch rabbit hare
deer wolf bear fox seal whale dolphin turtle lizard cobra mongoose leopard falcon salmon owl bat
lantern basket kettle teapot candle mirror ribbon anchor compass hammock saddle barrel crate
ladder shovel hammer pencil needle thread button pocket wallet blanket pillow curtain window table chair lamp clock cabinet bucket
gentle brave quiet swift bright golden silver crimson violet indigo scarlet emerald sapphire
cobalt copper nickel marble granite velvet cotton linen wool warm cool calm bold keen proud merry lucky humble nimble
temple garden forest valley canyon summit harbor lagoon prairie village castle tower bridge
tunnel trail path field pond lake spring swamp marsh cliff cave hill ridge shore coast beach port square plaza
mango guava papaya melon peach plum fig date olive almond cashew cumin clove nutmeg
pepper ginger garlic onion lemon lime mint sage thyme sugar rice wheat maize bean pea bread butter cheese
melody rhythm harmony tempo note chord verse story poem fable legend myth riddle puzzle
secret wonder wisdom courage spirit vision dream thought reason logic truth honor virtue peace hope joy smile cheer
wander drift glide sail paddle stride sprint linger saunter meander tumble ripple swirl twirl
spin leap bound dash hike climb soar float swim dive rest wake rise shine glow spark blaze shimmer
`
  .split(/\s+/)
  .filter(Boolean)

if (new Set(WORDS).size !== 256) throw new Error('word list must hold 256 distinct words')

function generatePassphrase() {
  const words = Array.from({ length: 5 }, () => WORDS[randomInt(WORDS.length)])
  return `${words.join('-')}-${String(randomInt(1000)).padStart(3, '0')}`
}

const adminEmail = (fromEnv('ADMIN_EMAILS') || '').split(',')[0].trim().toLowerCase()
if (!adminEmail) {
  console.error('ADMIN_EMAILS is not set. Add it to .env first, e.g. ADMIN_EMAILS=you@example.com')
  process.exit(1)
}

const given = process.argv[2]
const password = given || generatePassphrase()
if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error('Password must be at least 8 characters and contain letters and numbers.')
  process.exit(1)
}

const tokenVersion = randomBytes(16).toString('hex')
const client = new MongoClient(fromEnv('MONGODB_URI'))
try {
  await client.connect()
  const users = client.db(fromEnv('MONGODB_DB') || 'shrifragrance').collection('users')
  await users.createIndex({ email: 1 }, { unique: true })
  const existing = await users.findOne({ email: adminEmail })
  const fields = { name: 'Admin', passwordHash: await hashPassword(password), role: 'admin', tokenVersion }
  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: fields })
    console.log('Admin password reset for ' + adminEmail)
  } else {
    await users.insertOne({ email: adminEmail, ...fields, createdAt: new Date() })
    console.log('Admin account created: ' + adminEmail)
  }
  console.log('Every earlier session of this account is signed out.')
  console.log(given ? 'Password set from the argument you passed.' : 'Generated password (shown once, save it now): ' + password)
} finally {
  await client.close()
}
