// Pull-based CI/CD deploy agent for the Shri Fragrance Windows server.
//
// Runs under PM2 alongside the app. Every POLL_MS it fetches origin/main;
// when the remote moves AHEAD of the local checkout it deploys:
//   git pull → npm install → next build into .next-new → atomic swap → pm2 restart
//
// Deploys are gated on the commit's GitHub Actions check runs when the repo
// has CI configured: pending waits, failure skips, no CI deploys anyway.
// The staged build (NEXT_DIST_DIR, see next.config.mjs) means a broken build
// never touches the serving .next.
//
// Never exits; safe under PM2 resurrection. Logs go to PM2's log files
// (~/.pm2/logs/deploy-watch-out.log).

import { execSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'

const REPO = 'C:/Shri_ecommerce/Fragrance'
const SLUG = 'ShailogTech/Fragrance'
const BRANCH = 'main'
const APP = 'shri-fragrance'
const PM2 = `"${path.join(process.env.APPDATA || '', 'npm', 'pm2.cmd')}"`
const POLL_MS = 60_000
const CI_RECHECK_MS = 10 * 60_000 // re-query a sha's CI at most this often
const BUILD_ENV = { ...process.env, NEXT_DIST_DIR: '.next-new' }

const sh = (cmd, opts = {}) =>
  execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()

const log = (msg) => console.log(`[deploy-watch ${new Date().toISOString()}] ${msg}`)

// execSync errors carry the failed command's stdout/stderr; the message alone
// is only "Command failed: …", which says nothing about the cause.
function errDetail(e) {
  const head = (e?.message || String(e)).split('\n')[0]
  const tail = (buf) =>
    (Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf ?? ''))
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-6)
      .join(' | ')
  const detail = [tail(e?.stdout), tail(e?.stderr)].filter(Boolean).join(' || ')
  return detail ? `${head} — ${detail}`.slice(0, 1500) : head
}

function timed(step, fn) {
  const started = Date.now()
  const secs = () => ((Date.now() - started) / 1000).toFixed(0)
  try {
    fn()
  } catch (e) {
    log(`${step} FAILED after ${secs()}s: ${errDetail(e)}`)
    throw e
  }
  log(`${step} done in ${secs()}s`)
}

let deploying = false
const ciCache = new Map() // sha → { status, at }
const skippedShas = new Set() // sha → CI failed, logged once

async function ciStatus(sha) {
  const cached = ciCache.get(sha)
  if (cached && Date.now() - cached.at < CI_RECHECK_MS) return cached.status
  let status
  try {
    const res = await fetch(`https://api.github.com/repos/${SLUG}/commits/${sha}/check-runs`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'shri-deploy-watch' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      // rate-limited or transient API trouble — don't block deploys on it
      status = 'none'
    } else {
      const data = await res.json()
      const runs = data.check_runs || []
      if (runs.length === 0) status = 'none'
      else if (runs.some(r => r.status !== 'completed')) status = 'pending'
      else if (runs.some(r => !['success', 'neutral', 'skipped'].includes(r.conclusion))) status = 'failure'
      else status = 'success'
    }
  } catch {
    status = 'none'
  }
  ciCache.set(sha, { status, at: Date.now() })
  return status
}

function swapBuildDirs() {
  const next = path.join(REPO, '.next')
  const nextNew = path.join(REPO, '.next-new')
  const nextOld = path.join(REPO, '.next-old')
  rmSync(nextOld, { recursive: true, force: true })
  if (existsSync(next)) renameSync(next, nextOld)
  try {
    renameSync(nextNew, next)
  } catch (e) {
    if (existsSync(nextOld)) renameSync(nextOld, next) // put the old build back
    throw e
  }
  rmSync(nextOld, { recursive: true, force: true })
}

async function healthy() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(3_000) })
      if (res.ok) return true
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1_000))
  }
  return false
}

