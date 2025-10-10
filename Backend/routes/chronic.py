from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Dict
import pandas as pd
import numpy as np
import os

router = APIRouter()

# ✅ Caminho relativo para o arquivo dentro do projeto
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # volta para Backend
EXCEL_PATH = os.path.join(BASE_DIR, "data", "DietaCronicaOf.xlsx")

REQUIRED_COLS = [
    "Cultivo", "ANO_POF", "Região", "LMR (mg_kg)",
    "MREC_STMR (mg_kg)", "Market Share", "IDMT (Numerador)",
    "Contribuição Individual do Cultivo",
    "Consumo diário per capita (g_dia_pessoa) C",
    "Fator de Processamento FP", "Fator de Conversão FC", "PC (kg)"
]

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

    df = df[REQUIRED_COLS]
    df = df.replace({pd.NA: None, np.nan: None, np.inf: None, -np.inf: None})

    return df

@router.get("/dados")
def get_dados():
    try:
        df = _read_excel_validated(EXCEL_PATH)

        # Monta POF dinamicamente
        pof_2008 = {"PC_Kg": {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {}}
        pof_2017 = {"PC_Kg": {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {}}

        for linha in df.to_dict(orient="records"):
            try:
                if linha["ANO_POF"] == 2008:
                    regiao = linha["Região"]
                    pc_kg = linha["PC (kg)"]
                    if regiao and pc_kg is not None:
                        pof_2008["PC_Kg"][regiao] = round(float(pc_kg), 4)
                        pof_2008["%IDA_ANVISA"][regiao] = None
                        pof_2008["%IDA_SYNGENTA"][regiao] = None
                if linha["ANO_POF"] == 2017:
                    regiao = linha["Região"]
                    pc_kg = linha["PC (kg)"]
                    if regiao and pc_kg is not None:
                        pof_2017["PC_Kg"][regiao] = round(float(pc_kg), 4)
                        pof_2017["%IDA_ANVISA"][regiao] = None
                        pof_2017["%IDA_SYNGENTA"][regiao] = None
            except Exception:
                # Se alguma linha vier malformada, continua sem derrubar tudo
                continue

        registros = jsonable_encoder(df.to_dict(orient="records"))
        meta = {
            "file": os.path.basename(EXCEL_PATH),
            "total_registros": len(registros),
            "colunas": list(df.columns),
        }
        return JSONResponse(content={
            "tabelaCompleta": registros,
            "POF_2008": pof_2008,
            "POF_2017": pof_2017,
            "meta": meta
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar dados: {e}")

@router.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):
    # Ambiente de deploy (ex.: Vercel) é read-only
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

        novo_df = novo_df[REQUIRED_COLS].replace({pd.NA: None, np.nan: None})

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
