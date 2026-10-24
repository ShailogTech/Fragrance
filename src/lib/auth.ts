'use client'

// Own-auth client module. Sessions come from the app's /api/auth/* routes
// (local MongoDB + scrypt + HS256 tokens — see src/lib/auth-core.ts). The
// session object is cached in a module variable (hydrated from localStorage)
// so getSession() stays synchronous for existing call sites; the bearer token
// lives in localStorage and is attached by authHeaders() (src/lib/client-auth.ts).

export type Role = 'admin' | 'customer'

export interface StoredUser {
  email: string
  name: string
  pwd: string // legacy, unused — kept for localStorage compatibility
  role: Role
  phone?: string
  createdAt: string
}

export interface Session {
  email: string
  name: string
  role: Role
}

export interface AuthResult { ok: boolean; error?: string; session?: Session }

// Admin allowlist. Any account with these emails gets the 'admin' role.
const ADMIN_EMAILS = new Set(['admin@shrifragrance.com'])

export const USERS_KEY = 'shri:users'
export const SESSION_KEY = 'shri:session'
export const TOKEN_KEY = 'shri:auth-token'

let cachedSession: Session | null = null

function persistSession(s: Session | null) {
  if (typeof window === 'undefined') return
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* storage unavailable */ }
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable */ }
}

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('shri:auth-change'))
  }
}

function readUsers(): StoredUser[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function writeUsers(users: StoredUser[]): void {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)) } catch { /* ignore */ }
}

function mirrorUser(session: Session, phone?: string) {
  // Mirror the customer into localStorage so the admin "Customers" tab
  // (which reads USERS_KEY) keeps working.
  if (session.role !== 'customer' || typeof window === 'undefined') return
  const users = readUsers()
  if (!users.some(u => u.email.toLowerCase() === session.email)) {
    users.push({
      email: session.email,
      name: session.name,
      pwd: '',
      role: 'customer',
      phone: phone?.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    writeUsers(users)
  }
}

function hydrate() {
  if (typeof window === 'undefined' || cachedSession !== null) return
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) cachedSession = JSON.parse(raw) as Session
  } catch { /* ignore */ }
}

// Kept for backward compatibility with pages that call it on mount. With
// own-auth there is nothing to seed client-side; sessions live in localStorage.
export function ensureAdminSeed(): void {
  hydrate()
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  hydrate()
  return cachedSession
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const e = email.trim().toLowerCase()
  if (!e || !password) return { ok: false, error: 'Enter email and password.' }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password }),
    })
    const data = (await res.json()) as { ok: boolean; error?: string; token?: string; session?: Session }
    if (!res.ok || !data.ok || !data.token || !data.session) {
      return { ok: false, error: data.error || 'Invalid credentials. If you have no account yet, sign up at /signup.' }
    }
    writeToken(data.token)
    cachedSession = data.session
    persistSession(data.session)
    mirrorUser(data.session)
    notify()
    return { ok: true, session: data.session }
  } catch {
    return { ok: false, error: 'Network error. Check your connection.' }
  }
}

export async function signup(input: {
  email: string
  name: string
  password: string
  phone?: string
  role?: Role
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  if (!email || !name || !input.password) return { ok: false, error: 'All fields are required.' }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Enter a valid email.' }
  if (input.password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password: input.password, phone: input.phone }),
    })
    const data = (await res.json()) as { ok: boolean; error?: string; token?: string; session?: Session }
    if (!res.ok || !data.ok || !data.token || !data.session) {
      return { ok: false, error: data.error || 'Could not create the account.' }
    }
    writeToken(data.token)
    cachedSession = data.session
    persistSession(data.session)
    mirrorUser(data.session, input.phone)
    notify()
    return { ok: true, session: data.session }
  } catch {
    return { ok: false, error: 'Network error. Check your connection.' }
  }
}

export async function logout(): Promise<void> {
  cachedSession = null
  persistSession(null)
  writeToken(null)
  notify()
}

export function subscribeAuth(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  hydrate()
  const handler = () => listener()
  window.addEventListener('shri:auth-change', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('shri:auth-change', handler)
    window.removeEventListener('storage', handler)
  }
}

// Used by modules that previously called Firebase's getIdToken().
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.trim().toLowerCase())
}

export function hasToken(): boolean {
  return Boolean(readToken())
}
