import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background-color,color,border-color,transform] duration-150 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.98] disabled:pointer-events-none disabled:bg-kraft disabled:text-ink-muted";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-postal-ink text-on-postal-ink hover:bg-postal-ink-deep",
  secondary: "border border-rule-line bg-sheet text-ink hover:bg-kraft",
  ghost: "bg-transparent text-postal-ink hover:bg-postal-ink-wash",
  destructive: "border border-blocked bg-blocked-wash text-blocked hover:bg-blocked-wash/80",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-12 px-5 text-[0.9375rem]",
  sm: "h-11 px-4 text-[0.875rem]",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], className].join(" ");
}

type ButtonOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & ButtonOptions) {
  return <button className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonOptions) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
