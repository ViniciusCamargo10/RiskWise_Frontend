from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from typing import List, Dict
from fastapi import Body


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite qualquer origem (não recomendado em produção)
    allow_methods=["*"],  # Permite todos os métodos HTTP (GET, POST, etc.)
    allow_headers=["*"],  # Permite todos os cabeçalhos
)

df = pd.read_excel(r"C:\Users\s1337626\OneDrive - Syngenta\Área de Trabalho\Calculadoras\DietaCronica_Calculadora.xlsx", index=False)
colunas_desejadas = ["Cultivo", "ANO_POF", "Região", "LMR (mg_kg)", "MREC_STMR (mg_kg)", "Market Share", "IDMT (Numerador)", "Contribuição Individual do Cultivo"]
df = df[colunas_desejadas]

@app.get("/dados")
def get_dados():
    return df.to_dict(orient="records")


@app.post("/atualizar")
def atualizar(dados: List[Dict] = Body(...)):  # ← força JSON no body
    global df
    df = pd.DataFrame(dados)
    df.to_excel(r"C:\Users\s1337626\OneDrive - Syngenta\Área de Trabalho\Calculadoras\DietaCronica_Calculadora.xlsx", index=False)
    return {"status": "salvo"}
