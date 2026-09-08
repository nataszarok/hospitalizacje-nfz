from __future__ import annotations

X_AXIS_TOTAL = "total"
X_AXIS_PER_100K = "per_100k"

X_AXIS_OPTIONS = (X_AXIS_TOTAL, X_AXIS_PER_100K)
X_AXIS_DEFAULT = X_AXIS_TOTAL

X_AXIS_LABELS = {
    X_AXIS_TOTAL: "Liczba hospitalizacji ogółem",
    X_AXIS_PER_100K: "Liczba hospitalizacji / 100 000 mieszkańców",
}

ADMISSION_SCALE_LABELS = {
    X_AXIS_TOTAL: "Liczba hospitalizacji ogółem",
    X_AXIS_PER_100K: "Liczba hospitalizacji / 100 000 mieszkańców",
}

# One-time migration for values saved by older app versions. Application logic
# depends on stable IDs, not presentation labels.
X_AXIS_LEGACY_VALUES = {label: option_id for option_id, label in X_AXIS_LABELS.items()}


def x_axis_label(option_id: str) -> str:
    """Return presentation label for a stable mortality X-axis option ID."""
    try:
        return X_AXIS_LABELS[option_id]
    except KeyError as exc:
        raise ValueError(f"Unknown X-axis option ID: {option_id!r}") from exc


def admission_scale_label(option_id: str) -> str:
    """Return presentation label for a stable admission chart scale ID."""
    try:
        return ADMISSION_SCALE_LABELS[option_id]
    except KeyError as exc:
        raise ValueError(f"Unknown admission scale option ID: {option_id!r}") from exc
