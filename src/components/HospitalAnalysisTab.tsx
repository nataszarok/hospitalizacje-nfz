"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select, Tooltip } from "@mantine/core";
import { createPortal } from "react-dom";
import type { EstimationMethod, HospitalAnalysis, HospitalDirectoryEntry, ProductOption } from "@/lib/types";
import { hospitalAnalysisFromDataset, hospitalDirectoryFromDataset, loadStaticDataset } from "@/lib/staticData";
import { PLOTLY_CONFIG, getAppFontFamily } from "@/lib/plotlyChart";
import "./HospitalAnalysisBase.css";
import "./HospitalProfileSummary.css";

const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mf = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const bf = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pct = (v: number) => `${pf.format(v)}%`;
const normalizeNip=(value:unknown)=>String(value ?? "").replace(/\D/g,"");
const moneyCompact=(value:number|null|undefined)=>{
  if(value==null || !Number.isFinite(value)) return "—";
  const abs=Math.abs(value);
  if(abs>=1_000_000_000) return `${bf.format(value/1_000_000_000)} mld zł`;
  return `${mf.format(value/1_000_000)} mln zł`;
};

type FinancialYearRecord = {
  year:number;
  revenue:number|null;
  net_result:number|null;
  net_margin:number|null;
  assets:number|null;
  has_values:boolean;
  status:string|null;
  precision:"exact"|"official"|"rounded"|"unspecified"|string;
  source_service:string|null;
  source_url:string|null;
  notes:string|null;
};
type FinancialEntityRecord = {
  nip:string;
  name:string|null;
  latest_result_year:number|null;
  latest_values_year:number|null;
  years:FinancialYearRecord[];
};
type FinancialResultsPayload = {
  version:number; currency:string; entity_level:string; preferred_year:number; records:FinancialEntityRecord[];
};
let financialResultsPromise:Promise<FinancialResultsPayload>|null=null;
function loadFinancialResults(){
  if(!financialResultsPromise){
    financialResultsPromise=fetch("/data/financial_results.json.gz",{cache:"force-cache"}).then(parseMaybeGzip) as Promise<FinancialResultsPayload>;
    financialResultsPromise=financialResultsPromise.catch(e=>{financialResultsPromise=null;throw e;});
  }
  return financialResultsPromise;
}
type FacilityMedicalField = { x?:string; name?:string; source_viii?:string[] };
type FacilityCapability = { present?:boolean; beds?:number; cells_count?:number; source_viii?:string[]; dialysis_stations?:number; day_places?:number };
type FacilitySite = {
  facility_id:string; name:string; hospital_cells_count:number; outpatient_cells_count:number; support_cells_count:number;
  capacity:Record<string,number>; hospital_x_codes_core?:string[]; hospital_medical_fields_core?:FacilityMedicalField[]; hospital_medical_fields_core_supported?:FacilityMedicalField[]; outpatient_medical_fields?:FacilityMedicalField[];
  core_capacity?:{raw_types?:Record<string,{beds?:number;cells_count?:number;names?:string[];family?:string}>};
  special_capabilities?:Record<string,FacilityCapability>;
  non_core_capacity?:Record<string,FacilityCapability>;
  primary_address?:{city?:string;street?:string;building?:string;postal_code?:string};
};
type FacilityProfileRecord = {
  oz_nfz:string; nip:string; source_name:string; source_city:string; facility_count:number; facilities:FacilitySite[];
  aggregate:{facility_count:number;hospital_beds_total:number;core_beds_total:number;core_type_count_raw:number;core_x_supported_count:number;core_types_raw?:string[];core_x_supported_codes?:string[]};
};
type FacilityProfilesPayload={version:number;rpwdl_snapshot_date:string;records:FacilityProfileRecord[]};
type RpwdlWardSortKey="name"|"beds"|"fields";
let facilityProfilesPromise:Promise<FacilityProfilesPayload>|null=null;
function loadRpwdlFacilityProfiles(){
  if(!facilityProfilesPromise){
    facilityProfilesPromise=fetch("/data/rpwdl_facility_profiles.json.gz",{cache:"force-cache"}).then(parseMaybeGzip) as Promise<FacilityProfilesPayload>;
    facilityProfilesPromise=facilityProfilesPromise.catch(e=>{facilityProfilesPromise=null;throw e;});
  }
  return facilityProfilesPromise;
}
async function parseMaybeGzip(r: Response) {
  if (!r.ok) throw new Error(`Nie udało się pobrać danych (${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const gzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzip) return JSON.parse(new TextDecoder().decode(bytes));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

function displayHospitalName(value:string){
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

const JGP_FAMILY_NAMES:Record<string,string>={
  A:"Choroby układu nerwowego",
  B:"Choroby narządu wzroku",
  C:"Choroby twarzy, jamy ustnej, gardła, krtani, nosa i uszu",
  D:"Choroby układu oddechowego",
  E:"Choroby układu krążenia",
  F:"Choroby przewodu pokarmowego",
  G:"Choroby wątroby, dróg żółciowych, trzustki i śledziony",
  H:"Choroby układu mięśniowo-szkieletowego",
  J:"Choroby piersi, skóry i oparzenia",
  K:"Choroby układu dokrewnego",
  L:"Choroby układu moczowo-płciowego",
  M:"Choroby żeńskiego układu rozrodczego",
  N:"Położnictwo i opieka nad noworodkami",
  P:"Choroby dzieci - leczenie zachowawcze",
  PZ:"Choroby dzieci - leczenie zabiegowe",
  Q:"Choroby naczyń",
  S:"Choroby układu krwiotwórczego, zatrucia i choroby zakaźne",
  T:"Obrażenia, urazy",
  Z:"Kompleksowa diagnostyka",
};

function jgpFamilyFromCode(value:string|null|undefined){
  const code=String(value ?? "").trim().toLocaleUpperCase("pl");
  if(!code) return null;
  if(code.startsWith("PZ")) return "PZ";
  return code.match(/^[A-ZĄĆĘŁŃÓŚŹŻ]+/u)?.[0] ?? null;
}

function jgpFamilyName(family:string){
  return JGP_FAMILY_NAMES[family] ?? `Sekcja ${family}`;
}

function ProfileGlyph({name,className=""}:{name:string;className?:string}){
  const common={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
  if(name==="hospital") return <svg {...common} className={className}><path d="M5 21V5.8A1.8 1.8 0 0 1 6.8 4h7.4A1.8 1.8 0 0 1 16 5.8V21"/><path d="M3 21h18M9 8h3M10.5 6.5v3M8 13h2M13 13h2M8 17h2M13 17h2M17 10h1.2A1.8 1.8 0 0 1 20 11.8V21"/></svg>;
  if(name==="chart") return <svg {...common} className={className}><path d="M5 20V11M12 20V5M19 20v-8"/><path d="M3 20h18"/></svg>;
  if(name==="users") return <svg {...common} className={className}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.4 2.4-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><circle cx="17" cy="9" r="2.2"/><path d="M15.4 14.2c2.8-.4 4.8 1.2 5.1 4.2"/></svg>;
  if(name==="heart") return <svg {...common} className={className}><path d="M20.8 8.4c0 5.4-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.4A4.4 4.4 0 0 1 11 5.6l1 1 1-1a4.4 4.4 0 0 1 7.8 2.8Z"/><path d="M7.4 11h2.3l1.2-2.4 2.1 5 1.1-2.6h2.5"/></svg>;
  if(name==="document") return <svg {...common} className={className}><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14.5 3.5V7H18M8 11h7M8 15h7M8 18h4"/></svg>;
  if(name==="calculator") return <svg {...common} className={className}><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 18h2M12 18h2M16 18h0"/></svg>;
  if(name==="stethoscope") return <svg {...common} className={className}><path d="M6 4v5a4 4 0 0 0 8 0V4M4.5 4h3M12.5 4h3"/><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0v-1"/><circle cx="19" cy="12" r="2"/></svg>;
  if(name==="bed") return <svg {...common} className={className}><path d="M3 19V8M3 16h18v3M7 12h5a3 3 0 0 1 3 3v1H7v-4Z"/><path d="M15 11h3a3 3 0 0 1 3 3v2"/></svg>;
  if(name==="coins") return <svg {...common} className={className}><ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M6 10v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4M6 14v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4"/></svg>;
  if(name==="cube") return <svg {...common} className={className}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.4 7.7 7.6 4.2 7.6-4.2M12 12v9"/></svg>;
  if(name==="pie") return <svg {...common} className={className}><path d="M11 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M14 3.5A8.5 8.5 0 0 1 20.5 10H14V3.5Z"/></svg>;
  if(name==="building") return <svg {...common} className={className}><path d="M4 21V7h10v14M14 11h6v10M2 21h20"/><path d="M7 10h2M11 10h1M7 14h2M11 14h1M7 18h2M17 14h1M17 18h1"/></svg>;
  if(name==="flask") return <svg {...common} className={className}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/></svg>;
  if(name==="calendar") return <svg {...common} className={className}><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17"/></svg>;
  return <svg {...common} className={className}><circle cx="12" cy="12" r="8"/></svg>;
}


function HospitalCharts({ analysis, products }: { analysis: HospitalAnalysis; products: ProductOption[] }) {
  const topRef = useRef<HTMLDivElement>(null);
  const familyRef = useRef<HTMLDivElement>(null);
  const topShellRef = useRef<HTMLDivElement>(null);
  const familyShellRef = useRef<HTMLDivElement>(null);
  const productMap = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const [chartTooltip,setChartTooltip]=useState<
    | {kind:"jgp";left:number;top:number;code:string;name:string;hospitalizations:number;sharePct:number;deaths:number;mortalityPct:number}
    | {kind:"family";left:number;top:number;placement:"side"|"above"|"below";code:string;name:string;hospitalizations:number;sharePct:number;codeCount:number;isOther:boolean}
    | null
  >(null);

  const familySummary=useMemo(()=>{
    const byFamily=new Map<string,{family:string;name:string;hospitalizations:number;codeCount:number}>();
    for(const row of analysis.codes){
      const family=jgpFamilyFromCode(row.jgpCode);
      if(!family) continue;
      const current=byFamily.get(family) ?? {
        family,
        name:jgpFamilyName(family),
        hospitalizations:0,
        codeCount:0,
      };
      current.hospitalizations+=Number(row.hospitalizations)||0;
      current.codeCount+=1;
      byFamily.set(family,current);
    }

    const total=[...byFamily.values()].reduce((sum,row)=>sum+row.hospitalizations,0);
    const rows=[...byFamily.values()]
      .map(row=>({
        ...row,
        sharePct:total>0 ? row.hospitalizations/total*100 : 0,
      }))
      .sort((a,b)=>b.hospitalizations-a.hospitalizations || a.family.localeCompare(b.family,"pl"));

    const coverageRows:{
      family:string;
      name:string;
      hospitalizations:number;
      codeCount:number;
      sharePct:number;
    }[]=[];
    let coveredHospitalizations=0;

    for(const row of rows){
      if(total>0 && coveredHospitalizations/total>=0.9) break;
      coverageRows.push(row);
      coveredHospitalizations+=row.hospitalizations;
    }

    return {
      rows,
      coverageRows,
      total,
      coveragePct:total>0 ? coveredHospitalizations/total*100 : 0,
      otherHospitalizations:Math.max(0,total-coveredHospitalizations),
    };
  },[analysis.codes]);

  const tooltipPosition=(shell:HTMLDivElement|null,clientX:number,clientY:number,estimatedHeight=210)=>{
    if(!shell) return {left:12,top:12};
    const r=shell.getBoundingClientRect();
    const x=clientX-r.left;
    const y=clientY-r.top;
    const tooltipWidth=Math.min(330,Math.max(230,r.width-24));
    const gap=14;
    const left=x+r.width*0.02+tooltipWidth+gap<r.width
      ? Math.min(x+gap,r.width-tooltipWidth-10)
      : Math.max(10,x-tooltipWidth-gap);
    const halfHeight=Math.min(estimatedHeight/2,Math.max(40,(r.height-20)/2));
    const top=Math.max(halfHeight+10,Math.min(r.height-halfHeight-10,y));
    return {left,top};
  };


  const treemapTooltipPosition=(
    shell:HTMLDivElement|null,
    eventTarget:EventTarget|null|undefined,
    clientX:number,
    clientY:number,
    estimatedHeight=180,
  )=>{
    if(!shell) return {left:12,top:12,placement:"side" as const};

    const shellRect=shell.getBoundingClientRect();
    const target=eventTarget instanceof Element ? eventTarget : null;
    const slice=target?.closest("g.slice") ?? target?.closest("path.surface") ?? target;
    const boxRect=slice instanceof Element ? slice.getBoundingClientRect() : null;

    if(!boxRect || boxRect.width<=0 || boxRect.height<=0){
      const fallback=tooltipPosition(shell,clientX,clientY,estimatedHeight);
      return {...fallback,placement:"side" as const};
    }

    const gap=14;
    const viewportPad=12;
    const tooltipWidth=Math.min(330,Math.max(230,shellRect.width-24));
    const tooltipHeight=Math.min(estimatedHeight,Math.max(120,window.innerHeight-viewportPad*2));
    const roomRight=window.innerWidth-boxRect.right-viewportPad;
    const roomLeft=boxRect.left-viewportPad;
    const roomAbove=boxRect.top-viewportPad;
    const roomBelow=window.innerHeight-boxRect.bottom-viewportPad;
    const boxCenterY=boxRect.top+boxRect.height/2;
    const clampedCenterY=Math.max(
      viewportPad+tooltipHeight/2,
      Math.min(window.innerHeight-viewportPad-tooltipHeight/2,boxCenterY),
    );

    // Priorytet: prawa/lewa strona kafla. To gwarantuje brak nakładania na box.
    if(roomRight>=tooltipWidth+gap){
      return {
        left:boxRect.right+gap-shellRect.left,
        top:clampedCenterY-shellRect.top,
        placement:"side" as const,
      };
    }
    if(roomLeft>=tooltipWidth+gap){
      return {
        left:boxRect.left-gap-tooltipWidth-shellRect.left,
        top:clampedCenterY-shellRect.top,
        placement:"side" as const,
      };
    }

    // Gdy po bokach brakuje miejsca, tooltip trafia całkowicie nad albo pod box.
    const centeredViewportLeft=Math.max(
      viewportPad,
      Math.min(window.innerWidth-viewportPad-tooltipWidth,boxRect.left+boxRect.width/2-tooltipWidth/2),
    );
    if(roomAbove>=tooltipHeight+gap || roomAbove>=roomBelow){
      return {
        left:centeredViewportLeft-shellRect.left,
        top:boxRect.top-gap-shellRect.top,
        placement:"above" as const,
      };
    }
    return {
      left:centeredViewportLeft-shellRect.left,
      top:boxRect.bottom+gap-shellRect.top,
      placement:"below" as const,
    };
  };

  const wrapTreemapName=(value:string,maxLine=18)=>{
    const words=value.trim().split(/\s+/).filter(Boolean);
    if(!words.length) return "";
    const lines:string[]=[];
    let line="";
    for(const word of words){
      const next=line ? `${line} ${word}` : word;
      if(line && next.length>maxLine){
        lines.push(line);
        line=word;
      }else{
        line=next;
      }
    }
    if(line) lines.push(line);
    return lines.join("<br>");
  };

  const treemapLabel=(row:{label:string;name:string;sharePct:number;isOther:boolean})=>{
    if(row.isOther){
      return row.sharePct>=7
        ? `<b>Pozostałe</b><br>${pf.format(row.sharePct)}%`
        : "<b>Inne</b>";
    }

    // Kod sekcji jest zawsze pierwszym i obowiązkowym elementem etykiety.
    // Pełną nazwę pokazujemy dopiero, gdy udział daje realną szansę na jej zmieszczenie.
    const fullNameThreshold=
      row.name.length<=22 ? 8 :
      row.name.length<=38 ? 12 :
      18;

    if(row.sharePct>=fullNameThreshold){
      return `<b>${row.label}</b><br>${wrapTreemapName(row.name)}<br>${pf.format(row.sharePct)}%`;
    }

    if(row.sharePct>=5){
      return `<b>${row.label}</b><br>${pf.format(row.sharePct)}%`;
    }

    return `<b>${row.label}</b>`;
  };

  useEffect(() => {
    let cancelled=false;
    const cleanups:Array<()=>void>=[];

    const render=async()=>{
      const Plotly=(await import("plotly.js-dist-min")).default;
      if(cancelled) return;

      if(topRef.current){
        const top=analysis.codes.slice(0,10).reverse();
        const total=analysis.codes.reduce((sum,row)=>sum+(Number(row.hospitalizations)||0),0);
        const baseColors=top.map(()=>"#98A2B3");

        await Plotly.react(topRef.current,[{
          type:"bar",
          orientation:"h",
          x:top.map(row=>row.hospitalizations),
          y:top.map(row=>row.jgpCode ?? row.productCode),
          text:top.map(row=>total>0 ? `${pf.format((Number(row.hospitalizations)||0)/total*100)}%` : "0%"),
          textposition:"inside",
          insidetextanchor:"end",
          textfont:{color:"#FFFFFF",size:10},
          constraintext:"inside",
          cliponaxis:false,
          customdata:top.map(row=>[
            productMap.get(row.productCode)?.name ?? "",
            total>0 ? (Number(row.hospitalizations)||0)/total*100 : 0,
            row.deaths,
            row.mortalityPct,
          ]),
          marker:{color:baseColors},
          hoverinfo:"none",
        }],{
          autosize:true,
          height:400,
          paper_bgcolor:"#FFFFFF",
          plot_bgcolor:"#FFFFFF",
          font:{family:getAppFontFamily(),color:"#172033",size:11},
          showlegend:false,
          hovermode:"closest",
          margin:{l:54,r:48,t:6,b:64},
          xaxis:{
            title:{text:"Liczba hospitalizacji",standoff:8,font:{size:10,color:"#667085"}},
            gridcolor:"#EEF1F5",
            zeroline:false,
            automargin:false,
          },
          yaxis:{title:"",automargin:true},
        },{...PLOTLY_CONFIG,displayModeBar:false});

        const plot=topRef.current as any;
        plot.removeAllListeners?.("plotly_hover");
        plot.removeAllListeners?.("plotly_unhover");

        const resetTop=()=>{
          void Plotly.restyle(plot,{"marker.color":[baseColors]},[0]);
          setChartTooltip(current=>current?.kind==="jgp" ? null : current);
        };

        plot.on?.("plotly_hover",(ev:any)=>{
          const pt=ev?.points?.[0];
          if(pt?.curveNumber!==0 || !Number.isInteger(pt.pointIndex)) return;
          const row=top[pt.pointIndex];
          if(!row) return;

          const colors=baseColors.slice();
          colors[pt.pointIndex]="#D92D20";
          void Plotly.restyle(plot,{"marker.color":[colors]},[0]);

          const mouse=ev?.event;
          const pos=tooltipPosition(
            topShellRef.current,
            Number(mouse?.clientX ?? 0),
            Number(mouse?.clientY ?? 0),
          );
          setChartTooltip({
            kind:"jgp",
            ...pos,
            code:String(row.jgpCode ?? row.productCode ?? "—"),
            name:String(productMap.get(row.productCode)?.name ?? ""),
            hospitalizations:Number(row.hospitalizations)||0,
            sharePct:total>0 ? (Number(row.hospitalizations)||0)/total*100 : 0,
            deaths:Number(row.deaths)||0,
            mortalityPct:Number(row.mortalityPct)||0,
          });
        });
        plot.on?.("plotly_unhover",resetTop);

        const mouseLeave=()=>resetTop();
        plot.addEventListener?.("mouseleave",mouseLeave);
        cleanups.push(()=>plot.removeEventListener?.("mouseleave",mouseLeave));
      }

      if(familyRef.current){
        const rows=[
          ...familySummary.coverageRows.map(row=>({
            label:row.family,
            name:row.name,
            hospitalizations:row.hospitalizations,
            sharePct:row.sharePct,
            codeCount:row.codeCount,
            isOther:false,
          })),
          ...(familySummary.otherHospitalizations>0 ? [{
            label:"Pozostałe",
            name:"Pozostałe sekcje JGP",
            hospitalizations:familySummary.otherHospitalizations,
            sharePct:familySummary.total>0 ? familySummary.otherHospitalizations/familySummary.total*100 : 0,
            codeCount:0,
            isOther:true,
          }] : []),
        ];
        const familyBaseColors=rows.map(row=>row.isOther ? "#EAECF0" : "#98A2B3");
        const familyBaseTextColors=rows.map(row=>row.isOther ? "#344054" : "#FFFFFF");

        await Plotly.react(familyRef.current,[{
          type:"treemap",
          labels:rows.map(row=>row.label),
          parents:rows.map(()=>""),
          values:rows.map(row=>row.hospitalizations),
          text:rows.map(row=>treemapLabel(row)),
          texttemplate:"%{text}",
          textinfo:"text",
          textfont:{size:10,color:familyBaseTextColors},
          branchvalues:"total",
          tiling:{pad:2},
          pathbar:{visible:false},
          marker:{
            colors:familyBaseColors,
            line:{width:2,color:"#FFFFFF"},
          },
          customdata:rows.map(row=>[row.name,row.hospitalizations,row.sharePct,row.codeCount,row.isOther]),
          hoverinfo:"none",
        }],{
          autosize:true,
          height:400,
          paper_bgcolor:"#FFFFFF",
          plot_bgcolor:"#FFFFFF",
          font:{family:getAppFontFamily(),color:"#172033",size:11},
          margin:{l:2,r:2,t:6,b:64},
          uniformtext:{minsize:9,mode:"show"},
          hovermode:"closest",
        },{...PLOTLY_CONFIG,displayModeBar:false});

        const familyPlot=familyRef.current as any;
        familyPlot.removeAllListeners?.("plotly_hover");
        familyPlot.removeAllListeners?.("plotly_unhover");

        const resetFamilyHighlight=()=>{
          void Plotly.restyle(familyPlot,{
            "marker.colors":[familyBaseColors],
            "textfont.color":[familyBaseTextColors],
          },[0]);
          setChartTooltip(current=>current?.kind==="family" ? null : current);
        };

        familyPlot.on?.("plotly_hover",(ev:any)=>{
          const pt=ev?.points?.[0];
          if(pt?.curveNumber!==0 || !Number.isInteger(pt.pointNumber)) return;
          const row=rows[pt.pointNumber];
          if(!row) return;

          const colors=familyBaseColors.slice();
          const textColors=familyBaseTextColors.slice();
          colors[pt.pointNumber]="#D92D20";
          textColors[pt.pointNumber]="#FFFFFF";
          void Plotly.restyle(familyPlot,{
            "marker.colors":[colors],
            "textfont.color":[textColors],
          },[0]);

          const mouse=ev?.event;
          const pos=treemapTooltipPosition(
            familyShellRef.current,
            mouse?.target,
            Number(mouse?.clientX ?? 0),
            Number(mouse?.clientY ?? 0),
            180,
          );
          setChartTooltip({
            kind:"family",
            ...pos,
            code:row.label,
            name:row.name,
            hospitalizations:row.hospitalizations,
            sharePct:row.sharePct,
            codeCount:row.codeCount,
            isOther:row.isOther,
          });
        });
        familyPlot.on?.("plotly_unhover",resetFamilyHighlight);

        const familyMouseLeave=()=>resetFamilyHighlight();
        familyPlot.addEventListener?.("mouseleave",familyMouseLeave);
        cleanups.push(()=>familyPlot.removeEventListener?.("mouseleave",familyMouseLeave));
      }
    };

    void render();
    return()=>{
      cancelled=true;
      cleanups.forEach(fn=>fn());
    };
  },[analysis,productMap,familySummary]);

  return <div className="hospital-charts-layout hospital-summary-jgp-layout">
    <div className="hospital-summary-jgp-grid">
      <section className="hospital-chart-card hospital-peer-chart-card hospital-surface-card hospital-jgp-bars-card">
        <div className="hospital-peer-chart-head hospital-profile-chart-head hospital-profile-chart-head-simple">
          <div className="hospital-profile-chart-title">
            <h3>TOP 10 kodów JGP</h3>
          </div>
          <small>Szary: udział bazowy · czerwony: wskazany kod.</small>
        </div>

        <div ref={topShellRef} className="hospital-summary-chart-shell">
          <div ref={topRef} className="hospital-jgp-code-bars" />
          {chartTooltip?.kind==="jgp" ? <div
            className="hospital-peer-tooltip hospital-summary-chart-tooltip"
            role="tooltip"
            style={{left:chartTooltip.left,top:chartTooltip.top}}
          >
            <div className="hospital-peer-tooltip-head">
              <b>{chartTooltip.code}</b>
              <strong>{pf.format(chartTooltip.sharePct)}%</strong>
            </div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Grupa JGP</b></div>
              <div className="hospital-peer-tooltip-row hospital-summary-tooltip-name">
                <span>Nazwa</span><b>{chartTooltip.name || "—"}</b>
              </div>
            </div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Dane szpitala</b></div>
              <div className="hospital-peer-tooltip-row"><span>Hospitalizacje</span><b>{nf.format(chartTooltip.hospitalizations)}</b></div>
              <div className="hospital-peer-tooltip-row"><span>Udział w JGP</span><b>{pf.format(chartTooltip.sharePct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Zgony</span><b>{nf.format(chartTooltip.deaths)}</b></div>
              <div className="hospital-peer-tooltip-row"><span>Śmiertelność</span><b>{pf.format(chartTooltip.mortalityPct)}%</b></div>
            </div>
          </div> : null}
        </div>
      </section>

      <section className="hospital-chart-card hospital-peer-chart-card hospital-surface-card hospital-jgp-family-panel">
        <div className="hospital-peer-chart-head hospital-jgp-family-head hospital-profile-chart-head hospital-profile-chart-head-simple">
          <div className="hospital-profile-chart-title">
            <h3>Struktura działalności</h3>
          </div>
          <small>
            {familySummary.coverageRows.length} sekcji obejmuje <b>{pf.format(familySummary.coveragePct)}%</b> wolumenu
          </small>
        </div>

        <div ref={familyShellRef} className="hospital-summary-chart-shell">
          <div ref={familyRef} className="hospital-jgp-family-treemap" />
          {chartTooltip?.kind==="family" ? <div
            className={`hospital-peer-tooltip hospital-summary-chart-tooltip hospital-summary-chart-tooltip--${chartTooltip.placement}`}
            role="tooltip"
            style={{left:chartTooltip.left,top:chartTooltip.top}}
          >
            <div className="hospital-peer-tooltip-head">
              <b>{chartTooltip.isOther ? "Pozostałe" : chartTooltip.code}</b>
              <strong>{pf.format(chartTooltip.sharePct)}%</strong>
            </div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Sekcja JGP</b></div>
              <div className="hospital-peer-tooltip-row hospital-summary-tooltip-name">
                <span>Nazwa</span><b>{chartTooltip.name}</b>
              </div>
            </div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Dane szpitala</b></div>
              <div className="hospital-peer-tooltip-row"><span>Hospitalizacje</span><b>{nf.format(chartTooltip.hospitalizations)}</b></div>
              {!chartTooltip.isOther ? <div className="hospital-peer-tooltip-row"><span>Kody JGP w sekcji</span><b>{nf.format(chartTooltip.codeCount)}</b></div> : null}
            </div>
          </div> : null}
        </div>
      </section>
    </div>
  </div>;
}


export function HospitalAnalysisTab({ method, products, hospitalKey, setHospitalKey, hospitalSubtab, setHospitalSubtab, peerThreshold, setPeerThreshold }: {
  method: EstimationMethod; products: ProductOption[];
  hospitalKey:string; setHospitalKey:(value:string)=>void;
  hospitalSubtab:"summary"|"comparison"|"similarity"; setHospitalSubtab:(value:"summary"|"comparison"|"similarity")=>void;
  peerThreshold:number; setPeerThreshold:(value:number)=>void;
}) {
  const [directory, setDirectory] = useState<HospitalDirectoryEntry[]>([]);
  const [city, setCity] = useState("");
  const [analysis, setAnalysis] = useState<HospitalAnalysis | null>(null);
  const [facilityProfiles, setFacilityProfiles] = useState<Record<string,FacilityProfileRecord>>({});
  const [facilitySnapshotDate,setFacilitySnapshotDate]=useState<string>("");
  const [financialResults,setFinancialResults]=useState<Record<string,FinancialEntityRecord>>({});
  const [sidebarSlot, setSidebarSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rpwdlOpen,setRpwdlOpen]=useState<{core:boolean;outpatient:boolean}>({
    core:false,
    outpatient:false,
  });
  const [rpwdlWardSortKey,setRpwdlWardSortKey]=useState<RpwdlWardSortKey>("beds");
  const [rpwdlWardSortDir,setRpwdlWardSortDir]=useState<"asc"|"desc">("desc");

  void hospitalSubtab;
  void setHospitalSubtab;
  void peerThreshold;
  void setPeerThreshold;

  useEffect(() => {
    setSidebarSlot(document.getElementById("hospital-sidebar-slot"));
  }, []);
  useEffect(()=>{
    setRpwdlOpen({core:false,outpatient:false});
    setRpwdlWardSortKey("beds");
    setRpwdlWardSortDir("desc");
  },[hospitalKey]);
  useEffect(() => {
    void loadStaticDataset()
      .then((d) => {
        setDirectory(hospitalDirectoryFromDataset(d));
        return Promise.allSettled([loadRpwdlFacilityProfiles(), loadFinancialResults()]);
      })
      .then(([fp, fin]) => {
        if(fp.status === "fulfilled"){
          const byKey:Record<string,FacilityProfileRecord>={};
          fp.value.records.forEach(x=>{byKey[`${x.oz_nfz}|${x.nip}`]=x;});
          setFacilityProfiles(byKey);
          setFacilitySnapshotDate(fp.value.rpwdl_snapshot_date);
        }
        if(fin.status === "fulfilled"){
          const byNip:Record<string,FinancialEntityRecord>={};
          fin.value.records.forEach(x=>{byNip[normalizeNip(x.nip)]=x;});
          setFinancialResults(byNip);
        }
        const optionalErrors = [
          fp.status === "rejected" ? `profile placówek RPWDL: ${fp.reason instanceof Error ? fp.reason.message : "błąd"}` : null,
          fin.status === "rejected" ? `wyniki finansowe: ${fin.reason instanceof Error ? fin.reason.message : "błąd"}` : null,
        ].filter(Boolean);
        setError(optionalErrors.length ? `Dane podstawowe działają. Nie udało się załadować: ${optionalErrors.join("; ")}` : null);
        setLoading(false);
      })
      .catch((e) => { setError(e instanceof Error ? e.message : "Błąd danych"); setLoading(false); });
  }, []);
  const hospitalMatches = useMemo(() => {
    const q = city.trim().toLocaleLowerCase("pl");
    if (!q) return [];
    return directory
      .filter((x) => `${x.city} ${x.name}`.toLocaleLowerCase("pl").includes(q))
      .sort((a,b) => a.city.localeCompare(b.city, "pl") || a.name.localeCompare(b.name, "pl"))
      .slice(0, 30);
  }, [directory, city]);
  const facilityProfile = hospitalKey ? facilityProfiles[hospitalKey] : undefined;
  const facilityAddress=facilityProfile?.facilities.find(site=>site.primary_address)?.primary_address;
  const facilityCity=facilityAddress?.city ?? facilityProfile?.source_city;
  const facilityStreetAddress=[facilityAddress?.street,facilityAddress?.building].filter(Boolean).join(" ");
  const financialEntity=analysis ? financialResults[normalizeNip(analysis.nip)] : undefined;
  const financialResult=financialEntity?.years.find(x=>x.year===financialEntity.latest_result_year) ?? null;
  const financialValues=financialResult ?? (financialEntity?.years.find(x=>x.year===financialEntity.latest_values_year) ?? null);
  const financialDisplayYear=financialValues?.year ?? null;
  const financialHasResult=financialValues?.net_result!=null;
  const financialIsFallback=financialDisplayYear!=null && financialDisplayYear!==2025;
  const financialTone=!financialHasResult ? "is-missing" : financialValues!.net_result!>0 ? "is-profit" : financialValues!.net_result!<0 ? "is-loss" : "is-neutral";
  const hospitalScaleLabel=analysis
    ? (analysis.hospitalizations>=20000 ? "dużej skali" : analysis.hospitalizations>=8000 ? "średniej skali" : "mniejszej skali")
    : "";
  const hospitalTreatmentLabel=analysis
    ? (analysis.proceduralSharePct>=45 ? "profil bardziej zabiegowy" : analysis.proceduralSharePct<=20 ? "profil bardziej zachowawczy" : "profil mieszany")
    : "";
  const hospitalProfileSummary=analysis
    ? (facilityProfile
      ? `Placówka ${hospitalScaleLabel}. Ma ${hospitalTreatmentLabel}, ${nf.format(analysis.uniqueJgpOver10)} aktywnych JGP, ${nf.format(facilityProfile.aggregate.core_type_count_raw)} główne oddziały i ${nf.format(facilityProfile.aggregate.core_beds_total)} łóżka szpitalne.`
      : `Placówka ${hospitalScaleLabel}. Ma ${hospitalTreatmentLabel} i ${nf.format(analysis.uniqueJgpOver10)} aktywnych JGP.`)
    : "";
  const facilityStats = useMemo(()=>{
    if(!facilityProfile) return null;
    const hospitalCells=facilityProfile.facilities.reduce((s,x)=>s+(x.hospital_cells_count||0),0);
    const outpatientCells=facilityProfile.facilities.reduce((s,x)=>s+(x.outpatient_cells_count||0),0);
    const supportCells=facilityProfile.facilities.reduce((s,x)=>s+(x.support_cells_count||0),0);
    const dialysis=facilityProfile.facilities.reduce((s,x)=>s+(x.capacity?.["Liczba stanowisk dializacyjnych"]||0),0);
    const dayPlaces=facilityProfile.facilities.reduce((s,x)=>s+(x.capacity?.["Liczba miejsc pobytu dziennego"]||0),0);
    const coreFieldMap=new Map<string,string>();
    for(const site of facilityProfile.facilities){
      for(const code of site.hospital_x_codes_core??[]) if(!coreFieldMap.has(code)) coreFieldMap.set(code,code);
      for(const field of site.hospital_medical_fields_core??[]){
        if(field.x) coreFieldMap.set(field.x,field.name||field.x);
      }
    }
    const fields=[...coreFieldMap.entries()].sort(([a],[b])=>a.localeCompare(b,"pl")).map(([,name])=>name);
    const outpatientFields=[...new Set(facilityProfile.facilities.flatMap(x=>(x.outpatient_medical_fields??[]).map(y=>y.name).filter(Boolean) as string[]))].sort((a,b)=>a.localeCompare(b,"pl"));

    const coreWardMap=new Map<string,{code:string;names:Set<string>;beds:number;fields:Set<string>}>();
    for(const site of facilityProfile.facilities){
      const rawTypes=site.core_capacity?.raw_types??{};
      const siteFields=site.hospital_medical_fields_core??[];
      for(const [code,raw] of Object.entries(rawTypes)){
        const entry=coreWardMap.get(code) ?? {code,names:new Set<string>(),beds:0,fields:new Set<string>()};
        for(const name of raw.names??[]) if(name) entry.names.add(name);
        entry.beds += Number(raw.beds)||0;
        for(const field of siteFields){
          if(field.name && field.source_viii?.includes(code)) entry.fields.add(field.name);
        }
        coreWardMap.set(code,entry);
      }
    }
    const coreWards=[...coreWardMap.values()].map(row=>({
      code:row.code,
      name:[...row.names].sort((a,b)=>a.localeCompare(b,"pl")).join(" / ") || `Oddział ${row.code}`,
      beds:row.beds,
      fields:[...row.fields].sort((a,b)=>a.localeCompare(b,"pl")),
    })).sort((a,b)=>a.name.localeCompare(b.name,"pl"));

    const capabilityBeds=(key:string, fallbackKey?:string)=>{
      let present=false, beds=0;
      for(const site of facilityProfile.facilities){
        const primary=site.special_capabilities?.[key];
        const fallback=fallbackKey ? site.non_core_capacity?.[fallbackKey] : undefined;
        const cap=primary ?? fallback;
        if(cap?.present){ present=true; beds += cap.beds ?? 0; }
      }
      return {present,beds};
    };
    const sor=capabilityBeds("emergency_department","emergency_department");
    const admission=capabilityBeds("admission_room","admission_room");
    const chronic=capabilityBeds("chronic_care_ward","chronic_care");
    const palliative=capabilityBeds("palliative_ward","palliative");
    const icu=capabilityBeds("intensive_care","intensive_care");
    const stroke=capabilityBeds("stroke_unit","stroke_unit");
    const ccu=capabilityBeds("cardiac_intensive_care","cardiac_intensive_care");
    const rehab=capabilityBeds("rehabilitation","rehabilitation");
    const psychiatry=capabilityBeds("psychiatry_addiction","psychiatry_addiction");
    const hospice=capabilityBeds("hospice","hospice");
    const neonatology=capabilityBeds("neonatology","neonatology");

    const flagPresent=(key:string)=>{
      for(const site of facilityProfile.facilities){
        if(site.special_capabilities?.[key]?.present) return true;
      }
      return false;
    };
    const operatingBlock=flagPresent("operating_block");
    const deliveryRoom=flagPresent("delivery_room");
    const dialysisPresent=flagPresent("dialysis") || dialysis>0;

    const supportText=facilityProfile.facilities
      .flatMap(site=>[
        site.name,
        ...(site.hospital_medical_fields_core??[]).map(x=>x.name??""),
        ...(site.outpatient_medical_fields??[]).map(x=>x.name??""),
        ...(site.special_capabilities ? Object.keys(site.special_capabilities) : []),
        ...(site.non_core_capacity ? Object.keys(site.non_core_capacity) : []),
      ])
      .join(" ")
      .toLocaleLowerCase("pl");

    const textMarker=(terms:string[])=>terms.some(term=>supportText.includes(term.toLocaleLowerCase("pl")));
    const pozPresent=textMarker(["podstawowa opieka zdrowotna","poz"]);
    const nplPresent=textMarker(["nocna i świąteczna","nocna opieka","npl"]);

    const capabilities=[
      {key:"core",group:"Profil organizacyjny",label:"Główne oddziały",present:facilityProfile.aggregate.core_type_count_raw>0,detail:`${nf.format(facilityProfile.aggregate.core_type_count_raw)} oddziałów · ${nf.format(fields.length)} dziedzin`},
      {key:"outpatient",group:"Profil organizacyjny",label:"Opieka ambulatoryjna",present:outpatientCells>0,detail:`${nf.format(outpatientCells)} komórek · ${nf.format(outpatientFields.length)} dziedzin`},
      {key:"support",group:"Profil organizacyjny",label:"Diagnostyka i zaplecze",present:supportCells>0,detail:`${nf.format(supportCells)} komórek${dayPlaces ? ` · ${nf.format(dayPlaces)} miejsc dziennych` : ""}`},

      {key:"sor",group:"Ratunkowe i intensywne",label:"SOR",present:sor.present,detail:sor.beds ? `${nf.format(sor.beds)} łóżek` : ""},
      {key:"admission",group:"Ratunkowe i intensywne",label:"Izba przyjęć",present:admission.present,detail:admission.beds ? `${nf.format(admission.beds)} łóżek` : ""},
      {key:"icu",group:"Ratunkowe i intensywne",label:"OIT",present:icu.present,detail:icu.beds ? `${nf.format(icu.beds)} łóżek` : ""},
      {key:"stroke",group:"Ratunkowe i intensywne",label:"Oddział udarowy",present:stroke.present,detail:stroke.beds ? `${nf.format(stroke.beds)} łóżek` : ""},
      {key:"ccu",group:"Ratunkowe i intensywne",label:"Intensywny nadzór kardiologiczny",present:ccu.present,detail:ccu.beds ? `${nf.format(ccu.beds)} łóżek` : ""},

      {key:"operating",group:"Zabiegowe",label:"Blok operacyjny",present:operatingBlock,detail:""},
      {key:"delivery",group:"Zabiegowe",label:"Sala porodowa",present:deliveryRoom,detail:""},

      {key:"chronic",group:"Długoterminowe i opiekuńcze",label:"ZOL / ZPO",present:chronic.present,detail:chronic.beds ? `${nf.format(chronic.beds)} łóżek` : ""},
      {key:"palliative",group:"Długoterminowe i opiekuńcze",label:"Opieka paliatywna",present:palliative.present,detail:palliative.beds ? `${nf.format(palliative.beds)} łóżek` : ""},
      {key:"hospice",group:"Długoterminowe i opiekuńcze",label:"Hospicjum",present:hospice.present,detail:hospice.beds ? `${nf.format(hospice.beds)} łóżek` : ""},
      {key:"rehab",group:"Długoterminowe i opiekuńcze",label:"Rehabilitacja",present:rehab.present,detail:rehab.beds ? `${nf.format(rehab.beds)} łóżek` : ""},

      {key:"dialysis",group:"Specjalistyczne",label:"Dializy",present:dialysisPresent,detail:dialysis ? `${nf.format(dialysis)} stanowisk` : ""},
      {key:"psychiatry",group:"Specjalistyczne",label:"Psychiatria / leczenie uzależnień",present:psychiatry.present,detail:psychiatry.beds ? `${nf.format(psychiatry.beds)} łóżek` : ""},
      {key:"neonatology",group:"Specjalistyczne",label:"Neonatologia",present:neonatology.present,detail:neonatology.beds ? `${nf.format(neonatology.beds)} łóżek` : ""},
      {key:"poz",group:"Podstawowa i doraźna",label:"POZ",present:pozPresent,detail:""},
      {key:"npl",group:"Podstawowa i doraźna",label:"Nocna i świąteczna opieka",present:nplPresent,detail:""},
    ];
    return {hospitalCells,outpatientCells,supportCells,dialysis,dayPlaces,fields,outpatientFields,coreWards,capabilities};
  },[facilityProfile]);

  const facilityProfileDescriptor=useMemo(()=>{
    if(!facilityProfile || !facilityStats) return "";
    const fieldCount=facilityStats.fields.length;
    const outpatientCount=facilityStats.outpatientFields.length;
    const breadth=fieldCount>=25 ? "bardzo szeroki profil specjalistyczny" : fieldCount>=12 ? "szeroki profil specjalistyczny" : "bardziej skoncentrowany profil";
    const extras=[
      outpatientCount>=20 ? "rozbudowaną opiekę ambulatoryjną" : outpatientCount>=8 ? "opiekę ambulatoryjną" : "",
      facilityStats.supportCells>=50 ? "rozbudowane zaplecze diagnostyczne i wspierające" : facilityStats.supportCells>0 ? "zaplecze diagnostyczne i wspierające" : "",
    ].filter(Boolean);
    return `Placówka ma ${breadth}${extras.length ? ` oraz ${extras.join(" i ")}` : ""}.`;
  },[facilityProfile,facilityStats]);

  const sortedRpwdlWards=useMemo(()=>{
    if(!facilityStats) return [];
    return [...facilityStats.coreWards].sort((a,b)=>{
      let cmp=0;
      if(rpwdlWardSortKey==="name") cmp=a.name.localeCompare(b.name,"pl");
      else if(rpwdlWardSortKey==="beds") cmp=a.beds-b.beds;
      else cmp=a.fields.length-b.fields.length || a.fields.join(" · ").localeCompare(b.fields.join(" · "),"pl");
      return rpwdlWardSortDir==="asc" ? cmp : -cmp;
    });
  },[facilityStats,rpwdlWardSortKey,rpwdlWardSortDir]);

  const sortRpwdlWards=(key:RpwdlWardSortKey)=>{
    if(rpwdlWardSortKey===key) setRpwdlWardSortDir(v=>v==="asc"?"desc":"asc");
    else {
      setRpwdlWardSortKey(key);
      setRpwdlWardSortDir(key==="name"?"asc":"desc");
    }
  };

  const RpwdlWardHeader=({sortKey,children,num=false}:{sortKey:RpwdlWardSortKey;children:React.ReactNode;num?:boolean})=>
    <th className={num?"num":undefined} aria-sort={rpwdlWardSortKey===sortKey?(rpwdlWardSortDir==="asc"?"ascending":"descending"):"none"}>
      <button
        type="button"
        className={`hospital-sort-header${rpwdlWardSortKey===sortKey?" is-active":""}`}
        onClick={()=>sortRpwdlWards(sortKey)}
      >
        <span>{children}</span>
        <span className="hospital-sort-icon">{rpwdlWardSortKey===sortKey?(rpwdlWardSortDir==="asc"?"↑":"↓"):"↕"}</span>
      </button>
    </th>;

  useEffect(() => {
    if (!hospitalKey) { setAnalysis(null); return; }
    let cancelled = false;
    setLoading(true);
    void loadStaticDataset()
      .then((d) => {
        if (!cancelled) setAnalysis(hospitalAnalysisFromDataset(d, hospitalKey, method));
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Błąd analizy"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hospitalKey, method]);
  return <section className={`hospital-analysis ${loading ? "loading" : ""} hospital-subtab-summary`}>
    {sidebarSlot ? createPortal(<>
      <section className="filter-section">
        <div className="sidebar-kicker">Szpital</div>
        <Select
          searchable
          value={hospitalKey || null}
          onChange={(value) => {
            if (!value) return;
            const selected=directory.find((x)=>x.key===value);
            setHospitalKey(value);
            if (selected) setCity(`${selected.name} · ${selected.city}`);
          }}
          data={directory.map((x)=>({value:x.key,label:`${x.name} · ${x.city}`}))}
          placeholder="Wybierz szpital"
          nothingFoundMessage="Brak wyników"
          allowDeselect={false}
          comboboxProps={{withinPortal:true,shadow:"md"}}
          className="mantine-filter"
        />
      </section>

      {/* Widoki porównawcze są odłączone. Implementacje są w osobnych modułach metod. */}

    </>, sidebarSlot) : null}
      {error ? <div className="alert">{error}</div> : null}

    {!analysis ? <div className="hospital-empty">Wyszukaj miasto i wybierz szpital, aby zobaczyć jego pełny profil.</div> : <>
      <div className="hospital-profile-topline">
        <div className="hospital-identity hospital-identity-flat hospital-view-heading hospital-profile-identity hospital-profile-banner">
          <div className="hospital-profile-identity-icon" aria-hidden="true"><ProfileGlyph name="hospital"/></div>
          <div className="hospital-profile-identity-copy">
            <h2>{displayHospitalName(analysis.providerName)}</h2>
            <div className="hospital-profile-identity-meta">
              {facilityCity ? <span>{facilityCity}</span> : null}
              {facilityStreetAddress ? <span>{facilityStreetAddress}</span> : null}
            </div>
            <p>{hospitalProfileSummary}</p>
          </div>
        </div>

        <div className={`hospital-profile-card hospital-profile-card-finance hospital-profile-card-finance-top ${financialTone}`}>
          <div className="hospital-profile-card-head hospital-profile-card-head-finance">
            
            <div>
              <span>
                {financialHasResult
                  ? `${financialValues!.net_result! >= 0 ? "Zysk netto" : "Strata netto"}${financialDisplayYear ? ` (${financialDisplayYear})` : ""}`
                  : financialDisplayYear ? `Wynik finansowy (${financialDisplayYear})` : "Wynik finansowy"}
              </span>
            </div>
          </div>
          <div className="hospital-profile-finance-body">
            <b className="hospital-profile-finance-amount">{financialHasResult ? moneyCompact(financialValues!.net_result) : "—"}</b>
            {financialIsFallback ? <em>Brak danych za 2025 · pokazano najnowszy dostępny rok.</em> : null}
            <small className="hospital-profile-finance-revenue">{financialValues?.revenue != null ? `Przychód ${moneyCompact(financialValues.revenue)}` : "Brak danych finansowych"}</small>
          </div>
          <div className="hospital-profile-finance-bars" aria-hidden="true">
            <i></i><i></i><i></i><i></i><i></i><i></i>
          </div>
        </div>
      </div>
      
      <div className="hospital-summary-stack hospital-summary-redesign">
        <section className="hospital-profile-stats-card" aria-label="Najważniejsze informacje o szpitalu">
          <div className="hospital-profile-stats-grid">
            <div className="hospital-profile-stat">
              <span>Hospitalizacje</span>
              <strong>{nf.format(analysis.hospitalizations)}</strong>
              <small>{pct(analysis.proceduralSharePct)} hosp. zabiegowych</small>
            </div>

            <div className="hospital-profile-stat">
              <span>Śmiertelność</span>
              <strong>{pct(analysis.mortalityPct)}</strong>
              <small>{nf.format(analysis.deaths)} zgonów</small>
            </div>

            <div className="hospital-profile-stat">
              <span>Liczba unikalnych JGP</span>
              <strong>{nf.format(analysis.uniqueJgpOver10)}</strong>
              <small>JGP &gt;10 hospitalizacji</small>
            </div>

            <div className="hospital-profile-stat">
              <span>Główne oddziały</span>
              <strong>{facilityProfile ? nf.format(facilityProfile.aggregate.core_type_count_raw) : "—"}</strong>
              <small>{facilityProfile ? `${nf.format(facilityProfile.aggregate.core_beds_total)} łóżek szpitalnych` : "Brak danych RPWDL"}</small>
            </div>
          </div>
        </section>

        <section className="hospital-jgp-profile-section hospital-surface-card">
          <HospitalCharts analysis={analysis} products={products} />
        </section>

        <div className="hospital-summary-section-head hospital-profile-section-head hospital-rpwdl-section-head">
          <div className="hospital-profile-section-icon hospital-profile-section-icon-building" aria-hidden="true"><ProfileGlyph name="building"/></div>
          <div>
            <h3>Struktura organizacyjna – RPWDL</h3>
            <p>Szczegóły organizacyjne i zakres działalności wynikające z profilu RPWDL.</p>
          </div>
        </div>

        {facilityProfile && facilityStats ? <section className="hospital-chart-card hospital-peer-chart-card hospital-surface-card hospital-summary-profile-card hospital-rpwdl-overview">
          <div className="hospital-rpwdl-overview-meta">
            <small>{facilitySnapshotDate ? `Stan na ${facilitySnapshotDate} · ` : ""}dopasowanie po OW NFZ i NIP</small>
          </div>

          <div className="hospital-rpwdl-kpis">
            <div className="hospital-rpwdl-kpi">
              <span className="hospital-rpwdl-kpi-icon"><ProfileGlyph name="bed"/></span>
              <div><b>{nf.format(facilityProfile.aggregate.core_type_count_raw)}</b><span>Główne oddziały</span><small>{nf.format(facilityProfile.aggregate.core_beds_total)} łóżek szpitalnych</small></div>
            </div>
            <div className="hospital-rpwdl-kpi">
              <span className="hospital-rpwdl-kpi-icon"><ProfileGlyph name="building"/></span>
              <div><b>{nf.format(facilityStats.fields.length)}</b><span>Dziedziny główne</span><small>zakres specjalizacji oddziałów</small></div>
            </div>
            <div className="hospital-rpwdl-kpi">
              <span className="hospital-rpwdl-kpi-icon"><ProfileGlyph name="users"/></span>
              <div><b>{nf.format(facilityStats.outpatientCells)}</b><span>Opieka ambulatoryjna</span><small>{nf.format(facilityStats.outpatientFields.length)} dziedzin</small></div>
            </div>
            <div className="hospital-rpwdl-kpi">
              <span className="hospital-rpwdl-kpi-icon"><ProfileGlyph name="flask"/></span>
              <div><b>{nf.format(facilityStats.supportCells)}</b><span>Diagnostyka i zaplecze</span><small>{facilityStats.dayPlaces ? `${nf.format(facilityStats.dayPlaces)} miejsc dziennych` : "komórki wspierające"}</small></div>
            </div>
          </div>

          <div className="hospital-rpwdl-present">
            <div className="hospital-rpwdl-present-head">
              <span>Dodatkowe wykryte elementy</span>
              <small>Dodatkowe elementy organizacyjne wykryte poza głównymi oddziałami i opieką ambulatoryjną.</small>
            </div>
            <div className="hospital-rpwdl-present-badges">
              {facilityStats.capabilities.filter(x=>x.present && [
                "sor","admission","icu","stroke","ccu",
                "operating","delivery",
                "chronic","palliative","hospice","rehab",
                "dialysis","psychiatry","neonatology",
                "poz","npl"
              ].includes(x.key)).map(x=><span key={x.key}><strong>{x.label}</strong>{x.detail ? <small>{x.detail}</small> : null}</span>)}
              {!facilityStats.capabilities.some(x=>x.present && [
                "sor","admission","icu","stroke","ccu",
                "operating","delivery",
                "chronic","palliative","hospice","rehab",
                "dialysis","psychiatry","neonatology",
                "poz","npl"
              ].includes(x.key)) ? <em>Brak dodatkowych wykrytych elementów.</em> : null}
            </div>
          </div>

          <div className="hospital-rpwdl-disclosures">
            <div className={`hospital-rpwdl-disclosure ${rpwdlOpen.core ? "is-open" : ""}`}>
              <button type="button" aria-expanded={rpwdlOpen.core} onClick={()=>setRpwdlOpen(v=>({...v,core:!v.core}))}>
                <span><strong>Główne oddziały i dziedziny</strong><small>{nf.format(facilityStats.fields.length)} dziedzin · {nf.format(facilityProfile.aggregate.core_type_count_raw)} oddziałów · {nf.format(facilityProfile.aggregate.core_beds_total)} łóżek</small></span>
                <i aria-hidden="true">⌄</i>
              </button>
              {rpwdlOpen.core ? <div className="hospital-rpwdl-disclosure-body hospital-rpwdl-table-wrap">
                {sortedRpwdlWards.length ? <table className="hospital-rpwdl-wards-table">
                  <thead>
                    <tr>
                      <RpwdlWardHeader sortKey="name">Oddział</RpwdlWardHeader>
                      <RpwdlWardHeader sortKey="beds" num>Łóżka</RpwdlWardHeader>
                      <RpwdlWardHeader sortKey="fields">Realizowane dziedziny</RpwdlWardHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRpwdlWards.map(row=><tr key={row.code}>
                      <td><strong>{row.name}</strong></td>
                      <td>{nf.format(row.beds)}</td>
                      <td>{row.fields.length ? row.fields.join(", ") : "—"}</td>
                    </tr>)}
                  </tbody>
                </table> : <div className="hospital-empty-inline">Brak szczegółowych danych o głównych oddziałach.</div>}
              </div> : null}
            </div>

            <div className={`hospital-rpwdl-disclosure ${rpwdlOpen.outpatient ? "is-open" : ""}`}>
              <button type="button" aria-expanded={rpwdlOpen.outpatient} onClick={()=>setRpwdlOpen(v=>({...v,outpatient:!v.outpatient}))}>
                <span><strong>Opieka ambulatoryjna</strong><small>{nf.format(facilityStats.outpatientCells)} komórek · {nf.format(facilityStats.outpatientFields.length)} dziedzin</small></span>
                <i aria-hidden="true">⌄</i>
              </button>
              {rpwdlOpen.outpatient ? <div className="hospital-rpwdl-disclosure-body">
                <div className="hospital-field-cloud">
                  {facilityStats.outpatientFields.length ? facilityStats.outpatientFields.map((name,i)=><span key={`outpatient-${name}-${i}`}>{name}</span>) : <em>Brak dziedzin ambulatoryjnych w profilu.</em>}
                </div>
              </div> : null}
            </div>


          </div>
        </section> : <div className="hospital-empty hospital-summary-profile-empty">Brak dopasowania do nowego profilu RPWDL dla klucza OW NFZ + NIP.</div>}
      </div>


    {/* Porównania pozostają niepodpięte do Profilu szpitala. */}

    </>}
  </section>;
}
