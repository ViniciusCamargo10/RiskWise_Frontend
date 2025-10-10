import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ajusta o path para permitir imports do Backend
sys.path.append(os.path.dirname(__file__))

# Cria a aplicação FastAPI
app = FastAPI(debug=True)

# Middleware para CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, restrinja para o domínio do Vercel
    allow_methods=["*"],
    allow_headers=["*"],
)

# Importa e inclui as rotas da API
from Backend.routes import chronic, acute, mexico
app.include_router(chronic.router, tags=["Dieta Crônica"])
app.include_router(acute.router, prefix="/acute", tags=["Nova Planilha"])
app.include_router(mexico.router, prefix="/mexico", tags=["México Planilha"])

# ✅ Servir o frontend mantendo a estrutura original
# Exemplo: Frontend/html/index.html -> https://seuprojeto.vercel.app/html/index.html
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "Frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")