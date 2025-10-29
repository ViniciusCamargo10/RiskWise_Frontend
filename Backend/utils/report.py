# utils/report.py
from reportlab.lib.pagesizes import A2  # (opcional trocar para A4)
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from datetime import datetime
from io import BytesIO


# --------- estilos e utilidades ----------
def _estilos():
    estilos = getSampleStyleSheet()
    if "CustomTitle" not in estilos:
        estilos.add(ParagraphStyle(name="CustomTitle", alignment=1, fontSize=24, spaceAfter=20))
    if "CustomInfo" not in estilos:
        estilos.add(ParagraphStyle(name="CustomInfo", fontSize=14, textColor=colors.HexColor("#333333")))
    header_style = ParagraphStyle(
        name="HeaderStyle",
        fontSize=14,
        alignment=1,
        textColor=colors.white,
        fontName="Helvetica-Bold"
    )
    return estilos, header_style

def _table_style(header_bg="#4CAF50"):
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_bg)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('ALIGN', (0, 1), (3, -1), 'LEFT'),
        ('ALIGN', (4, 1), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 1), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 14),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
    ])

def _doc():
    return dict(pagesize=A2, leftMargin=30*mm, rightMargin=30*mm, topMargin=30*mm, bottomMargin=30*mm)


# --------- POF ----------
def _pof_table(pof_dict):
    """
    pof_dict esperado:
    {
      "PC_Kg": {...},
      "%IDA_ANVISA": {...},
      "%IDA_SYNGENTA": {...}
    }
    """

    regioes = ["Brasil", "Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"]

    def _get_region(d, metrica, reg, default="—"):
        obj = (d or {}).get(metrica) or {}
        if reg in obj:
            return obj.get(reg)
        if reg == "Centro-Oeste":
            # tenta variação com underline
            return obj.get("Centro_Oeste", default)
        return default

    linhas = [
        ["Métrica"] + regioes,
        ["PC (Kg)"]     + [_get_region(pof_dict, "PC_Kg", r)         for r in regioes],
        ["IDA_EXTERNA"] + [_get_region(pof_dict, "%IDA_ANVISA", r)   for r in regioes],
        ["IDA_INTERNA"] + [_get_region(pof_dict, "%IDA_SYNGENTA", r) for r in regioes],
    ]
    table = Table(linhas, colWidths=[100] + [80]*6, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#455A64")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    return table


# --------- Acute (seção) ----------

def _acute_section(drfa_externo, drfa_interno, dados):
    estilos, header_style = _estilos()
    elementos = []

    elementos.append(Paragraph("Acute Diet Calculator", estilos["CustomTitle"]))
    # 🔧 NÃO escapar tags HTML no Paragraph
    info_text = (
        f"<b>DRFA Externo:</b> {drfa_externo} &nbsp;&nbsp; "
        f"<b>DRFA Interno:</b> {drfa_interno}<br/>"
        f"<font size=12>Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}</font>"
    )
    elementos.append(Paragraph(info_text, estilos["CustomInfo"]))
    elementos.append(Spacer(1, 20))

    cabecalho = [
        Paragraph("Cultivo", header_style),
        Paragraph("ANO<br/>POF", header_style),
        Paragraph("Região", header_style),
        Paragraph("Caso<br/>Fórmula", header_style),
        Paragraph("LMR<br/>(mg/kg)", header_style),
        Paragraph("HR/MCR", header_style),
        Paragraph("MREC/STMR", header_style),
        Paragraph("IMEA", header_style),
        Paragraph("%DRFA<br/>Externo", header_style),
        Paragraph("%DRFA<br/>Interno", header_style)
    ]

    linhas = [cabecalho]
    for item in dados or []:
        linhas.append([
            item.get("Cultivo/ Matriz Animal", "-"),
            item.get("ANO POF", "-"),
            item.get("Região", "-"),
            item.get("Caso Fórmula", "-"),
            item.get("LMR (mg/kg)", "-"),
            item.get("HR/MCR (mg/kg)", "-"),
            item.get("MREC/STMR (mg/kg)", "-"),
            item.get("IMEA (mg/kg p.c./dia)", "-"),
            item.get("%DRFA ANVISA", "-"),
            item.get("%DRFA SYNGENTA", "-"),
        ])

    col_widths = [120, 60, 90, 80, 70, 70, 70, 150, 100, 100]
    tabela = Table(linhas, colWidths=col_widths, repeatRows=1)
    tabela.setStyle(_table_style("#4CAF50"))
    elementos.append(tabela)
    return elementos


# --------- Chronic (seção) ----------

def _chronic_section(ida_externo, ida_interno, chronic_rows, pof2008=None, pof2017=None):
    estilos, header_style = _estilos()
    elementos = []

    elementos.append(Paragraph("Chronic DRA Calculator", estilos["CustomTitle"]))
    info_text = (
        f"<b>IDA Externo:</b> {ida_externo} &nbsp;&nbsp; "
        f"<b>IDA Interno:</b> {ida_interno}<br/>"
        f"<font size=12>Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}</font>"
    )
    elementos.append(Paragraph(info_text, estilos["CustomInfo"]))
    elementos.append(Spacer(1, 20))

    cabecalho = [
        Paragraph("Cultivo", header_style),
        Paragraph("ANO<br/>POF", header_style),
        Paragraph("Região", header_style),
        Paragraph("LMR<br/>(mg/kg)", header_style),
        Paragraph("MREC_STMR<br/>(mg/kg)", header_style),
        Paragraph("Market<br/>Share (%)", header_style),
        Paragraph("IDMT<br/>(%)", header_style),
        Paragraph("Contribuição<br/>Individual (%)", header_style),
    ]

    linhas = [cabecalho]
    for item in chronic_rows or []:
        linhas.append([
            item.get("Cultivo", "-"),
            item.get("ANO_POF", "-"),
            item.get("Região", "-"),
            item.get("LMR (mg_kg)", item.get("LMR (mg/kg)", "-")),
            item.get("MREC_STMR (mg_kg)", item.get("MREC_STMR (mg/kg)", "-")),
            item.get("Market Share (%)", item.get("Market Share", "-")),
            item.get("IDMT (%)", item.get("IDMT (Numerador)", "-")),
            item.get("Contribuição Individual do Cultivo (%)", item.get("Contribuição Individual do Cultivo", "-")),
        ])

    col_widths = [150, 60, 90, 90, 110, 120, 160, 170]
    tabela = Table(linhas, colWidths=col_widths, repeatRows=1)
    tabela.setStyle(_table_style("#1976D2"))
    elementos.append(tabela)
    elementos.append(Spacer(1, 24))

    if pof2008:
        elementos.append(Paragraph("POF 2008", estilos["CustomTitle"]))
        elementos.append(_pof_table(pof2008))
        elementos.append(Spacer(1, 16))

    if pof2017:
        elementos.append(Paragraph("POF 2017", estilos["CustomTitle"]))
        elementos.append(_pof_table(pof2017))

    return elementos


# --------- Water Acute (seção) ----------

def _water_section(water_data):
    estilos, header_style = _estilos()
    elems = []
    elems.append(Paragraph("Water Acute Calculator", estilos["CustomTitle"]))

    # 🔧 NÃO escapar tags
    w_ext = water_data.get("DRFA Externo", "-")
    w_int = water_data.get("DRFA Interno", "-")
    elems.append(Paragraph(
        f"<b>DRFA Externo:</b> {w_ext} &nbsp;&nbsp; <b>DRFA Interno:</b> {w_int}",
        estilos["CustomInfo"]
    ))
    elems.append(Spacer(1, 12))

    cabecalho = [
        Paragraph("Concentração", header_style),
        Paragraph("Peso Adulto", header_style),
        Paragraph("Peso Criança", header_style),
        Paragraph("%DRFA Interno Adulto", header_style),
        Paragraph("%DRFA Externo Adulto", header_style),
        Paragraph("%DRFA Interno Criança", header_style),
        Paragraph("%DRFA Externo Criança", header_style)
    ]
    linha_dados = [
        water_data.get("Concentração", "-"),
        water_data.get("Peso Adulto", "-"),
        water_data.get("Peso Criança", "-"),
        water_data.get("%DRFA Interno Adulto", "-"),
        water_data.get("%DRFA Externo Adulto", "-"),
        water_data.get("%DRFA Interno Criança", "-"),
        water_data.get("%DRFA Externo Criança", "-")
    ]

    tabela = Table([cabecalho, linha_dados], colWidths=[100, 100, 100, 120, 120, 120, 120], repeatRows=1)
    tabela.setStyle(_table_style("#009688"))
    elems.append(tabela)
    return elems

def _water_chronic_section(water_chr_data):
    estilos, header_style = _estilos()
    elems = []
    elems.append(Paragraph("Water Chronic Calculator", estilos["CustomTitle"]))

    ida_ext = water_chr_data.get("IDA Externo", "-")
    ida_int = water_chr_data.get("IDA Interno", "-")
    elems.append(Paragraph(
        f"<b>IDA Externo:</b> {ida_ext} &nbsp;&nbsp; <b>IDA Interno:</b> {ida_int}",
        estilos["CustomInfo"]
    ))
    elems.append(Spacer(1, 12))

    cabecalho = [
        Paragraph("Concentração", header_style),
        Paragraph("Peso Adulto", header_style),
        Paragraph("Peso Criança", header_style),
        Paragraph("%IDA Interno Adulto", header_style),
        Paragraph("%IDA Externo Adulto", header_style),
        Paragraph("%IDA Interno Criança", header_style),
        Paragraph("%IDA Externo Criança", header_style)
    ]
    linha_dados = [
        water_chr_data.get("Concentração", "-"),
        water_chr_data.get("Peso Adulto", "-"),
        water_chr_data.get("Peso Criança", "-"),
        water_chr_data.get("%IDA Interno Adulto", "-"),
        water_chr_data.get("%IDA Externo Adulto", "-"),
        water_chr_data.get("%IDA Interno Criança", "-"),
        water_chr_data.get("%IDA Externo Criança", "-")
    ]

    tabela = Table([cabecalho, linha_dados], colWidths=[100, 100, 100, 120, 120, 120, 120], repeatRows=1)
    tabela.setStyle(_table_style("#3F51B5"))  # cor diferente para crônico
    elems.append(tabela)
    return elems


def _mexico_chronic_section(mexico_data, mexico_results):
    estilos, header_style = _estilos()
    elems = []
    elems.append(Paragraph("Mexico Chronic Calculator", estilos["CustomTitle"]))

    # Tabela principal
    cabecalho = [
        Paragraph("Crop", header_style),
        Paragraph("Cultivo", header_style),
        Paragraph("LMR (mg/kg)", header_style),
        Paragraph("R (mg/kg)", header_style),
        Paragraph("C (Kg/person/day)", header_style),
        Paragraph("(LMR or R)*C", header_style)
    ]
    linhas = [cabecalho]
    for item in mexico_data or []:
        linhas.append([
            item.get("Crop", "-"),
            item.get("Cultivo", "-"),
            item.get("LMR (mg/kg)", "-"),
            item.get("R (mg/kg)", "-"),
            item.get("C (Kg/person/day)", "-"),
            item.get("(LMR or R)*C", "-")
        ])
    tabela = Table(linhas, colWidths=[120, 120, 120, 120, 120, 120], repeatRows=1)
    tabela.setStyle(_table_style("#F08C1B"))
    elems.append(tabela)
    elems.append(Spacer(1, 16))

    # Resultados consolidados
    resultados = [
        ["BW (kg)", "Sum", "ADI (mg/kg bw/dia)", "IDMT", "%ADI"],
        [
            mexico_results.get("bw", "-"),
            mexico_results.get("sum", "-"),
            mexico_results.get("adi", "-"),
            mexico_results.get("idmt", "-"),
            mexico_results.get("percentAdi", "-")
        ]
    ]
    tabela_resultados = Table(resultados, colWidths=[80, 180, 160, 180, 180])
    tabela_resultados.setStyle(_table_style("#F08F21"))
    elems.append(tabela_resultados)
    elems.append(Spacer(1, 24))
    return elems


# --------- APIs de geração (bytes) ----------
# Mantém compatibilidade com /acute/gerar-pdf
def gerar_pdf_bytes(drfa_externo, drfa_interno, dados):
    """Wrapper histórico: gera apenas a seção Acute."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, **_doc())
    elementos = _acute_section(drfa_externo, drfa_interno, dados)
    doc.build(elementos)
    buffer.seek(0)
    return buffer.read()

def gerar_pdf_acute_bytes(drfa_externo, drfa_interno, dados):
    return gerar_pdf_bytes(drfa_externo, drfa_interno, dados)

def gerar_pdf_chronic_bytes(ida_externo, ida_interno, chronic_rows, pof2008=None, pof2017=None):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, **_doc())
    elementos = _chronic_section(ida_externo, ida_interno, chronic_rows, pof2008, pof2017)
    doc.build(elementos)
    buffer.seek(0)
    return buffer.read()


def gerar_pdf_combinado(
    acute_drfa_externo, acute_drfa_interno,
    chronic_ida_externo=None, chronic_ida_interno=None,
    acute_rows=None, chronic_rows=None,
    pof2008=None, pof2017=None,
    water_data=None, water_chronic_data=None,
    incluir_water_acute=False, incluir_water_chronic=False,
    mexico=None
):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, **_doc())
    elementos = []

    # ---- Gates/flags
    temAcute = bool(acute_rows and len(acute_rows) > 0)
    temChronic = bool(chronic_rows and len(chronic_rows) > 0)
    temWaterAcute = bool(incluir_water_acute)
    temWaterChronic = bool(incluir_water_chronic)
    temMexico = bool(mexico and isinstance(mexico.get("data"), list) and len(mexico["data"]) > 0)

    if not (temAcute or temChronic or temWaterAcute or temWaterChronic or temMexico):
        estilos, _ = _estilos()
        elementos.append(Paragraph("Nenhum dado para gerar relatório.", estilos["Title"]))
        doc.build(elementos)
        buffer.seek(0)
        return buffer.read()

    # ---- Acute
    if temAcute:
        elementos.extend(_acute_section(acute_drfa_externo, acute_drfa_interno, acute_rows))
        if temChronic or temWaterChronic or temWaterAcute or temMexico:
            elementos.append(PageBreak())

    # ---- Chronic
    if temChronic:
        ida_ext = chronic_ida_externo if (chronic_ida_externo not in (None, "")) else "-"
        ida_int = chronic_ida_interno if (chronic_ida_interno not in (None, "")) else "-"
        elementos.extend(_chronic_section(ida_ext, ida_int, chronic_rows, pof2008, pof2017))
        if temWaterChronic or temWaterAcute or temMexico:
            elementos.append(PageBreak())

    # ---- Water Chronic
    if temWaterChronic:
        elementos.extend(_water_chronic_section(water_chronic_data or {}))
        if temWaterAcute or temMexico:
            elementos.append(PageBreak())

    # ---- Water Acute
    if temWaterAcute:
        elementos.extend(_water_section(water_data or {}))
        if temMexico:
            elementos.append(PageBreak())

    # ---- Mexico
    if temMexico:
        elementos.extend(_mexico_chronic_section(mexico["data"], mexico.get("results", {})))

    doc.build(elementos)
    buffer.seek(0)
    return buffer.read()