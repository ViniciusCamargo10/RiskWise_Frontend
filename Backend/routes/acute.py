from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Dict
from pathlib import Path
import pandas as pd
from utils.excel_loader import carregar_excel

router = APIRouter()

# Caminho do Excel
EXCEL_PATH = Path(r"C:\Users\s1337626\OneDrive - Syngenta\Área de Trabalho\DietaAgudaOf.xlsx")

# Colunas esperadas
COLUNAS_DESEJADAS = [
    "Cultivo/ Matriz Animal", "ANO POF", "Região", "Caso Fórmula", "Caso Mapeado",
    "LMR (mg/kg)", "HR/MCR (mg/kg)", "MREC/STMR (mg/kg)",
    "Consumo (g/dia/pessoa) Percentil 97,5", "Peso corpóreo da região (kg)",
    "Maior porção MP (g/dia/pessoa)", "Peso Corpóreo médio dos consumidores PC (kg)",
    "%DRFA ANVISA", "%DRFA SYNGENTA"
]

# Carrega DataFrame inicial
df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)

@router.get("/dados")
def get_dados():
    registros = jsonable_encoder(df.to_dict(orient="records"))
    return JSONResponse(content={"tabelaCompleta": registros})

@router.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):
    global df
    try:
        novo_df = pd.DataFrame(dados)
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