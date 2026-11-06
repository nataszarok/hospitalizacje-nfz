// Kalibracja wartości „<5” (metoda cal v4, scripts/calibrate_below5.py wywoływany z build_hospitalizations.py).
// Pliki hospitalizacji mają kolumny hCal/dCal dla lat z kalibracją; index.json ma podsumowanie każdego takiego roku.

/** Podsumowanie kalibracji roku (index.json, klucz „calibration”). Sumy komórek liczymy w grupach z danymi API. */
export type CalibrationSummary = {
  year: string;
  method: string;
  cells: number;
  groups: number;
  groupsA: number;
  groupsB: number;
  groupsWithoutApi: number;
  staysMin: number;
  staysCal: number;
  staysApi: number;
  deathsMin: number;
  deathsCal: number;
  deathsApi: number;
  groupsStaysEqualApi: number;
  groupsDeathsEqualApi: number;
  cellsBelowPatients: number;
  groupsBelowPatients: number;
};

/** Lata z kalibracją, od najstarszego. */
export function calibrationSummaries(calibration: Record<string, CalibrationSummary> | undefined): CalibrationSummary[] {
  return Object.values(calibration ?? {}).sort((a, b) => a.year.localeCompare(b.year));
}
