import Link from "next/link";
import { UserCog } from "lucide-react";

export default function AdminResellers() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-ink">Resellers</h1>
        <Link
          href="/admin/users"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Manage in Users →
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-hover">
          <UserCog size={26} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-ink">No resellers yet</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Onboard wholesale partners and B2B distributors here. Track their
          discounted pricing and bulk orders separately from retail customers.
        </p>
      </div>
    </>
  );
}
