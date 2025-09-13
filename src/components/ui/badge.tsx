
import * as React from "react";
import { cn } from "./utils";

export function Badge({ children, variant="default", className }:{ children:React.ReactNode; variant?:"default"|"secondary"|"destructive"; className?:string }) {
  const variants = {
    default: "bg-gray-900 text-white",
    secondary: "bg-gray-100 text-gray-900",
    destructive: "bg-red-600 text-white",
  } as const;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", variants[variant], className)}>{children}</span>;
}