async function deploy(remoteSha) {
  deploying = true
  const localBefore = sh('git rev-parse HEAD')
  // True while the live app is stopped for the build swap: a failure from
  // that point on must always bring it back up.
  let appStopped = false
  log(`deploying ${remoteSha.slice(0, 9)} (from ${localBefore.slice(0, 9)})`)
  try {
    // npm install rewrites package-lock.json whenever it drifts from
    // package.json; left dirty, that file makes the next pull abort.
    sh('git checkout -- package-lock.json || true')
    timed('pull', () => sh(`git pull --ff-only origin ${BRANCH}`))
    timed('install', () => sh('npm install --no-audit --no-fund'))
    log('building...')
    timed('build', () => sh('npm run build', { env: BUILD_ENV }))
    sh(`${PM2} stop ${APP}`)
    appStopped = true
    swapBuildDirs()
    sh(`${PM2} restart ${APP}`)
    appStopped = false
    if (await healthy()) {
      log(`deploy OK — serving ${sh('git rev-parse HEAD').slice(0, 9)}`)
    } else {
      log('WARNING: app did not report healthy within 30s after deploy — check pm2 logs')
    }
  } catch (e) {
    log(`DEPLOY FAILED: ${errDetail(e)}`)
    log('rolling code back to the last deployed commit')
    try {
      sh(`git reset --hard ${localBefore}`)
    } catch (e2) {
      log(`rollback failed too: ${errDetail(e2)}`)
    }
    if (appStopped) {
      restartApp()
    } else {
      // The live app was never touched, but its node_modules may have been by
      // the failed attempt's npm install: resync them to the rolled-back
      // commit, and restart only if that actually changed something.
      try {
        if (/up to date/i.test(sh('npm install --no-audit --no-fund'))) {
          log('rollback complete — live app was never touched, not restarted')
        } else {
          log('rollback changed dependencies — restarting the app on the previous release')
          restartApp()
        }
      } catch (e3) {
        // Leave the running process alone: it serves fine on what it has
        // already loaded, and the next tick retries the deploy.
        log(`could not resync dependencies after rollback (app left running): ${errDetail(e3)}`)
      }
    }
  } finally {
    deploying = false
  }
}

function restartApp() {
  try {
    sh(`${PM2} restart ${APP}`)
  } catch (e) {
    log(`could not restart ${APP} — it may be down: ${errDetail(e)}`)
  }
}

async function tick() {
  if (deploying) return
  let remote, local
  const started = Date.now()
  try {
    sh(`git fetch origin ${BRANCH}`)
    remote = sh(`git rev-parse origin/${BRANCH}`)
    local = sh('git rev-parse HEAD')
  } catch (e) {
    log(`git fetch failed after ${((Date.now() - started) / 1000).toFixed(0)}s: ${errDetail(e)}`)
    return
  }
  if (remote === local) return
  // only fast-forwardable updates: origin must contain the local commit
  try {
    sh(`git merge-base --is-ancestor ${local} ${remote}`)
  } catch {
    if (!skippedShas.has(`diverged:${remote}`)) {
      skippedShas.add(`diverged:${remote}`)
      log(`origin/${BRANCH} (${remote.slice(0, 9)}) diverged from local (${local.slice(0, 9)}) — manual intervention needed`)
    }
    return
  }
  const ci = await ciStatus(remote)
  if (ci === 'pending') return // wait for CI, retry next tick
  if (ci === 'failure') {
    if (!skippedShas.has(remote)) {
      skippedShas.add(remote)
      log(`skipping ${remote.slice(0, 9)} — CI failed`)
    }
    return
  }
  await deploy(remote)
}

log(`watching ${SLUG} ${BRANCH} → ${REPO} (poll ${POLL_MS / 1000}s)`)
const loop = () => tick().catch(e => log(`tick error: ${errDetail(e)}`)).finally(() => setTimeout(loop, POLL_MS))
loop()
