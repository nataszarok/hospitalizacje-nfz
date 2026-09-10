import "server-only";
import { getPool } from "@/lib/db";
import type { AdmissionRow, EstimationMethod, MortalityRow, ProductOption, ReferencePayload, RegionOption } from "@/lib/types";

function productLabel(code: string, jgpCode: string | null, name: string | null): string {
  const label = [jgpCode, name].filter((value) => value && value.trim()).join(" — ");
  return label || code;
}

function hospitalizationColumn(method: EstimationMethod): "hosp_min" | "hosp_sim" {
  return method === "sim" ? "hosp_sim" : "hosp_min";
}

export async function loadReferenceData(): Promise<ReferencePayload> {
  const db = getPool();
  const [config, productsResult, regionsResult, citiesResult, durationResult] = await Promise.all([
    db.query<{ key: string; value: string }>("SELECT key, value FROM app_config"),
    db.query<{ product_code: string; jgp_code: string | null; product_name: string | null }>(
      "SELECT product_code, jgp_code, product_name FROM products ORDER BY product_code"
    ),
    db.query<{ ow_nfz: string; voivodeship: string }>(
      "SELECT ow_nfz, voivodeship FROM nfz_regions ORDER BY sort_order, ow_nfz"
    ),
    db.query<{ city: string }>(
      `SELECT DISTINCT f.city
         FROM facilities f
         JOIN facility_product_duration_admission s
           ON s.ow_nfz = f.ow_nfz AND s.nip = f.nip
        WHERE f.city IS NOT NULL AND BTRIM(f.city) <> ''
        ORDER BY f.city`
    ),
    db.query<{ duration_group: string }>(
      "SELECT DISTINCT duration_group FROM facility_product_duration_admission ORDER BY duration_group"
    ),
  ]);

  const cfg = new Map(config.rows.map((row) => [row.key, row.value]));
  const products: ProductOption[] = productsResult.rows.map((row) => ({
    code: row.product_code,
    jgpCode: row.jgp_code,
    name: row.product_name,
    label: productLabel(row.product_code, row.jgp_code, row.product_name),
  }));
  const regions: RegionOption[] = regionsResult.rows.map((row) => ({ owNfz: row.ow_nfz, name: row.voivodeship }));

  return {
    analysisYear: cfg.get("analysis_year") ?? "2025",
    defaultProductCode: cfg.get("default_product_code") ?? products[0]?.code ?? "",
    products,
    regions,
    cities: citiesResult.rows.map((row) => row.city),
    durations: durationResult.rows.map((row) => row.duration_group),
  };
}

interface MortalityQuery {
  products: string[];
  durations: string[];
  method: EstimationMethod;
  minHosp: number;
  baseline: boolean;
}

export async function loadMortalityRows(query: MortalityQuery): Promise<MortalityRow[]> {
  if (query.products.length === 0) return [];
  const db = getPool();
  const hospColumn = hospitalizationColumn(query.method);
  const deathsColumn = query.method === "sim" ? "deaths_sim" : "deaths_min";
  const params: unknown[] = [query.products];
  const conditions = ["s.product_code = ANY($1::text[])"];

  if (!query.baseline && query.durations.length > 0) {
    params.push(query.durations);
    conditions.push(`s.duration_group = ANY($${params.length}::text[])`);
  }

  const minIndex = params.push(query.baseline ? 0 : query.minHosp);
  const sql = `
    WITH by_product AS (
      SELECT
        s.ow_nfz,
        s.nip,
        s.product_code,
        SUM(s.${hospColumn})::double precision AS hospitalizations,
        SUM(s.${deathsColumn})::double precision AS deaths
      FROM facility_product_duration_admission s
      WHERE ${conditions.join(" AND ")}
      GROUP BY s.ow_nfz, s.nip, s.product_code
    ),
    eligible_facilities AS (
      SELECT ow_nfz, nip
      FROM by_product
      GROUP BY ow_nfz, nip
      HAVING SUM(hospitalizations) >= $${minIndex}::double precision
    )
    SELECT
      p.ow_nfz,
      p.nip,
      p.product_code,
      f.provider_name,
      COALESCE(f.city, '') AS city,
      r.voivodeship,
      pop.population,
      p.hospitalizations,
      p.deaths
    FROM by_product p
    JOIN eligible_facilities e USING (ow_nfz, nip)
    JOIN facilities f USING (ow_nfz, nip)
    JOIN nfz_regions r USING (ow_nfz)
    JOIN population_voivodeship pop USING (ow_nfz)
    ORDER BY p.hospitalizations DESC, p.ow_nfz, p.nip, p.product_code
  `;

  const result = await db.query<{
    ow_nfz: string;
    nip: string;
    product_code: string;
    provider_name: string;
    city: string;
    voivodeship: string;
    population: string | number;
    hospitalizations: string | number;
    deaths: string | number;
  }>(sql, params);

  return result.rows.map((row) => {
    const hospitalizations = Number(row.hospitalizations);
    const deaths = Number(row.deaths);
    const population = Number(row.population);
    return {
      owNfz: row.ow_nfz,
      nip: row.nip,
      productCode: row.product_code,
      providerName: row.provider_name,
      city: row.city,
      voivodeship: row.voivodeship,
      population,
      hospitalizations,
      deaths,
      mortalityPct: hospitalizations > 0 ? (deaths / hospitalizations) * 100 : 0,
      hospitalizationsPer100k: population > 0 ? (hospitalizations / population) * 100_000 : 0,
    };
  });
}


