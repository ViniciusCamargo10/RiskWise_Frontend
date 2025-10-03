from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Dict
from pathlib import Path
import pandas as pd
from utils.excel_loader import carregar_excel

router = APIRouter()

# Configuração original
EXCEL_PATH = Path(r"C:\Users\s1337626\OneDrive - Syngenta\Área de Trabalho\DietaCronicaOf.xlsx")
COLUNAS_DESEJADAS = [
    "Cultivo", "ANO_POF", "Região", "LMR (mg_kg)",
    "MREC_STMR (mg_kg)", "Market Share", "IDMT (Numerador)",
    "Contribuição Individual do Cultivo",
    "Consumo diário per capita (g_dia_pessoa) C",
    "Fator de Processamento FP", "Fator de Conversão FC", "PC (kg)"
]

# Carrega DataFrame
df = carregar_excel(EXCEL_PATH, COLUNAS_DESEJADAS)

# Estruturas POF
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

@router.get("/dados")
def get_dados():
    registros = jsonable_encoder(df.to_dict(orient="records"))
    return JSONResponse(content={
        "tabelaCompleta": registros,
        "POF_2008": pof_2008,
        "POF_2017": pof_2017
    })

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