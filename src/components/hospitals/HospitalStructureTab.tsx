"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ChartTooltip, TooltipHead } from "@/components/ChartTooltip";
import { HelpLines, InfoTip, INFO_TIP_PHONE_QUERY } from "@/components/InfoTip";
import { CHART_COLORS } from "@/lib/chartPalette";
import { formatPln } from "@/lib/formatters";
import { wardPaymentStatus, type HospitalPageData, type WardPaymentStatus } from "@/lib/hospitalPage";
import {
  CONTRACT_BADGES, GROUP_ORDER, acuteSummary, PLAN, STRUCTURE_GROUPS, STRUCTURE_PARTS, clinicEntries, fieldsShown, groupOf, highlightParts, inset,
  isKidsWard, isLightColor, layoutBuildings, matchesSearch, placeName, planName, roomLabel, searchWords, shortPlaceName, squarifyRatio,
  wardEntries, type ContractPay, type HospitalStructure, type StructureBed, type StructureGroup, type StructurePart,
} from "@/lib/hospitalStructure";
import type { Box } from "@/lib/tooltipPosition";
import { plural } from "@/lib/jgpDescription";
import { useMediaQuery } from "@/lib/useMediaQuery";
import base from "@/components/jgp/JgpPage.module.css";
import tabs from "@/components/jgp/JgpTabs.module.css";
import card from "./HospitalCard.module.css";
import styles from "./HospitalStructure.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const percent = (value: number, total: number, digits = 0) => `${((value / (total || 1)) * 100).toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const HATCH = `repeating-linear-gradient(45deg, ${CHART_COLORS.backgroundMuted} 0 3px, ${CHART_COLORS.borderStrong} 3px 5px)`;
const swatch = (group: StructureGroup) => STRUCTURE_GROUPS[group].color === "hatch" ? HATCH : STRUCTURE_GROUPS[group].color;
const PART_SWATCH: Record<StructurePart, string> = {
  acute: `linear-gradient(90deg, ${CHART_COLORS.dataStrong}, ${CHART_COLORS.data} 40%, ${CHART_COLORS.dataSoft})`,
  psych: STRUCTURE_GROUPS.psych.color, rehab: STRUCTURE_GROUPS.rehab.color, care: STRUCTURE_GROUPS.care.color,
};
/** Zasoby bez łóżek z „Zaplecza” (miejsca z łóżkami są na rzucie). */
const NO_BED_RESOURCES = new Set(["Sala porodowa", "Dializy", "Leczenie jednego dnia", "Zespoły ratownictwa (ZRM)", "POZ", "Nocna i świąteczna opieka"]);
const LOCATION_KINDS: Record<string, string> = {
  hospital: "szpital", sor: "SOR", outpatient: "poradnie", psychiatry: "psychiatria", rehab: "rehabilitacja",
  long_term: "ZOL / ZPO", hospice: "hospicjum", dialysis: "dializy", spa: "uzdrowisko",
};

/** Dymek danych: szeroki ekran — `ChartTooltip` przy obiekcie; telefon — arkusz od dołu (DESIGN.md 6.3). */
interface Tip { anchor: Box; title: string; body: ReactNode }
function useDataTip() {
  const phone = useMediaQuery(INFO_TIP_PHONE_QUERY) === true;
  const [tip, setTip] = useState<Tip | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const open = (element: Element, title: string, body: ReactNode) => { const r = element.getBoundingClientRect(); setTip({ anchor: { left: r.left, top: r.top, width: r.width, height: r.height }, title, body }); };
  // Szeroki ekran: najechanie; telefon: `click` (arkusz otwarty przy dotknięciu traci `click` na rzecz swojego tła).
  const handlers = (title: string, body: () => ReactNode) => phone
    ? { onClick: (event: { currentTarget: Element }) => open(event.currentTarget, title, body()) }
    : { onMouseEnter: (event: { currentTarget: Element }) => open(event.currentTarget, title, body()), onMouseLeave: () => setTip(null) };
  return { phone, container, handlers, tip, close: () => setTip(null) };
}

function DataTip({ tip, phone, container, onClose }: { tip: Tip | null; phone: boolean; container: RefObject<HTMLDivElement | null>; onClose: () => void }) {
  if (!tip) return null;
  return phone
    ? <BottomSheet title={tip.title} onClose={onClose}>{tip.body}</BottomSheet>
    : <ChartTooltip anchor={tip.anchor} container={container} kind="area"><TooltipHead title={tip.title} /><div className={styles.tipBody}>{tip.body}</div></ChartTooltip>;
}

