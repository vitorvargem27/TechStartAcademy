"""
Tech Start Academy — Backend (FastAPI)
======================================
Chatbot Gemini AI + Motor de Insights com IA + Agendamento Diário

Iniciar:
  cd backend
  pip install -r ../requirements.txt
  python app.py

Rotas:
  GET  /                  → Status
  POST /api/chat          → Chatbot Gemini
  POST /api/send-insights → E-mail simples
  POST /api/sync-data     → Sincronizar dados do frontend
  POST /api/run-insights  → Disparar insights manualmente (admin)
  GET  /api/analyze/{id}  → Análise individual de um aluno
"""

import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path

# Carrega variáveis de ambiente
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

# ─── VARIÁVEIS DE AMBIENTE ──────────────────────
GEMINI_API_KEY = ""
SECRET_KEY     = "tsa-default-key"
PORT           = 8090
DEBUG_MODE     = str(os.getenv("FLASK_DEBUG", "false")).lower() == "true"

# ─── GEMINI CLIENT ──────────────────────────────
gemini_client = None
try:
    from google import genai
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("✅ Gemini AI conectado com sucesso!")
    else:
        print("⚠️  GEMINI_API_KEY não configurada no .env")
except ImportError:
    print("⚠️  google-genai não instalado. Execute: pip install google-genai")
except Exception as e:
    print(f"⚠️  Erro ao inicializar Gemini: {e}")

# ─── IMPORTAR MÓDULO DE INSIGHTS ────────────────
try:
    from plataforma.send_insights import (
        enviar_email,
        executar_insights_todos_alunos,
        coletar_metricas_aluno,
        gerar_analise,
        carregar_dados,
        atualizar_cache,
        iniciar_agendador,
    )
    INSIGHTS_AVAILABLE = True
    print("✅ Módulo de insights carregado!")
except ImportError as e:
    INSIGHTS_AVAILABLE = False
    print(f"⚠️  Módulo send_insights não disponível: {e}")

# ─── FASTAPI APP ────────────────────────────────
app = FastAPI(title="Tech Start Academy API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── MODELS ─────────────────────────────────────
class ChatRequest(BaseModel):
    message: str

class InsightsRequest(BaseModel):
    student_email: str
    student_name: str
    subject: str
    body: str

class SyncDataRequest(BaseModel):
    users: list
    activities: list
    homework: Optional[list] = []
    certificates: Optional[list] = []
    messages: Optional[list] = []

class AnalyzeRequest(BaseModel):
    user_id: str

# ─── SYSTEM PROMPT ──────────────────────────────
SYSTEM_PROMPT = """Você é o CodeBot, assistente de programação da Tech Start Academy.

REGRAS:
- Responda na linguagem que te enviarem a dúvida
- Seja claro, didático e incentivador
- Use exemplos de código quando relevante
- Formate o código entre ```linguagem e ```
- Foque em: Python, JavaScript, Java, HTML, CSS, Angular, Spring Boot, Robot Framework, TypeScript, React, Node.js, SQL, Git e Lógica de Programação
- Seja conciso mas completo
- Use emojis com moderação para tornar a conversa amigável
- Se o aluno parecer frustrado, seja encorajador
- Nunca forneça respostas prontas de exercícios; guie o aluno para descobrir a solução
"""


# ══════════════════════════════════════════════════════
#  ROTAS
# ══════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Tech Start Academy API",
        "version": "3.0",
        "gemini": "connected" if gemini_client else "not configured",
        "insights": "available" if INSIGHTS_AVAILABLE else "unavailable",
    }


# ─── CHATBOT GEMINI ─────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Chatbot com Gemini AI."""
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    if not gemini_client:
        return {
            "success": True,
            "data": {
                "reply": (
                    "⚠️ O serviço de IA não está configurado. "
                    "Verifique a variável `GEMINI_API_KEY` no arquivo `.env`.\n\n"
                    "**Para configurar:**\n"
                    "1. Acesse https://aistudio.google.com/apikey\n"
                    "2. Gere uma API Key\n"
                    "3. Adicione no `.env`:\n"
                    "```\nGEMINI_API_KEY=sua_chave_aqui\n```\n"
                    "4. Reinicie o servidor."
                )
            }
        }

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{SYSTEM_PROMPT}\n\nAluno pergunta: {req.message}"
        )
        reply = response.text if response.text else "Desculpe, não consegui gerar uma resposta. Tente novamente."
        return {"success": True, "data": {"reply": reply}}
    except Exception as e:
        print(f"❌ Erro Gemini: {e}")
        return {"success": False, "detail": f"Erro ao processar: {str(e)}"}


