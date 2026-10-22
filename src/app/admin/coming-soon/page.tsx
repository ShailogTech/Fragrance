import Link from "next/link";

export default function ComingSoon({
  searchParams,
}: {
  searchParams: { feature?: string };
}) {
  const f = searchParams.feature ?? "This feature";
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
        🛠
      </div>
      <h2 className="mt-4 text-2xl font-bold text-ink">{f}</h2>
      <p className="mt-2 text-sm text-ink-muted">
        This admin feature is scaffolded and not yet wired to a backend
        integration. The dashboard layout and access control are live.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-hover"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
