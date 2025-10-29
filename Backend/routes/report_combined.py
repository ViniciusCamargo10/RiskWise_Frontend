from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse
from typing import Any, Dict, List, Optional
from io import BytesIO
from datetime import date

from utils.report import gerar_pdf_combinado

router = APIRouter()


# -------------------------------
# Helpers de limpeza/filtragem
# -------------------------------
def _is_blank_like(val: Any) -> bool:
    """
    Considera 'vazio' tudo que não representa preenchimento real:
    "", "-", "—", "na", "n/a" (case-insensitive) ou None.
    """
    if val is None:
        return True
    s = str(val).strip().lower()
    return s in ("", "-", "—", "na", "n/a")


def _is_number_like(val: Any) -> bool:
    """
    True se for número ou string numérica (aceita vírgula e %).
    """
    if val is None:
        return False
    s = str(val).strip()
    if s == "" or s in ("-", "—"):
        return False
    s = s.replace("%", "").replace(",", ".")
    try:
        float(s)
        return True
    except Exception:
        return False


def _linhas_usuario_preencheu(
    dados: List[Dict[str, Any]],
    campos_editaveis: List[str]
) -> List[Dict[str, Any]]:
    """
    Mantém linhas onde o usuário interagiu em pelo menos 1 campo 'editável',
    aceitando números e strings (não vazios de acordo com _is_blank_like).
    """
    out: List[Dict[str, Any]] = []
    for row in (dados or []):
        for campo in campos_editaveis:
            if not _is_blank_like(row.get(campo)):
                out.append(row)
                break
    return out


def _linhas_usuario_digitou_string(
    dados: List[Dict[str, Any]],
    campos_editaveis: List[str]
) -> List[Dict[str, Any]]:
    """
    Reforço: mantém apenas linhas onde pelo menos 1 campo editável veio como STRING
    (indício de digitação manual no front) e não é 'blank-like'.
    """
    out: List[Dict[str, Any]] = []
    for row in (dados or []):
        for campo in campos_editaveis:
            v = row.get(campo)
            if isinstance(v, str):
                s = v.strip().lower()
                if s not in ("", "-", "—", "na", "n/a"):
                    out.append(row)
                    break
    return out


