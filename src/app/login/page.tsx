'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Flame, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ensureAdminSeed, login, loginWithGoogle, getSession } from '@/lib/auth'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params?.get('next') || '/'
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ensureAdminSeed()
    if (getSession()) router.replace(next)
  }, [router, next])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)
    if (!result.ok) {
      toast({ title: 'Login failed', description: result.error })
      return
    }
    toast({ title: 'Welcome back', description: `Signed in as ${result.session?.name}` })
    if (result.session?.role === 'admin') router.replace('/admin')
    else router.replace(next === '/login' ? '/' : next)
  }

  const handleGoogle = async () => {
    setSubmitting(true)
    const result = await loginWithGoogle()
    setSubmitting(false)
    if (!result.ok) {
      toast({ title: 'Google sign-in failed', description: result.error })
      return
    }
    toast({ title: 'Welcome', description: `Signed in as ${result.session?.name}` })
    if (result.session?.role === 'admin') router.replace('/admin')
    else router.replace(next === '/login' ? '/' : next)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-temple-cream via-white to-temple-cream">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="w-10 h-10 rounded-full saffron-gradient flex items-center justify-center shadow-lg shadow-temple-saffron/30">
            <Flame className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-temple-deep tracking-wide">Shri Fragrance</span>
        </Link>

        <Card className="border-temple-gold/20 bg-white shadow-2xl shadow-temple-deep/10">
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-temple-deep">Welcome back</h1>
            <p className="text-sm text-temple-deep/60 mt-1 mb-6">Sign in to continue your sacred journey.</p>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Email</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9 h-11 border-temple-gold/25"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Password</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 h-11 border-temple-gold/25"
                  />
                </div>
              </label>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold transition-all shadow-md shadow-temple-deep/25"
              >
                Sign In <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-temple-gold/15" />
              <span className="text-[10px] uppercase tracking-wider text-temple-deep/40">or</span>
              <div className="flex-1 h-px bg-temple-gold/15" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={handleGoogle}
              className="w-full h-11 border-temple-gold/30 hover:bg-temple-gold/5 font-medium"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <p className="text-center text-sm text-temple-deep/70 mt-6">
              New to Shri Fragrance?{' '}
              <Link href="/signup" className="text-temple-saffron font-semibold hover:underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-temple-cream">
        <div className="w-10 h-10 rounded-full border-4 border-temple-saffron border-t-transparent animate-spin" />
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}
