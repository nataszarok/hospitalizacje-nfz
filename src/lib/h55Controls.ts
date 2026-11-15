/**
 * Kontrole NFZ, w których temat albo zakres wymienia grupę H55 (artykuł „H55. Historia jednego kodu”).
 * Źródło: NFZ, „Szczegółowe informacje o wynikach kontroli przeprowadzonych przez Departament Kontroli” (BIP NFZ,
 * arkusze w układzie z zarządzeń 122/2022/DK i 15/2020/DK) — numer postępowania, daty, ocena ogólna, skutki finansowe
 * i okres objęty kontrolą z opisu zakresu przedmiotowego.
 * Świadczeniodawca jak w danych portalu: „OW|NIP”. NIP pięciu kontroli z lat 2019–2022 ustalony po REGON
 * z wykazu świadczeniodawców NFZ.
 */
export interface H55Control {
  /** Numer postępowania kontrolnego. */
  id: string;
  /** Świadczeniodawca „OW|NIP”. */
  provider: string;
  /** Krótka nazwa w tekście i na wykresach. */
  label: string;
  /** Pełna nazwa kontrolowanego podmiotu. */
  name: string;
  /** Miasto terenowego wydziału kontroli NFZ. */
  department: string;
  /** Daty pracy kontrolerów (RRRR-MM-DD). */
  start: string;
  end: string;
  /** Okres świadczeń objęty kontrolą w części dotyczącej H55 (RRRR-MM, włącznie). */
  studyFrom: string;
  studyTo: string;
  /** Ocena ogólna; w układzie z 2020 r. (bez oceny ogólnej) — ocena obszarów kontroli. */
  outcome: "negatywna" | "pozytywna z nieprawidłowościami" | "negatywne oceny obszarów";
  /** Skutki finansowe kontroli (zł) — kwota wykazana przez NFZ, nie potwierdzona wpłata. */
  effectPln: number;
  /**
   * „series” — 17 kontroli z lat 2023–2026 poświęconych H55; „early” — pięć wcześniejszych (2019–2022).
   * `mixed`: kontrola wielotematyczna (H55 jest jednym z wielu zagadnień), skutków nie można przypisać H55.
   */
  wave: "early" | "series";
  mixed?: boolean;
  /** Dodatkowy zakres kontroli poza H55 (podpis w tabeli), gdy skutki dotyczą też innych zagadnień. */
  note?: string;
  /** Rodzaje ustaleń z pola „Stwierdzone nieprawidłowości” (opis: `FINDING_TEXT`). */
  findings: Finding[];
}

/**
 * Rodzaje ustaleń kontroli: „ambulatoryjnie” — niezasadna hospitalizacja, cel leczenia osiągalny ambulatoryjnie (art. 58);
 * „skierowanie” — hospitalizacja bez skierowania (art. 58); „kwalifikacja” — nieprawidłowe zakwalifikowanie do grupy JGP
 * lub rozliczenia, błędne procedury albo rozpoznania; „dokumentacja” — świadczenia bez potwierdzenia w dokumentacji;
 * „zalecenia” — niewykonanie zaleceń pokontrolnych; „inne” — inne zagadnienia kontroli wielotematycznej (np. personel).
 */
export type Finding = "ambulatoryjnie" | "skierowanie" | "kwalifikacja" | "dokumentacja" | "zalecenia" | "inne";

export const FINDING_TEXT: Record<Finding, string> = {
  ambulatoryjnie: "niezasadna hospitalizacja — można było leczyć ambulatoryjnie",
  skierowanie: "hospitalizacja bez skierowania",
  kwalifikacja: "błędne zakwalifikowanie do grupy JGP lub rozliczenia",
  dokumentacja: "świadczenia bez potwierdzenia w dokumentacji",
  zalecenia: "niewykonanie zaleceń pokontrolnych",
  inne: "inne zagadnienia (np. personel)",
};

