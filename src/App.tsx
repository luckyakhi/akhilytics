
import React, { useMemo, useState, useEffect } from "react";
import { DndContext, useDroppable, useDraggable, closestCenter, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area
} from "recharts";
// Fixed: alias valid Link icon to LinkIcon
import { Plus, Trash2, Calculator, Link as LinkIcon, Settings2, Filter, PieChart as PieIcon, BarChartBig, LineChart as LineIcon, Layers3, Table, LayoutDashboard, Columns3, Rows3, SlidersHorizontal } from "lucide-react";

/**
 * Tableau-like React Mockup
 * ---------------------------------------------
 * Goals
 *  - Data pane: dimensions vs measures
 *  - Drag shelves: Columns, Rows, Filters, Marks (Color, Size, Label)
 *  - Chart types switcher (bar, line, area, pie, scatter, table)
 *  - Calculated fields (simple expressions)
 *  - Quick aggregations (SUM, AVG, COUNT, MIN, MAX)
 *  - Dashboard tab with 2 worksheets and cross-filtering
 *  - Sample dataset (Retail sales)
 *  - Parameter controls (single value)
 *  - Export config (JSON)
 *  - Clean, modern UI with Tailwind "components"
 *
 * Self-tests: A tiny built-in suite renders at bottom to validate core utilities.
 */

// ---------------------- Mock Data ----------------------
const seedData = (() => {
  const regions = ["East", "West", "Central", "South"];
  const categories = ["Furniture", "Office Supplies", "Technology"];
  const subcats: Record<string, string[]> = {
    Furniture: ["Chairs", "Tables", "Bookcases", "Furnishings"],
    "Office Supplies": ["Binders", "Paper", "Storage", "Art"],
    Technology: ["Phones", "Accessories", "Machines", "Copiers"],
  };
  const segments = ["Consumer", "Corporate", "Home Office"];
  const products = [
    "Alpha Desk", "Bravo Chair", "Comet Phone", "Delta Binder", "Echo Table",
    "Falcon Copier", "Gemini Machine", "Helix Case", "Iota Paper", "Juno Lamp"
  ];
  const rows: any[] = [];
  const start = new Date("2023-01-01").getTime();
  for (let i = 0; i < 500; i++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const sub = subcats[cat][Math.floor(Math.random() * subcats[cat].length)];
    const date = new Date(start + Math.random() * (1000 * 60 * 60 * 24 * 700));
    const qty = 1 + Math.floor(Math.random() * 8);
    const price = 20 + Math.floor(Math.random() * 800);
    const sales = +(qty * price * (0.8 + Math.random()*0.6)).toFixed(2);
    const profit = +((sales * (Math.random()*0.4 - 0.1))).toFixed(2);
    rows.push({
      OrderID: `ORD-${10000 + i}`,
      OrderDate: date.toISOString().slice(0,10),
      Year: date.getFullYear(),
      Month: date.toISOString().slice(0,7),
      Region: regions[Math.floor(Math.random() * regions.length)],
      Segment: segments[Math.floor(Math.random() * segments.length)],
      Category: cat,
      SubCategory: sub,
      Product: products[Math.floor(Math.random() * products.length)],
      Quantity: qty,
      UnitPrice: price,
      Sales: sales,
      Profit: profit,
      Discount: +(Math.random() * 0.3).toFixed(2),
      ShipDays: 1 + Math.floor(Math.random()*12),
    });
  }
  return rows;
})();

// Derived field metadata
const FIELD_META: Record<string, { type: "dimension" | "measure" | "date"; fmt?: string }> = {
  OrderID: { type: "dimension" },
  OrderDate: { type: "date", fmt: "date" },
  Year: { type: "dimension" },
  Month: { type: "dimension" },
  Region: { type: "dimension" },
  Segment: { type: "dimension" },
  Category: { type: "dimension" },
  SubCategory: { type: "dimension" },
  Product: { type: "dimension" },
  Quantity: { type: "measure" },
  UnitPrice: { type: "measure" },
  Sales: { type: "measure" },
  Profit: { type: "measure" },
  Discount: { type: "measure" },
  ShipDays: { type: "measure" },
};

