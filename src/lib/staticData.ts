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

export function hospitalDirectoryFromDataset(d: StaticDataset): import("@/lib/types").HospitalDirectoryEntry[] {
  return d.facilities.map(([owNfz, nip, name, city]) => ({ key: `${owNfz}|${nip}`, owNfz, nip, name, city }));
}


function isProceduralJgpName(name: string | null | undefined) {
  // W katalogu NFZ symbol (*) oznacza grupę JGP o charakterze zabiegowym.
  return Boolean(name && /\*\s*$/.test(name.trim()));
}

export function hospitalAnalysisFromDataset(d: StaticDataset, facilityKey: string, method: EstimationMethod): import("@/lib/types").HospitalAnalysis | null {
  const facility = d.facilities.find(([ow, nip]) => `${ow}|${nip}` === facilityKey);
  if (!facility) return null;
  const [owNfz, nip, providerName, city] = facility;
  const productMap = new Map(d.products.map(([code, jgpCode, name]) => [code, { jgpCode, name }]));
  const codes = new Map<string, { hospitalizations: number; deaths: number }>();
  let hospitalizations = 0, deaths = 0, planned = 0, urgent = 0, other = 0, national = 0;
  for (const f of d.facts) {
    const [ow, fnip, product, , admission, hSim, hMin, dSim, dMin] = f;
    const h = method === "sim" ? hSim : hMin;
    const de = method === "sim" ? dSim : dMin;
    national += h;
    if (ow !== owNfz || fnip !== nip) continue;
    hospitalizations += h; deaths += de;
    const g = codes.get(product) ?? { hospitalizations: 0, deaths: 0 };
    g.hospitalizations += h; g.deaths += de; codes.set(product, g);
    if (admission === "6") planned += h;
    else if (admission === "2" || admission === "3") urgent += h;
    else other += h;
  }
  const codeStats = [...codes.entries()].filter(([,v]) => v.hospitalizations > 0).map(([productCode, v]) => ({
    productCode, jgpCode: productMap.get(productCode)?.jgpCode ?? null, hospitalizations: v.hospitalizations, deaths: v.deaths,
    mortalityPct: v.hospitalizations ? v.deaths / v.hospitalizations * 100 : 0,
    sharePct: hospitalizations ? v.hospitalizations / hospitalizations * 100 : 0,
  })).sort((a,b) => b.hospitalizations - a.hospitalizations || a.productCode.localeCompare(b.productCode));
  return { key: facilityKey, owNfz, nip, providerName, city, voivodeship: new Map(d.regions).get(owNfz) ?? owNfz,
    hospitalizations, deaths, mortalityPct: hospitalizations ? deaths / hospitalizations * 100 : 0,
    nationalSharePct: national ? hospitalizations / national * 100 : 0,
    uniqueJgp: codeStats.length, uniqueJgpOver10: codeStats.filter((x) => x.hospitalizations > 10).length,
    proceduralHospitalizations: codeStats.reduce((sum, x) => sum + (isProceduralJgpName(productMap.get(x.productCode)?.name) ? x.hospitalizations : 0), 0),
    proceduralSharePct: hospitalizations ? codeStats.reduce((sum, x) => sum + (isProceduralJgpName(productMap.get(x.productCode)?.name) ? x.hospitalizations : 0), 0) / hospitalizations * 100 : 0,
    codes: codeStats, admissions: { planned, urgent, other, total: planned + urgent + other } };
}


function median(values: number[]) {
  if (!values.length) return 0;
  const x = [...values].sort((a,b) => a-b);
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m-1] + x[m]) / 2;
}

