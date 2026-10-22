'use client'

// Firebase-backed auth. We cache the current session in a module variable
// (hydrated from localStorage) so that getSession() can stay synchronous for
// existing call sites.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from './firebase'

export type Role = 'admin' | 'customer'

export interface StoredUser {
  email: string
  name: string
  pwd: string // legacy, no longer used for verification
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

let cachedSession: Session | null = null
let listenerAttached = false

function toSession(u: FirebaseUser, fallbackName?: string): Session {
  const email = (u.email || '').toLowerCase()
  return {
    email,
    name: u.displayName || fallbackName || email.split('@')[0] || 'User',
    role: ADMIN_EMAILS.has(email) ? 'admin' : 'customer',
  }
}

function persistSession(s: Session | null) {
  if (typeof window === 'undefined') return
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* storage unavailable */ }
}

function notify() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('shri:auth-change'))
  }
}

function initAuthListener() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) cachedSession = JSON.parse(raw) as Session
  } catch { /* ignore */ }
  onAuthStateChanged(auth, (u) => {
    cachedSession = u ? toSession(u) : null
    persistSession(cachedSession)
    notify()
  })
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

// Kept as a no-op for backward compatibility. Firebase users are created
// through the signup flow, not seeded client-side.
export function ensureAdminSeed(): void {
  initAuthListener()
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  initAuthListener()
  return cachedSession
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const e = email.trim().toLowerCase()
  if (!e || !password) return { ok: false, error: 'Enter email and password.' }
  initAuthListener()
  try {
    const cred = await signInWithEmailAndPassword(auth, e, password)
    const session = toSession(cred.user)
    cachedSession = session
    persistSession(session)
    notify()
    return { ok: true, session }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    // Demo convenience: if account doesn't exist, auto-create it on first login.
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
      if (password.length >= 6) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, e, password)
          const session = toSession(cred.user, e.split('@')[0])
          cachedSession = session
          persistSession(session)
          notify()
          return { ok: true, session }
        } catch (signupErr: unknown) {
          const signupCode = (signupErr as { code?: string })?.code
          if (signupCode === 'auth/email-already-in-use') {
            return { ok: false, error: 'Wrong password for this email.' }
          }
          return { ok: false, error: prettyError(signupCode) }
        }
      }
    }
    return { ok: false, error: prettyError(code) }
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
  initAuthListener()
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, input.password)
    if (name) {
      try { await updateProfile(cred.user, { displayName: name }) } catch { /* ignore */ }
    }
    const session: Session = {
      email,
      name,
      role: ADMIN_EMAILS.has(email) ? 'admin' : 'customer',
    }
    cachedSession = session
    persistSession(session)

    // Mirror the customer into localStorage so the admin "Customers" tab
    // (which reads USERS_KEY) keeps working without a backend.
    if (session.role === 'customer') {
      const users = readUsers()
      if (!users.some(u => u.email.toLowerCase() === email)) {
        users.push({
          email,
          name,
          pwd: '',
          role: 'customer',
          phone: input.phone?.trim() || undefined,
          createdAt: new Date().toISOString(),
        })
        writeUsers(users)
      }
    }

    notify()
    return { ok: true, session }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    return { ok: false, error: prettyError(code) }
  }
}

export async function loginWithGoogle(): Promise<AuthResult> {
  initAuthListener()
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    const cred = await signInWithPopup(auth, provider)
    const session = toSession(cred.user)
    cachedSession = session
    persistSession(session)

    // Mirror customer into USERS_KEY so the admin page can list them.
    if (session.role === 'customer' && typeof window !== 'undefined') {
      const users = readUsers()
      if (!users.some(u => u.email.toLowerCase() === session.email)) {
        users.push({
          email: session.email,
          name: session.name,
          pwd: '',
          role: 'customer',
          createdAt: new Date().toISOString(),
        })
        writeUsers(users)
      }
    }

    notify()
    return { ok: true, session }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, error: 'Sign-in cancelled.' }
    }
    return { ok: false, error: prettyError(code) }
  }
}

export async function logout(): Promise<void> {
  cachedSession = null
  persistSession(null)
  notify()
  try { await signOut(auth) } catch { /* ignore */ }
}

export function subscribeAuth(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  initAuthListener()
  const handler = () => listener()
  window.addEventListener('shri:auth-change', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('shri:auth-change', handler)
    window.removeEventListener('storage', handler)
  }
}

function prettyError(code?: string): string {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found. Please sign up first at /signup.'
    case 'auth/invalid-credential':
      return 'Invalid credentials. If you have no account yet, sign up at /signup.'
    case 'auth/wrong-password':
      return 'Wrong password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/invalid-email':
      return 'Enter a valid email.'
    case 'auth/weak-password':
      return 'Password is too weak.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.'
    default:
      return code ? `Authentication failed (${code}).` : 'Authentication failed. Please try again.'
  }
}
