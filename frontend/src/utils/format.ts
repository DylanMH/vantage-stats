
export function formatScore(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return Number.isFinite(v) ? Number(v).toLocaleString() : "—";
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
