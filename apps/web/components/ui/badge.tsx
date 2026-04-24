import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide dark:border-slate-700 dark:bg-slate-900/80",
        className,
      )}
    >
      {children}
    </span>
  );
}
