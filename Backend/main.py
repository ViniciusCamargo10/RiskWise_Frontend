import sys
import os 
sys.path.append(os.path.dirname(__file__))
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Backend.routes import chronic, acute, mexico

app = FastAPI(debug=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui as rotas mantendo os mesmos endpoints
app.include_router(chronic.router, tags=["Dieta Crônica"])
app.include_router(acute.router, prefix="/acute", tags=["Nova Planilha"])
app.include_router(mexico.router, prefix="/mexico", tags=["Mexico Planilha"])