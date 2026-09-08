from __future__ import annotations
import pandas as pd
import streamlit as st
from dashboard.domain.analytics import area_product_stats, dataset_summary, admission_facility_stats
from .charts import make_scatter, make_admission_comparison_chart
from .components import compact_stats_html, metric_display_value

def render_kpis(cards):
    cols=st.columns(len(cards),gap="small")
    for col,card in zip(cols,cards):
        with col: st.metric(card["label"],metric_display_value(card["value"],card.get("baseline")),help=card.get("tooltip"),border=True)

def render_mortality(*, result:pd.DataFrame, result_all:pd.DataFrame, min_hosp:int, state, refs, product_meta, product_legend):
    st.markdown('<div class="section-copy"><b>Wolumen hospitalizacji a śmiertelność.</b> Każdy punkt reprezentuje placówkę; wyróżnienia geograficzne zachowują pozostałe placówki jako tło porównawcze.</div>',unsafe_allow_html=True)
    if result.empty:
        st.warning("Brak placówek spełniających wybrany próg liczby hospitalizacji."); return
    cur=dataset_summary(result); base=dataset_summary(result_all); ctx=(f"Aktywny próg: ≥ {min_hosp}. Format: po progu / bez progu. " if min_hosp>0 else "Próg wolumenu jest wyłączony. ")
    render_kpis([
        {"label":"Placówki","value":f"{cur['placowki']:,}".replace(","," "),"baseline":f"{base['placowki']:,}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx+"Placówka = OW NFZ + NIP."},
        {"label":"Hospitalizacje","value":f"{cur['hospitalizacje']:,.0f}".replace(","," "),"baseline":f"{base['hospitalizacje']:,.0f}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx+"Suma hospitalizacji."},
        {"label":"Zgony","value":f"{cur['zgony']:,.0f}".replace(","," "),"baseline":f"{base['zgony']:,.0f}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx+"Suma zgonów."},
        {"label":"Śmiertelność ogółem","value":f"{cur['smiertelnosc']:.2f}%","baseline":f"{base['smiertelnosc']:.2f}%" if min_hosp>0 else None,"tooltip":ctx+"Suma zgonów / suma hospitalizacji × 100."},])
    chart_col,stats_col=st.columns([4.25,1.1],gap="medium")
    with chart_col:
        fig=make_scatter(result,state.selected_ow if state.view_mode=="Województwa" else [],state.selected_products,state.selected_cities if state.view_mode=="Miasta" else [],refs.regions,refs.highlight_colors,refs.product_symbols,product_legend)
        st.plotly_chart(fig,use_container_width=True,theme=None,config={"displaylogo":False},key="chart_regions" if state.view_mode=="Województwa" else "chart_cities")
    with stats_col:
        area_col="OW_NFZ" if state.view_mode=="Województwa" else "Miejscowość"; selected=state.selected_ow if area_col=="OW_NFZ" else state.selected_cities; st.markdown("#### Województwa" if area_col=="OW_NFZ" else "#### Miasta")
        if not selected: st.caption("Wybierz obszar w panelu po lewej.")
        else:
            labels={p:product_legend(p) for p in state.selected_products}; names=refs.regions if area_col=="OW_NFZ" else None
            stats=area_product_stats(result,area_col,selected,product_labels=labels,area_names=names); baseline=area_product_stats(result_all,area_col,selected,product_labels=labels,area_names=names) if min_hosp>0 else {}
            for name,rows in stats.items(): st.markdown(compact_stats_html(name,rows,baseline.get(name)),unsafe_allow_html=True)
    with st.expander("Tabela danych · wolumen i śmiertelność"):
        cols=["Świadczeniodawca","NIP_PODMIOTU","KOD_PRODUKTU_JEDNOSTKOWEGO","OW_NFZ","Województwo","Miejscowość","hospitalizacje_ogolem","zgony","smiertelnosc_proc"]
        table=result[cols].copy(); table.insert(3,"Nazwa produktu",table["KOD_PRODUKTU_JEDNOSTKOWEGO"].map(lambda x:product_meta.get(str(x),{}).get("name",""))); table["smiertelnosc_proc"]=table["smiertelnosc_proc"].round(2); st.dataframe(table,use_container_width=True,hide_index=True)

def render_admissions(*, admission_data:pd.DataFrame, min_hosp:int):
    st.markdown('<div class="section-title">Przyjęcia planowane a nagłe</div><div class="section-copy">Każdy punkt to jedna placówka. Oś X pokazuje przyjęcia planowane (kod 6), a oś Y sumę przyjęć nagłych (kody 2 i 3).</div>',unsafe_allow_html=True)
    st.info("W tym module filtr „Kod trybu przyjęcia” z panelu bocznego jest celowo pomijany. Porównanie zawsze obejmuje kody 6 vs 2+3.")
    all_stats=admission_facility_stats(admission_data); stats=all_stats[all_stats["razem_planowane_nagle"]>=min_hosp].copy() if min_hosp>0 and not all_stats.empty else all_stats.copy()
    if stats.empty: st.warning("Brak placówek spełniających warunki porównania kodów przyjęcia 2, 3 i 6."); return
    p=stats["planowane"].sum(); u=stats["nagle"].sum(); ap=all_stats["planowane"].sum(); au=all_stats["nagle"].sum(); n=stats[["OW_NFZ","NIP_PODMIOTU"]].drop_duplicates().shape[0]; an=all_stats[["OW_NFZ","NIP_PODMIOTU"]].drop_duplicates().shape[0]; ctx=(f"Aktywny próg: ≥ {min_hosp}. Format: po progu / bez progu. " if min_hosp>0 else "Próg wyłączony. ")
    render_kpis([{"label":"Placówki","value":f"{n:,}".replace(","," "),"baseline":f"{an:,}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx},{"label":"Planowane (6)","value":f"{p:,.0f}".replace(","," "),"baseline":f"{ap:,.0f}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx},{"label":"Nagłe (2+3)","value":f"{u:,.0f}".replace(","," "),"baseline":f"{au:,.0f}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx},{"label":"Planowane + nagłe","value":f"{p+u:,.0f}".replace(","," "),"baseline":f"{ap+au:,.0f}".replace(","," ") if min_hosp>0 else None,"tooltip":ctx}])
    st.plotly_chart(make_admission_comparison_chart(stats),use_container_width=True,theme=None,config={"displaylogo":False},key="admission_scatter_nominal")
    with st.expander("Tabela danych · tryby przyjęcia"):
        table=stats.rename(columns={"planowane":"Planowane (6)","nagle":"Nagłe (2+3)","razem_planowane_nagle":"Planowane + nagłe"}); st.dataframe(table[["Świadczeniodawca","NIP_PODMIOTU","OW_NFZ","Miejscowość","Planowane (6)","Nagłe (2+3)","Planowane + nagłe"]],use_container_width=True,hide_index=True)