export interface HospitalPeerSelectionEntry {
  similarityPct: number;
  distanceScore?: number;
  peerGrade?: "A" | "B";
  structuralPct?: number; clinicalPct?: number; wardTypesPct?: number; wardBedsPct?: number;
  hospitalScalePct?: number; bedScalePct?: number; scalePct?: number;
  wardCountScalePct?: number; complexityPct?: number;
  jgpSetPct?: number; jgpRankPct?: number; jgpProportionPct?: number; urgentModePct?: number;
  sharedJgp?: number; targetJgp?: number; peerJgp?: number;
  targetHospitalizations?: number; peerHospitalizations?: number;
  targetDeaths?: number; peerDeaths?: number;
  targetCoreBeds?: number; peerCoreBeds?: number;
  targetCoreTypes?: number; peerCoreTypes?: number;
  targetCoreXSupported?: number; peerCoreXSupported?: number;
  targetClinics?: number; peerClinics?: number;
  sharedCoreTypes?: number;
  coreTypeSetSimilarity?: number; jgpSetSimilarity?: number; jgpSharedVolumeSimilarity?: number;
  bedCosineSimilarity?: number; bedWeightedJaccardSimilarity?: number;
}

export function hospitalPeerBenchmarkFromDataset(
  d: StaticDataset,
  facilityKey: string,
  method: EstimationMethod,
  rpwdlByNip?: Record<string, {
    liczba_oddzialow?: number;
    liczba_komorek?: number;
    liczba_poradni?: number;
    lozka_ogolem?: number;
    oddzialy?: { nazwa?: string; specjalnosc?: string; kod?: string | null; lozka?: number }[];
    poradnie?: { nazwa?: string; specjalnosc?: string; kod?: string | null; lozka?: number }[];
  }>,
  peerThresholdPct = 75,
  explicitPeers?: Map<string, HospitalPeerSelectionEntry>
): import("@/lib/types").HospitalPeerBenchmark | null {
  const facilityByKey = new Map(d.facilities.map(([ow,nip,name,city]) => [`${ow}|${nip}`, { ow, nip, name, city }]));
  const targetFacility = facilityByKey.get(facilityKey);
  if (!targetFacility) return null;

  const productMap = new Map(d.products.map(([code, jgpCode, name]) => [code, { jgpCode, name }]));
  type Agg = { hosp:number; deaths:number; planned:number; urgent:number; other:number; procedural:number; codes:Map<string,number>; codeDeaths:Map<string,number> };
  const aggs = new Map<string,Agg>();

  for (const f of d.facts) {
    const [ow,nip,product,,admission,hSim,hMin,dSim,dMin] = f;
    const h = method === "sim" ? hSim : hMin;
    if (h <= 0) continue;
    const de = method === "sim" ? dSim : dMin;
    const key = `${ow}|${nip}`;
    let a = aggs.get(key);
    if (!a) { a = { hosp:0,deaths:0,planned:0,urgent:0,other:0,procedural:0,codes:new Map(),codeDeaths:new Map() }; aggs.set(key,a); }
    a.hosp += h; a.deaths += de;
    a.codes.set(product, (a.codes.get(product) ?? 0) + h);
    a.codeDeaths.set(product, (a.codeDeaths.get(product) ?? 0) + de);
    if (admission === "6") a.planned += h;
    else if (admission === "2" || admission === "3") a.urgent += h;
    else a.other += h;
    if (isProceduralJgpName(productMap.get(product)?.name)) a.procedural += h;
  }

  const target = aggs.get(facilityKey);
  if (!target || target.hosp <= 0) return null;

  const coreProfile = (a: Agg) => {
    const core = new Map([...a.codes].filter(([,v]) => v > 10));
    const total = [...core.values()].reduce((s,v) => s+v, 0) || 1;
    return new Map([...core].map(([k,v]) => [k, v/total]));
  };
  const cosineMaps = (a: Map<string,number>, b: Map<string,number>) => {
    let dot=0, aa=0, bb=0;
    for (const v of a.values()) aa += v*v;
    for (const v of b.values()) bb += v*v;
    const [small,other] = a.size <= b.size ? [a,b] : [b,a];
    for (const [k,v] of small) dot += v * (other.get(k) ?? 0);
    return aa && bb ? dot / Math.sqrt(aa*bb) : 0;
  };
  const cleanNip = (v:string) => String(v ?? "").replace(/\D/g,"");
  const normalizeWardText = (w:{nazwa?:string;specjalnosc?:string;kod?:string|null}) =>
    `${w.specjalnosc ?? ""} ${w.nazwa ?? ""}`.toLocaleLowerCase("pl")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g," ").trim();

  const wardClass = (w:{nazwa?:string;specjalnosc?:string;kod?:string|null}): "core" | "support" | "nonacute" => {
    const code = String(w.kod ?? "").trim();
    const text = normalizeWardText(w);

    // NON-ACUTE / organizacyjne: nie wpływają na podobieństwo ostrej działalności JGP.
    // Kody wynikają z przeglądu pełnego RPWDL; tekst jest zabezpieczeniem dla rekordów bez kodu.
    const nonAcuteCodes = new Set([
      "6100","6300","6500","6700",                         // uzdrowiska / sanatoria
      "5160","5162","5170","5172","5174",                 // ZPO / ZOL, w tym psychiatryczne/dziecięce
      "2184",                                               // hospicjum stacjonarne
      "4730","4732","4734",                               // psychiatria sądowa
      "2724","2726","2740","2742","2744","2746","2752", // hostele / ośrodki uzależnień
      "4740","4744","4746","4750",                        // stacjonarne leczenie uzależnień / hostele
      "2300",                                               // rehabilitacja dzienna
      "4900","4910","4950","9000"                         // izba, blok, anestezjologia org., inne
    ]);
    if (nonAcuteCodes.has(code)) return "nonacute";
    if (/\b(sanatori|uzdrowisk|zaklad opiekunczo lecznic|zaklad pielegnacyjno opiekunc|hospicj|psychiatri.*sadow|hostel|blok operacyj|izba przyjec|rehabilitacj.*dzienn|dzienny osrodek|inna i nieokreslona komorka)\b/.test(text)) return "nonacute";

    // SUPPORT/SPECIALIZED: informacja cenna, ale nie może dominować nad profilem ostrym.
    if (
      /^43\d\d$/.test(code) ||                             // rehabilitacja stacjonarna
      /^41(7|8)\d$/.test(code) ||                         // wybrane paliatywne / specjalistyczne
      /^47(0|1|2)\d$/.test(code) ||                       // psychiatria ogólna/specjalistyczna (bez sądowej)
      /\b(rehabilitac|medycyn paliatyw|paliatyw|psychiatr|uzaleznien)\b/.test(text)
    ) return "support";

    return "core";
  };

  const wardKey = (w:{nazwa?:string;specjalnosc?:string;kod?:string|null}) => {
    const code = String(w.kod ?? "").trim();
    if (code) return `k:${code}`;
    const raw = normalizeWardText(w)
      .replace(/\b(oddzial|pododdzial|klinika|szpitalny)\b/g," ")
      .replace(/\s+/g," ").trim();
    return `n:${raw}`;
  };

  const wardVector = (nip:string) => {
    const p = rpwdlByNip?.[cleanNip(nip)] ?? rpwdlByNip?.[nip];
    const m = new Map<string,number>();
    let rawBeds = 0, excludedBeds = 0, supportBeds = 0, coreBeds = 0;

    for (const w of p?.oddzialy ?? []) {
      const beds = Math.max(0, Number(w.lozka ?? 0));
      rawBeds += beds;
      const cls = wardClass(w);
      if (cls === "nonacute") { excludedBeds += beds; continue; }

      // SUPPORT pozostaje w profilu, ale ma połowę siły CORE.
      const weight = cls === "support" ? .5 : 1;
      if (cls === "support") supportBeds += beds; else coreBeds += beds;

      const k = wardKey(w);
      if (k === "n:") continue;
      m.set(k, (m.get(k) ?? 0) + beds * weight);
    }
    return {
      map:m,
      beds:[...m.values()].reduce((s,v)=>s+v,0),
      wards:m.size,
      rawBeds, excludedBeds, supportBeds, coreBeds
    };
  };
  const closeness = (a:number,b:number,scale:number) => Math.exp(-Math.abs(a-b)/scale);
  const urgentShare = (a:Agg) => a.hosp ? a.urgent/a.hosp*100 : 0;
  const procShare = (a:Agg) => a.hosp ? a.procedural/a.hosp*100 : 0;
  const over10 = (a:Agg) => [...a.codes.values()].filter(v => v > 10).length;

  const targetCore = coreProfile(target);
  const targetWards = wardVector(targetFacility.nip);
  const targetHasWardData = targetWards.map.size > 0;
  const regionMap = new Map(d.regions);
  const profileFor = (nip:string) => rpwdlByNip?.[cleanNip(nip)] ?? rpwdlByNip?.[nip];

  const dice = (a:Set<string>, b:Set<string>) => {
    if (!a.size || !b.size) return 0;
    let common=0; for (const x of a) if (b.has(x)) common++;
    return 2*common/(a.size+b.size);
  };
  // Symetryczne podobieństwo skali bez progów odrzucenia.
  // Kara jest celowo stroma: ~2x różnica => ok. 50%, ~3x => ok. 20%.
  const scaleSimilarity = (a:number,b:number) => {
    if (a<=0 || b<=0) return 0;
    const ratio=Math.abs(Math.log(a/b));
    return Math.exp(-Math.pow(ratio/0.98,1.45));
  };
  const wardTypes = (nip:string) => {
    const out=new Set<string>();
    for (const w of profileFor(nip)?.oddzialy ?? []) {
      if (wardClass(w)==="nonacute") continue;
      const k=wardKey(w); if(k!=="n:") out.add(k);
    }
    return out;
  };
  const clinicTypes = (nip:string) => {
    const out=new Set<string>();
    for (const w of profileFor(nip)?.poradnie ?? []) {
      const code=String(w.kod ?? "").trim();
      const text=normalizeWardText(w);
      if(code) out.add(`k:${code}`); else if(text) out.add(`n:${text}`);
    }
    return out;
  };
  const jgpSet = (a:Agg) => new Set([...a.codes].filter(([,v])=>v>10).map(([k])=>k));
  const rankSimilarity = (a:Agg,b:Agg) => {
    // Ważony overlap rankingu, ale bez kary za dokładną pozycję.
    // Ten sam istotny JGP ma znaczenie nawet gdy jest np. #8 w jednym i #25 w drugim szpitalu.
    const ranked=(x:Agg)=>[...x.codes].filter(([,v])=>v>10).sort((p,q)=>q[1]-p[1]).map(([k])=>k);
    const oneWay=(left:string[],right:Set<string>)=>{
      let score=0,weight=0;
      left.forEach((k,i)=>{const w=1/Math.sqrt(i+1);weight+=w;if(right.has(k))score+=w;});
      return weight?score/weight:0;
    };
    const aa=ranked(a),bb=ranked(b);
    return (oneWay(aa,new Set(bb))+oneWay(bb,new Set(aa)))/2;
  };

  const tw=wardTypes(targetFacility.nip), tc=clinicTypes(targetFacility.nip), tj=jgpSet(target);
  const tp=profileFor(targetFacility.nip);

  const ranked = [...aggs.entries()]
    .filter(([key,a]) => key !== facilityKey && (explicitPeers ? explicitPeers.has(key) : a.hosp >= Math.max(100,target.hosp*.10)))
    .map(([key,a]) => {
      const f=facilityByKey.get(key)!; const cp=profileFor(f.nip);
      const cw=wardVector(f.nip);
      if(targetHasWardData && cw.map.size===0 && !explicitPeers?.has(key)) return null;

      // ETAP A — struktura placówki.
      const peerWardTypes=wardTypes(f.nip);
      const wardTypeScore=dice(tw,peerWardTypes);
      const wardBedScore=targetHasWardData?cosineMaps(targetWards.map,cw.map):0;
      const clinicTypeScore=dice(tc,clinicTypes(f.nip));

      // 1) STRUKTURA: typ placówki, niezależnie od jej bezwzględnej wielkości.
      // Rodzaje oddziałów są najważniejsze; rozkład łóżek mówi, jak te oddziały są zbalansowane.
      const structural=targetHasWardData
        ? .60*wardTypeScore+.40*wardBedScore
        : wardTypeScore;

      // 2) SKALA: realna wielkość placówki. Bez bramek — duża różnica po prostu mocno obniża score.
      const bedScale=scaleSimilarity(cw.coreBeds,targetWards.coreBeds);
      const hospScale=scaleSimilarity(a.hosp,target.hosp);
      const wardCountScale=scaleSimilarity(peerWardTypes.size,tw.size);
      const cellCountScale=tp&&cp?scaleSimilarity(cp.liczba_komorek??0,tp.liczba_komorek??0):0;

      // 3) SKALA: wyłącznie fizyczna/operacyjna wielkość szpitala.
      const scale=.60*bedScale+.40*hospScale;

      // 4) ZŁOŻONOŚĆ ORGANIZACYJNA: jak rozbudowana jest organizacja.
      const complexity=.50*wardCountScale+.50*cellCountScale;

      // 3) PROFIL DZIAŁALNOŚCI JGP: jedna symetryczna miara na realnych wolumenach.
      // sqrt(hosp.) ogranicza dominację największych JGP, ale nadal premiuje istotne klinicznie kody.
      const jgpActivity = (x:Agg) => new Map(
        [...x.codes].filter(([,v])=>v>10).map(([k,v])=>[k,Math.sqrt(v)] as [string,number])
      );
      const jgpA=jgpActivity(target), jgpB=jgpActivity(a);
      const clinical=Math.max(0,Math.min(1,cosineMaps(jgpA,jgpB)));

      // Jeden wynik. Zero progów pośrednich i zero specjalnych ścieżek kwalifikacji.
      // Cztery niezależne wymiary: co leczy, jaki ma profil oddziałowy,
      // jak duży jest i jak rozbudowana jest jego organizacja.
      const similarity=.35*clinical+.30*structural+.25*scale+.10*complexity;

      // Zachowujemy diagnostyczne miary zestawu/rankingu wyłącznie do hovera.
      const pj=jgpSet(a); const setScore=dice(tj,pj); const rankScore=rankSimilarity(target,a);
      const propScore=Math.max(0,Math.min(1,cosineMaps(targetCore,coreProfile(a))));
      const urgent=closeness(urgentShare(a),urgentShare(target),24);
      const cellCount=cellCountScale;
      const clinicCount=tp&&cp?scaleSimilarity(cp.liczba_poradni??0,tp.liczba_poradni??0):0;
      const size=hospScale;
      let shared=0; for(const code of tj) if(pj.has(code)) shared++;
      const explicit = explicitPeers?.get(key);

      return {
        key,providerName:f.name,city:f.city,voivodeship:regionMap.get(f.ow)??f.ow,
        similarityPct:explicit?.similarityPct ?? similarity*100,
        distanceScore:explicit?.distanceScore, peerGrade:explicit?.peerGrade,
        hospitalizations:a.hosp,
        mortalityPct:a.hosp ? a.deaths/a.hosp*100 : 0,
        proceduralSharePct:procShare(a),urgentSharePct:urgentShare(a),uniqueJgpOver10:explicit?.peerJgp ?? over10(a),
        coreBeds:explicit?.peerCoreBeds ?? cw.coreBeds, coreWards:explicit?.peerCoreTypes ?? wardTypes(f.nip).size,
        cellCount:explicit?.peerCoreXSupported ?? cp?.liczba_komorek ?? 0, clinicCount:explicit?.peerClinics ?? cp?.liczba_poradni ?? 0,
        pairMetrics:explicit ? {
          targetHospitalizations:target.hosp, peerHospitalizations:a.hosp,
          targetDeaths:target.deaths, peerDeaths:a.deaths,
          targetCoreBeds:explicit.targetCoreBeds ?? 0, peerCoreBeds:explicit.peerCoreBeds ?? 0,
          targetCoreTypes:explicit.targetCoreTypes ?? 0, peerCoreTypes:explicit.peerCoreTypes ?? 0,
          targetCoreXSupported:explicit.targetCoreXSupported ?? 0, peerCoreXSupported:explicit.peerCoreXSupported ?? 0,
          targetClinics:explicit.targetClinics ?? 0, peerClinics:explicit.peerClinics ?? 0,
          sharedCoreTypes:explicit.sharedCoreTypes ?? 0, sharedJgp:explicit.sharedJgp ?? 0,
          targetJgpOver10:explicit.targetJgp ?? 0, peerJgpOver10:explicit.peerJgp ?? 0,
          coreTypeSetSimilarity:explicit.coreTypeSetSimilarity ?? 0, jgpSetSimilarity:explicit.jgpSetSimilarity ?? 0,
          jgpSharedVolumeSimilarity:explicit.jgpSharedVolumeSimilarity ?? 0,
          bedCosineSimilarity:explicit.bedCosineSimilarity ?? 0, bedWeightedJaccardSimilarity:explicit.bedWeightedJaccardSimilarity ?? 0
        } : undefined,
        similarityBreakdown:{
          structuralPct:explicit?.structuralPct ?? structural*100,clinicalPct:explicit?.clinicalPct ?? clinical*100,
          wardTypesPct:explicit?.wardTypesPct ?? wardTypeScore*100,wardBedsPct:explicit?.wardBedsPct ?? wardBedScore*100,
          cellCountPct:cellCount*100,clinicTypesPct:clinicTypeScore*100,clinicCountPct:clinicCount*100,
          hospitalScalePct:explicit?.hospitalScalePct ?? size*100,bedScalePct:explicit?.bedScalePct ?? bedScale*100,scalePct:explicit?.scalePct ?? scale*100,
          wardCountScalePct:explicit?.wardCountScalePct ?? wardCountScale*100,cellCountScalePct:cellCountScale*100,complexityPct:explicit?.complexityPct ?? complexity*100,
          jgpSetPct:explicit?.jgpSetPct ?? setScore*100,jgpRankPct:explicit?.jgpRankPct ?? rankScore*100,
          jgpProportionPct:explicit?.jgpProportionPct ?? propScore*100,urgentModePct:explicit?.urgentModePct ?? urgent*100,
          sharedJgp:explicit?.sharedJgp ?? shared,targetJgp:explicit?.targetJgp ?? tj.size,peerJgp:explicit?.peerJgp ?? pj.size
        }
      };
    })
    .filter((x):x is NonNullable<typeof x>=>x!==null)
    .sort((a,b)=>b.similarityPct-a.similarityPct);

  // Adaptacyjna grupa peerów:
  // - nie sztywne TOP5,
  // - bierzemy szpitale blisko najlepszego dopasowania,
  // - minimum 4 dla stabilnej mediany, maksimum 12 żeby grupa nie rozmywała się.
  // Grupa peerów nie ma sztucznego limitu liczebności.
  // Pokazujemy wszystkie strukturalnie dopuszczone placówki z końcowym similarity >= 70%.
  // Jeden finalny próg podobieństwa. Bez progów pośrednich i bez dynamicznego odcięcia.
  const peerThreshold = Math.max(0, Math.min(100, peerThresholdPct));
  const peers = explicitPeers
    ? ranked.filter(x => explicitPeers.has(x.key)).sort((a,b)=>(a.distanceScore ?? Infinity)-(b.distanceScore ?? Infinity))
    : ranked.filter(x => x.similarityPct >= peerThreshold);

  // Różnice śmiertelności per JGP względem łącznej, ważonej wolumenem grupy peerów.
  // Liczymy dla każdej niepustej grupy peerów; UI pokazuje również benchmark dla 1–4 peerów.
  const mortalityOutliers = peers.length > 0
    ? [...target.codes]
        .filter(([,targetHosp]) => targetHosp > 10)
        .map(([productCode,targetHosp]) => {
          const targetDeaths=target.codeDeaths.get(productCode) ?? 0;
          let peerHosp=0,peerDeaths=0,peerHospitals=0;
          for(const peer of peers){
            const pa=aggs.get(peer.key);
            const ph=pa?.codes.get(productCode) ?? 0;
            if(!pa || ph<=0) continue;
            peerHosp+=ph; peerDeaths+=pa.codeDeaths.get(productCode) ?? 0; peerHospitals++;
          }
          if(peerHosp<=0) return null;
          const peerMortalityPct=peerDeaths/peerHosp*100;
          const targetMortalityPct=targetDeaths/targetHosp*100;
          const expectedDeaths=targetHosp*(peerDeaths/peerHosp);
          const excessDeaths=targetDeaths-expectedDeaths;
          const pm=productMap.get(productCode);
          const peerPoints=peers.flatMap(peer=>{
            const pa=aggs.get(peer.key);
            const hosp=pa?.codes.get(productCode) ?? 0;
            if(!pa || hosp<=0) return [];
            const deaths=pa.codeDeaths.get(productCode) ?? 0;
            return [{key:peer.key,name:peer.providerName,hospitalizations:hosp,deaths,mortalityPct:deaths/hosp*100}];
          });
          return {productCode,jgpCode:pm?.jgpCode ?? productCode,name:pm?.name ?? null,targetHospitalizations:targetHosp,targetDeaths,targetMortalityPct,peerHospitalizations:peerHosp,peerDeaths,peerHospitals,peerMortalityPct,expectedDeaths,excessDeaths,peerPoints};
        })
        .filter((x):x is NonNullable<typeof x>=>x!==null)
        .sort((a,b)=>Math.abs(b.excessDeaths)-Math.abs(a.excessDeaths))
    : [];
  const totalExcessDeaths=mortalityOutliers.reduce((sum,x)=>sum+x.excessDeaths,0);

  // Rozkład śmiertelności per JGP: wybrany szpital, każdy peer osobno i
  // łączna (ważona hospitalizacjami) śmiertelność peerów.
  // Do wykresu bierzemy JGP z >10 hospitalizacji w wybranym szpitalu;
  // kropkę peera pokazujemy tylko, gdy ten peer również ma >10 hosp. w danym JGP.
  const jgpMortalityDistribution=[...target.codes]
    .filter(([,targetHosp])=>targetHosp>100)
    .map(([productCode,targetHosp])=>{
      const targetDeaths=target.codeDeaths.get(productCode) ?? 0;
      const peerPoints=peers.flatMap(peer=>{
        const pa=aggs.get(peer.key);
        const hosp=pa?.codes.get(productCode) ?? 0;
        if(!pa || hosp<=10) return [];
        const deaths=pa.codeDeaths.get(productCode) ?? 0;
        return [{key:peer.key,name:peer.providerName,hospitalizations:hosp,deaths,mortalityPct:deaths/hosp*100}];
      });
      const peerHosp=peerPoints.reduce((sum,x)=>sum+x.hospitalizations,0);
      const peerDeaths=peerPoints.reduce((sum,x)=>sum+x.deaths,0);
      const pm=productMap.get(productCode);
      return {
        productCode,
        jgpCode:pm?.jgpCode ?? productCode,
        name:pm?.name ?? null,
        targetHospitalizations:targetHosp,
        targetDeaths,
        targetMortalityPct:targetDeaths/targetHosp*100,
        peerPoints,
        peerHospitalizations:peerHosp,
        peerDeaths,
        peerMortalityPct:peerHosp>0 ? peerDeaths/peerHosp*100 : null
      };
    })
    .filter(x=>x.peerPoints.length>0 && x.peerMortalityPct!==null && x.peerMortalityPct>=0.5)
    .sort((a,b)=>b.targetHospitalizations-a.targetHospitalizations);

  // Rozkład wolumenu JGP (>10 hospitalizacji) wg śmiertelności danego szpitala.
  // Każdy szpital jest klasyfikowany na podstawie własnej śmiertelności dla danego JGP,
  // a benchmark peerów to mediana sum hospitalizacji w każdym koszyku.
  const mortalityVolumeBucketsFor = (a:Agg) => {
    const buckets=[0,0,0,0];
    for(const [productCode,hosp] of a.codes){
      if(hosp<=10) continue;
      const deaths=a.codeDeaths.get(productCode) ?? 0;
      const mortality=hosp>0 ? deaths/hosp*100 : 0;
      const idx=mortality<1 ? 0 : mortality<2 ? 1 : mortality<5 ? 2 : 3;
      buckets[idx]+=hosp;
    }
    return buckets;
  };
  const targetMortalityVolumeBuckets=mortalityVolumeBucketsFor(target);
  const peerMortalityVolumeBuckets=peers.map(peer=>{
    const a=aggs.get(peer.key);
    return a ? mortalityVolumeBucketsFor(a) : [0,0,0,0];
  });
  const targetMortalityVolumeTotal=targetMortalityVolumeBuckets.reduce((a,b)=>a+b,0);
  const peerMortalityVolumeTotals=[0,0,0,0];
  peerMortalityVolumeBuckets.forEach(b=>b.forEach((v,i)=>peerMortalityVolumeTotals[i]+=v));
  const peerMortalityVolumeTotal=peerMortalityVolumeTotals.reduce((a,b)=>a+b,0);
  const mortalityVolumeBuckets={
    labels:["0–1%","1–2%","2–5%","5%+"],
    selected:targetMortalityVolumeBuckets.map(v=>targetMortalityVolumeTotal ? v/targetMortalityVolumeTotal*100 : 0),
    peers:peerMortalityVolumeTotals.map(v=>peerMortalityVolumeTotal ? v/peerMortalityVolumeTotal*100 : 0),
    selectedHosp:targetMortalityVolumeBuckets,
    peerHosp:peerMortalityVolumeTotals
  };

  const explicitFirst = explicitPeers ? [...explicitPeers.values()][0] : undefined;
  const selectedHosp = target.hosp;
  const selectedDeaths = target.deaths;
  const selected = {
    providerName:targetFacility.name,
    hospitalizations:selectedHosp,
    mortalityPct:selectedHosp > 0 ? selectedDeaths/selectedHosp*100 : 0,
    proceduralSharePct:procShare(target),
    urgentSharePct:urgentShare(target),
    uniqueJgpOver10:explicitFirst?.targetJgp ?? over10(target),
    coreBeds:explicitFirst?.targetCoreBeds ?? targetWards.coreBeds,
    coreWards:explicitFirst?.targetCoreTypes ?? tw.size,
    cellCount:explicitFirst?.targetCoreXSupported ?? tp?.liczba_komorek ?? 0,
    clinicCount:explicitFirst?.targetClinics ?? tp?.liczba_poradni ?? 0
  };
  return {
    peers,
    selected,
    mortalityOutliers,
    totalExcessDeaths,
    jgpMortalityDistribution,
    mortalityVolumeBuckets,
    median:{
      hospitalizations:median(peers.map(x=>x.hospitalizations)),
      mortalityPct:median(peers.map(x=>x.mortalityPct)),
      proceduralSharePct:median(peers.map(x=>x.proceduralSharePct)),
      urgentSharePct:median(peers.map(x=>x.urgentSharePct)),
      uniqueJgpOver10:median(peers.map(x=>x.uniqueJgpOver10))
    }
  };
}