/** Zakładka „Struktura”: części szpitala, rzut budynków, oddziały i poradnie z wyszukiwarką. */
export function HospitalStructureTab({ data, yearIndex }: { data: HospitalPageData; yearIndex: number }) {
  const structure = data.structure;
  if (!structure) return <section className={tabs.sec} aria-labelledby="s-struktura">
    <div className={tabs.secHead}><h2 id="s-struktura" className={tabs.secTitle}><span className={tabs.q}>Z czego składa się szpital?</span></h2></div>
    <p className={styles.empty} role="status">
      <b>Brak danych o oddziałach i łóżkach.</b> Rejestr RPWDL nie ma profilu tego świadczeniodawcy (stan {data.rpwdlYear ? `z ${data.rpwdlYear} r.` : "bieżący"}), np. gdy już nie działa.
    </p>
  </section>;
  return <>
    <PartsSection data={data} structure={structure} />
    <PlanSection data={data} structure={structure} />
    <ListsSection data={data} structure={structure} yearIndex={yearIndex} />
  </>;
}

function Head({ id, title, context, help, helpLabel, tools }: { id: string; title: string; context?: string; help: (string | [string, string])[]; helpLabel: string; tools?: ReactNode }) {
  return <div className={`${tabs.secHead} ${styles.head}`}>
    <h2 id={id} className={tabs.secTitle}>
      <span className={tabs.q}>{title}</span>{context ? <> <span className={`${tabs.ctx} ${styles.context}`}>{context}</span></> : null}{" "}
      <InfoTip ariaLabel={helpLabel} label={<HelpLines lines={help} />} />
    </h2>
    {tools}
  </div>;
}

// ── Z czego składa się szpital? ──────────────────────────────────────────────────────────────────────────────────

