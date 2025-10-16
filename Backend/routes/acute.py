from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Dict, Any
from datetime import datetime, date
from io import BytesIO
import pandas as pd
import numpy as np
import os

# Importa a função que gera PDF em memória
from utils.report import gerar_pdf_bytes
router = APIRouter()

# ✅ Caminho relativo para o arquivo dentro do projeto
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # volta para Backend
EXCEL_PATH = os.path.join(BASE_DIR, "data", "DietaAgudaOf.xlsx")

# Colunas obrigatórias (mínimo para funcionar)
REQUIRED_COLS = [
    "Cultivo/ Matriz Animal", "ANO POF", "Região",
    "Caso Fórmula", "Caso Mapeado",
    "LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)",
    "Fator de Processamento FP",
    "Fator de Conversão FC",
    "Peso Unitário da Parte Comestível Uc (g)",
    "Fator de variabilidade v",
    "Maior porção MP (g/dia/pessoa)",
    "Peso Corpóreo médio dos consumidores PC (kg)",
    "Consumo (g/dia/pessoa) Percentil 97,5",
    "Peso corpóreo da região (kg)",
    "%DRFA ANVISA", "%DRFA SYNGENTA",
]

# Colunas opcionais (se existirem, serão incluídas no output)
OPTIONAL_COLS = [
    "Peso unitário U (g)",
    "IMEA (mg/kg p.c./dia)",
]

# -------------------------------
# Funções auxiliares
# -------------------------------
def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df

def _read_excel_validated(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {path}")

    try:
        df = pd.read_excel(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler Excel: {e}")

    df = _normalize_columns(df)
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Colunas ausentes na planilha: {missing}. Colunas disponíveis: {list(df.columns)}"
        )

    cols_to_keep = REQUIRED_COLS + [c for c in OPTIONAL_COLS if c in df.columns]
    df = df[cols_to_keep]

    df = df.replace({pd.NA: None, np.nan: None, np.inf: None, -np.inf: None})
    return df

# -------------------------------
# Endpoints
# -------------------------------

@router.get("/dados")
def get_dados():
    try:
        df = _read_excel_validated(EXCEL_PATH)
        registros = jsonable_encoder(df.to_dict(orient="records"))
        meta = {
            "file": os.path.basename(EXCEL_PATH),
            "total_registros": len(registros),
            "colunas": list(df.columns),
        }
        return JSONResponse(content={"tabelaCompleta": registros, "meta": meta})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar dados: {e}")


@router.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
        raise HTTPException(
            status_code=501,
            detail="Escrita desabilitada no ambiente de deploy (filesystem read-only)."
        )

    try:
        novo_df = pd.DataFrame(dados)
        novo_df = _normalize_columns(novo_df)

        missing = [c for c in REQUIRED_COLS if c not in novo_df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Faltam colunas obrigatórias no payload: {missing}")

        cols_to_save = REQUIRED_COLS + [c for c in OPTIONAL_COLS if c in novo_df.columns]
        novo_df = novo_df[cols_to_save].replace({pd.NA: None, np.nan: None})

        try:
            novo_df.to_excel(EXCEL_PATH, index=False)
        except PermissionError:
            raise HTTPException(status_code=423, detail="Feche o arquivo Excel e tente novamente.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao salvar Excel: {e}")

        return {"status": "salvo", "linhas": len(novo_df), "arquivo": os.path.basename(EXCEL_PATH)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar atualização: {e}")


# -------------------------------
# Novo endpoint para gerar PDF
# -------------------------------
@router.post("/gerar-pdf")
def gerar_pdf_endpoint(payload: Dict[str, Any]):
    """
    Espera um JSON:
    {
      "dados": [ { ... }, ... ],
      "drfa_externo": "valor",
      "drfa_interno": "valor"
    }
    """
    try:
        dados: List[Dict[str, Any]] = payload.get("dados", [])
        drfa_externo: str = payload.get("drfa_externo", "-")
        drfa_interno: str = payload.get("drfa_interno", "-")

        pdf_bytes = gerar_pdf_bytes(drfa_externo, drfa_interno, dados)
        filename = f"riskwise_acute_{date.today().isoformat()}.pdf"

        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {e}")