# ─── E-MAIL SIMPLES ─────────────────────────────
@app.post("/api/send-insights")
async def send_insights_route(req: InsightsRequest):
    """Envia e-mail simples (sem análise) para um aluno."""
    if not INSIGHTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Módulo de insights indisponível.")

    try:
        ok = enviar_email(
            destinatario_email=req.student_email,
            destinatario_nome=req.student_name,
            assunto=req.subject,
            corpo=req.body
        )
        if ok:
            return {"success": True, "message": f"E-mail enviado para {req.student_email}"}
        raise HTTPException(status_code=500, detail="Falha ao enviar. Verifique credenciais no .env")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── SINCRONIZAR DADOS DO FRONTEND ──────────────
@app.post("/api/sync-data")
async def sync_data(req: SyncDataRequest):
    """Recebe snapshot do banco do frontend (localStorage) para análise."""
    if not INSIGHTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Módulo de insights indisponível.")

    dados = {
        "users": req.users,
        "activities": req.activities,
        "homework": req.homework or [],
        "certificates": req.certificates or [],
        "messages": req.messages or [],
    }
    atualizar_cache(dados)

    # Também salva no arquivo JSON para persistência
    try:
        data_dir = str(os.getenv("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))
        json_path = os.path.join(data_dir, "tsa_database.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        print(f"💾 Dados sincronizados → {json_path}")
    except Exception as e:
        print(f"⚠️ Não salvou JSON: {e}")

    return {
        "success": True,
        "message": f"Dados sincronizados: {len(req.users)} users, {len(req.activities)} activities"
    }


# ─── ANALISAR UM ALUNO INDIVIDUAL ────────────────
@app.post("/api/analyze")
async def analyze_student(req: AnalyzeRequest):
    """Gera análise textual de um aluno específico (retorna JSON, sem e-mail)."""
    if not INSIGHTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Módulo de insights indisponível.")

    dados = carregar_dados()
    metricas = coletar_metricas_aluno(req.user_id, dados)
    if not metricas:
        raise HTTPException(status_code=404, detail="Aluno não encontrado ou sem dados.")

    analise = gerar_analise(metricas)
    return {
        "success": True,
        "data": {
            "student": metricas["nome"],
            "email": metricas["email"],
            "media": metricas["media_geral"],
            "total_atividades": metricas["total_atividades"],
            "certificados": metricas["certificados"],
            "linguagens": {k: v["media"] for k, v in metricas["linguagens"].items()},
            "analise": analise,
        }
    }


# ─── DISPARAR INSIGHTS MANUALMENTE ──────────────
@app.post("/api/run-insights")
async def run_insights_manual():
    """Dispara o pipeline de insights para todos os alunos (admin only)."""
    if not INSIGHTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Módulo de insights indisponível.")

    resultado = executar_insights_todos_alunos()
    return {
        "success": True,
        "message": f"Pipeline concluído: {resultado['enviados']} enviado(s), {resultado['falhas']} falha(s)",
        "data": resultado
    }


# ══════════════════════════════════════════════════════
#  STARTUP EVENT — Inicia o agendador diário
# ══════════════════════════════════════════════════════
@app.on_event("startup")
async def on_startup():
    """Inicia o agendador de insights diários ao startar o servidor."""
    if INSIGHTS_AVAILABLE:
        iniciar_agendador()
        print("📅 Agendador diário de insights ativo (12:00)")
    else:
        print("⚠️ Agendador não iniciado — módulo de insights indisponível")


# ══════════════════════════════════════════════════════
#  INICIALIZAÇÃO
# ══════════════════════════════════════════════════════
if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════════════════╗
║   🚀 Tech Start Academy — Backend API v3.0              ║
║   📡 http://localhost:{PORT}                              ║
║   📚 Docs: http://localhost:{PORT}/docs                    ║
║   🤖 Gemini: {"✅ Conectado" if gemini_client else "❌ Não configurado"}                            ║
║   📊 Insights: {"✅ Ativo" if INSIGHTS_AVAILABLE else "❌ Indisponível"}                               ║
║   ⏰ Agendador: Todo dia às 12:00                        ║
╚══════════════════════════════════════════════════════════╝
    """)
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=PORT,
        reload=DEBUG_MODE
    )