# -------------------------------
# Endpoint
# -------------------------------
@router.post("/gerar-pdf")
def gerar_pdf_completo(payload: Dict[str, Any] = Body(...)):
    try:
        # ---- Campos editáveis por calculadora
        acute_campos_editaveis = ["LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)"]
        chronic_campos_editaveis = ["LMR (mg_kg)", "LMR (mg/kg)", "MREC_STMR (mg_kg)", "MREC_STMR (mg/kg)"]
        mexico_campos_editaveis = ["LMR (mg/kg)", "R (mg/kg)"]  # só consideramos México se usuário preencheu LMR/R

        # ---- Entradas brutas
        acute_input: List[Dict[str, Any]] = payload.get("acute", []) or []
        chronic_input: List[Dict[str, Any]] = payload.get("chronic", []) or []

        # ---- Filtro 1 (não vazio)
        acute_base = _linhas_usuario_preencheu(acute_input, acute_campos_editaveis)
        chronic = _linhas_usuario_preencheu(chronic_input, chronic_campos_editaveis)

        # ---- Filtro 2 (somente o que foi digitado como STRING) - reforço p/ Acute
        acute_str_only = _linhas_usuario_digitou_string(acute_base, acute_campos_editaveis)
        acute = acute_str_only if acute_str_only else acute_base

        # ---- POFs
        pof2008: Optional[Dict[str, Any]] = payload.get("pof2008")
        pof2017: Optional[Dict[str, Any]] = payload.get("pof2017")

        # ---- DRFA (Acute Crop)
        drfa_externo: str = payload.get("acute_drfa_externo") or payload.get("drfa_externo") or "-"
        drfa_interno: str = payload.get("acute_drfa_interno") or payload.get("drfa_interno") or "-"

        # ---- Water Acute
        water_conc        = payload.get("water_conc", "-")
        water_adulto      = payload.get("water_adulto", "-")
        water_crianca     = payload.get("water_crianca", "-")
        water_int_adulto  = payload.get("water_int_adulto", "-")
        water_ext_adulto  = payload.get("water_ext_adulto", "-")
        water_int_crianca = payload.get("water_int_crianca", "-")
        water_ext_crianca = payload.get("water_ext_crianca", "-")
        water_drfa_ext    = payload.get("water_drfa_externo", "-")
        water_drfa_int    = payload.get("water_drfa_interno", "-")

        # Monta water_data (defesa extra); renderização respeita flags no report.py
        water_fields = [
            water_conc, water_adulto, water_crianca,
            water_int_adulto, water_ext_adulto, water_int_crianca, water_ext_crianca,
            water_drfa_ext, water_drfa_int
        ]
        water_data = None
        if any(str(v).strip() and str(v).strip() not in ("-", "—") for v in water_fields):
            water_data = {
                "DRFA Externo": water_drfa_ext,
                "DRFA Interno": water_drfa_int,
                "Concentração": water_conc,
                "Peso Adulto": water_adulto,
                "Peso Criança": water_crianca,
                "%DRFA Interno Adulto": water_int_adulto,
                "%DRFA Externo Adulto": water_ext_adulto,
                "%DRFA Interno Criança": water_int_crianca,
                "%DRFA Externo Criança": water_ext_crianca
            }

        # ---- Water Chronic
        wchr_conc        = payload.get("CRONICO_conc", "-")
        wchr_adulto      = payload.get("CRONICO_adulto", "-")
        wchr_crianca     = payload.get("CRONICO_crianca", "-")
        wchr_int_adulto  = payload.get("CRONICO_outIntAdulto", "-")
        wchr_ext_adulto  = payload.get("CRONICO_outExtAdulto", "-")
        wchr_int_crianca = payload.get("CRONICO_outIntCrianca", "-")
        wchr_ext_crianca = payload.get("CRONICO_outExtCrianca", "-")
        wchr_ida_ext     = payload.get("CRONICO_IDA_ANVISA_VAL", "-")
        wchr_ida_int     = payload.get("CRONICO_IDA_SYNGENTA_VAL", "-")

        water_chronic_data = {
            "IDA Externo": wchr_ida_ext,
            "IDA Interno": wchr_ida_int,
            "Concentração": wchr_conc,
            "Peso Adulto": wchr_adulto,
            "Peso Criança": wchr_crianca,
            "%IDA Interno Adulto": wchr_int_adulto,
            "%IDA Externo Adulto": wchr_ext_adulto,
            "%IDA Interno Criança": wchr_int_crianca,
            "%IDA Externo Criança": wchr_ext_crianca,
        }

        # ---- México: filtre o dataset base e só inclua se há LMR/R OU resultados numéricos
        mexico_input = payload.get("mexico") or {}
        mexico_data_raw: List[Dict[str, Any]] = mexico_input.get("data") or []
        mexico_results: Dict[str, Any] = mexico_input.get("results") or {}

        mexico_data_filtered = _linhas_usuario_preencheu(mexico_data_raw, mexico_campos_editaveis)

        tem_resultados_mexico = any(
            _is_number_like(mexico_results.get(k))
            for k in ("adi", "idmt", "percentAdi", "sum", "bw")
        )

        should_include_mexico = (len(mexico_data_filtered) > 0) or tem_resultados_mexico

        mexico_payload = None
        if should_include_mexico:
            mexico_payload = {
                "data": mexico_data_filtered,
                "results": mexico_results
            }

        # ---- Flags vindas do frontend (Water)
        incluir_water_acute   = bool(payload.get("incluirWaterAcute"))
        incluir_water_chronic = bool(payload.get("incluirWaterChronic"))

        # ---- Nome do arquivo dinâmico
        name_parts = []
        if acute: name_parts.append("acute")
        if chronic: name_parts.append("chronic")
        if incluir_water_acute: name_parts.append("waterAcute")
        if incluir_water_chronic: name_parts.append("waterChronic")
        if should_include_mexico: name_parts.append("mexico")
        if not name_parts:
            name_parts = ["empty"]
        filename = f"riskwise_{'_'.join(name_parts)}_{date.today().isoformat()}.pdf"

        # ---- IDAs do Chronic (separados)
        chronic_ida_externo = payload.get("chronic_ida_externo")
        chronic_ida_interno = payload.get("chronic_ida_interno")

        # ---- Geração do PDF
        pdf_bytes = gerar_pdf_combinado(
            acute_drfa_externo=drfa_externo,
            acute_drfa_interno=drfa_interno,
            chronic_ida_externo=chronic_ida_externo,
            chronic_ida_interno=chronic_ida_interno,
            acute_rows=acute,
            chronic_rows=chronic,
            pof2008=pof2008,
            pof2017=pof2017,
            water_data=water_data,
            water_chronic_data=water_chronic_data,
            incluir_water_acute=incluir_water_acute,
            incluir_water_chronic=incluir_water_chronic,
            mexico=mexico_payload  # ⬅️ só passa se realmente deve incluir
        )

        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF combinado: {e}")