function PartsSection({ data, structure }: { data: HospitalPageData; structure: HospitalStructure }) {
  const { container, handlers, tip, phone, close } = useDataTip();
  const total = structure.beds.reduce((sum, row) => sum + row[5], 0);
  const manyBuildings = new Set(structure.beds.map((row) => row[0])).size > 1;
  const parts = STRUCTURE_PARTS.map(({ key, label }) => {
    const rows = structure.beds.filter((row) => STRUCTURE_GROUPS[groupOf(row[3], row[2])].part === key);
    return { key, label, rows, beds: rows.reduce((sum, row) => sum + row[5], 0) };
  }).filter((part) => part.beds > 0);
  const groupBeds = (rows: StructureBed[], group: StructureGroup) => rows.filter((row) => groupOf(row[3], row[2]) === group).reduce((sum, row) => sum + row[5], 0);
  const noBeds = (data.resources?.capabilities ?? []).filter(([label]) => NO_BED_RESOURCES.has(label));
  const reg = structure.registry, out = structure.outpatient;
  return <section className={tabs.sec} aria-labelledby="s-czesci">
    <Head id="s-czesci" title="Z czego składa się szpital?" helpLabel="Jak czytać strukturę" help={[
      [`${integer(total)} łóżek`, `— wszystkie łóżka szpitala w rejestrze RPWDL${reg ? `, pod ${reg.locations} ${plural(reg.locations, "adresem", "adresami", "adresami")} w ${reg.cities} ${plural(reg.cities, "mieście", "miastach", "miastach")}` : ""}.`],
      ["Pasek", "dzieli łóżka na części szpitala. W leczeniu szpitalnym odcienie to rodzaje oddziałów — te same co na rzucie."],
      ["SOR, izba przyjęć i blok", "mają łóżka, ale nie są oddziałami. Liczymy je w leczeniu szpitalnym (kreskowanie)."],
      ["Poradnie", "nie mają łóżek, więc są tylko w osobnym boksie, nie w pasku."],
      ["Poza oddziałami", "— miejsca bez łóżek z rejestru RPWDL: gabinety lekarza rodzinnego (POZ), punkty nocnej i świątecznej opieki, dializy, sala porodowa, zespoły ratownictwa."],
    ]} />
    <div ref={container} className={styles.relative}>
      <div className={styles.bar} role="img" aria-label={`Łóżka według części szpitala: ${parts.map((part) => `${part.label} ${integer(part.beds)}`).join(", ")}`}>
        {parts.map((part) => <span key={part.key} className={styles.barPart} style={{ flex: part.beds }}>
          {GROUP_ORDER.filter((group) => STRUCTURE_GROUPS[group].part === part.key).map((group) => {
            const beds = groupBeds(part.rows, group);
            return beds ? <i key={group} style={{ flex: beds, background: swatch(group) }} {...handlers(STRUCTURE_GROUPS[group].label, () => <>
              <span className={styles.muted}>{part.label}</span><br />{integer(beds)} łóżek · {percent(beds, total, 1)} wszystkich łóżek
              {beds !== part.beds ? <><br /><span className={styles.muted}>Cała część: {integer(part.beds)} łóżek ({percent(part.beds, total, 1)})</span></> : null}
            </>)} /> : null;
          })}
        </span>)}
      </div>
      <DataTip tip={tip} phone={phone} container={container} onClose={close} />
    </div>
    <dl className={styles.boxes}>
      {parts.map((part) => {
        const wards = part.rows.filter((row) => groupOf(row[3], row[2]) !== "support");
        // Leczenie szpitalne: te same liczby co nagłówek karty (`acuteSummary`).
        const codes = part.key === "acute" ? acuteSummary(structure).wards : new Set(wards.map((row) => row[3])).size;
        const names = [...new Set(wards.map((row) => planName(structure, row)))];
        const support = Object.entries(part.rows.filter((row) => groupOf(row[3], row[2]) === "support").reduce<Record<string, number>>((acc, row) => {
          const name = planName(structure, row); acc[name] = (acc[name] ?? 0) + row[5]; return acc;
        }, {}));
        const addresses = [...new Set(part.rows.map((row) => structure.addresses[row[0]][0]))];
        return <div key={part.key} className={styles.box}>
          <dt><i style={{ background: PART_SWATCH[part.key] }} aria-hidden />{part.label}</dt>
          <dd className={styles.val}><b>{integer(part.beds)}</b> łóżek · {percent(part.beds, total)}</dd>
          <dd className={styles.what}>{part.key !== "acute" && names.length <= 2 ? names.join(", ") : `${codes} ${plural(codes, "oddział", "oddziały", "oddziałów")}`}</dd>
          {support.length ? <dd className={styles.sub}>w tym {support.map(([name, beds]) => `${name} ${beds}`).join(", ")} (nie oddziały)</dd> : null}
          {manyBuildings ? <dd className={styles.sub}>{addresses.join(" · ")}</dd> : null}
        </div>;
      })}
      {out ? <div className={`${styles.box} ${styles.aos}`}>
        <dt><i className={styles.ring} aria-hidden />Poradnie (AOS)</dt>
        <dd className={styles.val}><b>{integer(out.cells)}</b> {plural(out.cells, "poradnia", "poradnie", "poradni")}</dd>
        <dd className={styles.what}>{integer(out.fields)} {plural(out.fields, "dziedzina", "dziedziny", "dziedzin")} · w {integer(out.locations)} {plural(out.locations, "lokalizacji", "lokalizacjach", "lokalizacjach")}</dd>
      </div> : null}
    </dl>
    {noBeds.length ? <p className={styles.extras}><span>Poza oddziałami:</span> {noBeds.map(([label, detail]) => <span key={label} className={styles.chip}><b>{label}</b>{detail ? ` · ${detail}` : ""}</span>)}</p> : null}
  </section>;
}

// ── Rzut szpitala ────────────────────────────────────────────────────────────────────────────────────────────────

/** Pomiar podpisów (canvas, 11 px Inter): podpis tylko, gdy cała nazwa się mieści. */
function useMeasure() {
  const canvas = useRef<CanvasRenderingContext2D | null>(null);
  return (text: string, bold: boolean) => {
    canvas.current ??= typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (!canvas.current) return text.length * 6.4;
    canvas.current.font = `${bold ? 600 : 400} 11px Inter, sans-serif`;
    return canvas.current.measureText(text).width;
  };
}

