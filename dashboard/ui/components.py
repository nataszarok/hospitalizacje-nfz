def compact_stats_html(
    area_name: str,
    rows: list[dict],
    baseline_rows: list[dict] | None = None,
    *,
    show_population_rate: bool = False,
) -> str:
    lines = [
        f'<div style="margin:0 0 8px 0;padding:7px 8px;border:1px solid #E5E7EB;'
        f'border-radius:7px;line-height:1.15;font-size:0.74rem;">'
        f'<div style="font-weight:700;font-size:0.88rem;margin-bottom:5px;">{area_name}</div>'
    ]
    baseline = {r.get("label"): r for r in (baseline_rows or [])}

    for i, row in enumerate(rows):
        hosp = f"{row['hospitalizacje']:,.0f}".replace(",", " ")
        hp = f"{row['hospitalizacje_na_placowke']:,.1f}".replace(",", " ")
        label = row["label"]
        border = "" if i == 0 else "border-top:1px solid #F0F1F3;padding-top:4px;margin-top:4px;"
        lines.append(
            f'<div style="{border}"><span style="font-weight:{700 if i == 0 else 600};">{label}</span><br>'
            f'Hosp. <b>{hosp}</b> · Śmiert. <b>{row["smiertelnosc"]:.2f}%</b><br>'
            f'Hosp./plac. <b>{hp}</b> · Placówki <b>{int(row["placowki"])}</b>'
        )

        rate = row.get("hospitalizacje_na_100k")
        if show_population_rate and rate is not None:
            rate_text = f"{rate:,.2f}".replace(",", " ")
            lines.append(f'<br>Hosp./100 tys. <b>{rate_text}</b>')

        b = baseline.get(label)
        if b is not None:
            baseline_text = (
                f'Bez progu: Hosp. {b["hospitalizacje"]:,.0f} · '
                f'Śmiert. {b["smiertelnosc"]:.2f}% · Placówki {int(b["placowki"])}'
            )
            baseline_rate = b.get("hospitalizacje_na_100k")
            if show_population_rate and baseline_rate is not None:
                baseline_text += f' · Hosp./100 tys. {baseline_rate:,.2f}'
            lines.append(
                '<br><span style="color:#6B7280;font-size:0.68rem;">'
                + baseline_text.replace(",", " ")
                + '</span>'
            )
        lines.append('</div>')

    lines.append('</div>')
    return ''.join(lines)

def metric_display_value(value, baseline=None) -> str:
    """Format the compact value displayed inside a KPI card.

    Comparisons stay intentionally terse: current / baseline. Percentage
    context is rendered as secondary text below the main value.
    """
    if baseline is None:
        return str(value)
    return f"{value} / {baseline}"


def metric_retained_share(
    value_numeric: float | int | None,
    baseline_numeric: float | int | None,
) -> str | None:
    """Return a compact secondary label with share of the baseline value."""
    if value_numeric is None or baseline_numeric in (None, 0):
        return None
    share = float(value_numeric) / float(baseline_numeric) * 100.0
    return f"{share:.0f}% wartości bazowej"
