from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence


MORTALITY_X_AXIS_STATE_KEY = "mortality_x_axis_mode"
MORTALITY_X_AXIS_WIDGET_KEY = "mortality_x_axis_selector"
ADMISSION_SCALE_STATE_KEY = "admission_scale_mode"
ADMISSION_SCALE_WIDGET_KEY = "admission_scale_selector"


def _normalize_choice(
    value: object,
    options: Sequence[str],
    aliases: Mapping[str, str] | None = None,
) -> str | None:
    """Normalize a stored widget value to one of the stable option IDs."""
    if value in options:
        return str(value)
    if aliases and isinstance(value, str):
        migrated = aliases.get(value)
        if migrated in options:
            return str(migrated)
    return None


def ensure_widget_choice(
    state: MutableMapping[str, object],
    key: str,
    options: Sequence[str],
    default: str,
    *,
    aliases: Mapping[str, str] | None = None,
) -> str:
    """Return one canonical option ID and persist it in session state."""
    if default not in options:
        raise ValueError("Default value must be one of the available options")

    current = _normalize_choice(state.get(key), options, aliases)
    if current is None:
        state[key] = default
        return default
    state[key] = current
    return current


def prepare_widget_choice(
    state: MutableMapping[str, object],
    canonical_key: str,
    widget_key: str,
    options: Sequence[str],
    default: str,
    *,
    aliases: Mapping[str, str] | None = None,
) -> str:
    """Prepare mirrored widget state *before* the Streamlit widget is created.

    ``canonical_key`` is the durable application state. ``widget_key`` is only
    Streamlit's technical widget state.  The widget key may legally be written
    only before widget instantiation, so restoration/migration happens here.

    If an older app version stored only the widget value, that value is used to
    seed the canonical state before falling back to ``default``.
    """
    if default not in options:
        raise ValueError("Default value must be one of the available options")

    canonical = _normalize_choice(state.get(canonical_key), options, aliases)
    if canonical is None:
        canonical = _normalize_choice(state.get(widget_key), options, aliases)
    if canonical is None:
        canonical = default

    state[canonical_key] = canonical
    # Safe only because this helper is explicitly called before instantiation.
    state[widget_key] = canonical
    return canonical


def sync_widget_choice(
    state: MutableMapping[str, object],
    canonical_key: str,
    widget_key: str,
    options: Sequence[str],
    default: str,
    *,
    aliases: Mapping[str, str] | None = None,
) -> str:
    """Copy a widget change to canonical state without touching widget state.

    This function is callback-safe: Streamlit executes ``on_change`` after the
    widget exists, at which point assigning to ``state[widget_key]`` is illegal.
    Only the independent canonical key is updated here.
    """
    if default not in options:
        raise ValueError("Default value must be one of the available options")

    widget_value = _normalize_choice(state.get(widget_key), options, aliases)
    if widget_value is None:
        widget_value = _normalize_choice(state.get(canonical_key), options, aliases)
    if widget_value is None:
        widget_value = default

    state[canonical_key] = widget_value
    return widget_value


def mortality_chart_key(view_mode: str, x_axis_id: str) -> str:
    """Stable Plotly key based only on stable internal IDs."""
    view = "regions" if view_mode == "Województwa" else "cities"
    return f"mortality_chart_{view}_{x_axis_id}"


def admission_chart_key(scale_id: str, view_mode: str) -> str:
    """Stable admission Plotly key based on scale and geography mode IDs."""
    view = "regions" if view_mode == "Województwa" else "cities"
    return f"admission_chart_{view}_{scale_id}"
