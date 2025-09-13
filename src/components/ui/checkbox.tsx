
import * as React from "react";

export function Checkbox({ checked, onCheckedChange, id }: { checked?: boolean; onCheckedChange?:(v:boolean)=>void; id?:string }) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={(e)=>onCheckedChange?.(e.target.checked)}
      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-300"
    />
  );
}
