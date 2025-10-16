from reportlab.lib.pagesizes import A2  # Página maior para mais espaço
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from datetime import datetime
from io import BytesIO

def gerar_pdf_bytes(drfa_externo, drfa_interno, dados):
    buffer = BytesIO()

    # Documento com margens ajustadas
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A2,  # ✅ Página A2 para mais espaço
        leftMargin=30*mm,
        rightMargin=30*mm,
        topMargin=30*mm,
        bottomMargin=30*mm
    )

    estilos = getSampleStyleSheet()
    estilos.add(ParagraphStyle(name="CustomTitle", alignment=1, fontSize=24, spaceAfter=20))
    estilos.add(ParagraphStyle(name="CustomInfo", fontSize=14, textColor=colors.HexColor("#333333")))

    # Estilo para cabeçalho da tabela
    header_style = ParagraphStyle(
        name="HeaderStyle",
        fontSize=14,
        alignment=1,  # Centralizado
        textColor=colors.white,
        fontName="Helvetica-Bold"
    )

    elementos = []

    # Título
    elementos.append(Paragraph("Acute Diet Calculator", estilos["CustomTitle"]))

    # Informações DRFA
    info_text = (
        f"<b>DRFA Externo:</b> {drfa_externo} &nbsp;&nbsp; "
        f"<b>DRFA Interno:</b> {drfa_interno}<br/>"
        f"<font size=12>Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}</font>"
    )
    elementos.append(Paragraph(info_text, estilos["CustomInfo"]))
    elementos.append(Spacer(1, 20))

    # ✅ Cabeçalho com quebra de linha usando <br/>
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

    # Adiciona dados
    for item in dados:
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
            item.get("%DRFA SYNGENTA", "-")
        ])

    # ✅ Larguras maiores para A2
    col_widths = [120, 60, 90, 80, 70, 70, 70, 150, 100, 100]

    tabela = Table(linhas, colWidths=col_widths, repeatRows=1)

    # Estilo da tabela
    tabela.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4CAF50")),  # Cabeçalho verde
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),  # Centraliza verticalmente
        ('ALIGN', (0, 1), (3, -1), 'LEFT'),
        ('ALIGN', (4, 1), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 1), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 14),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('WORDWRAP', (0, 1), (-1, -1), True),
    ]))

    elementos.append(tabela)
    doc.build(elementos)
    buffer.seek(0)
    return buffer.read()