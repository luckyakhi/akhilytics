
import * as React from "react";
import { cn } from "./utils";

type TabsCtx = { value: string; setValue: (v:string)=>void };
const Ctx = React.createContext<TabsCtx | null>(null);

export function Tabs({ value, onValueChange, children }: { value:string; onValueChange:(v:string)=>void; children:React.ReactNode }) {
  return <Ctx.Provider value={{ value, setValue: onValueChange }}>{children}</Ctx.Provider>;
}
export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex gap-2 bg-gray-100 rounded-xl p-1", className)} {...props} />;
}
export function TabsTrigger({ value, children }: { value:string; children:React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button onClick={()=>ctx.setValue(value)} className={cn("px-3 py-1 rounded-lg text-sm", active ? "bg-white shadow border" : "text-gray-600 hover:text-gray-900")}>
      {children}
    </button>
  );
}
export function TabsContent({ value, children }: { value:string; children:React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className="mt-4">{children}</div>;
}
