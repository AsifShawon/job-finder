import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-card",
        className
      )}
    >
      {children}
    </section>
  );
}
