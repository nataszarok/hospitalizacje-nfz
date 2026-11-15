import { H55_CONTROLS } from "@/lib/h55Controls";
import type { H55ArticleFile } from "@/lib/h55Article";

/** Plik budowania z hospitalizacjami każdej placówki kontroli (po 10 w każdym miesiącu) i jedną krótką serią. */
export function h55ArticleFixture(): H55ArticleFile {
  const years = ["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
  // Świadczeniodawca raz na liście, także gdy miał kilka kontroli (Koszalin).
  const controlled = [...new Set(H55_CONTROLS.map((control) => control.provider))];
  const providers = [...controlled, "05|krotka", "06|inna"];
  const rows = { provider: [] as number[], month: [] as number[], hospitalizations: [] as number[] };
  const add = (provider: number, month: number, value: number) => { rows.provider.push(provider); rows.month.push(month); rows.hospitalizations.push(value); };
  controlled.forEach((_, p) => { for (let m = 0; m < 108; m += 1) add(p, m, 10); });
  for (let m = 96; m < 102; m += 1) add(providers.length - 2, m, 30);
  for (let m = 0; m < 108; m += 1) add(providers.length - 1, m, 1);
  return { version: 1, jgp: "H55", product: "5.51.01.0008055", years, method: "sim", providers, rows, procedure: { code: "03.96", source: "API", fields: [], years: [[2017, 5395, 5255, 97.41], [2018, 7259, 7049, 97.11], [2019, 8634, 8449, 97.86], [2020, 7071, 6960, 98.43], [2021, 10160, 10009, 98.51], [2022, 17937, 17850, 99.52], [2023, 24517, 24228, 98.82], [2024, 30971, 30232, 97.61]] },
    stays: { source: "API", fields: [], rows: [[2023, 24517, 2222, 20003, 3613], [2024, 30971, 2867, 26470, 3461]] },
    valuation2026: { group: "HK14", year: 2026, source: "katalog", points: { hospitalizacja: 2512, planowa: 2311, zero_dni: 2311 } },
    settled: { fields: [], rows: [[2025, "H55", 1860, 1000], [2026, "HK14", 1930, 1000]] },
  };
}

