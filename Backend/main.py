import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


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
from .routes import chronic, acute, mexico
app.include_router(chronic.router, tags=["Dieta Crônica"])
app.include_router(acute.router, prefix="/acute", tags=["Nova Planilha"])
app.include_router(mexico.router, prefix="/mexico", tags=["México Planilha"])


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "Frontend")
FRONTEND_HTML_DIR = os.path.join(FRONTEND_DIR, "html")

# Servir CSS, JS e imagens
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/javascript", StaticFiles(directory=os.path.join(FRONTEND_DIR, "javascript")), name="javascript")
app.mount("/imagens", StaticFiles(directory=os.path.join(FRONTEND_DIR, "imagens")), name="imagens")

# Servir HTML
app.mount("/", StaticFiles(directory=FRONTEND_HTML_DIR, html=True), name="frontend")

# ✅ Rota para favicon
@app.get("/favicon.ico")
async def favicon():
    return FileResponse(os.path.join(FRONTEND_DIR, "favicon.ico"))