/** Szerokość kontenera (rzut liczony w prawdziwych pikselach); 0 przed pomiarem. */
function useWidth() {
  const [node, ref] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  // Po załadowaniu fontów podpisy mierzymy jeszcze raz (szerokość tekstu zależy od kroju).
  const [, setFonts] = useState(0);
  useEffect(() => {
    const element = node;
    if (!element) return;
    document.fonts?.ready.then(() => setFonts((value) => value + 1));
    // ResizeObserver mierzy też od razu po `observe`; bez niego (testy) — jeden pomiar w następnej klatce.
    if (typeof ResizeObserver === "undefined") {
      const frame = requestAnimationFrame(() => setWidth(element.clientWidth));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [node]);
  return { ref, width };
}

function PlanSection({ data, structure }: { data: HospitalPageData; structure: HospitalStructure }) {
  const [mode, setMode] = useState<"group" | "kids">("group");
  const { container, handlers, tip, phone, close } = useDataTip();
  const measure = useMeasure();
  const { ref, width } = useWidth();
  const buildings = useMemo(() => {
    const byAddr = new Map<number, StructureBed[]>();
    structure.beds.forEach((row) => byAddr.set(row[0], [...(byAddr.get(row[0]) ?? []), row]));
    return [...byAddr].map(([addr, rows]) => ({ addr, rows, beds: rows.reduce((sum, row) => sum + row[5], 0) }));
  }, [structure]);
  const lines = width ? layoutBuildings(buildings, width) : [];
  const colorOf = (row: StructureBed) => {
    if (mode === "kids") return isKidsWard(row[3]) ? CHART_COLORS.data : CHART_COLORS.dataFaint;
    const color = STRUCTURE_GROUPS[groupOf(row[3], row[2])].color;
    return color === "hatch" ? "url(#hatch)" : color;
  };
  const present = GROUP_ORDER.filter((group) => structure.beds.some((row) => groupOf(row[3], row[2]) === group));
  const nameOf = (site: string) => phone ? shortPlaceName(site, data.name) : site;
  const roomTip = (row: StructureBed) => {
    const group = STRUCTURE_GROUPS[groupOf(row[3], row[2])];
    const [street, city] = structure.addresses[row[0]];
    return <>
      {structure.names[row[3]] && structure.names[row[3]] !== row[4] ? <><span className={styles.muted}>{structure.names[row[3]]}</span><br /></> : null}
      {integer(row[5])} łóżek{row[6] ? ` (w tym ${row[6]} intensywnej terapii)` : ""}<br />
      {structure.sites[row[1]] ? `${structure.sites[row[1]]}, ` : ""}{street}, {city}<br />
      <span className={styles.muted}>{STRUCTURE_PARTS.find((part) => part.key === group.part)!.label} · {group.label.split(" (")[0]}{isKidsWard(row[3]) ? " · dla dzieci" : ""}</span>
    </>;
  };
  return <section className={tabs.sec} aria-labelledby="s-rzut">
    <Head id="s-rzut" title="Rzut szpitala" context="· budynki i oddziały według łóżek" helpLabel="Jak czytać rzut" help={[
      ["Ramka", "to budynek pod jednym adresem. Prostokąt w ramce to oddział albo inne miejsce z łóżkami: SOR, izba przyjęć, ZOL, hospicjum."],
      ["Wielkość prostokąta", "odpowiada liczbie łóżek. Skala jest wspólna dla wszystkich budynków i szpitali, więc widać też, który budynek jest większy."],
      ["Kolor", "pokazuje rodzaj oddziału; oddziały jednego rodzaju stoją obok siebie. Oddział z pododdziałem (np. udarowym) ma dwa prostokąty."],
      ["Brak podpisu", "— oddział jest za mały na nazwę. Dotknij go albo najedź kursorem."],
    ]} tools={<div className={base.segmented} role="group" aria-label="Kolor rzutu">
      <button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")}>Rodzaj<span className={styles.long}> oddziału</span></button>
      <button type="button" aria-pressed={mode === "kids"} onClick={() => setMode("kids")}>Dzieci<span className={styles.long}> / dorośli</span></button>
    </div>} />
    <ul className={styles.legend} aria-label="Legenda rzutu">
      {mode === "kids" ? <>
        <li><i style={{ background: CHART_COLORS.data }} />Oddziały dla dzieci</li><li><i style={{ background: CHART_COLORS.dataFaint }} />Dorośli</li>
      </> : STRUCTURE_PARTS.map(({ key, label }) => {
        const groups = present.filter((group) => STRUCTURE_GROUPS[group].part === key);
        if (!groups.length) return null;
        return key === "acute"
          ? [<li key="h" className={styles.legendHead}>{label}:</li>, ...groups.map((group) => <li key={group}><i style={{ background: swatch(group) }} />{STRUCTURE_GROUPS[group].short}</li>)]
          : <li key={key}><i style={{ background: swatch(groups[0]) }} />{groups.map((group) => STRUCTURE_GROUPS[group].short).join(", ")}</li>;
      })}
    </ul>
    <div ref={container} className={styles.relative}><div ref={ref} className={styles.site}>
      {lines.map((line, l) => <div key={l} className={styles.row}>
        {line.map(({ building, width: w, height: h }) => {
          const inner = { w: w - 2 * PLAN.pad - 2, h: h - 2 * PLAN.pad };
          const wings = GROUP_ORDER.map((group) => ({ group, rows: building.rows.filter((row) => groupOf(row[3], row[2]) === group).sort((a, b) => b[5] - a[5]) })).filter((wing) => wing.rows.length);
          const wingRects = squarifyRatio(wings.map((wing) => ({ ...wing, value: wing.rows.reduce((sum, row) => sum + row[5], 0) })), 0, 0, inner.w, inner.h, PLAN.wingRatio);
          const [street, city] = structure.addresses[building.addr];
          const siteBeds = new Map<string, number>();
          building.rows.forEach((row) => { const site = structure.sites[row[1]]; if (site) siteBeds.set(site, (siteBeds.get(site) ?? 0) + row[5]); });
          const full = placeName([...siteBeds].sort((a, b) => b[1] - a[1]).map(([site]) => site), city);
          return <div key={building.addr} className={styles.building} style={{ width: w }}>
            <h3>
              <span className={styles.place} title={phone && full !== nameOf(full) ? full : undefined}>{nameOf(full) || street}</span>
              {/* Telefon (DESIGN.md 7.1b): łóżka w drugiej linii z ulicą; miasto w `title`. */}
              {/* Wąski budynek: tylko łóżka (adres w `title`), żeby nagłówek miał najwyżej 2 linie. */}
              {phone ? <small title={`${street}, ${city}`}>{integer(building.beds)} łóżek{w >= 200 ? ` · ${street}` : ""}</small> : <> <span className={styles.beds}>· {integer(building.beds)} łóżek</span><small>{street}, {city}</small></>}
            </h3>
            <svg width={inner.w + 2 * PLAN.pad} height={h} viewBox={`0 0 ${inner.w + 2 * PLAN.pad} ${h}`} role="img" aria-label={`Rzut budynku ${street}, ${city}: ${integer(building.beds)} łóżek`}>
              <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill={CHART_COLORS.backgroundMuted} /><line x1="0" y1="0" x2="0" y2="7" stroke={CHART_COLORS.borderStrong} strokeWidth="2.5" /></pattern></defs>
              {wingRects.flatMap((wing0) => {
                const wing = inset({ ...wing0, x: wing0.x + PLAN.pad, y: wing0.y + PLAN.pad }, PLAN.wingGap);
                return squarifyRatio(wing0.rows.map((row) => ({ row, value: row[5] })), wing.x, wing.y, wing.w, wing.h, PLAN.roomRatio).map((room0, r) => {
                  const room = inset(room0, PLAN.roomGap);
                  const row = room.row;
                  const color = colorOf(row);
                  const name = planName(structure, row);
                  const label = roomLabel(room, name, row[5], measure);
                  const dark = color.startsWith("url") || isLightColor(color);
                  return <g key={`${wing0.group}-${r}`} className={styles.room} {...handlers(row[4], () => roomTip(row))}>
                    <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={2.5} fill={color} />
                    {label === "two" ? <text x={room.x + 6} y={room.y + 15} className={dark ? styles.labelDark : styles.label}>{name}<tspan x={room.x + 6} dy={14} className={styles.labelBeds}>{row[5]} łóżek</tspan></text>
                      : label === "one" ? <text x={room.x + 6} y={room.y + room.h / 2 + 4} className={dark ? styles.labelDark : styles.label}>{name}<tspan className={styles.labelBeds}> {row[5]}</tspan></text> : null}
                  </g>;
                });
              })}
            </svg>
          </div>;
        })}
      </div>)}
    </div><DataTip tip={tip} phone={phone} container={container} onClose={close} /></div>
    {structure.points.length ? <>
      <h3 className={styles.pointsTitle}>Lokalizacje bez łóżek</h3>
      <ul className={styles.points}>
        {structure.points.map(([address, kinds, sites]) => {
          const city = address.split(", ").pop() ?? "";
          const name = placeName(sites.map((site) => structure.sites[site]), city);
          const stem = name.toLowerCase().slice(0, 6);
          const what = kinds.filter((kind) => !name || !kind.toLowerCase().includes(stem)).map((kind) => kind.startsWith("other:") ? kind.slice(6) : LOCATION_KINDS[kind] ?? kind).join(", ");
          return <li key={address}><b title={phone ? name : undefined}>{nameOf(name) || address}</b>{name ? <> · <span title={phone ? address : undefined}>{phone ? city : address}</span></> : null}{what ? ` · ${what}` : ""}</li>;
        })}
      </ul>
    </> : null}
  </section>;
}

// ── Oddziały i poradnie ──────────────────────────────────────────────────────────────────────────────────────────

const PAYMENT_BADGES: Record<WardPaymentStatus, { label: string; tone: "lump" | "mixed" | "out" }> = {
  ryczalt: { label: "ryczałt sieci", tone: "lump" }, czesciowo: { label: "ryczałt + za pobyty", tone: "mixed" }, poza: { label: "za każdy pobyt", tone: "out" },
};
const TONE_CLASS: Record<string, string> = { lump: card.payLump, mixed: card.payMixed, out: card.payOut, other: card.payOther, none: card.payNone };
const TONE_ORDER = ["lump", "mixed", "out", "other", "none"];

/** Opis plakietki z umów: rodzaj umowy (umowa sieci albo osobna) i kwota. */
function contractDetail(pay: ContractPay, year: string) {
  if (pay[0] === "none") return `Umowy z NFZ na ${year} r. nie wymieniają tego oddziału ani poradni. Może być finansowany w ramach innego świadczenia (np. opieki kompleksowej) albo nie mieć umowy z NFZ.`;
  return pay[1].map(([type, psz, amount]) => `${type} (${psz ? "umowa sieci szpitali" : "osobna umowa"}): ${amount ? formatPln(amount) : "bez kwoty"}`).join("; ") + ` — ${year} r.`;
}

function Highlight({ text, words }: { text: string; words: string[] }) {
  return <>{highlightParts(text, words).map(([part, hit], i) => hit ? <mark key={i} className={styles.mark}>{part}</mark> : <span key={i}>{part}</span>)}</>;
}

function Fields({ fields, words }: { fields: string[]; words: string[] }) {
  const { shown, rest } = fieldsShown(fields, words);
  return <>{shown.map((field, i) => <span key={field}>{i ? ", " : ""}<Highlight text={field} words={words} /></span>)}{rest.length ? <> <span className={styles.rest} title={rest.join(", ")}>i {rest.length} {plural(rest.length, "inna", "inne", "innych")}</span></> : null}</>;
}

function ListsSection({ data, structure, yearIndex }: { data: HospitalPageData; structure: HospitalStructure; yearIndex: number }) {
  const phone = useMediaQuery(INFO_TIP_PHONE_QUERY) === true;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({ wards: false, clinics: false });
  const [sheet, setSheet] = useState<{ title: string; body: string } | null>(null);
  const words = useMemo(() => searchWords(query), [query]);
  const year = data.years[yearIndex];
  const wards = useMemo(() => wardEntries(structure), [structure]);
  const clinics = useMemo(() => clinicEntries(structure), [structure]);
  const total = structure.beds.reduce((sum, row) => sum + row[5], 0);
  const manyBuildings = new Set(structure.beds.map((row) => row[0])).size > 1;
  const manyClinicAddresses = new Set(structure.clinics.map((row) => row[0])).size > 1;
  const searching = words.length > 0;
  const wardHits = wards.filter((entry) => matchesSearch([entry.name, ...entry.fields], words));
  const clinicHits = clinics.filter((entry) => matchesSearch([entry.name, ...entry.fields], words));
  const clinicCount = clinicHits.reduce((sum, entry) => sum + entry.count, 0);
  const wardCount = wards.filter((entry) => !entry.support).length;

  // Plakietka: oddział z pobytami JGP — udział hospitalizacji w ryczałcie; inne — pozycje umów NFZ.
  const badge = (code: string, support: boolean): { label: string; tone: string; detail: string; share?: string } | null => {
    const jgp = support ? null : wardPaymentStatus(code, data.wardPayment, yearIndex);
    if (jgp) {
      const paid = Math.round(jgp.paidPct);
      const share = `${100 - paid}% w ryczałcie · ${paid}% za pobyty`;
      return { ...PAYMENT_BADGES[jgp.status], detail: `${integer(jgp.total)} hospitalizacji oddziału w ${year} r.: ${share}`, share: jgp.status === "czesciowo" ? share : undefined };
    }
    const pay = structure.pay[code]?.[yearIndex];
    return pay ? { ...CONTRACT_BADGES[pay[0]], detail: contractDetail(pay, year) } : null;
  };
  const Badge = ({ code, support }: { code: string; support: boolean }) => {
    const shown = badge(code, support);
    if (!shown) return null;
    const className = `${card.pay} ${TONE_CLASS[shown.tone]}`;
    return <span className={styles.payWrap}>
      {phone ? <button type="button" className={className} onClick={() => setSheet({ title: shown.label, body: shown.detail })}>{shown.label}</button>
        : <span className={className} title={shown.detail}>{shown.label}</span>}
      {shown.share ? <small className={card.payShare}>{shown.share}</small> : null}
    </span>;
  };
  const used = new Map<string, string>();
  for (const entry of wards) { const shown = badge(entry.code, entry.support); if (shown) used.set(shown.label, shown.tone); }
  const legend = [...used].sort((a, b) => TONE_ORDER.indexOf(a[1]) - TONE_ORDER.indexOf(b[1]));
  const where = (addresses: [string, number][]) => addresses.length > 1 ? addresses.map(([address, n]) => `${address} (${n})`).join(" · ") : addresses[0]?.[0];

  return <section className={tabs.sec} aria-labelledby="s-listy">
    <Head id="s-listy" title="Oddziały i poradnie" helpLabel="Jak czytać listy" help={[
      ["Oddziały", "są pogrupowane w części szpitala, jak na rzucie. Oddział z pododdziałami albo kilkoma klinikami tego samego rodzaju to jeden wiersz."],
      ["Poradnie", "to poradnie specjalistyczne i pracownie fizjoterapii, jeden wiersz na rodzaj; liczba mówi, ile ich jest. Lista nie obejmuje gabinetów lekarza rodzinnego, pracowni badań ani ratownictwa."],
      ["Dziedziny medycyny", "to specjalności, w których oddział lub poradnia leczy pacjentów — według rejestru RPWDL."],
      ["Wyszukiwarka", "nie rozróżnia wielkości liter ani polskich znaków. Przy kilku słowach wszystkie muszą pasować do jednej nazwy lub dziedziny."],
    ]} />
    <input className={styles.search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Czy jest… np. kardiologia, poradnia diabetologiczna" aria-label="Szukaj oddziału, poradni albo dziedziny medycyny" autoComplete="off" />
    {searching ? <p className={styles.found} aria-live="polite">
      {wardHits.length || clinicCount
        ? <>„{query.trim()}”: <b>{wardHits.length}</b> {plural(wardHits.length, "pozycja", "pozycje", "pozycji")} na liście oddziałów i <b>{clinicCount}</b> {plural(clinicCount, "poradnia", "poradnie", "poradni")}.</>
        : <>„{query.trim()}”: brak oddziału i poradni. Rejestr RPWDL nie ma takiego oddziału ani poradni w tym szpitalu (sprawdź też inną nazwę dziedziny).</>}
    </p> : null}

    <details className={styles.listBox} open={searching || open.wards} onToggle={(event) => { if (!searching) setOpen((value) => ({ ...value, wards: (event.target as HTMLDetailsElement).open })); }}>
      <summary><span className={styles.listTitle}>Oddziały</span><small>{searching ? `${wardHits.filter((entry) => !entry.support).length} z ${wardCount}` : `${wardCount} · ${integer(total)} łóżek`}</small><span className={styles.more} /></summary>
      {legend.length ? <ul className={styles.payLegend} aria-label="Sposób zapłaty">
        {legend.map(([label, tone]) => <li key={label}><span className={`${card.pay} ${TONE_CLASS[tone]}`}>{label}</span></li>)}
        <li className={styles.payNote}>sposób zapłaty NFZ w {year} r. <InfoTip ariaLabel="Jak czytać sposób zapłaty" label={<HelpLines lines={[
          ["Ryczałt sieci", "— stała roczna kwota sieci szpitali, niezależna od liczby pacjentów."],
          ["Za każdy pobyt", "— NFZ płaci za każdą hospitalizację. Ryczałt + za pobyty — oba sposoby naraz; udziały są pod plakietką."],
          ["Stawka dobowa", "— stała kwota za każdy dzień gotowości (SOR, izba przyjęć)."],
          ["Osobna kwota", "— zakres poza ryczałtem, opłacany do kwoty z planu umowy (np. psychiatria, ZOL, hospicjum). W poradni: za porady, do limitu."],
          ["Szara plakietka", "— sposób zapłaty niepotwierdzony: umowa z NFZ wymienia ten oddział lub poradnię bez kwoty albo w ogóle go nie wymienia."],
          "Źródło: plany umów NFZ (API NFZ „Umowy”) i hospitalizacje według zakresów umów. Kwotę i nazwę umowy pokazuje plakietka po najechaniu lub dotknięciu.",
        ]} />} /></li>
      </ul> : null}
      <div className={`priority-table ${styles.tableWrap}`}>
        <table className={`${base.table} ${styles.list} sticky-head`}>
          <thead><tr><th>Oddział</th><th className={styles.fieldsCol}>Dziedziny medycyny</th><th className={`${base.num} ${styles.nums}`}>Łóżka</th><th className={`${base.num} ${styles.nums}`}>Udział</th></tr></thead>
          <tbody>
            {STRUCTURE_PARTS.map(({ key, label }) => {
              const all = wards.filter((entry) => entry.part === key);
              const hits = wardHits.filter((entry) => entry.part === key);
              if (!hits.length) return null;
              const beds = all.reduce((sum, entry) => sum + entry.beds, 0);
              return [<tr key={key} className={styles.partRow}>
                <th scope="rowgroup"><i style={{ background: PART_SWATCH[key] }} aria-hidden />{label}</th><th className={styles.fieldsCol} /><th className={`${base.num} ${styles.nums}`}>{integer(beds)}</th><th className={`${base.num} ${styles.nums}`}>{percent(beds, total, 1)}</th>
              </tr>, ...hits.map((entry) => <tr key={`${key}-${entry.code}-${entry.category}`}>
                <td>
                  <Highlight text={entry.name} words={words} />{entry.support ? <span className={styles.notWard}>nie oddział</span> : null}<Badge code={entry.code} support={entry.support} />
                  {entry.fields.length ? <small className={styles.fieldsInline}><Fields fields={entry.fields} words={words} /></small> : null}
                  {manyBuildings ? <small>{where(entry.addresses)}</small> : null}
                </td>
                <td className={styles.fieldsCol}><Fields fields={entry.fields} words={words} /></td>
                <td className={`${base.num} ${styles.nums}`}>{integer(entry.beds)}</td>
                <td className={`${base.num} ${styles.nums}`}>{percent(entry.beds, total, 1)}</td>
              </tr>)];
            })}
            {!wardHits.length ? <tr><td colSpan={4} className={styles.emptyRow}>Brak oddziału dla tego zapytania.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </details>

    {clinics.length ? <details className={styles.listBox} open={searching || open.clinics} onToggle={(event) => { if (!searching) setOpen((value) => ({ ...value, clinics: (event.target as HTMLDetailsElement).open })); }}>
      <summary><span className={styles.listTitle}>Poradnie (AOS)</span><small>{searching ? `${clinicCount} z ${structure.clinics.length}` : `${structure.clinics.length} w ${clinics.length} ${plural(clinics.length, "rodzaju", "rodzajach", "rodzajach")}`}</small><span className={styles.more} /></summary>
      <div className={`priority-table ${styles.tableWrap}`}>
        <table className={`${base.table} ${styles.list} sticky-head`}>
          <thead><tr><th>Poradnia</th><th className={styles.fieldsCol}>Dziedziny medycyny</th><th className={`${base.num} ${styles.nums}`}>Liczba</th></tr></thead>
          <tbody>
            {clinicHits.map((entry) => <tr key={entry.code}>
              <td>
                <Highlight text={entry.name} words={words} /><Badge code={entry.code} support={false} />
                {entry.fields.length ? <small className={styles.fieldsInline}><Fields fields={entry.fields} words={words} /></small> : null}
                {manyClinicAddresses ? <small>{where(entry.addresses)}</small> : null}
              </td>
              <td className={styles.fieldsCol}><Fields fields={entry.fields} words={words} /></td>
              <td className={`${base.num} ${styles.nums}`}>{entry.count}</td>
            </tr>)}
            {!clinicHits.length ? <tr><td colSpan={3} className={styles.emptyRow}>Brak poradni dla tego zapytania.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </details> : null}
    <p className={base.note}>Rejestr RPWDL, stan {data.rpwdlYear ? `z ${data.rpwdlYear} r.` : "bieżący"}; sposób zapłaty — umowy z NFZ w {year} r.</p>
    {sheet ? <BottomSheet title={sheet.title} onClose={() => setSheet(null)}>{sheet.body}</BottomSheet> : null}
  </section>;
}
