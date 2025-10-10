from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Dict
from pathlib import Path
import pandas as pd
from utils.excel_loader import carregar_excel
import os

router = APIRouter()

# ✅ Caminho relativo para o arquivo dentro do projeto
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # volta para Backend
EXCEL_PATH = os.path.join(BASE_DIR, "data", "DietaCronicaOf.xlsx")

COLUNAS_DESEJADAS = [
    "Cultivo", "ANO_POF", "Região", "LMR (mg_kg)",
    "MREC_STMR (mg_kg)", "Market Share", "IDMT (Numerador)",
    "Contribuição Individual do Cultivo",
    "Consumo diário per capita (g_dia_pessoa) C",
    "Fator de Processamento FP", "Fator de Conversão FC", "PC (kg)"
]

# ✅ NÃO carregue o Excel no import! (isso quebra no Vercel)
# df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)

# Estruturas POF (serão preenchidas sob demanda)
pof_2008 = {"PC_Kg": {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {}}
pof_2017 = {"PC_Kg": {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {}}

@router.get("/dados")
def get_dados():
    # ✅ Carrega o Excel sob demanda
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {EXCEL_PATH}")

    df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)

    # Monta POF dinamicamente
    pof_2008 = {"PC_Kg": {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {}}
    pof_2017 = {"PC_Kg": {}, "%IDA_ANVISA": {}, "%IDA_SYNGENTA": {}}

    for linha in df.to_dict(orient="records"):
        if linha["ANO_POF"] == 2008:
            regiao = linha["Região"]
            pc_kg = linha["PC (kg)"]
            if regiao and pc_kg is not None:
                pof_2008["PC_Kg"][regiao] = round(pc_kg, 4)
                pof_2008["%IDA_ANVISA"][regiao] = None
                pof_2008["%IDA_SYNGENTA"][regiao] = None
        if linha["ANO_POF"] == 2017:
            regiao = linha["Região"]
            pc_kg = linha["PC (kg)"]
            if regiao and pc_kg is not None:
                pof_2017["PC_Kg"][regiao] = round(pc_kg, 4)
                pof_2017["%IDA_ANVISA"][regiao] = None
                pof_2017["%IDA_SYNGENTA"][regiao] = None

    registros = jsonable_encoder(df.to_dict(orient="records"))
    return JSONResponse(content={
        "tabelaCompleta": registros,
        "POF_2008": pof_2008,
        "POF_2017": pof_2017
    })

@router.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):
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