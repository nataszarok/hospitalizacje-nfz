APP_CSS = r'''<style>
:root{--app-ink:#172033;--app-muted:#667085;--app-border:#E6EAF0;--app-soft:#F7F9FC;--app-accent:#2856A3;--app-accent-soft:#EEF4FF}.stApp{background:#FFF;color:var(--app-ink)}.block-container{max-width:1480px;padding-top:.85rem;padding-bottom:2rem}[data-testid="stSidebar"]{border-right:1px solid var(--app-border);background:#FAFBFD}[data-testid="stSidebar"] .block-container{padding-top:1.1rem}[data-testid="stMetric"]{background:#FFF;border:1px solid var(--app-border);border-radius:10px;padding:.62rem .85rem;box-shadow:0 1px 2px rgba(16,24,40,.025);min-height:88px;height:88px;width:100%;box-sizing:border-box}[data-testid="stMetricLabel"]{color:var(--app-muted);font-size:.76rem}[data-testid="stMetricValue"]{color:var(--app-ink);letter-spacing:-.02em;font-size:1.45rem;line-height:1.08}[data-testid="stMetricDelta"]{font-size:.72rem;line-height:1.05}[data-testid="stPlotlyChart"]{background:#FFF;border:1px solid var(--app-border);border-radius:12px;padding:.15rem;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.03)}div[data-baseweb="tab-list"]{gap:.25rem;border-bottom:1px solid var(--app-border);margin-top:.15rem}button[data-baseweb="tab"]{font-weight:650;padding:.55rem .9rem}.app-header{margin:0 0 .15rem 0}.app-title{color:var(--app-ink);font-size:clamp(1.45rem,2vw,1.85rem);line-height:1.05;font-weight:760;letter-spacing:-.03em;margin:0}.app-subtitle{color:var(--app-muted);font-size:.82rem;line-height:1.35;margin-top:.12rem}.chart-heading{color:var(--app-ink);font-size:1rem;font-weight:700;line-height:1.2;margin:.2rem 0 0}.chart-context{color:var(--app-muted);font-size:.76rem;line-height:1.35;margin:.12rem 0 .35rem}.sidebar-kicker{color:#667085;font-size:.7rem;font-weight:750;letter-spacing:.07em;text-transform:uppercase;margin-top:.4rem;margin-bottom:.12rem}.footer-note{color:#7B8494;font-size:.76rem;line-height:1.5;padding-top:1rem;border-top:1px solid var(--app-border);margin-top:1.4rem}@media(max-width:900px){.block-container{padding-left:1rem;padding-right:1rem}}
</style>'''

def header_html(year:str)->str:
    return f'<div class="app-header"><h1 class="app-title">Hospitalizacje w Polsce</h1><div class="app-subtitle">Analiza wolumenu, śmiertelności i trybu przyjęcia · NFZ {year}</div></div>'

def about_markdown(year:str)->str:
    return f'''**Hospitalizacje {year}** to rozwijane narzędzie do eksploracji danych hospitalizacyjnych za {year} rok. Obecne MVP obejmuje analizę wolumenu i śmiertelności oraz porównanie przyjęć planowych i nagłych.

**Zakres analizy:** hospitalizacje, zgony, śmiertelność, tryb przyjęcia oraz przekroje produktowe i geograficzne.  
**Jednostka placówki:** unikalna para **OW NFZ + NIP**.  
**Jak korzystać:** wybierz produkt i filtry w panelu bocznym, a następnie przełączaj moduły analityczne.

**Interpretacja:** dashboard służy do analizy danych zagregowanych, a nie do oceny jakości pojedynczej placówki bez kontekstu. Wartości źródłowe oznaczone jako `<5` są przeliczane zgodnie z metodą wybraną w panelu bocznym.

**Ludność:** wariant osi X „hospitalizacje / 100 000 mieszkańców” wykorzystuje ludność województw wg GUS, stan na 31.12.2024. Mianownik jest przypisany według OW NFZ placówki, a nie miejsca zamieszkania pacjenta.'''

def footer_html(year:str)->str:
    return f'<div class="footer-note"><b>Hospitalizacje {year} · MVP panelu analitycznego.</b> Wartości oznaczone jako &lt;5 nie są dokładnymi liczbami. Metoda konserwatywna przyjmuje 1, a metoda symulacyjna korzysta z zapisanych wartości 1–4 (seed zapisany w bazie, prawdopodobieństwa ∝ exp(-x)).</div>'
