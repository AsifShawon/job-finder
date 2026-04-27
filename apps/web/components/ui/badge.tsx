import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "gov"
  | "category";

const variants: Record<BadgeVariant, string> = {
  default:
    "border-border bg-card text-muted-foreground",
  secondary:
    "border-primary/20 bg-primary/10 text-primary",
  outline:
    "border-border bg-transparent text-muted-foreground",
  success:
    "border-success/30 bg-success/10 text-success",
  warning:
    "border-warning/30 bg-warning/10 text-warning",
  danger:
    "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
  gov:
    "border-green-600/30 bg-green-50 text-green-700 dark:border-green-700/30 dark:bg-green-900/20 dark:text-green-400",
  category:
    "border-primary bg-primary text-primary-foreground",
};

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
