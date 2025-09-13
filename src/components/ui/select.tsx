
import * as React from "react";
import { cn } from "./utils";

type Ctx = { value: string; setValue: (v:string)=>void };
const Context = React.createContext<Ctx | null>(null);

export function Select({ value, onValueChange, children }:{ value?:string; onValueChange?:(v:string)=>void; children:React.ReactNode }) {
  const [val, setVal] = React.useState(value ?? "");
  React.useEffect(()=>{ if (value !== undefined) setVal(value); }, [value]);
  const setValue = (v:string) => { setVal(v); onValueChange?.(v); };
  return <Context.Provider value={{ value: val, setValue }}>{children}</Context.Provider>;
}
export function SelectTrigger({ className, children }: React.HTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("h-8 rounded-xl border px-2 text-sm", className)}>{children}</button>;
}
export function SelectContent({ children }: { children:React.ReactNode }) {
  return <div className="mt-1 rounded-xl border bg-white p-1 inline-block">{children}</div>;
}
export function SelectItem({ value, children }:{ value:string; children:React.ReactNode }) {
  const ctx = React.useContext(Context)!;
  const active = ctx.value === value;
  return (
    <div onClick={()=>ctx.setValue(value)} className={cn("px-3 py-1 rounded-lg cursor-pointer text-sm", active ? "bg-gray-900 text-white" : "hover:bg-gray-100")}>
      {children}
    </div>
  );
}
export function SelectValue() {
  const ctx = React.useContext(Context)!;
  return <span>{ctx.value || "Select"}</span>;
}
