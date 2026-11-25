import { NextResponse } from 'next/server'
import { isMongoConfigured } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

// GET /api/health → liveness probe for uptime monitors / load balancers.
// Deliberately does NOT ping MongoDB or any external service: it must be
// cheap, and it must answer even when dependencies are down. The `mongo`
// field reports configuration only, never connectivity.
export async function GET() {
  return NextResponse.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    mongo: isMongoConfigured ? 'configured' : 'not-configured',
    timestamp: new Date().toISOString(),
  })
}