// ---------------------- Utilities ----------------------
const isMeasure = (f: string) => FIELD_META[f]?.type === "measure";
const isDate = (f: string) => FIELD_META[f]?.type === "date";

type Agg = "SUM"|"AVG"|"MIN"|"MAX"|"COUNT";

function aggregate(data: any[], dims: string[], measures: { field: string; agg: Agg }[]) {
  // Group by dims, reduce measures
  const keyOf = (row: any) => dims.map(d => String(row[d])).join("|#|");
  const groups = new Map<string, any>();
  for (const row of data) {
    const k = keyOf(row);
    if (!groups.has(k)) groups.set(k, { __count: 0, __rows: [], ...dims.reduce((o, d) => (o[d]=row[d], o), {} as any) });
    const g = groups.get(k);
    g.__count += 1;
    g.__rows.push(row);
  }
  // compute measures
  const out: any[] = [];
  for (const g of groups.values()) {
    const rec: any = { ...g };
    for (const m of measures) {
      const vals = g.__rows.map((r: any)=>r[m.field]).filter((v: any)=> typeof v === 'number');
      const sum = vals.reduce((a:number,b:number)=>a+b,0);
      const mean = vals.length ? sum/vals.length : 0;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const count = g.__rows.length;
      const map: Record<Agg, number> = {
        SUM: sum,
        AVG: mean,
        MIN: min,
        MAX: max,
        COUNT: count,
      } as any;
      rec[`${m.agg}(${m.field})`] = map[m.agg];
    }
    out.push(rec);
  }
  return out;
}

// Simple expression evaluator for calculated fields (limited, safe subset)
function evalCalc(expr: string, row: any) {
  // Replace field names in {Field} syntax
  let safe = expr.replace(/\{([^}]+)\}/g, (_, f) => {
    const v = row[f.trim()];
    return typeof v === 'number' ? String(v) : '0';
  });
  try {
    const val = Function(`return (${safe})`)();
    if (Number.isFinite(val)) return val as number;
  } catch {}
  return 0;
}

// ---------------------- Drag & Drop ----------------------
function DraggableField({ id, label }: { id: string; label?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style}
      className={`px-2 py-1 rounded-md border text-sm cursor-grab select-none ${isDragging?"opacity-70":""}`}>
      <span className={isMeasure(id)?"font-semibold":""}>{label ?? id}</span>
      {isMeasure(id) && <Badge className="ml-2" variant="secondary">#</Badge>}
    </div>
  );
}

