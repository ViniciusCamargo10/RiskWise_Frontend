from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Dict
import pandas as pd
import os
from utils.excel_loader import carregar_excel

router = APIRouter()

# ✅ Caminho relativo para o arquivo dentro do projeto
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # volta para Backend
EXCEL_PATH = os.path.join(BASE_DIR, "data", "DietaAgudaOf.xlsx")

# Colunas esperadas
COLUNAS_DESEJADAS = [
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
    "%DRFA ANVISA", "%DRFA SYNGENTA"
]

# ✅ Não carregue o Excel no import
# df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)

@router.get("/dados")
def get_dados():
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {EXCEL_PATH}")

    df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)
    registros = jsonable_encoder(df.to_dict(orient="records"))
    return JSONResponse(content={"tabelaCompleta": registros})

@router.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {EXCEL_PATH}")

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

    return {"status": "salvo"}