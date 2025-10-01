from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

import pandas as pd
import numpy as np
from typing import List, Dict
from pathlib import Path

# ==== Config ====
EXCEL_PATH = Path(r"C:\Users\s1337626\OneDrive - Syngenta\Área de Trabalho\DietaCronicaOf.xlsx")
COLUNAS_DESEJADAS = [
    "Cultivo",
    "ANO_POF",
    "Região",
    "LMR (mg_kg)",
    "MREC_STMR (mg_kg)",
    "Market Share",
    "IDMT (Numerador)",
    "Contribuição Individual do Cultivo",
    "Consumo diário per capita (g_dia_pessoa) C",
    "Fator de Processamento FP",
    "Fator de Conversão FC",
    "PC (kg)",
]

app = FastAPI(debug=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # cuidado em produção
    allow_methods=["*"],
    allow_headers=["*"],
)

def carregar_df() -> pd.DataFrame:
    if not EXCEL_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {EXCEL_PATH}")

    try:
        df_local = pd.read_excel(EXCEL_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro lendo o Excel: {e}")

    faltando = [c for c in COLUNAS_DESEJADAS if c not in df_local.columns]
    if faltando:
        raise HTTPException(status_code=500, detail=f"Colunas ausentes no Excel: {faltando}")

    df_local = df_local[COLUNAS_DESEJADAS]

    # Sanitiza para JSON (NaN/inf -> None)
    df_local = df_local.replace({np.nan: None, np.inf: None, -np.inf: None})

    return df_local

# Carrega na inicialização
df = carregar_df()

@app.get("/dados")
def get_dados():
    # Garante que tudo é JSON-serializable
    registros = jsonable_encoder(df.to_dict(orient="records"))

    # === Adição: estrutura POF 2008 ===
    pof_2008 = {
        "PC_Kg": {},
        "%IDA_ANVISA": {},
        "%IDA_SYNGENTA": {}
    }

    for linha in df.to_dict(orient="records"):
        if linha["ANO_POF"] == 2008:
            regiao = linha["Região"]
            pc_kg = linha["PC (kg)"]
            if regiao and pc_kg is not None:
                pof_2008["PC_Kg"][regiao] = round(pc_kg, 4)
                pof_2008["%IDA_ANVISA"][regiao] = None
                pof_2008["%IDA_SYNGENTA"][regiao] = None

    # Retorno combinado
    return JSONResponse(content={
        "tabelaCompleta": registros,
        "POF_2008": pof_2008,
        "POF_2017": pof_2017
    })

@app.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):
    """
    Espera uma lista de objetos (linhas) com as mesmas colunas de COLUNAS_DESEJADAS.
    """
    global df

    try:
        novo_df = pd.DataFrame(dados)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON inválido para DataFrame: {e}")

    faltando = [c for c in COLUNAS_DESEJADAS if c not in novo_df.columns]
    if faltando:
        raise HTTPException(status_code=400, detail=f"Faltam colunas no payload: {faltando}")

    # Reordena/filtra colunas e sanitiza
    novo_df = novo_df[COLUNAS_DESEJADAS]
    novo_df = novo_df.replace({np.nan: None, np.inf: None, -np.inf: None})

    try:
        novo_df.to_excel(EXCEL_PATH, index=False)
    except PermissionError:
        raise HTTPException(
            status_code=423,
            detail="Não foi possível salvar. Feche o arquivo do Excel (ele pode estar aberto) e tente novamente."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar o Excel: {e}")

    # Atualiza o cache em memória
    df = novo_df.copy()

    return {"status": "salvo"}

# POF 2017

# Adição: estrutura POF 2017
pof_2017 = {
    "PC_Kg": {},
    "%IDA_ANVISA": {},
    "%IDA_SYNGENTA": {}
}

for linha in df.to_dict(orient="records"):
    if linha["ANO_POF"] == 2017:
        regiao = linha["Região"]
        pc_kg = linha["PC (kg)"]
        if regiao and pc_kg is not None:
            pof_2017["PC_Kg"][regiao] = round(pc_kg, 4)
            pof_2017["%IDA_ANVISA"][regiao] = None
            pof_2017["%IDA_SYNGENTA"][regiao] = None