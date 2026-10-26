import type { Growth } from "@/lib/score";

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function GrowthBars({ growth, notes = true }: { growth: Growth; notes?: boolean }) {
  const rows = [
    { label: "Trading", value: growth.trade, note: "Fees paid" },
    { label: "Borrowing", value: growth.borrow, note: "Healthy debt, over time" },
    { label: "Saving", value: growth.save, note: "Balance held, over time" },
    { label: "Roots", value: growth.roots, note: "Weeks active" },
  ];
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm font-semibold">
            <span>{r.label}</span>
            <span>{pct(r.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-leaf-soft" style={{ width: pct(r.value) }} />
          </div>
          {notes && <p className="mt-1 text-xs opacity-60">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}
