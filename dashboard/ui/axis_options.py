from __future__ import annotations

X_AXIS_TOTAL = "total"
X_AXIS_PER_100K = "per_100k"

X_AXIS_OPTIONS = (X_AXIS_TOTAL, X_AXIS_PER_100K)
X_AXIS_DEFAULT = X_AXIS_TOTAL

X_AXIS_LABELS = {
    X_AXIS_TOTAL: "Liczba hospitalizacji ogółem",
    X_AXIS_PER_100K: "Liczba hospitalizacji / 100 000 mieszkańców",
}

# Jednorazowa migracja wartości zapisanych przez starszą wersję aplikacji.
# Logika aplikacji nie zależy już od etykiet prezentacyjnych.
X_AXIS_LEGACY_VALUES = {label: option_id for option_id, label in X_AXIS_LABELS.items()}


def x_axis_label(option_id: str) -> str:
    """Return the presentation label for a stable X-axis option ID."""
    try:
        return X_AXIS_LABELS[option_id]
    except KeyError as exc:
        raise ValueError(f"Unknown X-axis option ID: {option_id!r}") from exc
