"use client";

import { ActionIcon } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { EstimationMethod, HospitalPeerBenchmark, ProductOption } from "@/lib/types";
import { hospitalPeerBenchmarkFromDataset, loadStaticDataset } from "@/lib/staticData";
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
} from "./HospitalComparisonShared";

type LegacyRpwdlMap = NonNullable<Parameters<typeof hospitalPeerBenchmarkFromDataset>[3]>;
type RpwdlPayload = { po_nip: LegacyRpwdlMap };
let rpwdlPromise:Promise<LegacyRpwdlMap>|null=null;

function loadRpwdlProfiles(){
  if(!rpwdlPromise){
    rpwdlPromise=fetch("/data/rpwdl_profile.json.gz",{cache:"force-cache"})
      .then(parseMaybeGzip)
      .then((x:RpwdlPayload)=>x.po_nip)
      .catch((e)=>{rpwdlPromise=null;throw e;});
  }
  return rpwdlPromise;
}

function PeerBenchmarkPanel({ benchmark, hoveredPeerKey, onHoverPeer }: { benchmark: HospitalPeerBenchmark; hoveredPeerKey: string | null; onHoverPeer: (key: string | null) => void }) {
  const [methodologyOpen,setMethodologyOpen]=useState(false);
  const rows = [
    { label:"Śmiertelność", selected:benchmark.selected.mortalityPct, median:benchmark.median.mortalityPct, fmt:pct, inverse:true },
    { label:"Hospitalizacje", selected:benchmark.selected.hospitalizations, median:benchmark.median.hospitalizations, fmt:(v:number)=>nf.format(v) },
    { label:"Przyjęcia nagłe", selected:benchmark.selected.urgentSharePct, median:benchmark.median.urgentSharePct, fmt:pct },
    { label:"Zabiegowe JGP *", selected:benchmark.selected.proceduralSharePct, median:benchmark.median.proceduralSharePct, fmt:pct },
    { label:"JGP > 10 hosp.", selected:benchmark.selected.uniqueJgpOver10, median:benchmark.median.uniqueJgpOver10, fmt:(v:number)=>nf.format(v) },
  ];
  return <section className="hospital-peer-section">
    <div className="hospital-peer-heading hospital-peer-heading-actions">
      <div>
        <span>Benchmark podobnych placówek</span>
        <div className="hospital-peer-title-with-info"><h3>Jak ten szpital wygląda na tle swoich peerów?</h3><ActionIcon variant="subtle" color="gray" size="xs" radius="xl" aria-label="Metodologia grupy porównawczej" onClick={()=>setMethodologyOpen(true)}><span className="info-icon">?</span></ActionIcon></div>
      </div>
      <div className="hospital-peer-disclosure">
        <button type="button" className="hospital-peer-disclosure-button" aria-label="Podejrzyj grupę porównawczą">
          <span>Grupa porównawcza</span>
        </button>
        <div className="hospital-peer-disclosure-popover" role="tooltip">
          <div className="hospital-peer-list-card">
            <div className="hospital-peer-list-title"><b>Grupa porównawcza</b><span>{benchmark.peers.length} peerów</span></div>

        {benchmark.peers.map((p,i)=><div className={`hospital-peer-item${hoveredPeerKey===p.key ? " is-hovered" : ""}`} key={p.key} tabIndex={0} onMouseEnter={()=>onHoverPeer(p.key)} onMouseLeave={()=>onHoverPeer(null)} onFocus={()=>onHoverPeer(p.key)} onBlur={()=>onHoverPeer(null)}>
          <span className="hospital-peer-rank">{i+1}</span>
          <div><b>{displayHospitalName(p.providerName)}</b><small>{p.city} · {p.voivodeship}</small></div>
          <strong>{pf.format(p.similarityPct)}%</strong>
          <div className="hospital-peer-tooltip" role="tooltip">
            <div className="hospital-peer-tooltip-head"><b>Profil podobieństwa</b><strong>{pf.format(p.similarityPct)}%</strong></div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Struktura szpitala</b><strong>{pf.format(p.similarityBreakdown.structuralPct)}%</strong></div>
              <div className="hospital-peer-tooltip-row"><span>Rodzaje oddziałów</span><b>{pf.format(p.similarityBreakdown.wardTypesPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Rozkład łóżek między oddziałami</span><b>{pf.format(p.similarityBreakdown.wardBedsPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Liczba komórek</span><b>{pf.format(p.similarityBreakdown.cellCountPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Typy poradni</span><b>{pf.format(p.similarityBreakdown.clinicTypesPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Liczba poradni</span><b>{pf.format(p.similarityBreakdown.clinicCountPct)}%</b></div>
            </div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Skala szpitala</b><strong>{pf.format(p.similarityBreakdown.scalePct)}%</strong></div>
              <div className="hospital-peer-tooltip-row"><span>Liczba łóżek na głównych oddziałach</span><b>{pf.format(p.similarityBreakdown.bedScalePct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Hospitalizacje</span><b>{pf.format(p.similarityBreakdown.hospitalScalePct)}%</b></div>
              <div className="hospital-peer-tooltip-grouphead"><b>Złożoność organizacyjna</b><strong>{pf.format(p.similarityBreakdown.complexityPct)}%</strong></div>
              <div className="hospital-peer-tooltip-row"><span>Liczba oddziałów</span><b>{pf.format(p.similarityBreakdown.wardCountScalePct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Liczba komórek</span><b>{pf.format(p.similarityBreakdown.cellCountScalePct)}%</b></div>
            </div>
            <div className="hospital-peer-tooltip-group">
              <div className="hospital-peer-tooltip-grouphead"><b>Profil działalności JGP</b><strong>{pf.format(p.similarityBreakdown.clinicalPct)}%</strong></div>
              <div className="hospital-peer-tooltip-row"><span>Wspólne JGP &gt;10</span><b>{p.similarityBreakdown.sharedJgp} / {p.similarityBreakdown.targetJgp}</b></div>
              <div className="hospital-peer-tooltip-row"><span>Zestaw JGP</span><b>{pf.format(p.similarityBreakdown.jgpSetPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Ranking JGP</span><b>{pf.format(p.similarityBreakdown.jgpRankPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Proporcje JGP</span><b>{pf.format(p.similarityBreakdown.jgpProportionPct)}%</b></div>
              <div className="hospital-peer-tooltip-row"><span>Tryb nagły</span><b>{pf.format(p.similarityBreakdown.urgentModePct)}%</b></div>
            </div>
            <small>Najpierw filtr strukturalny; dopiero wśród porównywalnych organizacyjnie placówek profil leczenia ustala kolejność.</small>
          </div>
        </div>)}
      
          </div>
        </div>
      </div>
    </div>
    <div className="hospital-benchmark-kpis hospital-metric-grid">
      {rows.filter(r=>r.label!=="JGP > 10 hosp.").map(r => {
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


    {methodologyOpen ? <div className="hospital-methodology-backdrop" onMouseDown={()=>setMethodologyOpen(false)}>
      <section className="hospital-methodology-modal" role="dialog" aria-modal="true" aria-labelledby="peer-methodology-title" onMouseDown={e=>e.stopPropagation()}>
        <div className="hospital-methodology-head">
          <div><span>Metodologia</span><h3 id="peer-methodology-title">Jak wyznaczamy grupę porównawczą?</h3></div>
          <button type="button" onClick={()=>setMethodologyOpen(false)} aria-label="Zamknij">×</button>
        </div>
        <p className="hospital-methodology-lead">Każdy szpital otrzymuje jeden wynik podobieństwa do wybranej placówki. Wynik łączy cztery obszary opisujące profil leczenia, strukturę, skalę i złożoność organizacyjną.</p>

        <div className="hospital-methodology-grid">
          <article><div><b>35%</b><strong>Profil działalności JGP</strong></div><p>Porównujemy rzeczywiste wolumeny kodów JGP z ponad 10 hospitalizacjami. Wolumeny są transformowane przez √hospitalizacji, dzięki czemu największe grupy nie dominują całego wyniku.</p></article>
          <article><div><b>30%</b><strong>Struktura szpitala</strong></div><p><strong>60%</strong> tego obszaru stanowi podobieństwo rodzajów oddziałów, a <strong>40%</strong> podobieństwo <em>rozkładu łóżek między oddziałami</em>. Ta część opisuje strukturę, a nie bezwzględną wielkość szpitala.</p></article>
          <article><div><b>25%</b><strong>Skala szpitala</strong></div><p><strong>60%</strong> tego obszaru stanowi bezwzględna <em>liczba łóżek na głównych oddziałach</em>, a <strong>40%</strong> liczba hospitalizacji. Tutaj porównujemy wielkość działalności placówek.</p></article>
          <article><div><b>10%</b><strong>Złożoność organizacyjna</strong></div><p><strong>50%</strong> stanowi liczba oddziałów i <strong>50%</strong> liczba komórek organizacyjnych.</p></article>
        </div>

        <div className="hospital-methodology-note"><b>Jak powstaje grupa porównawcza?</b><p>Dla każdego szpitala obliczamy łączny wynik podobieństwa do wybranej placówki. Do grupy porównawczej trafiają wszystkie szpitale, których wynik jest równy lub wyższy od progu ustawionego suwakiem w sidebarze. Analiza rozpoczyna się od progu <strong>70%</strong>. Podniesienie progu zawęża grupę do bardziej podobnych placówek; obniżenie go zwiększa liczbę peerów. Obecnie nie stosujemy automatycznego wykrywania „naturalnej luki” w rankingu podobieństwa.</p></div>
        <div className="hospital-methodology-note"><b>Co oznaczają łóżka na głównych oddziałach?</b><p><strong>Główne oddziały</strong> obejmują podstawowe oddziały szpitalne wykorzystywane do porównania skali placówek. Z profilu łóżkowego wyłączamy jednostki o innym charakterze, m.in. sanatoria i uzdrowiska, ZOL/ZPO, hospicja stacjonarne, rehabilitację dzienną, izbę przyjęć, blok operacyjny oraz wybrane jednostki psychiatryczne i leczenia uzależnień. Część jednostek pomocniczych i specjalistycznych klasyfikujemy jako <strong>oddziały wspierające</strong>: w porównaniu struktury łóżek otrzymują wagę 0,5, podczas gdy główne oddziały mają wagę 1,0, a jednostki wyłączone 0. W „Skali szpitala” liczba łóżek na głównych oddziałach oznacza natomiast bezwzględną sumę wyłącznie łóżek na głównych oddziałach.</p></div>
        <div className="hospital-methodology-note"><b>Dlaczego łóżka występują w dwóch miejscach?</b><p>W „Strukturze szpitala” analizujemy <strong>rozkład łóżek między rodzajami oddziałów</strong> — czyli podobieństwo profilu łóżkowego, z wagą 1,0 dla głównych oddziałów i 0,5 dla oddziałów wspierających. W „Skali szpitala” analizujemy <strong>łączną liczbę łóżek na głównych oddziałach</strong>. Pierwsza miara opisuje strukturę działalności, druga bezwzględną wielkość placówki.</p></div>
        <div className="hospital-methodology-note"><b>Czym są komórki organizacyjne?</b><p>Komórki to szczegółowe elementy struktury placówki wykazane w RPWDL. Mogą nimi być np. <strong>oddział chirurgii ogólnej, poradnia kardiologiczna, pracownia diagnostyczna, blok operacyjny lub izba przyjęć</strong>. Liczba komórek pomaga opisać, jak rozbudowana organizacyjnie jest placówka. Dlatego dwa szpitale o podobnej liczbie łóżek i hospitalizacji mogą różnić się złożonością organizacyjną.</p></div>
      </section>
    </div> : null}
        
  </section>;
}

export function HospitalComparisonLegacyTab({
  hospitalKey,
  method,
  products,
  peerThreshold,
}:{
  hospitalKey:string;
  method:EstimationMethod;
  products:ProductOption[];
  peerThreshold:number;
}){
  const [benchmark,setBenchmark]=useState<HospitalPeerBenchmark|null>(null);
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

    void Promise.all([loadStaticDataset(),loadRpwdlProfiles(),loadJgpValuations()])
      .then(([dataset,rpwdl,jgpValuations])=>{
        if(cancelled) return;
        setValuations(jgpValuations);
        setBenchmark(hospitalPeerBenchmarkFromDataset(dataset,hospitalKey,method,rpwdl,peerThreshold));
        setError(null);
      })
      .catch((e)=>{
        if(cancelled) return;
        setBenchmark(null);
        setError(e instanceof Error ? e.message : "Błąd starej metody porównawczej.");
      })
      .finally(()=>{ if(!cancelled) setLoading(false); });

    return()=>{cancelled=true;};
  },[hospitalKey,method,peerThreshold]);

  const valuationByJgp=useMemo(()=>new Map(valuations.map(x=>[x.kod_jgp,x])),[valuations]);

  if(loading) return <div className="hospital-empty">Ładowanie analizy porównawczej…</div>;
  if(error) return <div className="alert">{error}</div>;
  if(!benchmark?.peers.length) return <div className="hospital-empty">Brak placówek spełniających aktualny próg podobieństwa.</div>;

  return <div className="hospital-comparison-subtab">
    <PeerBenchmarkPanel
      benchmark={benchmark}
      hoveredPeerKey={hoveredPeerKey}
      onHoverPeer={setHoveredPeerKey}
    />
    <PeerComparisonCharts
      benchmark={benchmark}
      hoveredPeerKey={hoveredPeerKey}
      onHoverPeer={setHoveredPeerKey}
      products={products}
      valuationByJgp={valuationByJgp}
    />
    <JgpMortalityDifferenceTable
      benchmark={benchmark}
      products={products}
      valuationByJgp={valuationByJgp}
    />
  </div>;
}