interface AdmissionQuery {
  products: string[];
  durations: string[];
  method: EstimationMethod;
  minHosp: number;
}

const ADMISSION_COLUMN_CANDIDATES = ["admission_mode", "admission_code", "admission_mode_code", "kod_trybu_przyjecia"] as const;
let admissionColumnPromise: Promise<string> | null = null;

async function getAdmissionModeColumn(): Promise<string> {
  if (!admissionColumnPromise) {
    admissionColumnPromise = (async () => {
      const db = getPool();
      const result = await db.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'facility_product_duration_admission'
          AND column_name = ANY($1::text[])
      `, [ADMISSION_COLUMN_CANDIDATES]);
      const available = new Set(result.rows.map((row) => row.column_name));
      const column = ADMISSION_COLUMN_CANDIDATES.find((candidate) => available.has(candidate));
      if (!column) throw new Error("Brak kolumny trybu przyjęcia w tabeli facility_product_duration_admission.");
      return column;
    })();
  }
  return admissionColumnPromise;
}

export async function loadAdmissionRows(query: AdmissionQuery): Promise<AdmissionRow[]> {
  if (query.products.length === 0) return [];
  const db = getPool();
  const hospColumn = hospitalizationColumn(query.method);
  const admissionColumn = await getAdmissionModeColumn();
  const params: unknown[] = [query.products];
  const conditions = ["s.product_code = ANY($1::text[])", `s.${admissionColumn}::text IN ('2', '3', '6')`];

  if (query.durations.length > 0) {
    params.push(query.durations);
    conditions.push(`s.duration_group = ANY($${params.length}::text[])`);
  }

  const minIndex = params.push(query.minHosp);
  const sql = `
    WITH by_facility AS (
      SELECT
        s.ow_nfz,
        s.nip,
        SUM(CASE WHEN s.${admissionColumn}::text = '6' THEN s.${hospColumn} ELSE 0 END)::double precision AS planned_admissions,
        SUM(CASE WHEN s.${admissionColumn}::text IN ('2', '3') THEN s.${hospColumn} ELSE 0 END)::double precision AS urgent_admissions
      FROM facility_product_duration_admission s
      WHERE ${conditions.join(" AND ")}
      GROUP BY s.ow_nfz, s.nip
    )
    SELECT
      a.ow_nfz,
      a.nip,
      f.provider_name,
      COALESCE(f.city, '') AS city,
      r.voivodeship,
      a.planned_admissions,
      a.urgent_admissions
    FROM by_facility a
    JOIN facilities f USING (ow_nfz, nip)
    JOIN nfz_regions r USING (ow_nfz)
    WHERE (a.planned_admissions + a.urgent_admissions) >= $${minIndex}::double precision
    ORDER BY (a.planned_admissions + a.urgent_admissions) DESC, a.ow_nfz, a.nip
  `;

  const result = await db.query<{
    ow_nfz: string;
    nip: string;
    provider_name: string;
    city: string;
    voivodeship: string;
    planned_admissions: string | number;
    urgent_admissions: string | number;
  }>(sql, params);

  return result.rows.map((row) => {
    const plannedAdmissions = Number(row.planned_admissions);
    const urgentAdmissions = Number(row.urgent_admissions);
    return {
      owNfz: row.ow_nfz,
      nip: row.nip,
      providerName: row.provider_name,
      city: row.city,
      voivodeship: row.voivodeship,
      plannedAdmissions,
      urgentAdmissions,
      totalAdmissions: plannedAdmissions + urgentAdmissions,
    };
  });
}
