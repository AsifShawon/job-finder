import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-500 focus:border-primary dark:border-slate-700 dark:bg-slate-900/80",
        className,
      )}
      {...props}
    />
  );
}
