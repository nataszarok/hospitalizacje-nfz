"use client";

import { formatCityName, formatSigned as signed } from "@/lib/formatters";
import { decodeValuations, VALUATIONS_PATH, type JgpValuation, type ValuationsFile } from "@/lib/valuations";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import type { HospitalPeerBenchmark, ProductOption } from "@/lib/types";
import { PLOTLY_CONFIG, axisTitle, baselineShape, categoryAxis, chartLayout, measureAxis, paddedRange } from "@/lib/plotlyChart";
import { BASE_POINT, CHART_COLORS, DEVIATION_COLORS } from "@/lib/chartPalette";
import { elementBox, plotlyObjectBox, pointerBox, type Box } from "@/lib/tooltipPosition";
import { ChartTooltip, TooltipCompareTable, TooltipHead, TooltipKeyValue, TooltipNote, TooltipSection } from "./ChartTooltip";
import "./HospitalAnalysisBase.css";
import "./HospitalComparison.css";

export const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
export const pf = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pct = (v: number) => `${pf.format(v)}%`;

export async function parseMaybeGzip(r: Response) {
  if (!r.ok) throw new Error(`Nie udało się pobrać danych (${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const gzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzip) return JSON.parse(new TextDecoder().decode(bytes));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

export type { JgpValuation } from "@/lib/valuations";

let valuationPromise: Promise<JgpValuation[]> | null = null;
export function loadJgpValuations() {
  if (!valuationPromise) {
    valuationPromise = fetch(VALUATIONS_PATH, { cache: "force-cache" })
      .then(parseMaybeGzip)
      .then((file: ValuationsFile) => decodeValuations(file))
      .catch((e) => {
        valuationPromise = null;
        throw e;
      });
  }
  return valuationPromise;
}

export function displayHospitalName(value:string){
  const raw=String(value ?? "")
    .replace(/\u00A0/g," ")
    .trim()
    .replace(/\s+/g," ")
    .replace(/([\p{L}\p{M}])\s*-\s*([\p{L}\p{M}])/gu,"$1-$2");
  if(!raw) return raw;

  // Nie poprawiamy nazw, które już mają świadomie ustawioną wielkość liter.
  // Normalizacja dotyczy głównie nazw źródłowych zapisanych WIELKIMI LITERAMI.
  if(raw !== raw.toLocaleUpperCase("pl")) return raw;

  const smallWords=new Set([
    "w","we","z","ze","i","oraz","na","nad","pod","przy","do","od","dla","im","św","pw"
  ]);

  const acronyms:Record<string,string>={
    "nfz":"NFZ",
    "zoz":"ZOZ",
    "spzoz":"SPZOZ",
    "nzoz":"NZOZ",
    "sor":"SOR",
    "zol":"ZOL",
    "zpo":"ZPO",
    "mswia":"MSWiA",
    "cmkp":"CMKP",
    "coi":"COI",
  };

  const lower=raw.toLocaleLowerCase("pl");
  let wordIndex=0;

  return lower.replace(/[\p{L}\p{M}]+/gu,(word)=>{
    const normalized=word.toLocaleLowerCase("pl");
    const acronym=acronyms[normalized];
    if(acronym){
      wordIndex+=1;
      return acronym;
    }

    const isFirstWord=wordIndex===0;
    wordIndex+=1;

    if(!isFirstWord && smallWords.has(normalized)) return normalized;

    return normalized.charAt(0).toLocaleUpperCase("pl")+normalized.slice(1);
  });
}

function displayJgpLabel(value:string){
  const raw=String(value ?? "").trim().replace(/\s+/g," ");
  if(!raw) return raw;
  if(raw !== raw.toLocaleUpperCase("pl")) return raw;
  const lower=raw.toLocaleLowerCase("pl");
  return lower.charAt(0).toLocaleUpperCase("pl")+lower.slice(1);
}

export type PeerGrade = "A" | "B";

export type PeerPair = {
  a:string; b:string; peer_grade_pred:PeerGrade;
  hospitalizations_sim_a:number; hospitalizations_sim_b:number;
  hospitalizations_min_a:number; hospitalizations_min_b:number;
  deaths_sim_a:number; deaths_sim_b:number; deaths_min_a:number; deaths_min_b:number;
  core_types_a:number; core_types_b:number; core_beds_a:number; core_beds_b:number;
  core_x_supported_count_a:number; core_x_supported_count_b:number;
  clinics_a:number; clinics_b:number; jgp_gt10_a:number; jgp_gt10_b:number;
  core_types_shared:number; jgp_shared:number;
  core_type_set_similarity:number; jgp_shared_volume_similarity:number; jgp_set_similarity:number;
  bed_cosine_similarity:number; bed_weighted_jaccard_similarity:number;
  distance_score:number;
  d_jgp_set?:number;
  d_jgp_family_weighted_jaccard?:number;
  [key:string]:string|number|PeerGrade|undefined;
};

type PlotlyHoverEvent={
  points?:Array<{curveNumber:number;pointIndex:number;pointNumber:number}>;
  event?:MouseEvent;
};
type PlotlyDiv=HTMLDivElement & {
  on?: (event:string,callback:(event:PlotlyHoverEvent)=>void)=>void;
  removeAllListeners?: (event:string)=>void;
  __benchmarkTooltipCleanup?:()=>void;
};
type MortalityDisplayRow=HospitalPeerBenchmark["mortalityOutliers"][number] & {
  displayName:string;diff:number;valuation:number|null;
};
type MortalityPeerPoint={name?:string;mortalityPct:number;hospitalizations:number;deaths:number};
function getProductJgpCode(product:ProductOption){
  const alias=product as ProductOption & {jgpCode?:string;jgp?:string};
  return String(alias.jgpCode ?? alias.jgp ?? product.code ?? "").trim();
}
function getPairRenderedPoint(map:HTMLDivElement|null,shell:HTMLDivElement|null,index:number,pairMode:boolean){
  if(!pairMode || !map || !shell) return null;
  const traces=map.querySelectorAll<SVGGElement>("g.trace.scatter");
  const peerTrace=traces.item(0);
  if(!peerTrace) return null;
  const points=peerTrace.querySelectorAll<SVGPathElement>("path.point");
  const node=points.item(index);
  if(!node) return null;
  const r=node.getBoundingClientRect();
  const shellRect=shell.getBoundingClientRect();
  return {pointLeft:r.left+r.width/2-shellRect.left,pointTop:r.top+r.height/2-shellRect.top};
}

export function JgpMortalityDifferenceTable({ benchmark, products, valuationByJgp, pairMode=false }:{
  benchmark:HospitalPeerBenchmark;
  products:ProductOption[];
  valuationByJgp:Map<string,JgpValuation>;
  pairMode?:boolean;
}){
  type SortKey="jgp"|"name"|"targetHosp"|"targetDeaths"|"targetMortality"|"peerHosp"|"peerDeaths"|"peerMortality"|"diff"|"expected"|"excess"|"peerCount"|"valuation";
  const [sortKey,setSortKey]=useState<SortKey>("excess");
  const [sortDir,setSortDir]=useState<"asc"|"desc">("desc");
  const [largeDifferencesOnly,setLargeDifferencesOnly]=useState(false);
  const [selectedRow,setSelectedRow]=useState<MortalityDisplayRow|null>(null);
  const popupPlotRef=useRef<HTMLDivElement>(null);
  const popupPlotShellRef=useRef<HTMLDivElement>(null);
  const [popupPlotMounted,setPopupPlotMounted]=useState(false);
  const [popupTooltip,setPopupTooltip]=useState<{
    kind:"peer"|"selected"|"aggregate";anchor:Box;name:string;mortalityPct:number;hospitalizations:number;deaths:number;
  }|null>(null);

  const names=useMemo(()=>{
    const m=new Map<string,string>();
    products.forEach((p)=>{
      const code=getProductJgpCode(p);
      if(code && p.name) m.set(code,displayJgpLabel(String(p.name)));
    });
    return m;
  },[products]);

  const rows=useMemo(()=>benchmark.mortalityOutliers
    .filter((x)=>{
      if(x.targetHospitalizations<=10 || x.peerHospitals<2) return false;
      if(!largeDifferencesOnly) return true;
      const pp=Math.abs(x.targetMortalityPct-x.peerMortalityPct);
      const relative=x.peerMortalityPct>0 ? pp/x.peerMortalityPct : (x.targetMortalityPct>0 ? Infinity : 0);
      return pp>=2 && relative>=.5;
    })
    .map((x)=>({
      ...x,
      displayName:names.get(x.jgpCode) ?? "—",
      diff:x.targetMortalityPct-x.peerMortalityPct,
      valuation:valuationByJgp.get(x.jgpCode)?.pkt_hospitalizacja ?? null
    }))
    .sort((a,b)=>{
      const value=(x:MortalityDisplayRow)=>{
        switch(sortKey){
          case "jgp": return x.jgpCode;
          case "name": return x.displayName;
          case "targetHosp": return x.targetHospitalizations;
          case "targetDeaths": return x.targetDeaths;
          case "targetMortality": return x.targetMortalityPct;
          case "peerHosp": return x.peerHospitalizations;
          case "peerDeaths": return x.peerDeaths;
          case "peerMortality": return x.peerMortalityPct;
          case "diff": return x.diff;
          case "expected": return x.expectedDeaths;
          case "excess": return x.excessDeaths;
          case "peerCount": return x.peerHospitals;
          case "valuation": return x.valuation ?? -Infinity;
        }
      };
      const av=value(a),bv=value(b);
      const cmp=typeof av==="string" ? av.localeCompare(String(bv),"pl") : Number(av)-Number(bv);
      return sortDir==="asc" ? cmp : -cmp;
    }),[benchmark.mortalityOutliers,names,valuationByJgp,sortKey,sortDir,largeDifferencesOnly]);

  const sort=(key:SortKey)=>{
    if(sortKey===key) setSortDir(v=>v==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const renderHeader=(k:SortKey,children:React.ReactNode,num=false,priority?:2|3)=>
    <th className={[num?"num":"",priority?`col-p${priority}`:""].filter(Boolean).join(" ")||undefined} aria-sort={sortKey===k?(sortDir==="asc"?"ascending":"descending"):"none"}>
      <button type="button" className={`hospital-sort-header${sortKey===k?" is-active":""}`} onClick={()=>sort(k)}>
        <span>{children}</span><span className="hospital-sort-icon">{sortKey===k?(sortDir==="asc"?"↑":"↓"):"↕"}</span>
      </button>
    </th>;

  useEffect(()=>{
    if(!selectedRow || !popupPlotMounted || !popupPlotRef.current) return;
    let cancelled=false;
    let mouseLeaveCleanup:(()=>void)|null=null;

    (async()=>{
      const Plotly=(await import("plotly.js-dist-min")).default;
      if(cancelled || !popupPlotRef.current) return;

      const points=((selectedRow as MortalityDisplayRow & {peerPoints?:MortalityPeerPoint[]}).peerPoints ?? [])
        .filter((p)=>p.hospitalizations>0);
      const peerName=(p:(typeof points)[number])=>displayHospitalName(String(p?.name ?? "Podobny szpital"));
      const selectedName=displayHospitalName(benchmark.selected.providerName);

      await Plotly.react(popupPlotRef.current,[
        {
          type:"scatter",mode:"markers",name:"Podobne szpitale",
          x:points.map((p)=>p.mortalityPct),
          y:points.map(()=>selectedRow.jgpCode),
          customdata:points.map((p)=>[peerName(p),p.hospitalizations,p.deaths]),
          marker:{size:9,color:BASE_POINT,line:{width:.7,color:"#fff"}},
          hoverinfo:pairMode ? "none" : undefined,
          hovertemplate:pairMode ? undefined : "<b>%{customdata[0]}</b><br>Śmiertelność: <b>%{x:.1f}%</b><br>Hospitalizacje: %{customdata[1]:,.0f}<br>Zgony: %{customdata[2]:,.0f}<extra></extra>"
        },
        {
          type:"scatter",mode:"markers",name:"Ten szpital",
          x:[selectedRow.targetMortalityPct],
          y:[selectedRow.jgpCode],
          customdata:[[selectedRow.targetHospitalizations,selectedRow.targetDeaths]],
          marker:{size:13,color:CHART_COLORS.signal,line:{width:1.5,color:"#fff"}},
          hoverinfo:pairMode ? "none" : undefined,
          hovertemplate:pairMode ? undefined : "<b>Ten szpital</b><br>Śmiertelność: <b>%{x:.1f}%</b><br>Hospitalizacje: %{customdata[0]:,.0f}<br>Zgony: %{customdata[1]:,.0f}<extra></extra>"
        },
        {
          type:"scatter",mode:"markers",name:"Grupa porównawcza",
          x:[selectedRow.peerMortalityPct],
          y:[selectedRow.jgpCode],
          customdata:[[selectedRow.peerHospitalizations,selectedRow.peerDeaths,selectedRow.peerHospitals]],
          marker:{size:13,color:CHART_COLORS.text,symbol:"x",line:{width:2,color:CHART_COLORS.text}},
          hoverinfo:pairMode ? "none" : undefined,
          hovertemplate:pairMode ? undefined : "<b>Grupa porównawcza</b><br>Śmiertelność ważona: <b>%{x:.1f}%</b><br>Hospitalizacje: %{customdata[0]:,.0f}<br>Zgony: %{customdata[1]:,.0f}<br>Szpitale w grupie: %{customdata[2]}<extra></extra>"
        }
      ],{
        ...chartLayout(),
        autosize:true,height:280,
        margin:{l:28,r:16,t:8,b:48},
        legend:{orientation:"h",x:0,y:1.12,font:{size:12}},
        xaxis:(()=>{
          const values=[...points.map((p)=>p.mortalityPct),selectedRow.targetMortalityPct,selectedRow.peerMortalityPct].filter((v)=>Number.isFinite(v));
          const min=Math.min(...values),max=Math.max(...values),span=max-min;
          const minRange=4;
          const range=Math.max(span,minRange);
          const pad=Math.max(.5,range*.12);
          const center=(min+max)/2;
          const half=Math.max(range/2+pad,2);
          return measureAxis({title:axisTitle("Śmiertelność (%)",5),range:[center-half,center+half],ticksuffix:"%"});
        })(),
        yaxis:categoryAxis({showticklabels:false})
      },PLOTLY_CONFIG);

      if(pairMode && popupPlotRef.current){
        const plot=popupPlotRef.current as PlotlyDiv;
        plot.removeAllListeners?.("plotly_hover");
        plot.removeAllListeners?.("plotly_unhover");

        const reset=()=>setPopupTooltip(null);

        plot.on?.("plotly_hover",(ev:PlotlyHoverEvent)=>{
          const pt=ev?.points?.[0];
          if(!pt) return;
          const mouse=ev?.event;
          const anchor=plotlyObjectBox(plot,"scatter",pt.curveNumber,pt.pointIndex) ?? pointerBox(Number(mouse?.clientX ?? 0),Number(mouse?.clientY ?? 0));

          if(pt.curveNumber===0 && Number.isInteger(pt.pointIndex)){
            const p=points[pt.pointIndex];
            if(!p) return;
            setPopupTooltip({
              kind:"peer",
              anchor,
              name:peerName(p),
              mortalityPct:Number(p.mortalityPct)||0,
              hospitalizations:Number(p.hospitalizations)||0,
              deaths:Number(p.deaths)||0,
            });
          }else if(pt.curveNumber===1){
            setPopupTooltip({
              kind:"selected",
              anchor,
              name:selectedName,
              mortalityPct:Number(selectedRow.targetMortalityPct)||0,
              hospitalizations:Number(selectedRow.targetHospitalizations)||0,
              deaths:Number(selectedRow.targetDeaths)||0,
            });
          }else if(pt.curveNumber===2){
            setPopupTooltip({
              kind:"aggregate",
              anchor,
              name:"Podobne szpitale łącznie",
              mortalityPct:Number(selectedRow.peerMortalityPct)||0,
              hospitalizations:Number(selectedRow.peerHospitalizations)||0,
              deaths:Number(selectedRow.peerDeaths)||0,
            });
          }
        });

        plot.on?.("plotly_unhover",reset);
        const mouseLeave=()=>reset();
        plot.addEventListener?.("mouseleave",mouseLeave);
        mouseLeaveCleanup=()=>plot.removeEventListener?.("mouseleave",mouseLeave);
      }
    })();

    return()=>{
      cancelled=true;
      mouseLeaveCleanup?.();
      setPopupTooltip(null);
    };
  },[selectedRow,popupPlotMounted,pairMode,benchmark.selected.providerName]);

  if(!rows.length) return <section className="hospital-jgp-outlier-table-card hospital-surface-card">
    <div className="hospital-peer-chart-head"><div><span>Kontrola różnic JGP</span><h3>Porównanie JGP</h3></div></div>
    <p className="hospital-jgp-table-empty">Brak JGP spełniających aktualne kryteria tabeli.</p>
  </section>;

  return <>
  <section className="hospital-jgp-outlier-table-card hospital-surface-card">
    <div className="hospital-peer-chart-head">
      <div><span>Kontrola różnic JGP</span><h3>Porównanie JGP</h3></div>
      <div className="hospital-jgp-table-controls">
        <small>JGP &gt;10 hospitalizacji · min. 2 podobne szpitale z danym JGP</small>
        <button type="button" className={`hospital-jgp-filter-chip${largeDifferencesOnly?" is-active":""}`} onClick={()=>setLargeDifferencesOnly(v=>!v)} aria-pressed={largeDifferencesOnly} title="Duże różnice: bezwzględna różnica śmiertelności ≥2,0 pp i jednocześnie różnica względna ≥50% wobec grupy porównawczej.">Duże różnice</button>
      </div>
    </div>
    <div className="hospital-jgp-table-viewport"><div className="hospital-jgp-table-scroll priority-table">
      <table className="hospital-jgp-outlier-table">
        <thead><tr>
          {/* 6 kolumn (DESIGN.md 7.1); zgony, dane grupy, oczekiwane zgony, liczba podobnych i wycena są w oknie wiersza. */}
          {renderHeader("name", "Grupa JGP")}
          {renderHeader("targetHosp", "Hosp.", true, 2)}{renderHeader("targetMortality", "Śmiert. szpitala", true)}
          {renderHeader("peerMortality", "Śmiert. grupy", true, 3)}{renderHeader("diff", "Różnica", true)}{renderHeader("excess", "Nadmiar zgonów", true, 2)}
        </tr></thead>
        <tbody>{rows.map((x)=><tr key={x.productCode} className="hospital-jgp-clickable-row" tabIndex={0} onClick={()=>{setPopupPlotMounted(false);setSelectedRow(x)}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setPopupPlotMounted(false);setSelectedRow(x)}}}>
          <td className="name"><b>{x.jgpCode}</b> {x.displayName}</td>
          <td className="num col-p2">{nf.format(x.targetHospitalizations)}</td>
          <td className="num">{pct(x.targetMortalityPct)}</td>
          <td className="num col-p3">{pct(x.peerMortalityPct)}</td>
          <td className={`num ${x.diff>0?"bad":x.diff<0?"good":""}`}>{signed(x.diff," pp")}</td>
          <td className={`num col-p2 ${x.excessDeaths>0?"bad":x.excessDeaths<0?"good":""}`}>{signed(x.excessDeaths)}</td>
        </tr>)}</tbody>
      </table>
    </div></div>
    <small className="hospital-jgp-row-hint">Kliknij wiersz, aby zobaczyć wykres dla tego JGP.</small>
  </section>
  {selectedRow ? <div className="hospital-jgp-modal-backdrop" onMouseDown={()=>setSelectedRow(null)}>
    <section className="hospital-jgp-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
      <div className="hospital-jgp-modal-head"><div><span>{selectedRow.jgpCode}</span><h3>{selectedRow.displayName}</h3></div><button type="button" onClick={()=>setSelectedRow(null)} aria-label="Zamknij">×</button></div>
      <div className="hospital-jgp-modal-stats"><span>Szpital <b>{pct(selectedRow.targetMortalityPct)}</b></span><span>Grupa porównawcza <b>{pct(selectedRow.peerMortalityPct)}</b></span><span>Różnica <b>{signed(selectedRow.diff," pp")}</b></span><span>Nadmiar <b>{signed(selectedRow.excessDeaths)}</b></span></div>
      <div className="hospital-jgp-modal-stats hospital-jgp-modal-stats-detail">
        <span>Hospitalizacje: szpital <b>{nf.format(selectedRow.targetHospitalizations)}</b>, grupa <b>{nf.format(selectedRow.peerHospitalizations)}</b></span>
        <span>Zgony: szpital <b>{nf.format(selectedRow.targetDeaths)}</b>, grupa <b>{nf.format(selectedRow.peerDeaths)}</b></span>
        <span>Oczekiwane zgony <b>{pf.format(selectedRow.expectedDeaths)}</b></span>
        <span>Podobne szpitale z tą grupą <b>{nf.format(selectedRow.peerHospitals)}</b></span>
        <span>Wycena <b>{selectedRow.valuation==null?"—":`${pf.format(selectedRow.valuation)} pkt`}</b></span>
      </div>
      <div ref={popupPlotShellRef} className="hospital-standard-plot-shell hospital-jgp-modal-plot-shell">
        <div ref={el=>{popupPlotRef.current=el;if(el) setPopupPlotMounted(true)}} className="hospital-jgp-modal-plot"/>
        {pairMode && popupTooltip ? (()=>{
          const isPeer=popupTooltip.kind==="peer";
          const diff=popupTooltip.mortalityPct-selectedRow.peerMortalityPct;
          return <ChartTooltip anchor={popupTooltip.anchor} container={popupPlotShellRef}>
            <TooltipHead
              title={popupTooltip.name}
              context={`${popupTooltip.kind==="selected" ? "Ten szpital" : isPeer ? "Podobny szpital" : "Grupa porównawcza"} · JGP ${selectedRow.jgpCode}`}
            />
            <TooltipKeyValue
              label="Śmiertelność"
              value={pct(popupTooltip.mortalityPct)}
              delta={popupTooltip.kind==="aggregate" ? undefined : `${signed(diff," pp")} wobec grupy porównawczej`}
              tone={popupTooltip.kind==="aggregate" || diff===0 ? undefined : diff>0 ? "up" : "down"}
            />
            {isPeer
              ? <TooltipSection rows={[
                {label:"Hospitalizacje",value:nf.format(popupTooltip.hospitalizations)},
                {label:"Zgony",value:nf.format(popupTooltip.deaths)},
              ]}/>
              : <TooltipCompareTable
                columns={["Ten szpital",`Podobne (${nf.format(selectedRow.peerHospitals)})`]}
                rows={[
                  {label:"Śmiertelność",values:[pct(selectedRow.targetMortalityPct),pct(selectedRow.peerMortalityPct)]},
                  {label:"Hospitalizacje",values:[nf.format(selectedRow.targetHospitalizations),nf.format(selectedRow.peerHospitalizations)]},
                  {label:"Zgony",values:[nf.format(selectedRow.targetDeaths),nf.format(selectedRow.peerDeaths)]},
                ]}
              />}
          </ChartTooltip>;
        })() : null}
      </div>
    </section>
  </div> : null}
  </>;
}

const PAIR_DISTANCE_MODEL = [
  ["d_jgp_shared_volume","Wspólny wolumen JGP",0.21972062967338984,4.2664515360333155,1.395103871224797,1.0641823131896855,0.4309372575244875],
  ["d_jgp_shared_hospitalizations","Wspólne hospitalizacje JGP",0.27540669462559586,4.4279021475689735,0.6230423811271053,0.5720102671460036,0.2116303479869263],
  ["d_jgp_set","Zestaw JGP",0.15003908133051908,6.349241353517698,3.3694924753762923,0.1319784970770146,0.12055015142128826],
  ["d_jgp_breadth","Szerokość profilu JGP",0.23515177488606204,9.572609515345231,0.6311668503892313,0.21572796960096596,0.1084120057306868],
  ["d_hospitalizations","Hospitalizacje",0.35546246177019714,7.525876536718266,0.6103052516691673,1.890055199274897,1.8345885050120447],
  ["d_core_beds","Łóżka na głównych oddziałach",0.34721269600688576,7.890645138830174,0.5980177774781792,0.4504321297646458,0.17015085156256582],
  ["d_zrm_share","Udział ZRM",0.0928623500101614,2.355282050637913,0.48517143258364104,0.21723882216683985,0.21371012739490816],
  ["d_urgent_other_share","Inne przyjęcia nagłe",0.1410373257283591,2.7246215558029725,0.6260182468664952,0.09404962958432289,0.09668768755291711],
  ["d_core_x_supported_set","Dziedziny głównych oddziałów",0.27023809523809533,3.497291344207642,1.7078956286004736,0.18957710249849152,0.1497262271404988],
  ["d_core_family_bed_weighted_jaccard","Rozkład łóżek między oddziałami",0.2584413647438508,3.869349633682405,2.0205136312403003,0.7379679879118252,0.10649097211836488],
  ["d_core_inpatient_beds","Łóżka stacjonarne głównych oddziałów",0.34721269600688576,7.890645138830174,0.5980177774781792,0.4504321297646458,0.17015085156256582],
  ["d_core_day_treatment_x_set","Dziedziny leczenia dziennego",1.0,1.0,0.0,0.03532468962027539,0.03532468962027539],
  ["d_core_day_treatment_capacity_share","Udział leczenia dziennego",0.000001,61224.4897959183,0.0,0.000045399929762484854,0.000045399929762484854],
  ["d_outpatient_x_set","Dziedziny ambulatoryjne",0.23484848484848486,4.258064516129032,3.016129032258064,0.043082716957419116,0.06056597033348024],
  ["d_jgp_family_weighted_jaccard","Rodziny JGP",0.2294006046136423,3.9077125441924045,1.9621894851989532,2.1043497256832904,0.8555215994842532],
] as const;

function pairDistanceSimilarityPct(key:string,raw:number){
  const logRatioDistances=new Set([
    "d_jgp_shared_hospitalizations",
    "d_jgp_breadth",
    "d_hospitalizations",
    "d_core_beds",
    "d_core_inpatient_beds",
  ]);
  const similarity=logRatioDistances.has(key)
    ? Math.exp(-Math.max(0,raw))
    : 1-Math.max(0,raw);
  return Math.max(0,Math.min(1,similarity))*100;
}

function pairDistanceTop3(row:PeerPair|undefined){
  if(!row) return [
    {label:"—",raw:0,contribution:0,similarityPct:100},
    {label:"—",raw:0,contribution:0,similarityPct:100},
    {label:"—",raw:0,contribution:0,similarityPct:100},
  ];
  return PAIR_DISTANCE_MODEL.map(([key,label,scale,cap,knot,base,hinge])=>{
    const raw=Number(row[key])||0;
    const scaled=Math.min(raw/scale,cap);
    const contribution=base*scaled+hinge*Math.max(scaled-knot,0);
    return {
      label,
      raw,
      contribution,
      similarityPct:pairDistanceSimilarityPct(key,raw),
    };
  }).sort((a,b)=>b.contribution-a.contribution).slice(0,3);
}

export function PeerComparisonCharts({ benchmark, hoveredPeerKey, onHoverPeer, products, valuationByJgp, pairMode=false, peerPairs=[], hospitalKey="" }: { benchmark: HospitalPeerBenchmark; hoveredPeerKey:string|null; onHoverPeer:(key:string|null)=>void; products:ProductOption[]; valuationByJgp:Map<string,JgpValuation>; pairMode?:boolean; peerPairs?:PeerPair[]; hospitalKey?:string }) {
  const jgpNameByCode=useMemo(()=>{ const m=new Map<string,string>(); products.forEach((p)=>{ const code=getProductJgpCode(p); if(code && p.name) m.set(code,displayJgpLabel(String(p.name))); }); return m; },[products]);
  const pairByPeerKey=useMemo(()=>{
    const m=new Map<string,PeerPair>();
    for(const row of peerPairs){
      if(row.a===hospitalKey) m.set(row.b,row);
      else if(row.b===hospitalKey) m.set(row.a,row);
    }
    return m;
  },[peerPairs,hospitalKey]);
  const mapRef = useRef<HTMLDivElement>(null);
  const benchmarkRef = useRef<HTMLDivElement>(null);
  const benchmarkShellRef = useRef<HTMLDivElement>(null);
  const pairMapShellRef = useRef<HTMLDivElement>(null);
  const [pairManualHover,setPairManualHover]=useState<{index:number;anchor:Box;pointLeft:number;pointTop:number}|null>(null);
  const [pairSelectedHover,setPairSelectedHover]=useState<{anchor:Box;pointLeft:number;pointTop:number}|null>(null);
  const [pairListHighlight,setPairListHighlight]=useState<{index:number;pointLeft:number;pointTop:number}|null>(null);
  const [benchmarkTooltip,setBenchmarkTooltip]=useState<{
    anchor:Box;jgpCode:string;name:string;excessDeaths:number;
    targetMortalityPct:number;peerMortalityPct:number;targetDeaths:number;
    expectedDeaths:number;peerHospitals:number;valuation:number|null;
  }|null>(null);
  const plotHighlightKey=pairMode ? null : hoveredPeerKey;

  const handlePairPointerMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(!pairMode || !mapRef.current || !pairMapShellRef.current) return;
    const traces=mapRef.current.querySelectorAll<SVGGElement>("g.trace.scatter");
    const shellRect=pairMapShellRef.current.getBoundingClientRect();

    // Wybrany szpital jest ostatnią serią na mapie.
    const selectedTrace=traces.item(traces.length-1);
    const selectedPoint=selectedTrace?.querySelector<SVGPathElement>("path.point") ?? null;
    let selectedDistance=Infinity;
    let selectedX=0;
    let selectedY=0;
    if(selectedPoint){
      const r=selectedPoint.getBoundingClientRect();
      const cx=r.left+r.width/2;
      const cy=r.top+r.height/2;
      selectedDistance=Math.hypot(e.clientX-cx,e.clientY-cy);
      selectedX=cx-shellRect.left;
      selectedY=cy-shellRect.top;
    }

    const peerTrace=traces.item(0);
    const points=peerTrace?.querySelectorAll<SVGPathElement>("path.point");
    let bestIndex=-1;
    let bestDistance=Infinity;
    let bestX=0;
    let bestY=0;
    let bestNode:SVGPathElement|null=null;
    points?.forEach((node,i)=>{
      if(i>=benchmark.peers.length) return;
      const r=node.getBoundingClientRect();
      const cx=r.left+r.width/2;
      const cy=r.top+r.height/2;
      const d=Math.hypot(e.clientX-cx,e.clientY-cy);
      if(d<bestDistance){
        bestDistance=d;
        bestIndex=i;
        bestX=cx-shellRect.left;
        bestY=cy-shellRect.top;
        bestNode=node;
      }
    });

    // Wybrany szpital ma priorytet, jeśli kursor jest najbliżej niego.
    // Dymek liczy pozycję z prostokąta punktu (`ChartTooltip`), więc nie zasłania punktu.
    if(selectedPoint && selectedDistance<=20 && selectedDistance<=bestDistance){
      setPairSelectedHover({
        anchor:elementBox(selectedPoint),
        pointLeft:selectedX,
        pointTop:selectedY,
      });
      setPairManualHover(null);
      return;
    }

    if(bestNode && bestIndex>=0 && bestDistance<=18){
      setPairManualHover({
        index:bestIndex,
        anchor:elementBox(bestNode),
        pointLeft:bestX,
        pointTop:bestY,
      });
      setPairSelectedHover(null);
    }else{
      setPairManualHover(null);
      setPairSelectedHover(null);
    }
  };
  useEffect(()=>{
    let raf2=0;
    const raf1=requestAnimationFrame(()=>{
      const index=pairMode && hoveredPeerKey
        ? benchmark.peers.findIndex(p=>p.key===hoveredPeerKey) : -1;
      if(index<0){
        setPairListHighlight(null);
        return;
      }
      raf2=requestAnimationFrame(()=>{
        const pos=getPairRenderedPoint(mapRef.current,pairMapShellRef.current,index,pairMode);
        setPairListHighlight(pos ? {index,...pos} : null);
      });
    });
    return()=>{
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  },[pairMode,hoveredPeerKey,benchmark.peers]);

  useEffect(() => {
    let cancelled=false;
    void import("plotly.js-dist-min").then(async ({default:Plotly}) => {
      if(cancelled) return;
      const peers=benchmark.peers;
      const base=benchmark.selected;
      if(mapRef.current) {
        await Plotly.react(mapRef.current,[
          {
            type:"scatter",mode:"markers",name:"Podobne szpitale",
            x:peers.map(p=>p.coreBeds),
            y:peers.map(p=>p.hospitalizations),
            text:peers.map(p=>displayHospitalName(p.providerName)),
            customdata:pairMode ? peers.map(p=>{const m=p.pairMetrics;return [
              p.city,p.distanceScore ?? null,p.peerGrade ?? "—",p.coreWards,p.cellCount,p.clinicCount,p.hospitalizations,
              m?.sharedCoreTypes ?? 0,m?.targetCoreTypes ?? 0,m?.sharedJgp ?? 0,m?.targetJgpOver10 ?? 0
            ];}) : peers.map(p=>[
              p.city,p.similarityPct,p.similarityBreakdown.structuralPct,p.similarityBreakdown.clinicalPct,
              p.coreWards,p.cellCount,p.clinicCount,p.hospitalizations,
              p.similarityBreakdown.sharedJgp,p.similarityBreakdown.targetJgp
            ]),
            marker:{size:10,color:BASE_POINT,line:{width:1,color:"#FFFFFF"}},
            hoverinfo:pairMode ? "skip" : undefined,
            hovertemplate:pairMode
              ? undefined
              : "<b>%{text}</b><br>%{customdata[0]}<br><br><b>Realne dane</b><br>Łóżka na głównych oddziałach: %{x:,.0f}<br>Istotne JGP >10: %{y:,.0f}<br>Główne i wspierające oddziały: %{customdata[4]}<br>Komórki: %{customdata[5]}<br>Poradnie: %{customdata[6]}<br>Hospitalizacje: %{customdata[7]:,.0f}<br><br><b>Podobieństwo</b><br>Łącznie: %{customdata[1]:.1f}%<br>Struktura: %{customdata[2]:.1f}%<br>Profil leczenia: %{customdata[3]:.1f}%<br>Wspólne JGP >10: %{customdata[8]} / %{customdata[9]}<extra></extra>"
          },
          {
            type:"scatter",mode:"markers",name:"",showlegend:false,hoverinfo:"skip",
            x:[null],y:[null],
            marker:{size:17,opacity:1,color:CHART_COLORS.dataStrong,line:{width:2,color:"#FFFFFF"}}
          },
          {
            type:"scatter",mode:"markers",name:"Ten szpital",
            x:[base.coreBeds],y:[base.hospitalizations],
            marker:{size:16,color:CHART_COLORS.signal,line:{width:3,color:"#FFFFFF"}},
            customdata:[[base.coreWards,base.cellCount,base.clinicCount,base.hospitalizations]],
            hoverinfo:pairMode ? "skip" : undefined,
            hovertemplate:pairMode
              ? undefined
              : "<b>Ten szpital</b><br><br>Łóżka na głównych oddziałach: %{x:,.0f}<br>Istotne JGP >10: %{y:,.0f}<br>Główne i wspierające oddziały: %{customdata[0]}<br>Komórki: %{customdata[1]}<br>Poradnie: %{customdata[2]}<br>Hospitalizacje: %{customdata[3]:,.0f}<extra></extra>"
          }
        ],{
          ...chartLayout(),
          autosize:true,height:320,
          margin:{l:52,r:8,t:4,b:40},
          legend:{orientation:"h",x:0,y:1.06,font:{size:12}},
          // Ten sam margines na obu osiach (−6% / +10%); zero rysuje podstawa pod danymi.
          xaxis:measureAxis({title:axisTitle("Liczba łóżek na głównych oddziałach",3),range:paddedRange([...peers.map(p=>p.coreBeds),base.coreBeds]),tickformat:",.0f"}),
          yaxis:measureAxis({title:axisTitle("Liczba hospitalizacji",3),range:paddedRange([...peers.map(p=>p.hospitalizations),base.hospitalizations]),tickformat:",.0f"}),
          shapes:[baselineShape("y"),baselineShape("x")]
        },PLOTLY_CONFIG);
        const plot=mapRef.current as PlotlyDiv;
        plot.removeAllListeners?.("plotly_hover");
        plot.removeAllListeners?.("plotly_unhover");
        if(!pairMode){
          plot.on?.("plotly_hover",(ev:PlotlyHoverEvent)=>{
            const pt=ev?.points?.[0];
            if(pt?.curveNumber===0 && Number.isInteger(pt.pointIndex)) onHoverPeer(peers[pt.pointIndex]?.key ?? null);
          });
          plot.on?.("plotly_unhover",()=>onHoverPeer(null));
        }
        const hi=plotHighlightKey ? peers.findIndex(p=>p.key===plotHighlightKey) : -1;
        if(hi>=0){
          await Plotly.restyle(mapRef.current, {x:[[peers[hi].coreBeds]],y:[[peers[hi].hospitalizations]]}, [1]);
        } else {
          await Plotly.restyle(mapRef.current, {x:[[null]],y:[[null]]}, [1]);
        }
      }

      if(benchmarkRef.current && peers.length>0){
        const top=benchmark.mortalityOutliers.slice(0,10).reverse();
        await Plotly.react(benchmarkRef.current,[{
          type:"bar",orientation:"h",
          x:top.map(x=>x.excessDeaths),
          y:top.map(x=>x.jgpCode),
          customdata:top.map(x=>[
            jgpNameByCode.get(x.jgpCode) ?? "",
            x.targetDeaths,
            x.expectedDeaths,
            valuationByJgp.get(x.jgpCode)?.pkt_hospitalizacja ?? null,
            `${x.excessDeaths>=0?"+":""}${pf.format(x.excessDeaths)}`,
            x.peerHospitals,
            x.targetMortalityPct,
            x.peerMortalityPct
          ]),
          // Skala odchylenia: więcej zgonów niż w grupie porównawczej — ciepły, mniej — błękit.
          marker:{color:top.map(x=>x.excessDeaths>=0?DEVIATION_COLORS.up998:DEVIATION_COLORS.down998)},
          hoverinfo:pairMode ? "none" : undefined,
          hovertemplate:pairMode ? undefined : "<b>%{y}</b><br>%{customdata[0]}<br>Nadmiar: <b>%{customdata[4]}</b><br>Śmiertelność szpitala: %{customdata[6]:.1f}%<br>Śmiertelność grupy porównawczej: %{customdata[7]:.1f}%<br>Zgony: %{customdata[1]:.0f} · oczekiwane: %{customdata[2]:.1f}<br>Podobne szpitale z tym JGP: %{customdata[5]:.0f}<br>Wycena: %{customdata[3]:.1f} pkt<extra></extra>"
        }],{
          ...chartLayout(),
          autosize:true,height:320,showlegend:false,
          margin:{l:42,r:8,t:4,b:40},
          // Wartości ujemne i dodatnie: zero zawsze w zakresie, podstawa na zerze (DESIGN.md 6.4, pkt 6).
          xaxis:measureAxis({title:axisTitle("Zgony nadmiarowe wobec grupy porównawczej",3),range:paddedRange(top.map(x=>x.excessDeaths))}),
          yaxis:categoryAxis({title:axisTitle("Kod JGP",3)}),
          shapes:[baselineShape("x")]
        },PLOTLY_CONFIG);

        if(pairMode && benchmarkRef.current){
          const plot=benchmarkRef.current as PlotlyDiv;
          plot.removeAllListeners?.("plotly_hover");
          plot.removeAllListeners?.("plotly_unhover");

          const resetBenchmarkTooltip=()=>setBenchmarkTooltip(null);

          plot.on?.("plotly_hover",(ev:PlotlyHoverEvent)=>{
            const pt=ev?.points?.[0];
            if(pt?.curveNumber!==0 || !Number.isInteger(pt.pointIndex)) return;
            const row=top[pt.pointIndex];
            if(!row) return;
            const mouse=ev?.event;
            setBenchmarkTooltip({
              anchor:plotlyObjectBox(plot,"bar",0,pt.pointIndex) ?? pointerBox(Number(mouse?.clientX ?? 0),Number(mouse?.clientY ?? 0)),
              jgpCode:row.jgpCode,
              name:jgpNameByCode.get(row.jgpCode) ?? "—",
              excessDeaths:Number(row.excessDeaths)||0,
              targetMortalityPct:Number(row.targetMortalityPct)||0,
              peerMortalityPct:Number(row.peerMortalityPct)||0,
              targetDeaths:Number(row.targetDeaths)||0,
              expectedDeaths:Number(row.expectedDeaths)||0,
              peerHospitals:Number(row.peerHospitals)||0,
              valuation:valuationByJgp.get(row.jgpCode)?.pkt_hospitalizacja ?? null,
            });
          });

          plot.on?.("plotly_unhover",resetBenchmarkTooltip);
          const previousCleanup=plot.__benchmarkTooltipCleanup;
          previousCleanup?.();
          const mouseLeave=()=>resetBenchmarkTooltip();
          plot.addEventListener?.("mouseleave",mouseLeave);
          plot.__benchmarkTooltipCleanup=()=>plot.removeEventListener?.("mouseleave",mouseLeave);
        }
      }


    });
    return()=>{cancelled=true};
  },[benchmark,plotHighlightKey,onHoverPeer,pairMode,jgpNameByCode,valuationByJgp]);
  return <div className="hospital-peer-charts">
    <section className="hospital-peer-chart-card hospital-surface-card">
      <div className="hospital-peer-chart-head"><div><span>Mapa podobnych szpitali</span><h3>Realna skala struktury vs zakres leczenia</h3></div><small>Pomarańczowy punkt: ten szpital · niebieskie: podobne szpitale.</small></div>
      <div
        ref={pairMapShellRef}
        className="hospital-peer-map-shell"
        onMouseMoveCapture={handlePairPointerMove}
        onMouseLeave={()=>{
          if(pairMode){
            setPairManualHover(null);
            setPairSelectedHover(null);
          }
        }}
      >
        <div ref={mapRef} className="hospital-peer-chart-plot"/>
        {pairMode && pairSelectedHover ? <>
          <span
            className="hospital-map-main-highlight"
            aria-hidden="true"
            style={{
              left:pairSelectedHover.pointLeft,
              top:pairSelectedHover.pointTop,
            }}
          />
          <ChartTooltip anchor={pairSelectedHover.anchor} container={pairMapShellRef}>
            <TooltipHead title={displayHospitalName(benchmark.selected.providerName)} context="Ten szpital · punkt odniesienia"/>
            <TooltipSection rows={[
              {label:"Łóżka na głównych oddziałach",value:nf.format(benchmark.selected.coreBeds)},
              {label:"Hospitalizacje",value:nf.format(benchmark.selected.hospitalizations)},
              {label:"Główne oddziały",value:nf.format(benchmark.selected.coreWards)},
              {label:"Zakres specjalizacji",value:nf.format(benchmark.selected.cellCount)},
              {label:"Poradnie",value:nf.format(benchmark.selected.clinicCount)},
            ]}/>
            <TooltipNote>Niebieskie punkty to podobne szpitale dobrane przez model par.</TooltipNote>
          </ChartTooltip>
        </> : null}
        {pairMode && (pairManualHover || pairListHighlight) ? (()=>{
          const active=pairManualHover ?? pairListHighlight;
          if(!active) return null;
          const p=benchmark.peers[active.index];
          if(!p) return null;
          const m=p.pairMetrics;
          const d=pairDistanceTop3(pairByPeerKey.get(p.key));
          return <>
            <span
              className="hospital-map-peer-highlight"
              aria-hidden="true"
              style={{
                left:active.pointLeft,
                top:active.pointTop,
              }}
            />
            {pairManualHover ? <ChartTooltip anchor={pairManualHover.anchor} container={pairMapShellRef}>
              <TooltipHead title={displayHospitalName(p.providerName)} context={[p.city ? formatCityName(p.city) : null,p.peerGrade ? `klasa ${p.peerGrade}` : null].filter(Boolean).join(" · ")}/>
              <TooltipKeyValue label="Dystans pary" value={p.distanceScore==null?"—":pf.format(p.distanceScore)} delta="niższy dystans = bliższa para"/>
              <TooltipCompareTable
                columns={["Ten szpital","Podobny"]}
                rows={[
                  {label:"Łóżka na głównych oddz.",values:[nf.format(benchmark.selected.coreBeds),nf.format(p.coreBeds)]},
                  {label:"Hospitalizacje",values:[nf.format(benchmark.selected.hospitalizations),nf.format(p.hospitalizations)]},
                  {label:"Główne oddziały",values:[nf.format(benchmark.selected.coreWards),nf.format(p.coreWards)]},
                  {label:"Zakres specjalizacji",values:[nf.format(benchmark.selected.cellCount),nf.format(p.cellCount)]},
                  {label:"Poradnie",values:[nf.format(benchmark.selected.clinicCount),nf.format(p.clinicCount)]},
                ]}
              />
              <TooltipSection title="Największy wkład do dystansu" rows={d.map((x,i)=>({
                label:`${i+1}. ${x.label}`,
                hint:`podobieństwo ${pf.format(x.similarityPct)}%`,
                value:`+${pf.format(x.contribution)}`,
              }))}/>
              <TooltipSection title="Wspólny profil" rows={[
                {label:"Wspólne główne oddziały",value:m ? `${m.sharedCoreTypes} / ${m.targetCoreTypes}` : "—"},
                {label:"Wspólne JGP >10",value:m ? `${m.sharedJgp} / ${m.targetJgpOver10}` : "—"},
              ]}/>
            </ChartTooltip> : null}
          </>;
        })() : null}
      </div>
    </section>
    {benchmark.peers.length>0 ? <section className="hospital-peer-chart-card hospital-surface-card">
      <div className="hospital-peer-chart-head">
        <div><span>Różnice w wynikach JGP</span><h3>Gdzie występuje największa różnica liczby zgonów?</h3></div>
        <small><b>{signed(benchmark.totalExcessDeaths)}</b> {benchmark.totalExcessDeaths>=0 ? "zgonów nadmiarowych" : "zgonów mniej niż oczekiwano"} łącznie wobec grupy porównawczej</small>
      </div>
      <div ref={benchmarkShellRef} className="hospital-standard-plot-shell">
        <div ref={benchmarkRef} className="hospital-peer-chart-plot"/>
        {pairMode && benchmarkTooltip ? <ChartTooltip anchor={benchmarkTooltip.anchor} container={benchmarkShellRef} kind="bar-horizontal">
          <TooltipHead title={benchmarkTooltip.name} context={`JGP ${benchmarkTooltip.jgpCode}`}/>
          <TooltipKeyValue
            label="Zgony nadmiarowe"
            value={signed(benchmarkTooltip.excessDeaths)}
            delta={benchmarkTooltip.excessDeaths>=0 ? "więcej zgonów niż w grupie porównawczej" : "mniej zgonów niż w grupie porównawczej"}
            tone={benchmarkTooltip.excessDeaths>0 ? "up" : benchmarkTooltip.excessDeaths<0 ? "down" : undefined}
          />
          <TooltipCompareTable
            columns={["Ten szpital",`Podobne (${nf.format(benchmarkTooltip.peerHospitals)})`]}
            rows={[{label:"Śmiertelność",values:[pct(benchmarkTooltip.targetMortalityPct),pct(benchmarkTooltip.peerMortalityPct)]}]}
          />
          <TooltipSection rows={[
            {label:"Zgony",value:nf.format(benchmarkTooltip.targetDeaths)},
            {label:"Oczekiwane zgony",value:pf.format(benchmarkTooltip.expectedDeaths)},
            {label:"Wycena",value:benchmarkTooltip.valuation==null?"—":`${pf.format(benchmarkTooltip.valuation)} pkt`},
          ]}/>
          <TooltipNote>Oczekiwane zgony: hospitalizacje szpitala × śmiertelność grupy porównawczej.</TooltipNote>
        </ChartTooltip> : null}
      </div>
    </section> : null}
    
    
  </div>;
}

