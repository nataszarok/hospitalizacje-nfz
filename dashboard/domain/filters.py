from __future__ import annotations

from collections.abc import Collection
from dataclasses import dataclass


@dataclass(frozen=True)
class SidebarState:
    method: str
    selected_products: list[str]
    admission: list
    selected_ow: list[str]
    selected_cities: list[str]
    view_mode: str
    contracts: list
    discharge: list
    months: list
    sex: list
    age: list
    duration: list
    min_hosp: int

    def filters_tuple(self, *, exclude: Collection[str] = ()) -> tuple:
        """Return substantive filters, optionally omitting selected dimensions.

        The current dataset uses every filter returned here and the volume
        threshold is applied afterwards. A comparison baseline can reuse the
        same definition while excluding dimensions that must not alter the
        benchmark, such as length of stay.
        """
        filters = {
            "products": tuple(self.selected_products),
            "contracts": tuple(self.contracts),
            "admission": tuple(self.admission),
            "discharge": tuple(self.discharge),
            "months": tuple(self.months),
            "sex": tuple(self.sex),
            "age": tuple(self.age),
            "duration": tuple(self.duration),
        }
        excluded = set(exclude)
        unknown = excluded.difference(filters)
        if unknown:
            raise ValueError(f"Nieznane filtry do pominięcia: {sorted(unknown)}")
        return tuple(sorted((key, value) for key, value in filters.items() if key not in excluded))
