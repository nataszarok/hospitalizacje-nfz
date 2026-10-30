"""Pobiera umowy świadczeniodawcy z publicznego API NFZ „Umowy” do data/.

Zapisuje data/nfz_umowy_<kod>.json: umowy z kwotami i pozycje planu każdej umowy.
API pozwala na 10 zapytań na sekundę, więc skrypt czeka między zapytaniami.

Użycie:
    python3 scripts/fetch_nfz_agreements.py --provider 09R/010019 --branch 09 --years 2019-2025
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.nfz.gov.pl/app-umw-api"
# API odrzuca domyślny nagłówek User-Agent biblioteki urllib.
HEADERS = {"User-Agent": "curl/8.7.1", "Accept": "application/json"}
PAUSE_SECONDS = 0.5


def get(url: str) -> dict:
    for attempt in range(5):
        request = urllib.request.Request(url, headers=HEADERS)
        raw = urllib.request.urlopen(request, timeout=60).read().decode("utf-8")
        if raw.startswith("{"):
            time.sleep(PAUSE_SECONDS)
            return json.loads(raw)
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"API NFZ nie zwróciło JSON-a dla {url}: {raw[:120]}")


def pages(url: str, key: str):
    while url:
        data = get(url)
        yield from data["data"][key]
        url = data["links"].get("next")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", default="09R/010019")
    parser.add_argument("--branch", default="09")
    parser.add_argument("--years", default="2019-2025")
    args = parser.parse_args()
    first, _, last = args.years.partition("-")
    years = range(int(first), int(last or first) + 1)

    agreements = []
    for year in years:
        query = urllib.parse.urlencode({
            "year": year, "branch": args.branch, "providerCode": args.provider,
            "limit": 25, "format": "json", "api-version": "1.2",
        })
        for agreement in pages(f"{API}/agreements?{query}", "agreements"):
            attributes = agreement["attributes"]
            detail = f"{API}/agreements/{agreement['id']}?limit=25&format=json&api-version=1.2"
            plans = [plan["attributes"] for plan in pages(detail, "plans")]
            agreements.append({
                "year": year,
                "code": attributes["code"],
                "serviceType": attributes["service-type"],
                "serviceName": attributes["service-name"],
                "amount": attributes["amount"],
                "plans": [
                    {"productCode": plan["product-code"], "productName": plan["product-name"], "price": plan["price"]}
                    for plan in plans
                ],
            })
            print(f"{year} {attributes['service-name']}: {attributes['amount']:,.0f} zł, {len(plans)} pozycji")

    output = ROOT / "data" / f"nfz_umowy_{args.provider.replace('/', '_')}.json"
    output.write_text(json.dumps({"provider": args.provider, "branch": args.branch, "agreements": agreements},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Zapisano {output.relative_to(ROOT)}: {len(agreements)} umów.")


if __name__ == "__main__":
    main()
