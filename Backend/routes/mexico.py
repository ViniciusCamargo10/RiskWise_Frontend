from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pathlib import Path
from typing import List, Dict
import pandas as pd
from utils.excel_loader import carregar_excel

router = APIRouter()

# Caminho fixo (seu caminho atual)
EXCEL_PATH = Path(r"C:\Users\s1337626\OneDrive - Syngenta\Área de Trabalho\Dieta cronica Mexico_V01 STL_OF.xlsx")

# Colunas esperadas
COLUNAS_DESEJADAS = [
    "Crop", "Cultivo", "LMR (mg/kg)", "R (mg/kg)", "C (Kg/person/day)",
    "(LMR or R)*C", "ADI (mg/kg bw/day)", "bw (kg)", "IDMT", "%ADI"
]

# Carrega DataFrame inicial
df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)

@router.get("/dados")
def get_dados():
    global df
    registros = jsonable_encoder(df.to_dict(orient="records"))
    payload = {
        "meta": {
            "bw": 70,
            "adi_interno": 0.05  # ✅ fixo por enquanto
        },
        "rows": registros,
        "totals": {
            "sumLC": None,
            "idmt": None,
            "%ADI_interno": None
        }
    }
    return JSONResponse(content=payload)

@router.post("/atualizar")
def atualizar(payload: Dict = Body(...)):
    global df
    if "rows" not in payload:
        raise HTTPException(status_code=400, detail="Campo 'rows' é obrigatório.")
    rows = payload["rows"]

    try:
        novo_df = pd.DataFrame(rows)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON inválido: {e}")

    faltando = [c for c in COLUNAS_DESEJADAS if c not in novo_df.columns]
    if faltando:
        raise HTTPException(status_code=400, detail=f"Faltam colunas: {faltando}")

    novo_df = novo_df[COLUNAS_DESEJADAS].replace({pd.NA: None})

    try:
        novo_df.to_excel(EXCEL_PATH, index=False)
    except PermissionError:
        raise HTTPException(status_code=423, detail="Feche o arquivo Excel e tente novamente.")

    df = novo_df.copy()
    return {"status": "salvo"}