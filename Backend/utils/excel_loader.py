import pandas as pd
import numpy as np
from fastapi import HTTPException
from pathlib import Path

def carregar_excel(path: Path, colunas: list) -> pd.DataFrame:
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Arquivo não encontrado: {path}")
    try:
        df = pd.read_excel(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro lendo Excel: {e}")
    faltando = [c for c in colunas if c not in df.columns]
    if faltando:
        raise HTTPException(status_code=500, detail=f"Colunas ausentes: {faltando}")
    df = df[colunas].replace({np.nan: None, np.inf: None, -np.inf: None})
    return df