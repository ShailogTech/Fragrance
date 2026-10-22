import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { adminProductsSeed, type AdminProduct } from '@/lib/catalog-data'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set(['admin@shrifragrance.com'])

type ProductDoc = AdminProduct & { _id: number }

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: 'MONGODB_URI not set on the server.' },
    { status: 503 },
  )
}

function strip(docs: ProductDoc[]): AdminProduct[] {
  // Each doc is an AdminProduct plus a mirrored `_id`; drop `_id`, keep `id`.
  return docs.map(({ _id, ...rest }) => rest)
}

// GET /api/products  → the whole catalog (public). Seeds the collection from
// the default seed the first time it is empty.
export async function GET() {
  if (!isMongoConfigured) return notConfigured()
  try {
    const db = await getDb()
    const col = db.collection<ProductDoc>('products')
    let docs = await col.find({}).sort({ _id: 1 }).toArray()
    if (docs.length === 0) {
      await col.insertMany(adminProductsSeed.map(p => ({ ...p, _id: p.id })))
      docs = await col.find({}).sort({ _id: 1 }).toArray()
    }
    return NextResponse.json({ ok: true, products: strip(docs) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// PUT /api/products  body = { products, email }  → replace the whole catalog
// (admin only).
export async function PUT(req: Request) {
  if (!isMongoConfigured) return notConfigured()
  try {
    const { products, email } = await req.json()
    if (!ADMIN_EMAILS.has((email || '').toLowerCase())) {
      return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 403 })
    }
    if (!Array.isArray(products)) {
      return NextResponse.json({ ok: false, error: 'products must be an array.' }, { status: 400 })
    }
    const db = await getDb()
    const col = db.collection<ProductDoc>('products')
    await col.deleteMany({})
    if (products.length) {
      await col.insertMany(
        (products as AdminProduct[]).map(p => ({ ...p, _id: p.id })),
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
