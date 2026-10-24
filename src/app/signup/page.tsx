'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Flame, Mail, Lock, User as UserIcon, Phone, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ensureAdminSeed, signup, getSession } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ensureAdminSeed()
    if (getSession()) router.replace('/')
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', description: 'Please re-enter your password.' })
      return
    }
    setSubmitting(true)
    const result = await signup({ email, name, password, phone, role: 'customer' })
    setSubmitting(false)
    if (!result.ok) {
      toast({ title: 'Sign up failed', description: result.error })
      return
    }
    toast({ title: 'Account created', description: `Welcome to Shri Fragrance, ${result.session?.name}!` })
    router.replace('/dashboard')
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
            <h1 className="text-2xl font-bold text-temple-deep">Create an account</h1>
            <p className="text-sm text-temple-deep/60 mt-1 mb-6">Join the sacred journey of South Indian fragrances.</p>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Full Name</span>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name"
                    className="pl-9 h-11 border-temple-gold/25" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Email</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                  <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className="pl-9 h-11 border-temple-gold/25" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Phone <span className="text-temple-deep/40">(optional)</span></span>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 ..." className="pl-9 h-11 border-temple-gold/25" />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Password</span>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                    <Input type="password" autoComplete="new-password" required value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 chars"
                      className="pl-9 h-11 border-temple-gold/25" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-temple-deep/70 mb-1 block">Confirm</span>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
                    <Input type="password" autoComplete="new-password" required value={confirm}
                      onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat"
                      className="pl-9 h-11 border-temple-gold/25" />
                  </div>
                </label>
              </div>

              <Button type="submit" disabled={submitting}
                className="w-full h-11 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold transition-all shadow-md shadow-temple-deep/25">
                Create Account <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-temple-deep/70">
              Already a devotee?{' '}
              <Link href="/login" className="text-temple-saffron font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