function DropZone({ id, title, items, onRemove }: { id: string; title: string; items: string[]; onRemove?: (f: string)=>void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="border rounded-xl p-2">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2"><Layers3 className="w-4 h-4"/> {title}</div>
      <div ref={setNodeRef} className={`min-h-[44px] flex flex-wrap gap-2 p-2 rounded-lg ${isOver?"bg-indigo-50":"bg-gray-50"}`}>
        {items.length === 0 && <div className="text-xs text-gray-400">Drag fields here</div>}
        {items.map(f => (
          <div key={f} className="px-2 py-1 bg-white rounded-md border text-sm flex items-center gap-2">
            <span className={isMeasure(f)?"font-semibold":""}>{f}</span>
            {onRemove && <button onClick={()=>onRemove(f)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------- Worksheet ----------------------

type ShelfState = {
  columns: string[];
  rows: string[];
  filters: { field: string; values: string[] }[];
  measuresAgg: Record<string, Agg>; // field->agg
  marks: { color?: string; size?: string; label?: string };
  chart: "bar"|"line"|"area"|"pie"|"scatter"|"table";
  calcFields: { name: string; expr: string }[];
  parameter: { name: string; value: number };
};

const DEFAULT_SHELF: ShelfState = {
  columns: ["Month"],
  rows: ["Sales"],
  filters: [],
  measuresAgg: { Sales: "SUM" },
  marks: { color: "Category", size: undefined, label: undefined },
  chart: "bar",
  calcFields: [{ name: "ProfitRatio", expr: "{Profit} / ({Sales} + 0.0001)" }],
  parameter: { name: "Target %", value: 0.1 },
};

function Worksheet({ name, data, onCrossFilter }:{ name: string; data: any[]; onCrossFilter?: (f: string, v: string)=>void }){
  const [fields] = useState<string[]>(Object.keys(FIELD_META));
  const [shelf, setShelf] = useState<ShelfState>(DEFAULT_SHELF);
  const [activeDrag, setActiveDrag] = useState<string|undefined>();
  const sensors = useSensors(useSensor(PointerSensor));

  // Build dataset with calc fields
  const augmented = useMemo(()=>{
    return data.map(r => {
      const withCalc: any = { ...r };
      for (const c of shelf.calcFields) {
        withCalc[c.name] = evalCalc(c.expr, r);
        if (!FIELD_META[c.name]) FIELD_META[c.name] = { type: "measure" } as any;
      }
      return withCalc;
    });
  }, [data, shelf.calcFields]);

  // Apply filters
  const filtered = useMemo(()=>{
    if (shelf.filters.length === 0) return augmented;
    return augmented.filter(r => shelf.filters.every(f => f.values.length===0 || f.values.includes(String(r[f.field]))));
  }, [augmented, shelf.filters]);

  // Build aggregates
  const dims = [...shelf.columns.filter(f=>!isMeasure(f)), ...shelf.rows.filter(f=>!isMeasure(f))];
  const measureFields = [...new Set([...shelf.columns, ...shelf.rows].filter(isMeasure))];
  const measures = measureFields.map(f => ({ field: f, agg: shelf.measuresAgg[f] || "SUM" as Agg }));
  const viewData = useMemo(()=> aggregate(filtered, dims.length?dims:["Month"], measures.length?measures:[{ field: "Sales", agg: "SUM" }]), [filtered, JSON.stringify(dims), JSON.stringify(measures)]);

  // Domain values for filter pickers
  const domains = useMemo(()=>{
    const d: Record<string, string[]> = {};
    for (const f of fields.filter(x=>!isMeasure(x))) {
      d[f] = Array.from(new Set(augmented.map(r=>String(r[f])))).sort();
    }
    return d;
  }, [fields, augmented]);

  // DnD Handlers
  function handleDragEnd(e:any){
    const id = e.active?.id as string;
    const over = e.over?.id as string;
    setActiveDrag(undefined);
    if (!id || !over) return;
    if (["columns","rows","marks-color","marks-size","marks-label","filters"].includes(over)){
      setShelf(s => {
        const next = { ...s } as ShelfState;
        if (over === "columns") next.columns = Array.from(new Set([...s.columns, id]));
        if (over === "rows") next.rows = Array.from(new Set([...s.rows, id]));
        if (over === "filters" && !isMeasure(id)) next.filters = [...s.filters, { field: id, values: [] }];
        if (over === "marks-color") next.marks = { ...s.marks, color: id };
        if (over === "marks-size" && isMeasure(id)) next.marks = { ...s.marks, size: id };
        if (over === "marks-label") next.marks = { ...s.marks, label: id };
        return next;
      });
    }
  }

  // Chart rendering
  function ChartView(){
    if (shelf.chart === "table") return <DataGrid data={viewData}/>;

    // Guess X axis (first dimension) and Y keys (measure fields)
    const xKey = [...shelf.columns, ...shelf.rows].find(f => !isMeasure(f)) || "Month";
    const yKeys = Object.keys(viewData[0] || {}).filter(k => /^(SUM|AVG|MIN|MAX|COUNT)\(/.test(k));

    if (shelf.chart === "pie" && yKeys.length >= 1){
      const vKey = yKeys[0];
      return (
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Tooltip/>
            <Legend/>
            <Pie data={viewData} dataKey={vKey} nameKey={xKey} outerRadius={120} fill="#8884d8" label/>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (shelf.chart === "scatter" && yKeys.length >= 2){
      return (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey={yKeys[0]} name={yKeys[0]} />
            <YAxis dataKey={yKeys[1]} name={yKeys[1]} />
            <Tooltip/>
            <Legend/>
            <Scatter data={viewData} fill="#8884d8" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (shelf.chart === "line"){
      return (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={viewData}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey={xKey}/>
            <YAxis/>
            <Tooltip/>
            <Legend/>
            {yKeys.map(k => <Line key={k} type="monotone" dataKey={k} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (shelf.chart === "area"){
      return (
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={viewData}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey={xKey}/>
            <YAxis/>
            <Tooltip/>
            <Legend/>
            {yKeys.map(k => <Area key={k} type="monotone" dataKey={k} stackId={1} />)}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // default bar
    return (
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={viewData}>
          <CartesianGrid strokeDasharray="3 3"/>
          <XAxis dataKey={xKey}/>
          <YAxis/>
          <Tooltip/>
          <Legend/>
          {yKeys.map(k => <Bar key={k} dataKey={k} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Marks (Color/Label) legend + simple highlight
  const [highlight, setHighlight] = useState<{ field: string; value: string }|null>(null);
  const colorField = shelf.marks.color && !isMeasure(shelf.marks.color) ? shelf.marks.color : undefined;
  const colorDomain = colorField ? Array.from(new Set(filtered.map(r=>String(r[colorField!])))) : [];

  function handleColorClick(v: string){
    setHighlight(h => h && h.value === v ? null : { field: colorField!, value: v });
    if (onCrossFilter && colorField) onCrossFilter(colorField, v);
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left Data Pane */}
      <div className="col-span-3 space-y-3">
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Data</h3>
              <Badge variant="secondary">{seedData.length} rows</Badge>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500 mb-1">Dimensions</div>
              <div className="flex flex-wrap gap-2">
                {fields.filter(f=>!isMeasure(f)).map(f => <DraggableField key={f} id={f} />)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500 mb-1">Measures</div>
              <div className="flex flex-wrap gap-2">
                {fields.filter(isMeasure).map(f => <DraggableField key={f} id={f} />)}
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs uppercase text-gray-500 mb-1 flex items-center gap-2"><Calculator className="w-4 h-4"/> Calculated Fields</div>
              {shelf.calcFields.map((c,i)=>(
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Badge>{c.name}</Badge>
                  <span className="text-xs text-gray-500">{c.expr}</span>
                </div>
              ))}
              <CalcEditor onAdd={(name,expr)=>setShelf(s=>({...s, calcFields:[...s.calcFields, {name,expr}]}))} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center: Shelves + Viz */}
      <div className="col-span-9 space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={e=>setActiveDrag(e.active?.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6 space-y-2">
              <DropZone id="columns" title="Columns" items={shelf.columns} onRemove={(f)=>setShelf(s=>({...s, columns: s.columns.filter(x=>x!==f)}))} />
              <DropZone id="rows" title="Rows" items={shelf.rows} onRemove={(f)=>setShelf(s=>({...s, rows: s.rows.filter(x=>x!==f)}))} />
            </div>
            <div className="col-span-6 space-y-2">
              <DropZone id="filters" title="Filters" items={shelf.filters.map(f=>f.field)} onRemove={(f)=>setShelf(s=>({...s, filters: s.filters.filter(x=>x.field!==f)}))} />
              <Card className="p-3">
                <div className="text-xs uppercase text-gray-500 mb-2 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4"/> Marks</div>
                <div className="grid grid-cols-3 gap-2">
                  <DropZone id="marks-color" title="Color" items={shelf.marks.color?[shelf.marks.color]:[]} onRemove={()=>setShelf(s=>({...s, marks:{...s.marks, color: undefined}}))} />
                  <DropZone id="marks-size" title="Size (measure)" items={shelf.marks.size?[shelf.marks.size]:[]} onRemove={()=>setShelf(s=>({...s, marks:{...s.marks, size: undefined}}))} />
                  <DropZone id="marks-label" title="Label" items={shelf.marks.label?[shelf.marks.label]:[]} onRemove={()=>setShelf(s=>({...s, marks:{...s.marks, label: undefined}}))} />
                </div>
              </Card>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ChartPicker value={shelf.chart} onChange={(chart)=>setShelf(s=>({...s, chart}))}/>
            <div className="ml-auto flex items-center gap-3">
              <ParamControl value={shelf.parameter.value} onChange={(v)=>setShelf(s=>({...s, parameter:{...s.parameter, value:v}}))} label={shelf.parameter.name}/>
              <AggPicker measuresAgg={shelf.measuresAgg} onChange={(m)=>setShelf(s=>({...s, measuresAgg:m}))} measureCandidates={[...new Set([...shelf.columns, ...shelf.rows].filter(isMeasure))]} />
              <ExportConfig shelf={shelf}/>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              {colorField && (
                <div className="mb-2 flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-gray-500">{colorField}:</span>
                  {colorDomain.map(v => (
                    <Button key={v} size="sm" variant={highlight?.value===v?"default":"secondary"} onClick={()=>handleColorClick(v)}>
                      {v}
                    </Button>
                  ))}
                </div>
              )}
              <ChartView/>
            </CardContent>
          </Card>

          <DragOverlay>
            {activeDrag ? <DraggableField id={activeDrag} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Filters UI */}
        {shelf.filters.length>0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="text-xs uppercase text-gray-500 flex items-center gap-2"><Filter className="w-4 h-4"/> Filters</div>
              <div className="grid grid-cols-3 gap-3">
                {shelf.filters.map((f,i)=> (
                  <div key={i} className="border rounded-lg p-2">
                    <div className="text-xs font-medium mb-1">{f.field}</div>
                    <div className="max-h-28 overflow-auto space-y-1">
                      {domains[f.field]?.map(v => (
                        <div key={v} className="flex items-center gap-2">
                          <Checkbox id={`${f.field}-${v}`} checked={f.values.includes(v)}
                            onCheckedChange={(checked)=>setShelf(s=>{
                              const copy = { ...s };
                              const ff = copy.filters[i];
                              ff.values = checked ? Array.from(new Set([...ff.values, v])) : ff.values.filter(x=>x!==v);
                              return copy;
                            })}
                          />
                          <label htmlFor={`${f.field}-${v}`} className="text-sm">{v}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ChartPicker({ value, onChange }:{ value: ShelfState["chart"]; onChange:(v: ShelfState["chart"])=>void }){
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant={value==='bar'?"default":"outline"} onClick={()=>onChange('bar')}><BarChartBig className="w-4 h-4 mr-1"/> Bar</Button>
      <Button size="sm" variant={value==='line'?"default":"outline"} onClick={()=>onChange('line')}><LineIcon className="w-4 h-4 mr-1"/> Line</Button>
      <Button size="sm" variant={value==='area'?"default":"outline"} onClick={()=>onChange('area')}><Layers3 className="w-4 h-4 mr-1"/> Area</Button>
      <Button size="sm" variant={value==='pie'?"default":"outline"} onClick={()=>onChange('pie')}><PieIcon className="w-4 h-4 mr-1"/> Pie</Button>
      <Button size="sm" variant={value==='scatter'?"default":"outline"} onClick={()=>onChange('scatter')}><DotsIcon/> Scatter</Button>
      <Button size="sm" variant={value==='table'?"default":"outline"} onClick={()=>onChange('table')}><Table className="w-4 h-4 mr-1"/> Table</Button>
    </div>
  );
}

function DotsIcon(){
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></svg>
}

function AggPicker({ measuresAgg, onChange, measureCandidates }:{ measuresAgg: Record<string, Agg>, onChange:(m:Record<string, Agg>)=>void, measureCandidates: string[] }){
  return (
    <div className="flex items-center gap-2">
      {measureCandidates.map(m => (
        <div key={m} className="flex items-center gap-1 text-sm">
          <span className="text-gray-500">{m}</span>
          <Select value={measuresAgg[m] || 'SUM'} onValueChange={(v:any)=>onChange({ ...measuresAgg, [m]: v })}>
            <SelectTrigger className="w-24 h-8"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="SUM">SUM</SelectItem>
              <SelectItem value="AVG">AVG</SelectItem>
              <SelectItem value="MIN">MIN</SelectItem>
              <SelectItem value="MAX">MAX</SelectItem>
              <SelectItem value="COUNT">COUNT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

function ParamControl({ value, onChange, label }:{ value:number; onChange:(v:number)=>void; label:string }){
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{label}:</span>
      <Input type="number" value={value} onChange={e=>onChange(parseFloat((e.target as HTMLInputElement).value||'0'))} className="w-24 h-8"/>
    </div>
  );
}

function ExportConfig({ shelf }:{ shelf: ShelfState }){
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(shelf, null, 2);
  return (
    <Button size="sm" variant="outline" onClick={()=>{ navigator.clipboard?.writeText(json); setCopied(true); setTimeout(()=>setCopied(false), 1200);}}>
      {copied?"Copied": "Export Config"}
    </Button>
  );
}

function CalcEditor({ onAdd }:{ onAdd: (name:string, expr:string)=>void }){
  const [name, setName] = useState("");
  const [expr, setExpr] = useState("{Sales} - {Quantity} * 5");
  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Name" value={name} onChange={e=>setName((e.target as HTMLInputElement).value)} className="h-8"/>
      <Input placeholder="Expression (use {Field})" value={expr} onChange={e=>setExpr((e.target as HTMLInputElement).value)} className="h-8 flex-1"/>
      <Button size="sm" onClick={()=>{ if(name.trim()) onAdd(name.trim(), expr); setName(""); }}><Plus className="w-4 h-4 mr-1"/>Add</Button>
    </div>
  );
}

function DataGrid({ data }:{ data:any[] }){
  const cols = Object.keys(data[0] || {});
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            {cols.map(c => <th key={c} className="px-2 py-1 text-left font-medium border-b">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 200).map((r,i)=> (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              {cols.map(c => <td key={c} className="px-2 py-1 border-b">{String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------- Dashboard (2 worksheets) ----------------------
function Dashboard(){
  const [crossFilter, setCrossFilter] = useState<{ field: string; value: string }|null>(null);
  const data = useMemo(()=>{
    if (!crossFilter) return seedData;
    return seedData.filter(r => String(r[crossFilter.field]) === crossFilter.value);
  }, [crossFilter]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-6">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><BarChartBig className="w-4 h-4"/><h3 className="font-semibold">Sales by Month</h3></div>
            <Worksheet name="WS1" data={seedData} onCrossFilter={(f,v)=>setCrossFilter({ field:f, value:v })} />
          </CardContent>
        </Card>
      </div>
      <div className="col-span-6">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><LayoutDashboard className="w-4 h-4"/><h3 className="font-semibold">Detail View</h3></div>
            <Worksheet name="WS2" data={data} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------- Self Tests ----------------------
function SelfTests(){
  type T = { name: string; pass: boolean; info?: string };
  const [tests, setTests] = useState<T[]>([]);
  useEffect(()=>{
    const cases: T[] = [];
    try {
      const data = [{ A: 'x', Sales: 10 }, { A: 'x', Sales: 5 }];
      const out = aggregate(data, ['A'], [{ field: 'Sales', agg: 'SUM' }]);
      cases.push({ name: 'aggregate SUM groups & sums', pass: out.length===1 && (out[0]['SUM(Sales)']===15), info: JSON.stringify(out[0]) });

      const out2 = aggregate(data, ['A'], [{ field: 'Sales', agg: 'AVG' }]);
      cases.push({ name: 'aggregate AVG', pass: out2.length===1 && Math.abs(out2[0]['AVG(Sales)']-7.5)<1e-9, info: JSON.stringify(out2[0]) });

      const exprVal = evalCalc('{Sales} - {Quantity} * 5', { Sales: 100, Quantity: 4 });
      cases.push({ name: 'evalCalc basic arithmetic', pass: exprVal===80, info: String(exprVal) });

      cases.push({ name: 'default shelf agg set', pass: DEFAULT_SHELF.measuresAgg.Sales==='SUM' });

      const data3 = [{Cat:'A', Sales: 10},{Cat:'B', Sales: 20},{Cat:'A', Sales: 30}];
      const filtered = data3.filter(r=>['A'].includes(r.Cat));
      const out3 = aggregate(filtered, ['Cat'], [{ field:'Sales', agg:'SUM'}]);
      cases.push({ name: 'filter + aggregate consistency', pass: out3.length===1 && out3[0]['SUM(Sales)']===40 });
    } catch (e:any) {
      cases.push({ name: 'self-tests crashed', pass: false, info: String(e?.message||e) });
    }
    setTests(cases);
  },[]);

  return (
    <Card className="shadow-sm" data-cy="self-tests">
      <CardContent className="p-3">
        <div className="text-xs uppercase text-gray-500 mb-2">Self-Tests</div>
        <ul className="space-y-1">
          {tests.map((t,i)=> (
            <li key={i} className="text-sm">
              <Badge variant={t.pass?"default":"destructive"} className="mr-2">{t.pass?"PASS":"FAIL"}</Badge>
              {t.name} {t.info && <span className="text-gray-400 ml-2">{t.info}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------- App Shell ----------------------
export default function App(){
  const [activeTab, setActiveTab] = useState("worksheet");

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center gap-3">
        <div className="text-2xl font-bold tracking-tight">VizLab</div>
        <Badge variant="secondary">Tableau-like Mockup</Badge>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <Columns3 className="w-4 h-4"/> Columns &nbsp; <Rows3 className="w-4 h-4"/> Rows &nbsp; <Filter className="w-4 h-4"/> Filters
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="worksheet"><BarChartBig className="w-4 h-4 mr-1"/> Worksheet</TabsTrigger>
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1"/> Dashboard</TabsTrigger>
          <TabsTrigger value="data"><Table className="w-4 h-4 mr-1"/> Data Source</TabsTrigger>
        </TabsList>
        <TabsContent value="worksheet">
          <Worksheet name="Main" data={seedData} />
        </TabsContent>
        <TabsContent value="dashboard">
          <Dashboard/>
        </TabsContent>
        <TabsContent value="data">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="text-sm text-gray-600">Mock data: Retail sales (~500 rows). Toggle between "Extract" and "Live" (decorative).</div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm">Live</Button>
                <Button variant="secondary" size="sm">Extract</Button>
                <Button variant="outline" size="sm"><LinkIcon className="w-4 h-4 mr-1"/> Join / Union</Button>
                <Button variant="outline" size="sm"><Settings2 className="w-4 h-4 mr-1"/> Data Types</Button>
              </div>
              <DataGrid data={seedData.slice(0,100)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-gray-500">This is a functional mockup for demo purposes. Features: shelves, drag-drop, chart switch, filters, marks (color/size/label), calculated fields, parameter, exportable config, and a dashboard with cross-filtering.</footer>

      {/* Built-in tiny test harness */}
      <SelfTests/>
    </div>
  );
}
