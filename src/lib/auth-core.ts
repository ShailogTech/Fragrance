// Server-side auth primitives: password hashing (scrypt) and session tokens
// (HS256-signed JWTs). Self-contained on purpose — no third-party auth
// service, everything lives in the local MongoDB `users` collection.
//
// Server-only — never import from a client component.

import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

// Admin allowlist — same rule the previous Firebase setup used.
export const ADMIN_EMAILS = new Set(['admin@shrifragrance.com'])

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

export interface UserDoc {
  _id?: unknown
  email: string
  name: string
  phone?: string
  passwordHash: string
  role: 'admin' | 'customer'
  createdAt: Date
}

export function roleForEmail(email: string): 'admin' | 'customer' {
  return ADMIN_EMAILS.has(email.toLowerCase()) ? 'admin' : 'customer'
}

// ---------- password hashing ----------

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, SCRYPT_KEYLEN)
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const key = await scrypt(password, salt, expected.length)
  return key.length === expected.length && timingSafeEqual(key, expected)
}

// ---------- session tokens (HS256 JWT) ----------

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj))
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is not set (or too short). Generate one with `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"` and add it to .env.')
  }
  return secret
}

export interface TokenClaims {
  sub: string
  email: string
  name: string
  role: 'admin' | 'customer'
  iat: number
  exp: number
}

export function signToken(claims: Omit<TokenClaims, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: TokenClaims = { ...claims, iat: now, exp: now + SESSION_TTL_SECONDS }
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJson(payload)
  const sig = createHmac('sha256', getSecret()).update(`${head}.${body}`).digest()
  return `${head}.${body}.${b64url(sig)}`
}

export function verifyToken(token: string): TokenClaims | null {
  const m = token.match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/)
  if (!m) return null
  const [, head, body, sig] = m
  try {
    const expected = createHmac('sha256', getSecret()).update(`${head}.${body}`).digest()
    const got = fromB64url(sig)
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null
    const claims = JSON.parse(fromB64url(body).toString('utf8')) as TokenClaims
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
    if (!claims.sub || !claims.email) return null
    return claims
  } catch {
    return null
  }
}
