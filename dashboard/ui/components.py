def compact_stats_html(area_name: str, rows: list[dict], baseline_rows: list[dict] | None = None) -> str:
    lines=[f'<div style="margin:0 0 8px 0;padding:7px 8px;border:1px solid #E5E7EB;border-radius:7px;line-height:1.15;font-size:0.74rem;"><div style="font-weight:700;font-size:0.88rem;margin-bottom:5px;">{area_name}</div>']; baseline={r.get("label"):r for r in (baseline_rows or [])}
    for i,row in enumerate(rows):
        hosp=f"{row['hospitalizacje']:,.0f}".replace(","," "); hp=f"{row['hospitalizacje_na_placowke']:,.1f}".replace(","," "); label=row["label"]; border="" if i==0 else "border-top:1px solid #F0F1F3;padding-top:4px;margin-top:4px;"
        lines.append(f'<div style="{border}"><span style="font-weight:{700 if i==0 else 600};">{label}</span><br>Hosp. <b>{hosp}</b> · Śmiert. <b>{row["smiertelnosc"]:.2f}%</b><br>Hosp./plac. <b>{hp}</b> · Placówki <b>{int(row["placowki"])}</b>')
        b=baseline.get(label)
        if b is not None: lines.append(f'<br><span style="color:#6B7280;font-size:0.68rem;">Bez progu: Hosp. {b["hospitalizacje"]:,.0f} · Śmiert. {b["smiertelnosc"]:.2f}% · Placówki {int(b["placowki"])}</span>'.replace(","," "))
        lines.append('</div>')
    lines.append('</div>'); return ''.join(lines)

def metric_display_value(value, baseline=None):
    return f"{value} / {baseline}" if baseline is not None else str(value)