export const H55_CONTROLS: readonly H55Control[] = [
  { id: "DK.TWKX.7310.005.2019.DKUX", provider: "10|5422529292", label: "Białystok (Śniadecki)", name: "Wojewódzki Szpital Zespolony im. J. Śniadeckiego w Białymstoku", department: "Białystok", start: "2019-08-14", end: "2019-10-01", studyFrom: "2017-01", studyTo: "2017-12", outcome: "pozytywna z nieprawidłowościami", effectPln: 138727.84, wave: "early", mixed: true, findings: ["kwalifikacja", "inne"] },
  { id: "DK.TWKX.7310.012.2019.DKUX", provider: "10|5461193353", label: "Mońki", name: "SPZOZ w Mońkach", department: "Białystok", start: "2019-10-28", end: "2019-11-27", studyFrom: "2017-01", studyTo: "2017-12", outcome: "pozytywna z nieprawidłowościami", effectPln: 134837.03, wave: "early", mixed: true, findings: ["kwalifikacja", "inne"] },
  // Układ z 2020 r.: skutki = kara umowna 26 271,64 zł + zwrot 688 755,60 zł; oba obszary (zasadność hospitalizacji, procedura 03.96) ocenione negatywnie.
  { id: "DK.TWK-XV.7320.006.2020", provider: "15|6991919769", label: "Rawicz", name: "Szpital Powiatowy w Rawiczu", department: "Poznań", start: "2020-08-20", end: "2021-07-29", studyFrom: "2016-01", studyTo: "2017-09", outcome: "negatywne oceny obszarów", effectPln: 715027.24, wave: "early", findings: ["ambulatoryjnie", "kwalifikacja"] },
  { id: "DK.TWK.III.7310.013.2020.DKS", provider: "03|9222292491", label: "Zamość", name: "Szpital Wojewódzki im. Papieża Jana Pawła II w Zamościu", department: "Lublin", start: "2020-07-31", end: "2020-09-30", studyFrom: "2018-01", studyTo: "2019-12", outcome: "negatywna", effectPln: 173246.92, wave: "early", findings: ["kwalifikacja"] },
  // Kontrola badała lata 2016–2019; dane hospitalizacji zaczynają się w 2017 r.
  { id: "DK.TWK-XV.7320.003.2022", provider: "15|7891760011", label: "Poznań (Remedium)", name: "Wielkopolskie Centra Medyczne Remedium", department: "Poznań", start: "2022-03-29", end: "2022-07-15", studyFrom: "2016-01", studyTo: "2019-12", outcome: "negatywna", effectPln: 795541.18, wave: "early", findings: ["ambulatoryjnie", "kwalifikacja"] },
  { id: "DK.TWK-VII.7320.089.2022", provider: "07|5321662948", label: "Otwock (CMKP)", name: "Szpital Kliniczny im. prof. A. Grucy CMKP w Otwocku", department: "Warszawa", start: "2022-10-17", end: "2022-12-15", studyFrom: "2019-01", studyTo: "2019-12", outcome: "negatywna", effectPln: 134043.49, wave: "early", findings: ["kwalifikacja"] },
  { id: "DK.TWK-VII.4840.086.2023", provider: "07|7611333881", label: "Przasnysz", name: "SPZZOZ w Przasnyszu", department: "Warszawa", start: "2023-10-30", end: "2023-12-11", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 548808.09, wave: "series", findings: ["kwalifikacja"] },
  { id: "DK.TWK-XII.4840.063.2023", provider: "12|6351572989", label: "Mikołów", name: "Szpital św. Józefa w Mikołowie", department: "Katowice", start: "2023-11-10", end: "2024-06-27", studyFrom: "2021-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 348883.78, wave: "series", findings: ["kwalifikacja"] },
  { id: "DK.TWK-XII.4840.065.2023", provider: "12|6431764082", label: "Siemianowice Śląskie", name: "Szpital Miejski w Siemianowicach Śląskich", department: "Katowice", start: "2023-11-14", end: "2024-07-17", studyFrom: "2021-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 555770.93, wave: "series", findings: ["kwalifikacja"] },
  { id: "DK.TWK-X.4840.057.2023", provider: "16|8581797173", label: "Gryfino", name: "Szpital Powiatowy w Gryfinie", department: "Białystok", start: "2023-12-04", end: "2024-02-16", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 344559.52, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-XII.4840.003.2024", provider: "12|6342305444", label: "Katowice (kolejowy)", name: "Okręgowy Szpital Kolejowy w Katowicach", department: "Katowice", start: "2024-01-23", end: "2024-06-28", studyFrom: "2021-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 406159.72, wave: "series", findings: ["kwalifikacja"] },
  { id: "DK.TWK-X.4840.006.2024", provider: "16|6691044410", label: "Koszalin", name: "Szpital Wojewódzki im. M. Kopernika w Koszalinie", department: "Białystok", start: "2024-02-06", end: "2024-04-30", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 1497692.5, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-X.4840.005.2024", provider: "16|3020002009", label: "Białogard", name: "Regionalne Centrum Medyczne w Białogardzie", department: "Białystok", start: "2024-02-06", end: "2024-03-21", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 417164.38, wave: "series", findings: ["ambulatoryjnie", "skierowanie"] },
  { id: "DK.TWK-X.4840.029.2024", provider: "15|7661015232", label: "Wągrowiec", name: "Zespół Opieki Zdrowotnej w Wągrowcu", department: "Białystok", start: "2024-07-26", end: "2024-10-08", studyFrom: "2023-01", studyTo: "2023-08", outcome: "negatywna", effectPln: 549112, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-X.4840.032.2024", provider: "10|7231529454", label: "Zambrów", name: "Szpital Powiatowy w Zambrowie", department: "Białystok", start: "2024-08-29", end: "2024-12-13", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 675569.52, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-X.4840.039.2024", provider: "16|8522198181", label: "Szczecin (MSWiA)", name: "SPZOZ MSWiA w Szczecinie", department: "Białystok", start: "2024-10-28", end: "2025-01-22", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 1269479.22, wave: "series", findings: ["ambulatoryjnie", "dokumentacja"] },
  { id: "DK.TWK-X.4840.049.2024", provider: "16|8571688560", label: "Gryfice", name: "SPZZOZ w Gryficach", department: "Białystok", start: "2024-12-17", end: "2025-04-22", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 996855.08, wave: "series", findings: ["ambulatoryjnie", "skierowanie"] },
  { id: "DK.TWK-X.4840.014.2025", provider: "16|8512537954", label: "Szczecin (wojewódzki)", name: "Samodzielny Publiczny Wojewódzki Szpital Zespolony w Szczecinie", department: "Białystok", start: "2025-04-14", end: "2025-06-24", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 634712.5, wave: "series", findings: ["ambulatoryjnie", "skierowanie"] },
  { id: "DK.TWK-X.4840.019.2025", provider: "14|8491373268", label: "Pisz", name: "SPZOZ Szpital Powiatowy w Piszu", department: "Białystok", start: "2025-05-06", end: "2025-07-25", studyFrom: "2023-01", studyTo: "2023-12", outcome: "negatywna", effectPln: 670849.2, wave: "series", findings: ["ambulatoryjnie", "skierowanie"] },
  // Druga kontrola Koszalina: H55 VIII–XII 2024, H52 I–VIII 2023 i wykonanie zaleceń z kontroli DK.TWK-X.4840.006.2024 (niewykonane).
  { id: "DK.TWK-X.4840.026.2025", provider: "16|6691044410", label: "Koszalin (2. kontrola)", name: "Szpital Wojewódzki im. M. Kopernika w Koszalinie", department: "Białystok", start: "2025-08-04", end: "2026-03-27", studyFrom: "2024-08", studyTo: "2024-12", outcome: "negatywna", effectPln: 6960738.94, wave: "series", mixed: true, note: "także H52 (I–VIII 2023) i wykonanie zaleceń z 2024 r.", findings: ["zalecenia", "ambulatoryjnie", "skierowanie", "kwalifikacja"] },
  { id: "DK.TWK-X.4840.041.2025", provider: "11|5851479028", label: "Sopot", name: "Pomorskie Centrum Reumatologiczne w Sopocie", department: "Białystok", start: "2025-11-27", end: "2026-02-11", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 133406.15, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-II.4840.028.2025.SZP", provider: "02|5571520586", label: "Mogilno", name: "SPZOZ w Mogilnie", department: "Bydgoszcz", start: "2025-12-12", end: "2026-05-19", studyFrom: "2023-08", studyTo: "2024-05", outcome: "negatywna", effectPln: 2641109.09, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-X.4840.042.2025", provider: "11|9570730409", label: "Gdańsk (UCK)", name: "Uniwersyteckie Centrum Kliniczne w Gdańsku", department: "Białystok", start: "2025-12-29", end: "2026-03-23", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 234906.84, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-X.4840.044.2025", provider: "05|8271831912", label: "Sieradz", name: "Szpital Wojewódzki im. Prymasa Kardynała Stefana Wyszyńskiego w Sieradzu", department: "Białystok", start: "2025-12-30", end: "2026-07-30", studyFrom: "2022-01", studyTo: "2022-12", outcome: "negatywna", effectPln: 469016.01, wave: "series", findings: ["ambulatoryjnie"] },
  { id: "DK.TWK-XI.4840.004.2026", provider: "11|8421770610", label: "Miastko", name: "Szpital Miejski w Miastku", department: "Gdańsk", start: "2026-02-17", end: "2026-07-28", studyFrom: "2024-04", studyTo: "2025-03", outcome: "negatywna", effectPln: 13258157.23, wave: "series", findings: ["ambulatoryjnie"] },
];

export const findControl = (label: string): H55Control => {
  const control = H55_CONTROLS.find((item) => item.label === label);
  if (!control) throw new Error(`Brak kontroli: ${label}`);
  return control;
};
