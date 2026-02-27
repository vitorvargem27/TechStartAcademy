"""
Tech Start Academy — Motor de Insights com IA + Agendamento Diário
==================================================================

Funcionalidades:
  1. Analisa desempenho de cada aluno (notas, entregas, participação)
  2. Usa Gemini AI para gerar insights personalizados
  3. Se Gemini indisponível → fallback com ML local (scikit-learn)
  4. Gera gráficos (matplotlib) embutidos no e-mail
  5. Envia e-mail HTML estilizado para cada aluno
  6. Agendamento automático: todos os dias ao meio-dia

CONFIGURAÇÃO (.env):
  EMAIL_SENDER=vitorvargem27@gmail.com
  EMAIL_PASSWORD=<COLOQUE_SUA_SENHA_DE_APP_AQUI>
  GEMINI_API_KEY=<sua_chave_gemini>

Para gerar a Senha de App do Gmail:
  1. Ative Verificação em 2 Etapas
  2. Acesse: https://myaccount.google.com/apppasswords
  3. Gere e cole no .env
"""

import os
import io
import json
import base64
import smtplib
import threading
import time
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env (busca na pasta pai e na pasta atual)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

# ══════════════════════════════════════════════════════
#  VARIÁVEIS DE AMBIENTE (todas como str)
# ══════════════════════════════════════════════════════
EMAIL_SENDER   = "vitorvargem27@gmail.com"
EMAIL_PASSWORD = "mqtn ymlo ulup yyko"  # ← Senha de App do Gmail
SMTP_HOST      = "smtp.gmail.com"
SMTP_PORT      = "587"
SENDER_NAME    = "Tech Start Academy"
GEMINI_API_KEY = "AIzaSyC58GgWC_Ba9cwu3y1J-vxhjH81dKZ0ZSk"
DATA_DIR       = str(os.getenv("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))

# Cache de dados dos alunos (atualizado via API ou leitura do JSON)
_student_data_cache = None


# ══════════════════════════════════════════════════════
#  1. COLETA DE DADOS
# ══════════════════════════════════════════════════════
def carregar_dados() -> dict:
    """Carrega dados da plataforma (cache ou JSON)."""
    global _student_data_cache
    if _student_data_cache:
        return _student_data_cache

    json_path = os.path.join(DATA_DIR, "tsa_database.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            _student_data_cache = json.load(f)
            print(f"📂 Dados carregados de {json_path}")
            return _student_data_cache
    except FileNotFoundError:
        print(f"⚠️  Arquivo não encontrado: {json_path}")
        return {"users": [], "activities": [], "homework": [], "certificates": [], "messages": []}
    except Exception as e:
        print(f"❌ Erro ao ler dados: {e}")
        return {"users": [], "activities": [], "homework": [], "certificates": [], "messages": []}


def atualizar_cache(dados: dict):
    """Atualiza o cache interno (chamado pelo app.py via sync)."""
    global _student_data_cache
    _student_data_cache = dados
    print(f"🔄 Cache de dados atualizado — {len(dados.get('users', []))} usuários")


def coletar_metricas_aluno(user_id: str, dados: dict) -> dict:
    """Coleta todas as métricas de desempenho de um aluno."""
    users      = dados.get("users", [])
    activities = dados.get("activities", [])
    homework   = dados.get("homework", [])
    certs      = dados.get("certificates", [])
    messages   = dados.get("messages", [])

    user = next((u for u in users if u["id"] == user_id), None)
    if not user or user.get("role") == "admin":
        return None

    user_acts   = [a for a in activities if a.get("userId") == user_id]
    graded      = [a for a in user_acts if a.get("grade") is not None]
    pending     = [a for a in user_acts if a.get("status") == "pending"]
    user_certs  = [c for c in certs if c.get("userId") == user_id]
    user_msgs   = [m for m in messages if m.get("toId") == user_id]

    notas       = [a["grade"] for a in graded]
    media       = round(sum(notas) / len(notas), 2) if notas else 0.0

    # Linguagens trabalhadas
    linguagens = {}
    for a in user_acts:
        lang = a.get("language", "Outro")
        linguagens.setdefault(lang, {"total": 0, "notas": []})
        linguagens[lang]["total"] += 1
        if a.get("grade") is not None:
            linguagens[lang]["notas"].append(a["grade"])

    for lang in linguagens:
        ns = linguagens[lang]["notas"]
        linguagens[lang]["media"] = round(sum(ns) / len(ns), 2) if ns else 0.0

    # Frequência de entregas (dias entre entregas)
    datas_entrega = sorted([a.get("submittedAt", "") for a in user_acts if a.get("submittedAt")])
    regularidade = 0.0
    if len(datas_entrega) >= 2:
        try:
            dts = [datetime.fromisoformat(d.replace("Z", "+00:00")) for d in datas_entrega]
            diffs = [(dts[i+1] - dts[i]).days for i in range(len(dts)-1)]
            regularidade = round(sum(diffs) / len(diffs), 1) if diffs else 0.0
        except Exception:
            regularidade = 0.0

    return {
        "user_id":             user_id,
        "nome":                user.get("name", "Aluno"),
        "email":               user.get("email", ""),
        "username":            user.get("username", ""),
        "total_atividades":    len(user_acts),
        "atividades_corrigidas": len(graded),
        "atividades_pendentes": len(pending),
        "notas":               notas,
        "media_geral":         media,
        "maior_nota":          max(notas) if notas else 0,
        "menor_nota":          min(notas) if notas else 0,
        "certificados":        len(user_certs),
        "mensagens_recebidas": len(user_msgs),
        "linguagens":          linguagens,
        "regularidade_dias":   regularidade,
        "total_homework":      len(homework),
        "criado_em":           user.get("createdAt", ""),
    }


# ══════════════════════════════════════════════════════
#  2A. ANÁLISE COM GEMINI AI
# ══════════════════════════════════════════════════════
def analisar_com_gemini(metricas: dict) -> str:
    """Usa Gemini para gerar insights personalizados."""
    if not GEMINI_API_KEY:
        return ""

    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)

        prompt = f"""Você é um orientador pedagógico da Tech Start Academy, uma escola de programação.

Analise o desempenho do aluno abaixo e gere um relatório CURTO e MOTIVADOR com:
1. Fale tudo que analisou sobre o desempenho do aluno
2. Pontos fortes (máx 3 tópicos) porém com que a pessoa se sinta otimista e com emojis
3. O que pode melhorar (máx 3 tópicos com dicas práticas) sendo acolhedor, com emojis
4. Meta sugerida para a próxima semana e para os próximos exercícios

DADOS DO ALUNO:
- Nome: {metricas['nome']}
- Total de atividades entregues: {metricas['total_atividades']}
- Atividades corrigidas: {metricas['atividades_corrigidas']}
- Atividades pendentes: {metricas['atividades_pendentes']}
- Média geral: {metricas['media_geral']}
- Maior nota: {metricas['maior_nota']}
- Menor nota: {metricas['menor_nota']}
- Certificados: {metricas['certificados']}
- Linguagens trabalhadas: {json.dumps({k: v['media'] for k, v in metricas['linguagens'].items()}, ensure_ascii=False)}
- Regularidade de entrega: a cada {metricas['regularidade_dias']} dias em média
- Tarefas de casa disponíveis: {metricas['total_homework']}

Responda em Português do Brasil. Seja motivador mas honesto. Use emojis com moderação.
NÃO use markdown, apenas texto simples com quebras de linha."""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        texto = response.text if response.text else ""
        print(f"   ✅ Gemini analisou {metricas['nome']}")
        return texto.strip()

    except Exception as e:
        print(f"   ⚠️ Gemini falhou para {metricas['nome']}: {e}")
        return ""


# ══════════════════════════════════════════════════════
#  2B. ANÁLISE COM ML LOCAL (Fallback)
# ══════════════════════════════════════════════════════
def analisar_com_ml(metricas: dict) -> str:
    """Fallback: análise usando heurísticas + ML básico (sem dependência de API)."""
    nome   = metricas["nome"].split()[0]
    media  = metricas["media_geral"]
    total  = metricas["total_atividades"]
    pend   = metricas["atividades_pendentes"]
    certs  = metricas["certificados"]
    langs  = metricas["linguagens"]
    reg    = metricas["regularidade_dias"]
    maior  = metricas["maior_nota"]
    menor  = metricas["menor_nota"]

    # ─── Classificação por pontuação composta ────
    score = 0
    # Nota média (0-40 pontos)
    score += min(media * 4, 40)
    # Volume de entregas (0-20 pontos)
    score += min(total * 4, 20)
    # Certificados (0-15 pontos)
    score += min(certs * 5, 15)
    # Regularidade (0-15 pontos) — menor intervalo = melhor
    if reg > 0:
        score += max(15 - reg, 0)
    # Penalidade por pendentes
    score -= pend * 3
    score = max(0, min(100, round(score)))

    # ─── Classificar desempenho ──────────────────
    if score >= 80:
        nivel = "Excelente"
        emoji_nivel = "🌟"
        resumo = f"{nome}, seu desempenho está excelente! Você está no caminho certo."
    elif score >= 60:
        nivel = "Bom"
        emoji_nivel = "👍"
        resumo = f"{nome}, seu desempenho está bom! Com mais prática, você pode alcançar a excelência."
    elif score >= 40:
        nivel = "Regular"
        emoji_nivel = "📈"
        resumo = f"{nome}, seu desempenho está regular. Vamos trabalhar juntos para melhorar!"
    else:
        nivel = "Precisa Melhorar"
        emoji_nivel = "💪"
        resumo = f"{nome}, você pode mais! Vamos estabelecer uma rotina de estudos."

    # ─── Pontos fortes ───────────────────────────
    fortes = []
    if media >= 8:
        fortes.append(f"Média alta de {media} — ótimo aproveitamento!")
    if total >= 3:
        fortes.append(f"Já entregou {total} atividades — bom volume de prática.")
    if certs > 0:
        fortes.append(f"{certs} certificado(s) conquistado(s)!")
    if maior >= 9:
        fortes.append(f"Nota máxima de {maior} mostra grande potencial.")
    if len(langs) >= 2:
        fortes.append(f"Explora {len(langs)} linguagens — perfil versátil.")
    if not fortes:
        fortes.append("Está começando sua jornada — cada passo conta!")

    # ─── O que melhorar ──────────────────────────
    melhorar = []
    if media < 7 and total > 0:
        melhorar.append(f"Média de {media}: revise os conceitos antes de enviar. Tente refazer exercícios anteriores.")
    if pend > 0:
        melhorar.append(f"{pend} atividade(s) pendente(s): tente enviar antes da correção acumular.")
    if reg > 7 and total > 1:
        melhorar.append(f"Intervalo médio de {reg} dias entre entregas: tente uma rotina mais frequente (2-3x por semana).")
    if total < 2:
        melhorar.append("Poucas atividades entregues: comece pelos exercícios básicos do Material de Estudos.")
    if certs == 0 and total >= 3:
        melhorar.append("Sem certificados ainda: converse com o professor sobre os requisitos para conseguir o seu!")

    # ─── Metas ───────────────────────────────────
    if total < 3:
        meta = "Entregar ao menos 2 atividades nesta semana."
    elif pend > 0:
        meta = "Zerar as atividades pendentes e enviar 1 nova."
    elif media < 7:
        meta = "Refazer 1 exercício antigo buscando nota acima de 8."
    else:
        meta = "Explorar uma nova linguagem no Material de Estudos e enviar 1 atividade."

    # ─── Montar texto final ──────────────────────
    txt = f"{emoji_nivel} DESEMPENHO: {nivel} (Score: {score}/100)\n\n"
    txt += f"{resumo}\n\n"
    txt += "PONTOS FORTES:\n"
    for i, f in enumerate(fortes[:3], 1):
        txt += f"  {i}. {f}\n"
    txt += "\nO QUE MELHORAR:\n"
    if melhorar:
        for i, m in enumerate(melhorar[:3], 1):
            txt += f"  {i}. {m}\n"
    else:
        txt += "  Continue assim! Sem pontos críticos no momento.\n"
    txt += f"\nMETA DA SEMANA:\n  {meta}"

    print(f"   🤖 ML analisou {metricas['nome']} → Score {score}/100")
    return txt


def gerar_analise(metricas: dict) -> str:
    """Tenta Gemini primeiro; se falhar, usa ML local."""
    texto = analisar_com_gemini(metricas)
    if texto:
        return texto
    print(f"   ↪ Usando ML local para {metricas['nome']}")
    return analisar_com_ml(metricas)


# ══════════════════════════════════════════════════════
#  3. GERAÇÃO DE GRÁFICOS (matplotlib → base64)
# ══════════════════════════════════════════════════════
def gerar_grafico_notas(metricas: dict) -> str:
    """Gera gráfico de barras das notas por atividade. Retorna base64 PNG."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.ticker as mticker
    except ImportError:
        print("   ⚠️ matplotlib não instalado — gráfico ignorado")
        return ""

    notas = metricas["notas"]
    if not notas:
        return ""

    labels = [f"Ativ {i+1}" for i in range(len(notas))]

    fig, ax = plt.subplots(figsize=(6, 3), dpi=120)
    fig.patch.set_facecolor("#161b22")
    ax.set_facecolor("#0d1117")

    cores = ["#3fb950" if n >= 7 else "#d29922" if n >= 5 else "#f85149" for n in notas]
    bars = ax.bar(labels, notas, color=cores, width=0.6, edgecolor="#30363d", linewidth=0.5)

    # Rótulo em cima de cada barra
    for bar, nota in zip(bars, notas):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2,
                f"{nota}", ha="center", va="bottom", fontsize=9, color="#e6edf3", fontweight="bold")

    # Linha de referência (média 7)
    ax.axhline(y=7, color="#4facde", linestyle="--", linewidth=1, alpha=0.6, label="Mínimo (7)")

    ax.set_ylim(0, 11)
    ax.set_ylabel("Nota", color="#8b949e", fontsize=10)
    ax.set_title(f"📊 Notas — {metricas['nome']}", color="#e6edf3", fontsize=12, fontweight="bold", pad=10)
    ax.tick_params(colors="#8b949e", labelsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#30363d")
    ax.spines["bottom"].set_color("#30363d")
    ax.yaxis.set_major_locator(mticker.MultipleLocator(2))
    ax.legend(fontsize=8, facecolor="#161b22", edgecolor="#30363d", labelcolor="#8b949e")

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def gerar_grafico_linguagens(metricas: dict) -> str:
    """Gera gráfico horizontal de barras por linguagem. Retorna base64 PNG."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return ""

    langs = metricas.get("linguagens", {})
    if not langs:
        return ""

    nomes  = list(langs.keys())
    medias = [langs[l]["media"] for l in nomes]
    totais = [langs[l]["total"] for l in nomes]

    fig, ax = plt.subplots(figsize=(6, max(2, len(nomes) * 0.7)), dpi=120)
    fig.patch.set_facecolor("#161b22")
    ax.set_facecolor("#0d1117")

    cores = ["#4facde" if m >= 7 else "#d29922" if m >= 5 else "#f85149" for m in medias]
    bars = ax.barh(nomes, medias, color=cores, height=0.5, edgecolor="#30363d", linewidth=0.5)

    for bar, media, total in zip(bars, medias, totais):
        label = f" {media} ({total} ativ.)" if media > 0 else f" ({total} ativ.)"
        ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height()/2,
                label, ha="left", va="center", fontsize=8, color="#e6edf3")

    ax.set_xlim(0, 11)
    ax.set_xlabel("Média", color="#8b949e", fontsize=10)
    ax.set_title("🔤 Desempenho por Linguagem", color="#e6edf3", fontsize=12, fontweight="bold", pad=10)
    ax.tick_params(colors="#8b949e", labelsize=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#30363d")
    ax.spines["bottom"].set_color("#30363d")
    ax.axvline(x=7, color="#3fb950", linestyle="--", linewidth=1, alpha=0.4)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def gerar_grafico_resumo(metricas: dict) -> str:
    """Gera mini-dashboard circular (gauge) com score geral. Retorna base64 PNG."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        return ""

    media = metricas["media_geral"]
    total = metricas["total_atividades"]
    certs = metricas["certificados"]

    fig, axes = plt.subplots(1, 3, figsize=(7, 2.5), dpi=120)
    fig.patch.set_facecolor("#161b22")

    items = [
        ("Média", media, 10, "#4facde"),
        ("Atividades", total, max(total + 3, 10), "#7ee8a2"),
        ("Certificados", certs, max(certs + 2, 5), "#bc8cff"),
    ]

    for ax, (label, val, max_val, color) in zip(axes, items):
        ax.set_facecolor("#161b22")
        pct = min(val / max_val, 1.0) if max_val > 0 else 0
        theta = np.linspace(0, 2 * np.pi * pct, 100)
        theta_bg = np.linspace(0, 2 * np.pi, 100)

        ax.plot(np.cos(theta_bg), np.sin(theta_bg), color="#30363d", linewidth=8, alpha=0.3)
        if len(theta) > 1:
            ax.plot(np.cos(theta), np.sin(theta), color=color, linewidth=8, solid_capstyle="round")

        ax.text(0, 0, f"{val}", ha="center", va="center", fontsize=18, fontweight="bold", color="#e6edf3")
        ax.text(0, -1.5, label, ha="center", va="center", fontsize=9, color="#8b949e")
        ax.set_xlim(-1.6, 1.6)
        ax.set_ylim(-2, 1.4)
        ax.set_aspect("equal")
        ax.axis("off")

    fig.suptitle(f"📈 Resumo — {metricas['nome']}", color="#e6edf3", fontsize=12, fontweight="bold", y=1.02)
    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ══════════════════════════════════════════════════════
#  4. ENVIO DE E-MAIL COM GRÁFICOS
# ══════════════════════════════════════════════════════
def enviar_email_insight(destinatario_email: str, destinatario_nome: str,
                         analise_texto: str, grafico_notas_b64: str,
                         grafico_langs_b64: str, grafico_resumo_b64: str) -> bool:
    """Envia e-mail HTML com análise textual e gráficos embutidos."""
    if not EMAIL_PASSWORD:
        print("❌ EMAIL_PASSWORD não configurada no .env!")
        return False
    if not destinatario_email:
        print("❌ E-mail do destinatário vazio!")
        return False

    try:
        msg = MIMEMultipart("related")
        msg["From"]    = f"{SENDER_NAME} <{EMAIL_SENDER}>"
        msg["To"]      = destinatario_email
        msg["Subject"] = f"📊 Seu Insight Semanal — Tech Start Academy"

        analise_html = analise_texto.replace("\n", "<br>")

        # Blocos de imagem para CID
        img_sections = ""
        cid_idx = 0
        images_to_attach = []

        if grafico_resumo_b64:
            cid_idx += 1
            img_sections += f'<img src="cid:chart{cid_idx}" style="width:100%;max-width:560px;border-radius:8px;margin:12px 0" alt="Resumo">'
            images_to_attach.append((f"chart{cid_idx}", grafico_resumo_b64))

        if grafico_notas_b64:
            cid_idx += 1
            img_sections += f'<img src="cid:chart{cid_idx}" style="width:100%;max-width:560px;border-radius:8px;margin:12px 0" alt="Notas">'
            images_to_attach.append((f"chart{cid_idx}", grafico_notas_b64))

        if grafico_langs_b64:
            cid_idx += 1
            img_sections += f'<img src="cid:chart{cid_idx}" style="width:100%;max-width:560px;border-radius:8px;margin:12px 0" alt="Linguagens">'
            images_to_attach.append((f"chart{cid_idx}", grafico_langs_b64))

        html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif">
<div style="max-width:620px;margin:0 auto;padding:20px">

  <div style="background:linear-gradient(135deg,#4facde,#7ee8a2);border-radius:12px 12px 0 0;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">🚀 Tech Start Academy</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px">Relatório de Desempenho Personalizado</p>
  </div>

  <div style="background:#161b22;border:1px solid #30363d;border-top:none;padding:28px;border-radius:0 0 12px 12px">
    <p style="color:#e6edf3;font-size:16px;margin:0 0 20px">
      Olá, <strong>{destinatario_nome}</strong>! 👋
    </p>

    <p style="color:#8b949e;font-size:13px;margin:0 0 16px">
      Aqui está sua análise de desempenho gerada automaticamente com Inteligência Artificial:
    </p>

    {img_sections}

    <div style="background:#1c2128;border:1px solid #30363d;border-left:4px solid #4facde;border-radius:0 8px 8px 0;padding:20px;margin:20px 0">
      <p style="font-size:13px;font-weight:700;color:#4facde;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em">
        🤖 Análise da IA
      </p>
      <p style="color:#e6edf3;font-size:14px;line-height:1.8;margin:0">{analise_html}</p>
    </div>

    <div style="text-align:center;margin:24px 0">
      <p style="color:#8b949e;font-size:12px">Continue praticando e entregando atividades!</p>
      <p style="color:#4facde;font-size:14px;font-weight:700">💡 Dúvidas? Use o ChatBot na plataforma!</p>
    </div>

    <hr style="border:none;border-top:1px solid #30363d;margin:24px 0">
    <p style="color:#6e7681;font-size:11px;text-align:center;margin:0">
      E-mail enviado automaticamente pela Tech Start Academy<br>
      Gerado em {datetime.now().strftime("%d/%m/%Y às %H:%M")}
    </p>
  </div>
</div>
</body></html>"""

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(analise_texto, "plain", "utf-8"))
        alt.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(alt)

        # Anexar imagens com CID
        for cid, b64data in images_to_attach:
            img = MIMEImage(base64.b64decode(b64data), _subtype="png")
            img.add_header("Content-ID", f"<{cid}>")
            img.add_header("Content-Disposition", "inline")
            msg.attach(img)

        # Enviar via SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_SENDER, destinatario_email, msg.as_string())

        print(f"   ✅ E-mail enviado → {destinatario_email}")
        return True

    except smtplib.SMTPAuthenticationError:
        print(f"   ❌ Autenticação SMTP falhou! Verifique EMAIL_PASSWORD no .env")
        return False
    except Exception as e:
        print(f"   ❌ Erro ao enviar e-mail para {destinatario_email}: {e}")
        return False


# Função legada de compatibilidade (usada pelo app.py para e-mails simples)
def enviar_email(destinatario_email: str, destinatario_nome: str,
                 assunto: str, corpo: str) -> bool:
    """Envia um e-mail simples (sem gráficos)."""
    if not EMAIL_PASSWORD:
        print("❌ EMAIL_PASSWORD não configurada!")
        return False

    try:
        msg_obj = MIMEMultipart("alternative")
        msg_obj["From"]    = f"{SENDER_NAME} <{EMAIL_SENDER}>"
        msg_obj["To"]      = destinatario_email
        msg_obj["Subject"] = assunto

        html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Segoe UI',Tahoma,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#4facde,#7ee8a2);border-radius:12px 12px 0 0;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">🚀 Tech Start Academy</h1>
  </div>
  <div style="background:#161b22;border:1px solid #30363d;border-top:none;padding:28px;border-radius:0 0 12px 12px">
    <p style="color:#e6edf3;font-size:16px;margin:0 0 16px">Olá, <strong>{destinatario_nome}</strong>! 👋</p>
    <div style="background:#1c2128;border:1px solid #30363d;border-radius:8px;padding:20px;margin:16px 0">
      <p style="color:#e6edf3;font-size:14px;line-height:1.7;margin:0;white-space:pre-line">{corpo}</p>
    </div>
    <hr style="border:none;border-top:1px solid #30363d;margin:24px 0">
    <p style="color:#8b949e;font-size:12px;text-align:center;margin:0">Tech Start Academy — E-mail automático</p>
  </div>
</div></body></html>"""

        msg_obj.attach(MIMEText(corpo, "plain", "utf-8"))
        msg_obj.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_SENDER, destinatario_email, msg_obj.as_string())

        print(f"   ✅ E-mail simples enviado → {destinatario_email}")
        return True
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False


# ══════════════════════════════════════════════════════
#  5. PIPELINE COMPLETO: ANALISAR + ENVIAR PARA TODOS
# ══════════════════════════════════════════════════════
def executar_insights_todos_alunos():
    """Pipeline completo: coleta dados → analisa → gera gráficos → envia e-mail."""
    print(f"\n{'='*60}")
    print(f"  🚀 PIPELINE DE INSIGHTS — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"{'='*60}")

    dados = carregar_dados()
    users = dados.get("users", [])
    alunos = [u for u in users if u.get("role") == "user"]

    if not alunos:
        print("⚠️  Nenhum aluno encontrado.")
        return {"total": 0, "enviados": 0, "falhas": 0}

    print(f"📋 {len(alunos)} aluno(s) encontrado(s)\n")

    enviados = 0
    falhas   = 0

    for user in alunos:
        uid   = user["id"]
        nome  = user.get("name", "Aluno")
        email = user.get("email", "")

        print(f"👤 Processando: {nome} ({email})")

        if not email or "@" not in email:
            print(f"   ⏭️ Sem e-mail válido, pulando.")
            falhas += 1
            continue

        # 1. Coletar métricas
        metricas = coletar_metricas_aluno(uid, dados)
        if not metricas:
            print(f"   ⏭️ Sem métricas, pulando.")
            falhas += 1
            continue

        # 2. Gerar análise (Gemini → ML)
        analise = gerar_analise(metricas)

        # 3. Gerar gráficos
        g_resumo = gerar_grafico_resumo(metricas)
        g_notas  = gerar_grafico_notas(metricas)
        g_langs  = gerar_grafico_linguagens(metricas)

        # 4. Enviar e-mail
        ok = enviar_email_insight(
            destinatario_email=email,
            destinatario_nome=nome,
            analise_texto=analise,
            grafico_notas_b64=g_notas,
            grafico_langs_b64=g_langs,
            grafico_resumo_b64=g_resumo
        )

        if ok:
            enviados += 1
        else:
            falhas += 1
        print()

    resultado = {"total": len(alunos), "enviados": enviados, "falhas": falhas}
    print(f"{'='*60}")
    print(f"  ✅ Concluído: {enviados} enviado(s), {falhas} falha(s)")
    print(f"{'='*60}\n")
    return resultado


# ══════════════════════════════════════════════════════
#  6. AGENDADOR DIÁRIO (12:00)
# ══════════════════════════════════════════════════════
_scheduler_running = False

def _loop_agendador():
    """Loop que verifica a cada 30s se já é meio-dia para disparar os insights."""
    global _scheduler_running
    _scheduler_running = True
    ultimo_disparo = None

    print("⏰ Agendador de insights iniciado — dispara todo dia às 12:00")

    while _scheduler_running:
        agora = datetime.now()
        hoje  = agora.strftime("%Y-%m-%d")

        # Dispara se for entre 12:00 e 12:01 e ainda não disparou hoje
        if agora.hour == 12 and agora.minute == 0 and ultimo_disparo != hoje:
            print(f"\n⏰ [SCHEDULER] Disparando insights — {agora.strftime('%d/%m/%Y %H:%M')}")
            try:
                executar_insights_todos_alunos()
            except Exception as e:
                print(f"❌ [SCHEDULER] Erro no pipeline: {e}")
            ultimo_disparo = hoje

        time.sleep(30)  # Verifica a cada 30 segundos


def iniciar_agendador():
    """Inicia o agendador em uma thread separada (não-bloqueante)."""
    global _scheduler_running
    if _scheduler_running:
        print("⏰ Agendador já está rodando.")
        return

    t = threading.Thread(target=_loop_agendador, daemon=True)
    t.start()
    print("✅ Thread do agendador iniciada (daemon)")


def parar_agendador():
    """Para o agendador."""
    global _scheduler_running
    _scheduler_running = False
    print("⏹️ Agendador parado.")


# ══════════════════════════════════════════════════════
#  EXECUÇÃO DIRETA (teste)
# ══════════════════════════════════════════════════════
if __name__ == "__main__":
    print("🧪 Tech Start Academy — Teste de Insights\n")

    if not EMAIL_PASSWORD:
        print("⚠️  Configure EMAIL_PASSWORD no .env primeiro!")
        print("   EMAIL_SENDER=vitorvargem27@gmail.com")
        print("   EMAIL_PASSWORD=<senha_de_app_16_chars>")
        print("\n📊 Executando análise sem envio...\n")

    dados = carregar_dados()
    users = [u for u in dados.get("users", []) if u.get("role") == "user"]

    for u in users:
        m = coletar_metricas_aluno(u["id"], dados)
        if m:
            print(f"\n{'─'*50}")
            print(f"👤 {m['nome']} ({m['email']})")
            print(f"   Atividades: {m['total_atividades']} | Média: {m['media_geral']} | Certs: {m['certificados']}")
            analise = gerar_analise(m)
            print(f"\n{analise}")
            print(f"{'─'*50}")

    if EMAIL_PASSWORD:
        print("\n🚀 Executando pipeline completo...")
        executar_insights_todos_alunos()
