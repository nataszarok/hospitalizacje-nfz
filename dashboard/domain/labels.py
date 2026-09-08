from __future__ import annotations
import pandas as pd


def clean_label_value(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def build_product_meta(mapping: pd.DataFrame) -> dict[str, dict[str, str]]:
    return {
        str(row["KOD_PRODUKTU_JEDNOSTKOWEGO"]).strip(): {
            "jgp": clean_label_value(row.get("KOD_JGP", "")),
            "name": clean_label_value(row.get("NAZWA", "")),
        }
        for _, row in mapping.iterrows()
    }


def product_label(code: str, meta: dict[str, dict[str, str]]) -> str:
    code = str(code).strip(); item = meta.get(code)
    if not item: return code
    return " — ".join([p for p in [code, item.get("jgp", ""), item.get("name", "")] if p])


def product_legend_label(code: str, meta: dict[str, dict[str, str]]) -> str:
    code = str(code).strip(); item = meta.get(code, {})
    jgp = clean_label_value(item.get("jgp", "")); name = clean_label_value(item.get("name", ""))
    return f"{jgp} — {name}" if jgp and name else name or jgp or code


def admission_mode_label(code, labels: dict[int, str]) -> str:
    try: normalized = int(code)
    except (TypeError, ValueError): return str(code)
    description = labels.get(normalized)
    return f"{normalized} — {description}" if description else str(normalized)
