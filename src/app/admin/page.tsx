'use client'

// Product Manager — the entire CMS for the landing page.
//
// Adding or deleting a product commits `public/products.json` to the
// repository through the GitHub Contents API. The token is a fine-grained
// personal access token (Contents: Read and write on this repo) and is kept
// only in this browser's localStorage. Nothing here needs a server.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Flame, Plus, Trash2, LogOut, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle2, Loader2, Package, Github,
} from 'lucide-react'
import {
  DEFAULT_GH, FILE_PATH, GhError, ghLoadProducts, ghSaveProducts,
  nextProductId, type GhConfig, type Product,
} from '@/lib/products'

const TOKEN_KEY = 'shri:gh:token'
const REPO_KEY = 'shri:gh:repo'

interface RepoSettings {
  owner: string
  repo: string
  branch: string
}

function loadRepoSettings(): RepoSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_GH }
  try {
    const raw = localStorage.getItem(REPO_KEY)
    if (raw) return { ...DEFAULT_GH, ...(JSON.parse(raw) as Partial<RepoSettings>) }
  } catch { /* fall through */ }
  return { ...DEFAULT_GH }
}

type Notice = { kind: 'ok' | 'error' | 'info'; text: string } | null

export default function AdminPage() {
  // Connection state
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState<RepoSettings>({ ...DEFAULT_GH })
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showTokenEntry, setShowTokenEntry] = useState(false)

  // Catalog state
  const [products, setProducts] = useState<Product[]>([])
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false) // a save is in flight
  const [notice, setNotice] = useState<Notice>(null)
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(null)

  // Add-product form
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Floral')
  const [price, setPrice] = useState('')
  const [image, setImage] = useState('/images/product1.png')
  const [description, setDescription] = useState('')

  // Restore a previous session (token + repo settings) on mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       restoring the saved session reads localStorage, which only exists
       after hydration; the deferred setState calls are the point. */
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedRepo = loadRepoSettings()
    setRepo(savedRepo)
    if (savedToken) {
      setToken(savedToken)
      void connect(savedToken, savedRepo)
    } else {
      setShowTokenEntry(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const cfg = useCallback(
    (t = token, r = repo): GhConfig => ({ token: t.trim(), ...r }),
    [token, repo],
  )

  async function connect(t: string, r: RepoSettings) {
    if (!t.trim()) {
      setNotice({ kind: 'error', text: 'Paste a GitHub token first (see the steps below).' })
      return
    }
    setConnecting(true)
    setNotice(null)
    try {
      const loaded = await loadCatalog({ token: t.trim(), ...r })
      localStorage.setItem(TOKEN_KEY, t.trim())
      localStorage.setItem(REPO_KEY, JSON.stringify(r))
      setToken(t.trim())
      setRepo(r)
      setConnected(true)
      setShowTokenEntry(false)
      setNotice({ kind: 'ok', text: `Connected — ${loaded.length} product${loaded.length === 1 ? '' : 's'} in the catalog.` })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not connect to GitHub.' })
    } finally {
      setConnecting(false)
    }
  }

  async function loadCatalog(config: GhConfig) {
    setLoading(true)
    try {
      const file = await ghLoadProducts(config)
      setProducts(file.products)
      setSha(file.sha)
      return file.products
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    if (!connected) return
    setNotice(null)
    try {
      const list = await loadCatalog(cfg())
      setNotice({ kind: 'info', text: `Reloaded — ${list.length} product${list.length === 1 ? '' : 's'} from GitHub.` })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Reload failed.' })
    }
  }

  // Every add/delete commits immediately: one action = one commit. On a
  // SHA conflict (someone else edited meanwhile) we reload the latest file
  // state and retry once with this session's list (last write wins).
  async function commit(nextProducts: Product[], successText: string) {
    setBusy(true)
    setNotice(null)
    try {
      let result: Awaited<ReturnType<typeof ghSaveProducts>>
      try {
        result = await ghSaveProducts(cfg(), nextProducts, sha)
      } catch (err) {
        if (err instanceof GhError && err.status === 409) {
          const fresh = await ghLoadProducts(cfg())
          setProducts(fresh.products)
          result = await ghSaveProducts(cfg(), nextProducts, fresh.sha)
        } else {
          throw err
        }
      }
      setProducts(nextProducts)
      setSha(result.sha)
      setLastCommitUrl(result.commitUrl)
      setNotice({ kind: 'ok', text: successText })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !connected || busy) return
    const priceNumber = Number.parseInt(String(price).replace(/[^\d]/g, ''), 10)
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      setNotice({ kind: 'error', text: 'Enter a valid price in rupees (e.g. 299).' })
      return
    }
    const product: Product = {
      id: nextProductId(products),
      name: name.trim(),
      category: category.trim() || 'General',
      price: priceNumber,
      image: image.trim() || '/images/product1.png',
      description: description.trim(),
    }
    await commit([...products, product], `Added "${product.name}" — committed to GitHub.`)
    setName(''); setPrice(''); setDescription(''); setImage('/images/product1.png')
  }

  async function handleDelete(p: Product) {
    if (!connected || busy) return
    if (!window.confirm(`Delete "${p.name}" from the catalog? This commits the change to GitHub.`)) return
    await commit(products.filter((x) => x.id !== p.id), `Deleted "${p.name}" — committed to GitHub.`)
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setConnected(false)
    setShowTokenEntry(true)
    setProducts([])
    setNotice(null)
  }

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* Header */}
      <header className="bg-temple-maroon text-white">
        <div className="absolute top-0 left-0 right-0 h-0.5 gold-gradient-h" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Shri Fragrance logo" width={36} height={36} className="rounded-full" />
            <div>
              <h1 className="text-base font-bold tracking-wide">Product Manager</h1>
              <p className="text-[10px] text-temple-amber/60 tracking-wider uppercase">Shri Fragrance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-temple-gold/25 text-temple-gold/90 text-xs hover:bg-temple-gold/10 transition-colors">
              <ExternalLink className="w-3 h-3" /> View site
            </Link>
            {connected && (
              <>
                <button type="button" onClick={refresh} disabled={loading || busy} title="Reload from GitHub"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-temple-gold/25 text-temple-gold/90 hover:bg-temple-gold/10 transition-colors disabled:opacity-40">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button type="button" onClick={disconnect} title="Disconnect"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-temple-gold/25 text-temple-gold/90 hover:bg-temple-gold/10 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Notice */}
        {notice && (
          <div role="status"
            className={`flex items-start gap-2.5 p-4 rounded-xl border text-sm ${
              notice.kind === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : notice.kind === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
            {notice.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              : notice.kind === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                : <Flame className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="leading-relaxed">
              {notice.text}
              {lastCommitUrl && notice.kind === 'ok' && (
                <>
                  {' '}
                  <a href={lastCommitUrl} target="_blank" rel="noopener noreferrer"
                    className="underline font-medium inline-flex items-center gap-1">
                    view commit <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </span>
          </div>
        )}

        {/* Connection card (shown until connected, or when reconnecting) */}
        {(showTokenEntry || !connected) && (
          <section className="bg-white rounded-2xl border border-temple-gold/15 p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Github className="w-4 h-4 text-temple-deep" />
              <h2 className="text-lg font-bold text-temple-deep">Connect to GitHub</h2>
            </div>
            <p className="text-sm text-temple-deep/60 leading-relaxed mb-6">
              The catalog lives in <code className="px-1.5 py-0.5 rounded bg-temple-gold/10 text-temple-deep text-xs">{FILE_PATH}</code> in
              this repository. Connecting lets this page add and delete products by committing to that
              file — no server involved.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); void connect(token, repo) }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="token" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">
                  GitHub fine-grained personal access token
                </label>
                <input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)}
                  placeholder="github_pat_…" autoComplete="off"
                  className="w-full h-11 px-4 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep placeholder:text-temple-deep/30 focus:outline-none focus:border-temple-saffron focus:ring-2 focus:ring-temple-saffron/15" />
                <details className="mt-2 text-xs text-temple-deep/50">
                  <summary className="cursor-pointer hover:text-temple-saffron select-none">How do I create a token?</summary>
                  <ol className="list-decimal ml-4 mt-2 space-y-1 leading-relaxed">
                    <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="text-temple-saffron underline">github.com/settings/personal-access-tokens/new</a>.</li>
                    <li>Give it a name (e.g. <em>shri catalog</em>) and an expiration.</li>
                    <li>Under <em>Repository access</em>, choose <strong>Only select repositories</strong> → this repository.</li>
                    <li>Under <em>Permissions → Repository permissions</em>, set <strong>Contents: Read and write</strong>.</li>
                    <li>Generate, copy the token (<code>github_pat_…</code>), and paste it above.</li>
                  </ol>
                  <p className="mt-2">The token never leaves this browser (stored in localStorage only).</p>
                </details>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="owner" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Owner</label>
                  <input id="owner" type="text" value={repo.owner} onChange={(e) => setRepo({ ...repo, owner: e.target.value.trim() })}
                    className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep focus:outline-none focus:border-temple-saffron" />
                </div>
                <div>
                  <label htmlFor="repo" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Repository</label>
                  <input id="repo" type="text" value={repo.repo} onChange={(e) => setRepo({ ...repo, repo: e.target.value.trim() })}
                    className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep focus:outline-none focus:border-temple-saffron" />
                </div>
                <div>
                  <label htmlFor="branch" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Branch</label>
                  <input id="branch" type="text" value={repo.branch} onChange={(e) => setRepo({ ...repo, branch: e.target.value.trim() })}
                    className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep focus:outline-none focus:border-temple-saffron" />
                </div>
              </div>

              <button type="submit" disabled={connecting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg saffron-gradient text-white text-sm font-semibold shadow-lg shadow-temple-saffron/25 hover:brightness-110 transition-all disabled:opacity-60">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </section>
        )}

        {connected && (
          <>
            {/* Add product */}
            <section className="bg-white rounded-2xl border border-temple-gold/15 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <Plus className="w-4 h-4 text-temple-saffron" />
                <h2 className="text-lg font-bold text-temple-deep">Add a product</h2>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="p-name" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Name *</label>
                    <input id="p-name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Oudh Royale"
                      className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep placeholder:text-temple-deep/30 focus:outline-none focus:border-temple-saffron" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="p-cat" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Category</label>
                      <input id="p-cat" type="text" list="categories" value={category} onChange={(e) => setCategory(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep focus:outline-none focus:border-temple-saffron" />
                      <datalist id="categories">
                        {[...new Set(products.map((p) => p.category))].map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label htmlFor="p-price" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Price (₹) *</label>
                      <input id="p-price" type="text" required inputMode="numeric" value={price}
                        onChange={(e) => setPrice(e.target.value)} placeholder="299"
                        className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep placeholder:text-temple-deep/30 focus:outline-none focus:border-temple-saffron" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
                  <div>
                    <label htmlFor="p-img" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Image URL</label>
                    <input id="p-img" type="text" value={image} onChange={(e) => setImage(e.target.value)}
                      placeholder="/images/product1.png or https://…"
                      className="w-full h-10 px-3 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep placeholder:text-temple-deep/30 focus:outline-none focus:border-temple-saffron" />
                    <p className="text-[11px] text-temple-deep/40 mt-1">
                      Use one of the bundled images (/images/product1–6.png) or paste any image URL.
                    </p>
                  </div>
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-temple-gold/20 bg-temple-cream shrink-0">
                    <img src={image} alt="Preview" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.25' }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }} />
                  </div>
                </div>

                <div>
                  <label htmlFor="p-desc" className="block text-xs font-semibold text-temple-deep/70 mb-1.5">Description</label>
                  <textarea id="p-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short line shown under the product on the landing page."
                    className="w-full px-3 py-2.5 rounded-lg border border-temple-gold/25 bg-temple-cream/50 text-sm text-temple-deep placeholder:text-temple-deep/30 focus:outline-none focus:border-temple-saffron resize-y" />
                </div>

                <button type="submit" disabled={busy || loading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg saffron-gradient text-white text-sm font-semibold shadow-lg shadow-temple-saffron/25 hover:brightness-110 transition-all disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {busy ? 'Saving…' : 'Add product'}
                </button>
              </form>
            </section>

            {/* Product list */}
            <section className="bg-white rounded-2xl border border-temple-gold/15 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-temple-saffron" />
                  <h2 className="text-lg font-bold text-temple-deep">Catalog</h2>
                </div>
                <span className="text-xs text-temple-deep/45">
                  {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}
                </span>
              </div>

              {products.length === 0 && !loading ? (
                <p className="text-sm text-temple-deep/50 py-8 text-center">
                  No products yet — add the first one above.
                </p>
              ) : (
                <ul className="divide-y divide-temple-gold/10">
                  {products.map((p) => (
                    <li key={p.id} className="flex items-center gap-4 py-3.5">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-temple-gold/15 bg-temple-cream shrink-0">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/images/product1.png' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-temple-deep text-sm truncate">{p.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-temple-deep/6 text-temple-deep/60 text-[10px] font-semibold">
                            {p.category}
                          </span>
                        </div>
                        <p className="text-xs text-temple-deep/45 truncate mt-0.5">{p.description || '—'}</p>
                      </div>
                      <span className="text-sm font-bold text-temple-saffron shrink-0">₹{p.price}</span>
                      <button type="button" onClick={() => void handleDelete(p)} disabled={busy}
                        aria-label={`Delete ${p.name}`}
                        className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-[11px] text-temple-deep/40 text-center leading-relaxed">
              Each change is a commit to <code className="px-1 rounded bg-temple-gold/10">{FILE_PATH}</code>.
              The landing page picks it up within a minute (raw-content cache), and every future
              rebuild bakes it in permanently.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
