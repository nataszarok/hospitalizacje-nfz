from __future__ import annotations
from collections.abc import Callable
import pandas as pd
import plotly.graph_objects as go

def make_admission_comparison_chart(facility_stats: pd.DataFrame):
    fig=go.Figure()
    if facility_stats.empty:return fig
    custom=facility_stats[["Świadczeniodawca","NIP_PODMIOTU","OW_NFZ","Miejscowość","planowane","nagle","razem_planowane_nagle"]].to_numpy()
    fig.add_trace(go.Scatter(x=facility_stats["planowane"],y=facility_stats["nagle"],mode="markers",name="Placówki",marker=dict(size=10,opacity=.75),customdata=custom,hovertemplate="<b>%{customdata[0]}</b><br>NIP: %{customdata[1]}<br>OW NFZ: %{customdata[2]}<br>Miejscowość: %{customdata[3]}<br><br>Przyjęcia planowane (kod 6): <b>%{customdata[4]:,.0f}</b><br>Przyjęcia nagłe (kody 2+3): <b>%{customdata[5]:,.0f}</b><br>Razem w porównaniu: %{customdata[6]:,.0f}<br><br>Każdy punkt reprezentuje jedną placówkę = unikalną parę OW NFZ + NIP.<extra></extra>"))
    fig.update_layout(template="plotly_white",xaxis_title="Liczba przyjęć planowanych (kod 6)",yaxis_title="Liczba przyjęć nagłych (kody 2 + 3)",paper_bgcolor="#FFFFFF",plot_bgcolor="#FFFFFF",font=dict(color="#172033",family="Arial"),hoverlabel=dict(bgcolor="#FFFFFF",font_color="#111111",bordercolor="#B8BDC7"),showlegend=False,margin=dict(l=20,r=20,t=30,b=50),height=650)
    fig.update_xaxes(showgrid=True,gridcolor="#EEF1F5",zeroline=False); fig.update_yaxes(showgrid=True,gridcolor="#EEF1F5",zeroline=False); return fig

def make_scatter(df: pd.DataFrame, selected_ow:list[str], selected_products:list[str], selected_cities:list[str], region_names:dict[str,str], colors:list[str], symbols:list[str], product_legend_label:Callable[[str],str]):
    fig=go.Figure(); work=df.copy(); work["OW_NFZ"]=work["OW_NFZ"].astype(str).str.zfill(2); work["KOD_PRODUKTU_JEDNOSTKOWEGO"]=work["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str)
    selected_ow=[str(x).zfill(2) for x in selected_ow]; selected_products=[str(x) for x in selected_products]; selected_cities=[str(x).strip() for x in selected_cities if str(x).strip()]
    color_map={x:colors[i%len(colors)] for i,x in enumerate(selected_ow)}; city_color_map={x:colors[(i+len(selected_ow))%len(colors)] for i,x in enumerate(selected_cities)}; symbol_map={x:("circle" if len(selected_products)==1 else symbols[i%len(symbols)]) for i,x in enumerate(selected_products)}
    cols=["Świadczeniodawca","NIP_PODMIOTU","OW_NFZ","Województwo","Miejscowość","zgony","KOD_PRODUKTU_JEDNOSTKOWEGO"]
    hover="<b>%{customdata[0]}</b><br>NIP: %{customdata[1]}<br>OW NFZ: %{customdata[2]}<br>Województwo: %{customdata[3]}<br>Miejscowość: %{customdata[4]}<br>Produkt: %{customdata[6]}<br>Hospitalizacje: %{x:,.0f}<br>Zgony: %{customdata[5]:,.0f}<br>Śmiertelność: %{y:.2f}%<extra></extra>"
    highlighted=work["OW_NFZ"].isin(selected_ow)|work["Miejscowość"].astype(str).str.strip().isin(selected_cities)
    def add(part,name,marker,legendgroup=None):
        if not part.empty: fig.add_trace(go.Scatter(x=part["hospitalizacje_ogolem"],y=part["smiertelnosc_proc"],mode="markers",name=name,legendgroup=legendgroup,marker=marker,customdata=part[cols],hovertemplate=hover))
    for p in selected_products:
        part=work[(~highlighted)&(work["KOD_PRODUKTU_JEDNOSTKOWEGO"]==p)]; add(part,f"Pozostałe · {product_legend_label(p)}",dict(color="#C7CBD1",symbol=symbol_map[p],size=9,opacity=.68),f"product-{p}")
    for region in selected_ow:
        for p in selected_products:
            part=work[(work["OW_NFZ"]==region)&(~work["Miejscowość"].astype(str).str.strip().isin(selected_cities))&(work["KOD_PRODUKTU_JEDNOSTKOWEGO"]==p)]; add(part,f"{region_names.get(region,f'OW NFZ {region}')} · {product_legend_label(p)}",dict(color=color_map[region],symbol=symbol_map[p],size=11,opacity=.94))
    for city in selected_cities:
        for p in selected_products:
            part=work[(work["Miejscowość"].astype(str).str.strip()==city)&(work["KOD_PRODUKTU_JEDNOSTKOWEGO"]==p)]; add(part,f"{city} · {product_legend_label(p)}",dict(color=city_color_map[city],symbol=symbol_map[p],size=12,opacity=.96,line=dict(width=1,color="#4B5563")))
    fig.update_layout(template="plotly_white",xaxis_title="Liczba hospitalizacji",yaxis_title="Śmiertelność (%)",hovermode="closest",paper_bgcolor="#FFFFFF",plot_bgcolor="#FFFFFF",font=dict(color="#172033",family="Arial"),hoverlabel=dict(bgcolor="#FFFFFF",font_color="#111111",bordercolor="#B8BDC7"),legend=dict(orientation="h",yanchor="bottom",y=1.02,xanchor="left",x=0,font=dict(color="#111111")),margin=dict(l=20,r=20,t=70,b=20),height=650)
    fig.update_xaxes(showgrid=True,gridcolor="#EEF1F5",zeroline=False,linecolor="#6B7280",tickfont=dict(color="#111111"),title_font=dict(color="#111111")); fig.update_yaxes(showgrid=True,gridcolor="#EEF1F5",zeroline=False,linecolor="#6B7280",tickfont=dict(color="#111111"),title_font=dict(color="#111111")); return fig
