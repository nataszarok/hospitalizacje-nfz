from __future__ import annotations
import sqlite3
import pandas as pd
from dashboard.config import DB_PATH, ReferenceData
from dashboard.domain.analytics import add_derived_metrics

ALLOWED_NUM = {"KOD_TRYBU_PRZYJECIA", "KOD_TRYBU_WYPISU", "MIESIAC"}
ALLOWED_TEXT = {"KOD_PRODUKTU_JEDNOSTKOWEGO", "KOD_PRODUKTU_KONTRAKTOWEGO", "OW_NFZ", "PLEC_PACJENTA", "GRUPA_WIEKOWA_PACJENTA", "PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"}
SECONDARY_FILTERS = ("contracts", "discharge", "months", "sex", "age")

def connect_readonly(path=DB_PATH):
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
    con.execute("SELECT 1")
    return con

def load_reference_data(con) -> ReferenceData:
    cfg = dict(con.execute("SELECT key,value FROM app_config").fetchall())
    regions = {str(k).zfill(2): v for k,v in con.execute("SELECT ow_nfz,wojewodztwo FROM nfz_regions ORDER BY sort_order,ow_nfz")}
    admissions = {int(k): v for k,v in con.execute("SELECT code,label FROM admission_modes ORDER BY sort_order,code")}
    colors = [r[0] for r in con.execute("SELECT color FROM highlight_palette ORDER BY position")]
    symbols = [r[0] for r in con.execute("SELECT symbol FROM product_symbols ORDER BY position")]
    return ReferenceData(cfg["analysis_year"], int(cfg["death_discharge_code"]), cfg["default_product_code"], int(cfg["simulation_seed"]), regions, admissions, colors, symbols)

def aggregate_status(con):
    try: return con.execute("SELECT needs_refresh,refreshed_at,source_rows,aggregate_rows,note FROM data_pipeline_status WHERE pipeline_name='dashboard_aggregates'").fetchone()
    except sqlite3.Error: return None



def load_population_by_ow(con) -> dict[str, int]:
    rows = con.execute(
        "SELECT ow_nfz, population FROM population_voivodeship ORDER BY ow_nfz"
    ).fetchall()
    return {str(ow).zfill(2): int(population) for ow, population in rows}

def load_population_metadata(con) -> dict[str, str]:
    row = con.execute(
        """SELECT reference_date, source_publication, source_table, source_sheet,
                  source_unit, source_url, source_file
           FROM population_voivodeship
           ORDER BY ow_nfz LIMIT 1"""
    ).fetchone()
    if row is None:
        return {}
    keys = [
        "reference_date", "source_publication", "source_table", "source_sheet",
        "source_unit", "source_url", "source_file",
    ]
    return dict(zip(keys, row))

def load_product_mapping(con):
    return pd.read_sql_query('SELECT KOD_PRODUKTU_JEDNOSTKOWEGO,KOD_JGP,NAZWA FROM produkty_jgp ORDER BY KOD_PRODUKTU_JEDNOSTKOWEGO', con, dtype={"KOD_PRODUKTU_JEDNOSTKOWEGO":str,"KOD_JGP":str,"NAZWA":str}).drop_duplicates("KOD_PRODUKTU_JEDNOSTKOWEGO")

def distinct_values(con, column: str):
    if column in ALLOWED_NUM:
        vals=pd.read_sql_query("SELECT value_num FROM filter_values WHERE column_name=? ORDER BY value_num",con,params=[column])["value_num"].dropna().tolist()
        return [int(v) if float(v).is_integer() else v for v in vals]
    if column in ALLOWED_TEXT:
        return pd.read_sql_query("SELECT value_text FROM filter_values WHERE column_name=? ORDER BY value_text",con,params=[column])["value_text"].dropna().astype(str).tolist()
    raise ValueError("Niedozwolona kolumna filtra")

def normalize_city_name(value: object) -> str:
    """Normalize city display names without changing source values in SQLite."""
    if pd.isna(value):
        return ""
    return " ".join(str(value).strip().split()).title()

def normalize_city_series(series: pd.Series) -> pd.Series:
    return series.map(normalize_city_name)

def distinct_cities(con):
    q = '''SELECT DISTINCT TRIM(s.miejscowosc) AS city
           FROM nfz_swiadczeniodawcy_unique s
           JOIN (
               SELECT DISTINCT OW_NFZ, NIP_PODMIOTU
               FROM dashboard_facility_product
           ) h
             ON h.OW_NFZ = s.oddzial_nfz
            AND CAST(h.NIP_PODMIOTU AS TEXT) = s.nip
           WHERE s.miejscowosc IS NOT NULL
             AND TRIM(s.miejscowosc) <> '' '''
    cities = pd.read_sql_query(q, con)["city"].dropna().map(normalize_city_name)
    return sorted(dict.fromkeys(cities.tolist()), key=str.casefold)

def should_use_preaggregate(filters: dict) -> bool:
    return not any(filters.get(k,()) for k in SECONDARY_FILTERS)

def _sql_in(column, values, where, params):
    if values:
        where.append(f'h."{column}" IN ({",".join("?" for _ in values)})'); params.extend(values)

