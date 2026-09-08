APP_CSS = r'''<style>
:root{--app-ink:#172033;--app-muted:#667085;--app-border:#E6EAF0;--app-soft:#F7F9FC;--app-accent:#2856A3;--app-accent-soft:#EEF4FF}.stApp{background:#FFF;color:var(--app-ink)}.block-container{max-width:1480px;padding-top:1.65rem;padding-bottom:2.5rem}[data-testid="stSidebar"]{border-right:1px solid var(--app-border);background:#FAFBFD}[data-testid="stSidebar"] .block-container{padding-top:1.4rem}[data-testid="stMetric"]{background:#FFF;border:1px solid var(--app-border);border-radius:12px;padding:.8rem .95rem;box-shadow:0 1px 2px rgba(16,24,40,.03);min-height:0}[data-testid="stMetricLabel"]{color:var(--app-muted);font-size:.78rem}[data-testid="stMetricValue"]{color:var(--app-ink);letter-spacing:-.02em;font-size:1.55rem;line-height:1.12}[data-testid="stPlotlyChart"]{background:#FFF;border:1px solid var(--app-border);border-radius:14px;padding:.25rem;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.035)}div[data-baseweb="tab-list"]{gap:.35rem;border-bottom:1px solid var(--app-border)}button[data-baseweb="tab"]{font-weight:650;padding-left:1rem;padding-right:1rem}div[data-testid="stExpander"]{border:1px solid var(--app-border);border-radius:10px}.app-eyebrow{color:var(--app-accent);font-size:.76rem;font-weight:750;letter-spacing:.09em;text-transform:uppercase;margin-bottom:.2rem}.app-title{color:var(--app-ink);font-size:clamp(1.75rem,2.6vw,2.45rem);line-height:1.04;font-weight:760;letter-spacing:-.035em;margin:0}.app-subtitle{color:var(--app-muted);max-width:900px;font-size:.94rem;line-height:1.45;margin-top:.18rem}.section-title{color:var(--app-ink);font-size:1.28rem;line-height:1.25;font-weight:730;margin:0}.section-copy{color:var(--app-muted);font-size:.88rem;line-height:1.5;margin:.3rem 0 .8rem}.sidebar-kicker{color:#667085;font-size:.7rem;font-weight:750;letter-spacing:.07em;text-transform:uppercase;margin-top:.45rem;margin-bottom:.15rem}.footer-note{color:#7B8494;font-size:.76rem;line-height:1.5;padding-top:1rem;border-top:1px solid var(--app-border);margin-top:1.6rem}@media(max-width:900px){.block-container{padding-left:1rem;padding-right:1rem}}
</style>'''

def header_html(year:str)->str:
    return f'<div class="app-eyebrow">Panel analityczny · Polska · {year}</div><h1 class="app-title">Hospitalizacje {year}</h1><div class="app-subtitle">Interaktywna analiza hospitalizacji, wyników leczenia i trybów przyjęcia na poziomie placówek i regionów.</div>'

def about_markdown(year:str)->str:
    return f'''**Hospitalizacje {year}** to rozwijane narzędzie do eksploracji danych hospitalizacyjnych za {year} rok. Obecne MVP obejmuje analizę wolumenu i śmiertelności oraz porównanie przyjęć planowych i nagłych.

**Zakres analizy:** hospitalizacje, zgony, śmiertelność, tryb przyjęcia oraz przekroje produktowe i geograficzne.  
**Jednostka placówki:** unikalna para **OW NFZ + NIP**.  
**Jak korzystać:** wybierz produkt i filtry w panelu bocznym, a następnie przełączaj moduły analityczne.

**Interpretacja:** dashboard służy do analizy danych zagregowanych, a nie do oceny jakości pojedynczej placówki bez kontekstu. Wartości źródłowe oznaczone jako `<5` są przeliczane zgodnie z metodą wybraną w panelu bocznym.'''

def footer_html(year:str)->str:
    return f'<div class="footer-note"><b>Hospitalizacje {year} · MVP panelu analitycznego.</b> Wartości oznaczone jako &lt;5 nie są dokładnymi liczbami. Metoda konserwatywna przyjmuje 1, a metoda symulacyjna korzysta z zapisanych wartości 1–4 (seed zapisany w bazie, prawdopodobieństwa ∝ exp(-x)).</div>'
