'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Flame, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ensureAdminSeed, login, getSession } from '@/lib/auth'

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
