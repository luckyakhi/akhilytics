
import * as React from "react";
import { cn } from "./utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn("h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-gray-300", className)} {...rest} />;
}
