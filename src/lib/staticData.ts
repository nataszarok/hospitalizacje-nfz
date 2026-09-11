import type { AdmissionPayload, AdmissionRow, EstimationMethod, MortalityPayload, MortalityRow, ReferencePayload } from "@/lib/types";
import { summarize, summarizeAdmissionGeographies, summarizeGeographies } from "@/lib/query";

type ProductTuple = [string, string | null, string | null];
type RegionTuple = [string, string];
type FacilityTuple = [string, string, string, string];
type PopulationTuple = [string, number];
type FactTuple = [string, string, string, string, string, number, number, number, number];

interface StaticDataset {
  version: number;
  analysisYear: string;
  defaultProductCode: string;
  products: ProductTuple[];
  regions: RegionTuple[];
  facilities: FacilityTuple[];
  populations: PopulationTuple[];
  facts: FactTuple[];
}

export interface StaticQuery { products: string[]; durations: string[]; method: EstimationMethod; minHosp: number; }

let datasetPromise: Promise<StaticDataset> | null = null;
export function loadStaticDataset(): Promise<StaticDataset> {
  datasetPromise ??= (async () => {
    const response = await fetch("/data/dashboard.json.gz");
    if (!response.ok || !response.body) throw new Error("Nie udało się pobrać statycznego zbioru danych.");

    if (typeof DecompressionStream === "undefined") {
      throw new Error("Ta przeglądarka nie obsługuje dekompresji danych gzip.");
    }

    const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(decompressed).json() as Promise<StaticDataset>;
  })();
  return datasetPromise;
}

function label(code: string, jgp: string | null, name: string | null) {
  return [jgp, name].filter((x) => x?.trim()).join(" — ") || code;
}

export function referenceFromDataset(d: StaticDataset): ReferencePayload {
  const cities = [...new Set(d.facilities.map((f) => f[3].trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pl"));
  const durations = [...new Set(d.facts.map((f) => f[3]).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pl", { numeric: true }));
  return {
    analysisYear: d.analysisYear, defaultProductCode: d.defaultProductCode,
    products: d.products.map(([code,jgpCode,name]) => ({ code,jgpCode,name,label:label(code,jgpCode,name) })),
    regions: d.regions.map(([owNfz,name]) => ({ owNfz,name })), cities, durations,
  };
}

function context(d: StaticDataset) {
  const facilities = new Map(d.facilities.map(([ow,nip,name,city]) => [`${ow}|${nip}`, { name, city }]));
  const regions = new Map(d.regions);
  const populations = new Map(d.populations);
  return { facilities, regions, populations };
}

function mortalityRows(d: StaticDataset, q: StaticQuery, baseline: boolean): MortalityRow[] {
  if (!q.products.length) return [];
  const selected = new Set(q.products), durations = new Set(q.durations);
  const grouped = new Map<string, {ow:string;nip:string;product:string;h:number;deaths:number}>();
  for (const f of d.facts) {
    const [ow,nip,product,duration,,hSim,hMin,dSim,dMin] = f;
    if (!selected.has(product) || (!baseline && durations.size && !durations.has(duration))) continue;
    const key = `${ow}|${nip}|${product}`;
    const g = grouped.get(key) ?? { ow,nip,product,h:0,deaths:0 };
    g.h += q.method === "sim" ? hSim : hMin;
    g.deaths += q.method === "sim" ? dSim : dMin;
    grouped.set(key,g);
  }
  const totals = new Map<string,number>();
  for (const g of grouped.values()) totals.set(`${g.ow}|${g.nip}`, (totals.get(`${g.ow}|${g.nip}`) ?? 0) + g.h);
  const minHosp = baseline ? 0 : q.minHosp;
  const c = context(d);
  return [...grouped.values()].filter((g) => (totals.get(`${g.ow}|${g.nip}`) ?? 0) >= minHosp).map((g) => {
    const f = c.facilities.get(`${g.ow}|${g.nip}`); const population = c.populations.get(g.ow) ?? 0;
    return { owNfz:g.ow,nip:g.nip,productCode:g.product,providerName:f?.name ?? "",city:f?.city ?? "",voivodeship:c.regions.get(g.ow) ?? g.ow,population,
      hospitalizations:g.h,deaths:g.deaths,mortalityPct:g.h ? g.deaths/g.h*100 : 0,hospitalizationsPer100k:population ? g.h/population*100000 : 0 };
  }).sort((a,b) => b.hospitalizations-a.hospitalizations || a.owNfz.localeCompare(b.owNfz) || a.nip.localeCompare(b.nip));
}

export function mortalityFromDataset(d: StaticDataset, q: StaticQuery): MortalityPayload {
  const rows = mortalityRows(d,q,false), baselineRows = mortalityRows(d,{...q,durations:[],minHosp:0},true);
  return { rows,current:summarize(rows),baseline:summarize(baselineRows),hasComparison:q.minHosp>0||q.durations.length>0,areaStats:summarizeGeographies(rows),baselineAreaStats:summarizeGeographies(baselineRows) };
}

export function admissionsFromDataset(d: StaticDataset, q: StaticQuery): AdmissionPayload {
  if (!q.products.length) return { rows:[], areaStats:{regions:[],cities:[]} };
  const selected = new Set(q.products), durations = new Set(q.durations);
  const grouped = new Map<string,{ow:string;nip:string;product:string;planned:number;urgent:number}>();
  for (const f of d.facts) {
    const [ow,nip,product,duration,admission,hSim,hMin] = f;
    if (!selected.has(product) || (durations.size && !durations.has(duration)) || !["2","3","6"].includes(admission)) continue;
    const key=`${ow}|${nip}|${product}`; const g=grouped.get(key)??{ow,nip,product,planned:0,urgent:0}; const h=q.method==="sim"?hSim:hMin;
    if (admission==="6") g.planned+=h; else g.urgent+=h; grouped.set(key,g);
  }
  const totals=new Map<string,number>(); for(const g of grouped.values()) totals.set(`${g.ow}|${g.nip}`,(totals.get(`${g.ow}|${g.nip}`)??0)+g.planned+g.urgent);
  const c=context(d);
  const rows:AdmissionRow[]=[...grouped.values()].filter(g=>(totals.get(`${g.ow}|${g.nip}`)??0)>=q.minHosp).map(g=>{const f=c.facilities.get(`${g.ow}|${g.nip}`);const population=c.populations.get(g.ow)??0;const total=g.planned+g.urgent;return {owNfz:g.ow,nip:g.nip,productCode:g.product,providerName:f?.name??"",city:f?.city??"",voivodeship:c.regions.get(g.ow)??g.ow,population,plannedAdmissions:g.planned,urgentAdmissions:g.urgent,totalAdmissions:total,plannedAdmissionsPer100k:population?g.planned/population*100000:0,urgentAdmissionsPer100k:population?g.urgent/population*100000:0};}).sort((a,b)=>b.totalAdmissions-a.totalAdmissions);
  return { rows, areaStats:summarizeAdmissionGeographies(rows) };
}
