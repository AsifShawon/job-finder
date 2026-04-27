import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-card text-foreground hover:border-primary hover:text-primary",
  ghost: "text-foreground hover:bg-muted hover:text-primary",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
