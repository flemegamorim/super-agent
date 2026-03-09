const STATUS_STYLES: Record<string, string> = {
  queued: "bg-zinc-700 text-zinc-300",
  running: "bg-indigo-500/20 text-indigo-400 animate-pulse",
  completed: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-amber-500/20 text-amber-400",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.queued;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