def load_aggregated(con, filters: tuple, method: str, death_code: int, region_map: dict[str,str]):
    f=dict(filters); where=[]; params=[]; _sql_in("KOD_PRODUKTU_JEDNOSTKOWEGO",f.get("products",()),where,params)
    admission=f.get("admission",()); pre=should_use_preaggregate(f)
    if pre:
        duration=f.get("duration",())
        if duration:
            table="dashboard_facility_product_duration_admission"
            _sql_in("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI",duration,where,params)
            if admission: _sql_in("KOD_TRYBU_PRZYJECIA",admission,where,params)
        else:
            table="dashboard_facility_product_admission" if admission else "dashboard_facility_product"
            if admission: _sql_in("KOD_TRYBU_PRZYJECIA",admission,where,params)
        hosp="HOSP_NUM" if method.startswith("Symulacyjna") else "HOSP_MIN"; deaths="DEATHS_NUM" if method.startswith("Symulacyjna") else "DEATHS_MIN"
        death_expr=f'SUM(h."{deaths}")'
    else:
        for col,key in [("KOD_PRODUKTU_KONTRAKTOWEGO","contracts"),("KOD_TRYBU_PRZYJECIA","admission"),("KOD_TRYBU_WYPISU","discharge"),("MIESIAC","months"),("PLEC_PACJENTA","sex"),("GRUPA_WIEKOWA_PACJENTA","age"),("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI","duration")]: _sql_in(col,f.get(key,()),where,params)
        table="hospitalizacje"; hosp="LICZBA_HOSPITALIZACJI_NUM" if method.startswith("Symulacyjna") else "LICZBA_HOSPITALIZACJI_MIN"; death_expr=f'SUM(CASE WHEN h.KOD_TRYBU_WYPISU = ? THEN h."{hosp}" ELSE 0 END)'; params=[death_code]+params
    ws=" WHERE "+" AND ".join(where) if where else ""
    q=f'''SELECT h.OW_NFZ,h.NIP_PODMIOTU,h.KOD_PRODUKTU_JEDNOSTKOWEGO,COALESCE(NULLIF(s.swiadczeniodawca_wyswietlany,''),s.swiadczeniodawca,'NIP '||h.NIP_PODMIOTU) "Świadczeniodawca",'' "Województwo",COALESCE(s.miejscowosc,'') "Miejscowość",SUM(h."{hosp}") hospitalizacje_ogolem,{death_expr} zgony FROM {table} h LEFT JOIN nfz_swiadczeniodawcy_unique s ON s.nip=CAST(h.NIP_PODMIOTU AS TEXT) AND s.oddzial_nfz=h.OW_NFZ{ws} GROUP BY h.OW_NFZ,h.NIP_PODMIOTU,h.KOD_PRODUKTU_JEDNOSTKOWEGO,s.swiadczeniodawca_wyswietlany,s.swiadczeniodawca,s.miejscowosc'''
    data=pd.read_sql_query(q,con,params=params)
    if data.empty:return data
    data["OW_NFZ"]=data["OW_NFZ"].astype(str).str.replace(r"\.0$","",regex=True).str.zfill(2); data["Województwo"]=data["Województwo"].replace("",pd.NA).fillna(data["OW_NFZ"].map(region_map)).fillna(""); data["KOD_PRODUKTU_JEDNOSTKOWEGO"]=data["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str); data["Miejscowość"] = normalize_city_series(data["Miejscowość"])
    return add_derived_metrics(data).sort_values("hospitalizacje_ogolem",ascending=False).reset_index(drop=True)

def load_admission_comparison(con, filters: tuple, method: str):
    f=dict(filters); where=[]; params=[]; _sql_in("KOD_PRODUKTU_JEDNOSTKOWEGO",f.get("products",()),where,params); where.append('h."KOD_TRYBU_PRZYJECIA" IN (2,3,6)'); pre=should_use_preaggregate(f)
    if pre:
        duration=f.get("duration",())
        if duration:
            table="dashboard_facility_product_duration_admission"
            _sql_in("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI",duration,where,params)
        else:
            table="dashboard_facility_product_admission"
        hosp="HOSP_NUM" if method.startswith("Symulacyjna") else "HOSP_MIN"
    else:
        for col,key in [("KOD_PRODUKTU_KONTRAKTOWEGO","contracts"),("KOD_TRYBU_WYPISU","discharge"),("MIESIAC","months"),("PLEC_PACJENTA","sex"),("GRUPA_WIEKOWA_PACJENTA","age"),("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI","duration")]: _sql_in(col,f.get(key,()),where,params)
        table="hospitalizacje"; hosp="LICZBA_HOSPITALIZACJI_NUM" if method.startswith("Symulacyjna") else "LICZBA_HOSPITALIZACJI_MIN"
    q=f'''SELECT h.OW_NFZ,h.NIP_PODMIOTU,h.KOD_PRODUKTU_JEDNOSTKOWEGO,h.KOD_TRYBU_PRZYJECIA,COALESCE(NULLIF(s.swiadczeniodawca_wyswietlany,''),s.swiadczeniodawca,'NIP '||CAST(h.NIP_PODMIOTU AS TEXT)) "Świadczeniodawca",COALESCE(s.miejscowosc,'') "Miejscowość",SUM(h."{hosp}") hospitalizacje_ogolem FROM {table} h LEFT JOIN nfz_swiadczeniodawcy_unique s ON s.nip=CAST(h.NIP_PODMIOTU AS TEXT) AND s.oddzial_nfz=h.OW_NFZ WHERE {" AND ".join(where)} GROUP BY h.OW_NFZ,h.NIP_PODMIOTU,h.KOD_PRODUKTU_JEDNOSTKOWEGO,h.KOD_TRYBU_PRZYJECIA,s.swiadczeniodawca_wyswietlany,s.swiadczeniodawca,s.miejscowosc'''
    data=pd.read_sql_query(q,con,params=params)
    if not data.empty: data["OW_NFZ"]=data["OW_NFZ"].astype(str).str.replace(r"\.0$","",regex=True).str.zfill(2); data["KOD_PRODUKTU_JEDNOSTKOWEGO"]=data["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str); data["Miejscowość"] = normalize_city_series(data["Miejscowość"])
    return data
