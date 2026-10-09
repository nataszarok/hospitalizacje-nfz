"use client";

import { ActionIcon } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { EstimationMethod, HospitalPeerBenchmark, ProductOption } from "@/lib/types";
import {
  hospitalPeerBenchmarkFromDataset,
  loadStaticDataset,
  type HospitalPeerSelectionEntry,
} from "@/lib/staticData";
import {
  JgpMortalityDifferenceTable,
  PeerComparisonCharts,
  displayHospitalName,
  loadJgpValuations,
  nf,
  parseMaybeGzip,
  pct,
  pf,
  type JgpValuation,
  type PeerGrade,
  type PeerPair,
} from "./HospitalComparisonShared";

type PeerPairsPayload={version:number;grades:PeerGrade[];rows:PeerPair[]};
let peerPairsPromise:Promise<PeerPairsPayload>|null=null;

function loadPeerPairs(){
  if(!peerPairsPromise){
    peerPairsPromise=fetch("/data/peer_pairs_ab.json.gz",{cache:"force-cache"})
      .then(parseMaybeGzip) as Promise<PeerPairsPayload>;
    peerPairsPromise=peerPairsPromise.catch(e=>{peerPairsPromise=null;throw e;});
  }
  return peerPairsPromise;
}

function newPeerSelection(rows:PeerPair[],hospitalKey:string,gradeScope:"A"|"AB",maxDistance:number,method:EstimationMethod){
  const out=new Map<string,HospitalPeerSelectionEntry>();
  for(const row of rows){
    const gradeAllowed=row.peer_grade_pred==="A" || (gradeScope==="AB" && row.peer_grade_pred==="B");
    if(!gradeAllowed || row.distance_score>maxDistance || (row.a!==hospitalKey && row.b!==hospitalKey)) continue;
    const targetIsA=row.a===hospitalKey;
    const peerKey=targetIsA?row.b:row.a;
    const targetHosp=method==="sim"
      ? (targetIsA?row.hospitalizations_sim_a:row.hospitalizations_sim_b)
      : (targetIsA?row.hospitalizations_min_a:row.hospitalizations_min_b);
    const peerHosp=method==="sim"
      ? (targetIsA?row.hospitalizations_sim_b:row.hospitalizations_sim_a)
      : (targetIsA?row.hospitalizations_min_b:row.hospitalizations_min_a);
    const targetDeaths=method==="sim"
      ? (targetIsA?row.deaths_sim_a:row.deaths_sim_b)
      : (targetIsA?row.deaths_min_a:row.deaths_min_b);
    const peerDeaths=method==="sim"
      ? (targetIsA?row.deaths_sim_b:row.deaths_sim_a)
      : (targetIsA?row.deaths_min_b:row.deaths_min_a);
    const targetBeds=targetIsA?row.core_beds_a:row.core_beds_b;
    const peerBeds=targetIsA?row.core_beds_b:row.core_beds_a;
    const targetTypes=targetIsA?row.core_types_a:row.core_types_b;
    const peerTypes=targetIsA?row.core_types_b:row.core_types_a;
    const targetOrg=targetIsA?row.core_x_supported_count_a:row.core_x_supported_count_b;
    const peerOrg=targetIsA?row.core_x_supported_count_b:row.core_x_supported_count_a;
    const targetClinics=targetIsA?row.clinics_a:row.clinics_b;
    const peerClinics=targetIsA?row.clinics_b:row.clinics_a;
    const targetJgp=targetIsA?row.jgp_gt10_a:row.jgp_gt10_b;
    const peerJgp=targetIsA?row.jgp_gt10_b:row.jgp_gt10_a;
    out.set(peerKey,{
      // Pole pozostaje tylko dla zgodności z istniejącym typem benchmarku. W UI nowej metody nie jest pokazywane.
      similarityPct:0,
      distanceScore:row.distance_score,
      peerGrade:row.peer_grade_pred,
      targetHospitalizations:targetHosp,peerHospitalizations:peerHosp,
      targetDeaths,peerDeaths,
      targetCoreBeds:targetBeds,peerCoreBeds:peerBeds,
      targetCoreTypes:targetTypes,peerCoreTypes:peerTypes,
      targetCoreXSupported:targetOrg,peerCoreXSupported:peerOrg,
      targetClinics,peerClinics,
      sharedCoreTypes:row.core_types_shared,
      sharedJgp:row.jgp_shared,targetJgp,peerJgp,
      coreTypeSetSimilarity:row.core_type_set_similarity,
      jgpSetSimilarity:row.jgp_set_similarity,
      jgpSharedVolumeSimilarity:row.jgp_shared_volume_similarity,
      bedCosineSimilarity:row.bed_cosine_similarity,
      bedWeightedJaccardSimilarity:row.bed_weighted_jaccard_similarity,
    });
  }
  return out;
}

