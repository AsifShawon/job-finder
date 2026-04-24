import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost";

const variants: Record<Variant, string> = {
  default: "bg-primary text-white hover:opacity-90",
  outline: "border border-slate-300 bg-white/60 hover:bg-white dark:bg-slate-900 dark:border-slate-700",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
