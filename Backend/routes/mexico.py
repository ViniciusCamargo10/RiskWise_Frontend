from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pathlib import Path
from typing import Dict
import pandas as pd
import numpy as np
import os

router = APIRouter()

# ✅ Caminho relativo para o arquivo dentro do projeto
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # volta para Backend
EXCEL_PATH = os.path.join(BASE_DIR, "data", "DietaCronicaMexico.xlsx")

# Colunas esperadas na tabela principal
COLUNAS_DESEJADAS = [
    "Crop", "Cultivo", "LMR (mg/kg)", "R (mg/kg)", "C (Kg/person/day)", "(LMR or R)*C"
]

# Função para garantir que não haja NaN/Infinito no JSON
def safe_json(obj):
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [safe_json(v) for v in obj]
    return obj

# -------------------- Função para ler metadados e tabela --------------------
def carregar_dados():
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {EXCEL_PATH}")

    try:
        # Ler metadados (linhas 1 a 5)
        meta_df = pd.read_excel(EXCEL_PATH, nrows=5, header=None)
        meta_dict = {str(meta_df.iloc[i, 0]).strip(): meta_df.iloc[i, 1] for i in range(len(meta_df))}

        # Extrair valores fixos
        adi_interno = float(meta_dict.get("ADI (mg/kg bw/day)", 0.05))
        bw = float(meta_dict.get("bw (kg)", 70))
        idmt = meta_dict.get("IDMT", None)
        percent_adi = meta_dict.get("%ADI", None)

        # Ler tabela principal (a partir da linha 7)
        df = pd.read_excel(EXCEL_PATH, skiprows=6)

        # Validar colunas
        faltando = [c for c in COLUNAS_DESEJADAS if c not in df.columns]
        if faltando:
            raise HTTPException(status_code=500, detail=f"Colunas ausentes na planilha: {faltando}")

        # Substituir NaN por None
        df = df[COLUNAS_DESEJADAS].replace({pd.NA: None, np.nan: None, np.inf: None, -np.inf: None})

        return {
            "meta": {"bw": bw, "adi_interno": adi_interno},
            "rows": jsonable_encoder(df.to_dict(orient="records")),
            "totals": {"idmt": idmt, "%ADI_interno": percent_adi}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler Excel: {e}")

# -------------------- Endpoint GET --------------------
@router.get("/dados")
def get_dados():
    dados = carregar_dados()
    dados = safe_json(dados)
    return JSONResponse(content=dados)

# -------------------- Endpoint POST --------------------
@router.post("/atualizar")
def atualizar(payload: Dict = Body(...)):
    if "rows" not in payload:
        raise HTTPException(status_code=400, detail="Campo 'rows' é obrigatório.")

    try:
        novo_df = pd.DataFrame(payload["rows"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON inválido: {e}")

    faltando = [c for c in COLUNAS_DESEJADAS if c not in novo_df.columns]
    if faltando:
        raise HTTPException(status_code=400, detail=f"Faltam colunas: {faltando}")

    # Substituir NaN por None
    novo_df = novo_df[COLUNAS_DESEJADAS].replace({pd.NA: None, np.nan: None, np.inf: None, -np.inf: None})

    try:
        # Reescrever Excel mantendo metadados
        meta_df = pd.read_excel(EXCEL_PATH, nrows=5, header=None)
        with pd.ExcelWriter(EXCEL_PATH, engine="openpyxl") as writer:
            meta_df.to_excel(writer, index=False, header=False)
            novo_df.to_excel(writer, index=False, startrow=6)
    except PermissionError:
        raise HTTPException(status_code=423, detail="Feche o arquivo Excel e tente novamente.")

    return {"status": "salvo"}