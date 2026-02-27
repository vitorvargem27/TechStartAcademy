# Tech Start Academy — Plataforma de Ensino v4

## Estrutura do Projeto
```
├── index.html              # Frontend (SPA com integração API)
├── app.py                  # Backend Flask (Python)
├── tsa_database.json       # Banco de dados JSON
├── Logo_Tech_Start_Academy.png  # Logo da plataforma
├── requirements.txt        # Dependências Python
├── manifest.json           # PWA manifest
└── .env.example            # Exemplo de variáveis de ambiente
```

## Como Rodar

### 1. Backend (Flask)
```bash
# Instale as dependências
pip install -r requirements.txt

# (Opcional) Configure a chave Gemini no .env
# GEMINI_API_KEY=sua_chave_aqui

# Inicie o servidor
python app.py
```
O backend roda em `http://localhost:5000`

### 2. Frontend
Abra o `index.html` com **Live Server (GoLive)** no VSCode.  
O frontend conecta automaticamente ao backend na porta 5000.

### Credenciais Padrão
| Usuário | Senha | Tipo |
|---------|-------|------|
| admin   | Vvjb1234# | Administrador |
| joao    | senha123  | Aluno |
| maria   | senha123  | Aluno |

## Funcionalidades
- **Dashboard Admin** — Estatísticas, gráficos, gestão de alunos
- **Atividades** — Envio de código, correção com notas
- **Material de Estudos** — 8 linguagens/frameworks com exemplos
- **Chat com IA** — CodeBot powered by Google Gemini 2.5 Flash
- **Certificados** — Upload de PDF por aluno
- **Mensagens** — Comunicação professor-aluno
- **Acessibilidade** — Temas, daltonismo, dislexia, TDAH, tamanho fonte
- **Responsivo** — Funciona em celular, tablet e desktop

## Mudanças v4
- Frontend 100% integrado com backend Flask via API REST
- Dados persistidos no `tsa_database.json` (não mais localStorage)
- Tela de carregamento removida — página carrega instantaneamente
- Dashboard responsivo com layout melhorado
- Logos reais das linguagens de programação nas atividades
- Logo personalizada da Tech Start Academy
- Responsividade completa para todos os dispositivos
