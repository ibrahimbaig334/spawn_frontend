import type { ButtonHTMLAttributes, ReactNode } from "react";

const BASE =
  "inline-flex min-h-target cursor-pointer items-center justify-center gap-2.5 rounded-sm border-2 px-4 py-2.5 text-center font-bold tracking-[-0.01em] transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-45 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border-[ButtonText] print:bg-transparent print:text-black print:border-black";
const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "border-ink bg-ink text-inverse enabled:hover:border-raised enabled:hover:bg-raised enabled:hover:text-ink",
  secondary:
    "border-ink bg-raised text-ink enabled:hover:bg-ink enabled:hover:text-inverse",
  quiet:
    "border-transparent bg-transparent text-ink enabled:hover:border-surface-strong enabled:hover:bg-surface-strong",
  danger:
    "border-error bg-error text-inverse enabled:hover:bg-raised enabled:hover:text-error",
};

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  fullWidth = false,
  ...props
}: ButtonProps) {
  const classes = [
    BASE,
    VARIANTS[variant],
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
