
import * as React from "react";
import { cn } from "./utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive";
  size?: "sm" | "md";
};

export function Button({ className, variant = "default", size="md", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-2xl border text-sm font-medium transition px-3 py-2 shadow-sm";
  const variants = {
    default: "bg-gray-900 text-white border-gray-900 hover:opacity-90",
    secondary: "bg-gray-100 text-gray-900 border-gray-200 hover:bg-gray-200",
    outline: "bg-white text-gray-900 border-gray-300 hover:bg-gray-50",
    destructive: "bg-red-600 text-white border-red-600 hover:opacity-90",
  } as const;
  const sizes = {
    sm: "h-8",
    md: "h-10",
  } as const;
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