function PairBenchmarkPanel({ benchmark, hoveredPeerKey, onHoverPeer, method, gradeScope, maxDistance, peerPairs, hospitalKey }: {
  benchmark: HospitalPeerBenchmark;
  hoveredPeerKey: string | null;
  onHoverPeer: (key: string | null) => void;
  method: EstimationMethod;
  gradeScope:"A"|"AB";
  maxDistance:number;
  peerPairs:PeerPair[];
  hospitalKey:string;
}) {
  const [methodologyOpen,setMethodologyOpen]=useState(false);
  const [peerGroupOpen,setPeerGroupOpen]=useState(false);

  type PeerGroupSortKey=
    "name"|"grade"|"distance"|"hospitalizations"|"beds"|"coreTypes"|"sharedJgp"|"jgpFamilySimilarity";

  const [peerGroupSortKey,setPeerGroupSortKey]=useState<PeerGroupSortKey>("distance");
  const [peerGroupSortDir,setPeerGroupSortDir]=useState<"asc"|"desc">("asc");

  const rows = [
    { label:"Śmiertelność", selected:benchmark.selected.mortalityPct, median:benchmark.median.mortalityPct, fmt:pct, inverse:true },
    { label:"Hospitalizacje", selected:benchmark.selected.hospitalizations, median:benchmark.median.hospitalizations, fmt:(v:number)=>nf.format(v) },
    { label:"Przyjęcia nagłe", selected:benchmark.selected.urgentSharePct, median:benchmark.median.urgentSharePct, fmt:pct },
    { label:"Zabiegowe JGP *", selected:benchmark.selected.proceduralSharePct, median:benchmark.median.proceduralSharePct, fmt:pct },
  ];

  const pairByPeerKey=useMemo(()=>{
    const map=new Map<string,{pair:PeerPair;targetIsA:boolean}>();
    for(const pair of peerPairs){
      if(pair.a===hospitalKey) map.set(pair.b,{pair,targetIsA:true});
      else if(pair.b===hospitalKey) map.set(pair.a,{pair,targetIsA:false});
    }
    return map;
  },[peerPairs,hospitalKey]);

  const sharePct=(value:number|null|undefined)=>{
    const n=Number(value);
    if(!Number.isFinite(n)) return 0;
    return Math.abs(n)<=1.000001 ? n*100 : n;
  };

  const pairSideValue=(entry:{pair:PeerPair;targetIsA:boolean}|undefined,fieldA:keyof PeerPair,fieldB:keyof PeerPair,peerSide:boolean)=>{
    if(!entry) return 0;
    const useA=peerSide ? !entry.targetIsA : entry.targetIsA;
    return Number(entry.pair[useA ? fieldA : fieldB] ?? 0);
  };

  const mainPairEntry=useMemo(()=>{
    for(const p of benchmark.peers){
      const entry=pairByPeerKey.get(p.key);
      if(entry) return entry;
    }
    return undefined;
  },[benchmark.peers,pairByPeerKey]);

  const mainModelStats=useMemo(()=>({
    hospitalizations:mainPairEntry
      ? pairSideValue(mainPairEntry,method==="sim"?"hospitalizations_sim_a":"hospitalizations_min_a",method==="sim"?"hospitalizations_sim_b":"hospitalizations_min_b",false)
      : Number(benchmark.selected.hospitalizations)||0,
    beds:mainPairEntry ? pairSideValue(mainPairEntry,"core_beds_a","core_beds_b",false) : Number(benchmark.selected.coreBeds)||0,
    coreTypes:mainPairEntry ? pairSideValue(mainPairEntry,"core_types_a","core_types_b",false) : Number(benchmark.selected.coreWards)||0,
    sharedJgpPct:mainPairEntry ? Math.max(0,Math.min(100,(1-Number(mainPairEntry.pair.d_jgp_set ?? 1))*100)) : 0,
    jgpFamilySimilarityPct:mainPairEntry ? Math.max(0,Math.min(100,(1-Number(mainPairEntry.pair.d_jgp_family_weighted_jaccard ?? 1))*100)) : 0,
  }),[mainPairEntry,method,benchmark.selected]);

  const peerGroupRows=useMemo(()=>benchmark.peers.map((p,index)=>{
    const entry=pairByPeerKey.get(p.key);
    return {
      key:p.key,
      originalIndex:index,
      name:displayHospitalName(p.providerName),
      city:p.city,
      voivodeship:p.voivodeship,
      grade:String(p.peerGrade ?? entry?.pair.peer_grade_pred ?? "—"),
      distance:p.distanceScore==null ? (entry?.pair.distance_score ?? null) : Number(p.distanceScore),
      hospitalizations:entry
        ? pairSideValue(entry,method==="sim"?"hospitalizations_sim_a":"hospitalizations_min_a",method==="sim"?"hospitalizations_sim_b":"hospitalizations_min_b",true)
        : Number(p.hospitalizations)||0,
      beds:entry ? pairSideValue(entry,"core_beds_a","core_beds_b",true) : Number(p.coreBeds)||0,
      coreTypes:entry ? pairSideValue(entry,"core_types_a","core_types_b",true) : Number(p.coreWards)||0,
      sharedJgpPct:entry ? Math.max(0,Math.min(100,(1-Number(entry.pair.d_jgp_set ?? 1))*100)) : 0,
      jgpFamilySimilarityPct:entry ? Math.max(0,Math.min(100,(1-Number(entry.pair.d_jgp_family_weighted_jaccard ?? 1))*100)) : 0,
    };
  }),[benchmark.peers,pairByPeerKey,method]);

  const sortedPeerGroupRows=useMemo(()=>{
    const value=(r:(typeof peerGroupRows)[number],key:PeerGroupSortKey):string|number=>{
      switch(key){
        case "name": return r.name;
        case "grade": return r.grade;
        case "distance": return r.distance ?? Number.POSITIVE_INFINITY;
        case "hospitalizations": return r.hospitalizations;
        case "beds": return r.beds;
        case "coreTypes": return r.coreTypes;
        case "sharedJgp": return r.sharedJgpPct;
        case "jgpFamilySimilarity": return r.jgpFamilySimilarityPct;
      }
    };
    return [...peerGroupRows].sort((a,b)=>{
      const av=value(a,peerGroupSortKey);
      const bv=value(b,peerGroupSortKey);
      let cmp=0;
      if(typeof av==="string" && typeof bv==="string") cmp=av.localeCompare(bv,"pl");
      else cmp=Number(av)-Number(bv);
      if(cmp===0) cmp=a.originalIndex-b.originalIndex;
      return peerGroupSortDir==="asc" ? cmp : -cmp;
    });
  },[peerGroupRows,peerGroupSortKey,peerGroupSortDir]);

  const sortPeerGroup=(key:PeerGroupSortKey)=>{
    if(peerGroupSortKey===key) setPeerGroupSortDir(v=>v==="asc"?"desc":"asc");
    else {
      setPeerGroupSortKey(key);
      setPeerGroupSortDir(key==="name" || key==="grade" ? "asc" : "desc");
    }
  };

  const PeerGroupHeader=({sortKey,children,num=false}:{sortKey:PeerGroupSortKey;children:React.ReactNode;num?:boolean})=>
    <th className={num?"num":undefined} aria-sort={peerGroupSortKey===sortKey?(peerGroupSortDir==="asc"?"ascending":"descending"):"none"}>
      <button
        type="button"
        className={`hospital-sort-header${peerGroupSortKey===sortKey?" is-active":""}`}
        onClick={()=>sortPeerGroup(sortKey)}
      >
        <span>{children}</span>
        <span className="hospital-sort-icon">{peerGroupSortKey===sortKey?(peerGroupSortDir==="asc"?"↑":"↓"):"↕"}</span>
      </button>
    </th>;

  return <section className="hospital-peer-section">
    <div className="hospital-peer-heading hospital-peer-heading-actions">
      <div>
        <span>Benchmark placówek z modelu par</span>
        <div className="hospital-peer-title-with-info">
          <h3>Jak ten szpital wygląda na tle wybranych peerów?</h3>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            radius="xl"
            aria-label="Jak wybieramy placówki porównawcze"
            onClick={()=>setMethodologyOpen(true)}
          >
            <span className="info-icon">?</span>
          </ActionIcon>
        </div>
      </div>

      <button
        type="button"
        className="hospital-peer-disclosure-button hospital-peer-group-open-button"
        aria-haspopup="dialog"
        aria-expanded={peerGroupOpen}
        onClick={()=>setPeerGroupOpen(true)}
      >
        <span>Grupa porównawcza</span>
        <b>{benchmark.peers.length}</b>
      </button>
    </div>

    <div className="hospital-benchmark-kpis hospital-metric-grid">
      {rows.map(r=>{
        const diff=r.selected-r.median;
        const diffText=r.label==="Hospitalizacje" ? `${diff>0?"+":""}${nf.format(diff)}` : `${diff>0?"+":""}${pf.format(diff)} pp`;
        const diffClass=Math.abs(diff)<.05 ? "" : (r.inverse ? diff<0 : diff>0) ? " is-positive" : " is-negative";
        return <div className="hospital-benchmark-kpi" key={r.label}>
          <span>{r.label}</span>
          <strong>{r.fmt(r.selected)}</strong>
          <div><small>Mediana peerów</small><b>{r.fmt(r.median)}</b></div>
          <em className={diffClass}>{diffText}</em>
        </div>;
      })}
    </div>

    {peerGroupOpen ? <div className="hospital-methodology-backdrop" onMouseDown={()=>setPeerGroupOpen(false)}>
      <section
        className="hospital-peer-group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="peer-group-title"
        onMouseDown={e=>e.stopPropagation()}
      >
        <div className="hospital-methodology-head hospital-peer-group-modal-head">
          <div>
            <span>Grupa porównawcza</span>
            <h3 id="peer-group-title">Placówka główna i wybrane peery</h3>
            <small>
              {benchmark.peers.length} peerów · zakres {gradeScope==="A" ? "A" : "A + B"} · maks. dystans {pf.format(maxDistance)}
            </small>
          </div>
          <button type="button" onClick={()=>setPeerGroupOpen(false)} aria-label="Zamknij">×</button>
        </div>

        <div className="hospital-peer-group-table-wrap">
          <table className="hospital-peer-group-table">
            <thead>
              <tr>
                <th className="hospital-peer-group-provider-col">Placówka</th>
                <PeerGroupHeader sortKey="grade">Klasa</PeerGroupHeader>
                <PeerGroupHeader sortKey="distance" num>Dystans</PeerGroupHeader>
                <PeerGroupHeader sortKey="hospitalizations" num>Hospitalizacje</PeerGroupHeader>
                <PeerGroupHeader sortKey="beds" num>Łóżka główne</PeerGroupHeader>
                <PeerGroupHeader sortKey="coreTypes" num>Główne oddziały</PeerGroupHeader>
                <PeerGroupHeader sortKey="sharedJgp" num>Wspólne JGP</PeerGroupHeader>
                <PeerGroupHeader sortKey="jgpFamilySimilarity" num>Podobieństwo rodzin JGP</PeerGroupHeader>
              </tr>
            </thead>

            <tbody className="hospital-peer-group-main-body">
              <tr className="hospital-peer-group-main-row">
                <td>
                  <div className="hospital-peer-group-provider">
                    <b>{displayHospitalName(benchmark.selected.providerName)}</b>
                    <small>Placówka główna · punkt odniesienia</small>
                  </div>
                </td>
                <td><span className="hospital-peer-group-main-badge">GŁÓWNA</span></td>
                <td className="num">—</td>
                <td className="num">{nf.format(mainModelStats.hospitalizations)}</td>
                <td className="num">{nf.format(mainModelStats.beds)}</td>
                <td className="num">{nf.format(mainModelStats.coreTypes)}</td>
                <td className="num">{pf.format(mainModelStats.sharedJgpPct)}%</td>
                <td className="num">{pf.format(mainModelStats.jgpFamilySimilarityPct)}%</td>
              </tr>
            </tbody>

            <tbody>
              {sortedPeerGroupRows.map(p=><tr
                key={p.key}
                className={hoveredPeerKey===p.key ? "is-hovered" : undefined}
                onMouseEnter={()=>onHoverPeer(p.key)}
                onMouseLeave={()=>onHoverPeer(null)}
              >
                <td>
                  <div className="hospital-peer-group-provider">
                    <b>{p.name}</b>
                    <small>{[p.city,p.voivodeship].filter(Boolean).join(" · ")}</small>
                  </div>
                </td>
                <td><span className={`hospital-peer-grade hospital-peer-grade-${p.grade.toLowerCase()}`}>{p.grade}</span></td>
                <td className="num">{p.distance==null?"—":pf.format(p.distance)}</td>
                <td className="num">{nf.format(p.hospitalizations)}</td>
                <td className="num">{nf.format(p.beds)}</td>
                <td className="num">{nf.format(p.coreTypes)}</td>
                <td className="num">{pf.format(p.sharedJgpPct)}%</td>
                <td className="num">{pf.format(p.jgpFamilySimilarityPct)}%</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div> : null}

{methodologyOpen ? <div className="hospital-methodology-backdrop" onMouseDown={()=>setMethodologyOpen(false)}>
      <section className="hospital-methodology-modal hospital-pair-methodology-modal" role="dialog" aria-modal="true" aria-labelledby="pair-methodology-title" onMouseDown={e=>e.stopPropagation()}>
        <div className="hospital-methodology-head">
          <div><span>Metodologia</span><h3 id="pair-methodology-title">Jak wybieramy placówki porównawcze?</h3></div>
          <button type="button" onClick={()=>setMethodologyOpen(false)} aria-label="Zamknij">×</button>
        </div>

        <div className="hospital-pair-methodology-current">
          <span>Aktualny zakres</span><b>{gradeScope==="A" ? "Tylko A" : "A + B"}</b><small>Maksymalny dystans: {pf.format(maxDistance)}</small>
        </div>

        <p className="hospital-methodology-lead">Model porównuje analizowany szpital z innymi placówkami na podstawie ich skali i profilu działalności. Uwzględnia m.in. liczbę hospitalizacji, zakres i wolumen JGP, strukturę rodzin JGP, liczbę i strukturę łóżek na głównych oddziałach, dziedziny głównych oddziałów, leczenie dzienne, działalność ambulatoryjną oraz udział przyjęć nagłych.</p>

        <div className="hospital-methodology-note"><b>Jak powstaje wynik odległości?</b><p>Dla każdej cechy model wylicza <strong>różnicę między placówkami</strong>. Wartość 0 oznacza brak różnicy. Im większa wartość, tym większa rozbieżność. Różnice są skalowane i łączone w końcowy <strong>wynik odległości</strong>. Im niższy wynik, tym bardziej podobne są szpitale. Model jest monotoniczny: większa różnica w danej cesze nie może zwiększyć podobieństwa.</p></div>

        <div className="hospital-methodology-note"><b>Co oznaczają klasy A, B i N?</b>
          <div className="hospital-pair-methodology-grades">
            <div><strong>A</strong><span>najbardziej podobne</span></div>
            <div><strong>B</strong><span>podobne, ale z większymi różnicami</span></div>
            <div><strong>N</strong><span>niepodobne</span></div>
          </div>
          <p>Granice pomiędzy klasami A, B i N zostały wyuczone na ręcznie ocenionych parach szpitali. W aplikacji możesz korzystać tylko z par klasy <strong>A</strong> albo rozszerzyć grupę o klasę <strong>B</strong>. Pary klasy <strong>N</strong> nie są włączane do grupy peerów.</p>
        </div>

        <div className="hospital-methodology-note"><b>Jak działa filtr w tej zakładce?</b><p>Najpierw wybierasz zakres klas: <strong>A</strong> albo <strong>A + B</strong>. Następnie możesz ograniczyć grupę suwakiem <strong>maksymalnego dystansu</strong>. Do benchmarku trafiają tylko placówki spełniające oba warunki.</p></div>

        <div className="hospital-methodology-note"><b>Jak interpretować procenty?</b><p>Wskaźniki podobieństwa prezentowane przy poszczególnych cechach służą do łatwiejszej interpretacji. Nie są statystycznym prawdopodobieństwem. O klasie A, B lub N decyduje modelowy <strong>wynik odległości</strong> i wyuczone progi.</p></div>
      </section>
    </div> : null}

  </section>;
}

export function HospitalSimilarityTab({
  hospitalKey,
  method,
  products,
  gradeScope="A",
  maxDistance=10.01,
  peerThreshold=70,
}:{
  hospitalKey:string;
  method:EstimationMethod;
  products:ProductOption[];
  gradeScope?:"A"|"AB";
  maxDistance?:number;
  peerThreshold?:number;
}){
  const [benchmark,setBenchmark]=useState<HospitalPeerBenchmark|null>(null);
  const [peerPairs,setPeerPairs]=useState<PeerPair[]>([]);
  const [valuations,setValuations]=useState<JgpValuation[]>([]);
  const [hoveredPeerKey,setHoveredPeerKey]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!hospitalKey){
      setBenchmark(null);
      setLoading(false);
      return;
    }

    let cancelled=false;
    setLoading(true);

    void Promise.all([loadStaticDataset(),loadPeerPairs(),loadJgpValuations()])
      .then(([dataset,pairsPayload,jgpValuations])=>{
        if(cancelled) return;

        const selection=newPeerSelection(
          pairsPayload.rows,
          hospitalKey,
          gradeScope,
          maxDistance,
          method
        );

        setPeerPairs(pairsPayload.rows);
        setValuations(jgpValuations);
        setBenchmark(
          selection.size
            ? hospitalPeerBenchmarkFromDataset(dataset,hospitalKey,method,{},peerThreshold,selection)
            : null
        );
        setError(null);
      })
      .catch((e)=>{
        if(cancelled) return;
        setBenchmark(null);
        setError(e instanceof Error ? e.message : "Błąd nowej metody porównawczej.");
      })
      .finally(()=>{ if(!cancelled) setLoading(false); });

    return()=>{cancelled=true;};
  },[hospitalKey,method,gradeScope,maxDistance,peerThreshold]);

  const valuationByJgp=useMemo(()=>new Map(valuations.map(x=>[x.kod_jgp,x])),[valuations]);

  if(loading) return <div className="hospital-empty">Ładowanie analizy porównawczej…</div>;
  if(error) return <div className="alert">{error}</div>;
  if(!benchmark?.peers.length) return <div className="hospital-empty">Dla tej placówki nie znaleziono par spełniających aktualne kryteria.</div>;

  return <div className="hospital-comparison-subtab">
    <PairBenchmarkPanel
      benchmark={benchmark}
      hoveredPeerKey={hoveredPeerKey}
      onHoverPeer={setHoveredPeerKey}
      method={method}
      gradeScope={gradeScope}
      maxDistance={maxDistance}
      peerPairs={peerPairs}
      hospitalKey={hospitalKey}
    />
    <PeerComparisonCharts
      benchmark={benchmark}
      hoveredPeerKey={hoveredPeerKey}
      onHoverPeer={setHoveredPeerKey}
      products={products}
      valuationByJgp={valuationByJgp}
      pairMode
      peerPairs={peerPairs}
      hospitalKey={hospitalKey}
    />
    <JgpMortalityDifferenceTable
      benchmark={benchmark}
      products={products}
      valuationByJgp={valuationByJgp}
      pairMode
    />
  </div>;
}
