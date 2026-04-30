import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
