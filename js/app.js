'use strict';
// ══════════════════════════════════════════════
//  TECH START ACADEMY · Self-Contained v5
//  Backend JS para auth/dados | Python apenas para chatbot
// ══════════════════════════════════════════════

const CHATBOT_API = 'http://localhost:8090';
const LOGO_PATH = 'assets/Logo_Tech_Start_Academy.png';
const BOT_AVATAR = 'assets/bot-avatar.svg';

// ─── LANGUAGE LOGOS ──────────────────────────
const LANG_LOGOS = {
  Python:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
  JavaScript:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
  Java:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
  HTML:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg',
  CSS:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg',
  Angular:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg',
  SpringBoot:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/spring/spring-original.svg',
  ROBOT:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytest/pytest-original.svg',
  Python_OO:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
  TypeScript:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
  React:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
  NodeJS:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
  SQL:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg',
  Git:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',
  Logica:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/devicon/devicon-original.svg',
  Outro:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/devicon/devicon-original.svg',
  Geral:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/devicon/devicon-original.svg',
};
const LANG_EMOJIS={Python:'🐍',JavaScript:'🌐',Java:'☕',HTML:'🧱',CSS:'🎨',Angular:'🔺',SpringBoot:'🌱',ROBOT:'🤖',Python_OO:'🐍',TypeScript:'🔷',React:'⚛️',NodeJS:'🟢',SQL:'🗄️',Git:'📦',Logica:'🧠',Outro:'💻',Geral:'📚'};

function langImg(lang,cls='lang-logo'){const src=LANG_LOGOS[lang]||LANG_LOGOS.Outro;return `<img src="${src}" alt="${lang}" class="${cls}" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=font-size:32px>${LANG_EMOJIS[lang]||'💻'}</span>')">`;}

// ═══════════════════════════════════════════════
//  DB — GitHub API como banco de dados persistente
//  Lê e grava tsa_database.json no repositório
//  localStorage apenas como cache rápido
// ═══════════════════════════════════════════════

// ─── GitDB: camada de acesso ao GitHub Contents API ───
const GitDB = {
  _cfgKey: 'tsa_github_cfg',

  // Retorna config salva {token, owner, repo, branch, path}
  getConfig() {
    try { return JSON.parse(localStorage.getItem(this._cfgKey)) || null; } catch(_) { return null; }
  },
  saveConfig(cfg) {
    localStorage.setItem(this._cfgKey, JSON.stringify(cfg));
  },
  isConfigured() {
    const c = this.getConfig();
    return !!(c && c.token && c.owner && c.repo);
  },

  // Lê o arquivo JSON do repositório via GitHub API
  async read() {
    const c = this.getConfig();
    if (!c) return null;
    try {
      const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${c.path || 'data/tsa_database.json'}?ref=${c.branch || 'main'}&t=${Date.now()}`;
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${c.token}`, 'Accept': 'application/vnd.github.v3+json', 'If-None-Match': '' }
      });
      if (!r.ok) { console.warn('[GitDB] Falha ao ler:', r.status); return null; }
      const meta = await r.json();
      const content = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
      return { data: JSON.parse(content), sha: meta.sha };
    } catch (e) { console.warn('[GitDB] Erro ao ler:', e); return null; }
  },

  // Grava o arquivo JSON no repositório via GitHub API (commit)
  async write(data, sha) {
    const c = this.getConfig();
    if (!c) return false;
    try {
      const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${c.path || 'data/tsa_database.json'}`;
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      const body = {
        message: `[TSA] Atualização automática — ${new Date().toISOString()}`,
        content: encoded,
        branch: c.branch || 'main'
      };
      if (sha) body.sha = sha;
      const r = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${c.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.warn('[GitDB] Falha ao gravar:', r.status, err.message);
        // Se SHA está desatualizado, re-lê e tenta novamente
        if (r.status === 409 || (err.message && err.message.includes('sha'))) {
          console.log('[GitDB] Conflito de SHA, relendo...');
          const fresh = await this.read();
          if (fresh) {
            body.sha = fresh.sha;
            const r2 = await fetch(url, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${c.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
              body: JSON.stringify(body)
            });
            if (r2.ok) {
              const result = await r2.json();
              return result.content?.sha || true;
            }
          }
        }
        return false;
      }
      const result = await r.json();
      return result.content?.sha || true;
    } catch (e) { console.warn('[GitDB] Erro ao gravar:', e); return false; }
  }
};

const DB = {
  _d: null,
  _sha: null,           // SHA do arquivo no GitHub (necessário para commits)
  _key: 'tsa_db_v5',
  _saveTimer: null,      // Debounce para não commitar a cada micro-alteração
  _saving: false,

  async init() {
    // 1) SEMPRE tenta ler do GitHub primeiro (fonte de verdade)
    if (GitDB.isConfigured()) {
      try {
        const remote = await GitDB.read();
        if (remote && remote.data) {
          console.log('[DB] ✅ Dados carregados do GitHub (tsa_database.json)');
          this._d = remote.data;
          this._sha = remote.sha;
        }
      } catch (e) { console.warn('[DB] Erro ao ler do GitHub:', e); }
    }

    // 2) Se não conseguiu do GitHub, tenta fetch local (GoLive / dev server)
    if (!this._d) {
      try {
        const r = await fetch('data/tsa_database.json?t=' + Date.now());
        if (r.ok) {
          this._d = await r.json();
          console.log('[DB] ✅ Dados carregados do JSON local (fetch)');
        }
      } catch (e) { console.warn('[DB] Fetch local falhou:', e); }
    }

    // 3) Se nada funcionou, usa cache do localStorage
    if (!this._d) {
      const stored = localStorage.getItem(this._key);
      if (stored) {
        try {
          this._d = JSON.parse(stored);
          console.log('[DB] ⚠️ Usando cache localStorage (fallback)');
        } catch (e) { this._d = null; }
      }
    }

    // 4) Último recurso: seed mínimo embutido
    if (!this._d) {
      console.log('[DB] 🔄 Usando seed padrão embutido');
      this._d = {
        users: [
          { id:'u-admin', username:'admin', password:'Vvjb1234#', role:'admin', name:'Administrador', email:'admin@techstart.com', avatar:'', createdAt:new Date().toISOString() }
        ],
        activities: [],
        homework: [],
        certificates: [],
        messages: [],
        chat_histories: {}
      };
    }

    // Garante campos obrigatórios
    if (!this._d.homework) this._d.homework = [];
    if (!this._d.chat_histories) this._d.chat_histories = {};
    if (!this._d.activities) this._d.activities = [];
    if (!this._d.certificates) this._d.certificates = [];
    if (!this._d.messages) this._d.messages = [];

    // Salva no cache local
    this._saveLocal();
  },

  // Salva apenas no localStorage (rápido, síncrono)
  _saveLocal() {
    try { localStorage.setItem(this._key, JSON.stringify(this._d)); } catch (e) {}
  },

  // Salva no localStorage + agenda commit no GitHub (debounced)
  _save() {
    this._saveLocal();
    // Debounce: espera 1.5s de inatividade antes de commitar
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._commitToGitHub(), 1500);
  },

  // Commit real no GitHub
  async _commitToGitHub() {
    if (!GitDB.isConfigured() || this._saving) return;
    this._saving = true;
    try {
      // Clona dados sem campos pesados demais (chat_histories e avatars base64 podem ser grandes)
      const dataToSave = JSON.parse(JSON.stringify(this._d));
      const result = await GitDB.write(dataToSave, this._sha);
      if (result) {
        if (typeof result === 'string') this._sha = result;
        console.log('[DB] ✅ Dados salvos no GitHub com sucesso');
      } else {
        console.warn('[DB] ⚠️ Falha ao salvar no GitHub (dados salvos localmente)');
      }
    } catch (e) {
      console.warn('[DB] Erro ao commitar:', e);
    }
    this._saving = false;
  },

  // Força sync manual (útil para admin)
  async forceSync() {
    if (!GitDB.isConfigured()) return { ok: false, error: 'GitHub não configurado' };
    this._saving = false;
    await this._commitToGitHub();
    return { ok: true };
  },

  // Força reload do GitHub
  async forceReload() {
    if (!GitDB.isConfigured()) return { ok: false, error: 'GitHub não configurado' };
    const remote = await GitDB.read();
    if (remote && remote.data) {
      this._d = remote.data;
      this._sha = remote.sha;
      if (!this._d.homework) this._d.homework = [];
      if (!this._d.chat_histories) this._d.chat_histories = {};
      this._saveLocal();
      return { ok: true };
    }
    return { ok: false, error: 'Não foi possível ler do GitHub' };
  },
  async dispararInsights() {
    try {
      const r = await fetch(CHATBOT_API + '/api/run-insights', {method:'POST'});
      const d = await r.json();
      return d;
    } catch(e) { return {success:false, detail:String(e)}; }
  },
  async analisarAluno(userId) {
    try {
      const r = await fetch(CHATBOT_API + '/api/analyze', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({user_id: userId})
      });
      return await r.json();
    } catch(e) { return {success:false, detail:String(e)}; }
  },

  // ─── USERS ───
  getUsers() { return this._d.users || []; },
  getUserById(id) { return this._d.users.find(u => u.id === id); },
  getUserByUsername(un) { return this._d.users.find(u => u.username === un); },
  addUser(u) { this._d.users.push(u); this._save(); },
  updateUser(id, data) {
    const i = this._d.users.findIndex(u => u.id === id);
    if(i>=0){ Object.assign(this._d.users[i], data); this._save(); return true; }
    return false;
  },

  // ─── ACTIVITIES ───
  getActivities(uid) { return uid ? this._d.activities.filter(a => a.userId === uid) : this._d.activities; },
  addActivity(a) { this._d.activities.push(a); this._save(); return true; },
  gradeActivity(id, data) {
    const i = this._d.activities.findIndex(a => a.id === id);
    if(i>=0){ Object.assign(this._d.activities[i], data, {status:'graded'}); this._save(); return true; }
    return false;
  },

  // ─── HOMEWORK ───
  getHomework() { return this._d.homework || []; },
  addHomework(h) { this._d.homework.push(h); this._save(); return true; },
  deleteHomework(id) { this._d.homework = this._d.homework.filter(h=>h.id!==id); this._save(); return true; },

  // ─── CERTIFICATES ───
  getCertificates(uid) { return uid ? this._d.certificates.filter(c=>c.userId===uid) : this._d.certificates; },
  addCertificate(c) { this._d.certificates.push(c); this._save(); return true; },
  deleteCertificate(id) { this._d.certificates = this._d.certificates.filter(c=>c.id!==id); this._save(); return true; },

  // ─── MESSAGES ───
  getMessages(uid) { return uid ? this._d.messages.filter(m=>m.toId===uid) : this._d.messages; },
  getAllMessages() { return this._d.messages; },
  addMessage(m) { this._d.messages.push(m); this._save(); return true; },
  markRead(id) { const m = this._d.messages.find(x=>x.id===id); if(m){m.read=true;this._save();} },
};

// ═══════════════════════════════════════════════
//  AUTH — 100% JavaScript, sem backend
// ═══════════════════════════════════════════════
const Auth = {
  currentUser: null,
  _key: 'tsa_auth',

  init() {
    const s = sessionStorage.getItem(this._key);
    if(s) {
      try {
        this.currentUser = JSON.parse(s);
        // Revalida contra DB
        const dbUser = DB.getUserById(this.currentUser.id);
        if(!dbUser) { this.currentUser = null; sessionStorage.removeItem(this._key); }
        else { this.currentUser = {...dbUser}; }
      } catch(e) { this.currentUser = null; }
    }
  },

  isLoggedIn() { return !!this.currentUser; },
  isAdmin() { return this.currentUser?.role === 'admin'; },

  login(username, password) {
    const u = DB.getUserByUsername(username);
    if(u && u.password === password) {
      this.currentUser = {...u};
      sessionStorage.setItem(this._key, JSON.stringify(this.currentUser));
      return { ok: true, user: this.currentUser };
    }
    return { ok: false, error: 'Usuário ou senha incorretos.' };
  },

  register(data) {
    if(DB.getUserByUsername(data.username)) return { ok:false, error:'Usuário já existe.' };
    const u = { id:'u-'+Date.now(), ...data, role:'user', avatar:'', createdAt:new Date().toISOString() };
    DB.addUser(u);
    return { ok: true };
  },

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem(this._key);
    Router.go('login');
  },

  refreshUser() {
    const u = DB.getUserById(this.currentUser?.id);
    if(u){ this.currentUser = {...u}; sessionStorage.setItem(this._key, JSON.stringify(this.currentUser)); }
  },

  need() { if(!this.isLoggedIn()){Router.go('login');return false;} return true; },
  needAdmin() { if(!this.isLoggedIn()){Router.go('login');return false;} if(!this.isAdmin()){Toast.show('Acesso negado.','err');Router.go('login');return false;} return true; }
};

// ─── ROUTER ──────────────────────────────────
const Router = { page:'', go(page){ this.page=page; App.render(page); window.scrollTo(0,0); const sb=document.getElementById('sidebar'); if(sb) sb.classList.remove('open'); }};

// ─── TOAST ───────────────────────────────────
const Toast = {
  show(msg,type='info',dur=3500){
    const wrap=document.getElementById('toast-wrap');if(!wrap)return;
    const icons={ok:'✅',err:'❌',info:'ℹ️',warn:'⚠️'};
    const el=document.createElement('div');el.className=`toast ${type}`;
    el.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    wrap.appendChild(el);
    setTimeout(()=>{el.style.transition='.3s';el.style.opacity='0';el.style.transform='translateX(100%)';setTimeout(()=>el.remove(),300);},dur);
  }
};

// ─── A11Y ────────────────────────────────────
const A11y = {
  s:{theme:'dark',dyslexia:false,adhd:false,fontSize:'normal',ttsEnabled:false,ttsRate:1,ttsVoice:''},
  open:false,
  _synth:window.speechSynthesis||null,
  _speaking:false,
  init(){try{const saved=localStorage.getItem('tsa_a11y');if(saved)this.s={...this.s,...JSON.parse(saved)};}catch(_){}this._apply();},
  _apply(){
    const h=document.documentElement;
    h.setAttribute('data-theme',this.s.theme);
    h.setAttribute('data-dyslexia',this.s.dyslexia);
    h.setAttribute('data-adhd',this.s.adhd);
    h.setAttribute('data-fontsize',this.s.fontSize);
    try{localStorage.setItem('tsa_a11y',JSON.stringify(this.s));}catch(_){}
  },
  setTheme(t){this.s.theme=t;this._apply();this._refresh();},
  setFont(f){this.s.fontSize=f;this._apply();this._refresh();},
  toggle(){this.open=!this.open;this._refresh();},
  close(){this.open=false;this._refresh();},
  _refresh(){const c=document.getElementById('a11y-container');if(c)c.innerHTML=this._html();},

  // ─── TTS ────────────────────────────────────
  ttsToggle(){
    this.s.ttsEnabled=!this.s.ttsEnabled;
    this._apply();this._refresh();
    if(!this.s.ttsEnabled) this.ttsStop();
    Toast.show(this.s.ttsEnabled?'🔊 Texto-para-Áudio ativado':'🔇 Texto-para-Áudio desativado','info');
  },
  ttsSpeak(text){
    if(!this._synth||!this.s.ttsEnabled)return;
    this.ttsStop();
    const clean=text.replace(/<[^>]*>/g,' ').replace(/[{}()\[\]`#*_~|]/g,' ').replace(/\s+/g,' ').trim();
    if(!clean)return;
    const utt=new SpeechSynthesisUtterance(clean);
    utt.lang='pt-BR';
    utt.rate=this.s.ttsRate||1;
    const voices=this._synth.getVoices();
    const ptVoice=voices.find(v=>v.lang.startsWith('pt')&&v.name.toLowerCase().includes('google'))||voices.find(v=>v.lang.startsWith('pt'));
    if(ptVoice) utt.voice=ptVoice;
    utt.onstart=()=>{this._speaking=true;this._updateTTSBtn();};
    utt.onend=()=>{this._speaking=false;this._updateTTSBtn();};
    utt.onerror=()=>{this._speaking=false;this._updateTTSBtn();};
    this._synth.speak(utt);
  },
  ttsStop(){if(this._synth){this._synth.cancel();this._speaking=false;this._updateTTSBtn();}},
  ttsSetRate(r){this.s.ttsRate=parseFloat(r);this._apply();},
  ttsSpeakPage(){
    const main=document.querySelector('.page');
    if(main) this.ttsSpeak(main.innerText);
  },
  _updateTTSBtn(){
    const btn=document.getElementById('tts-float-btn');
    if(btn){if(this._speaking){btn.classList.add('playing');btn.textContent='⏹️';}else{btn.classList.remove('playing');btn.textContent='🔊';}}
  },

  _html(){
    const s=this.s,o=this.open;
    return `<div class="a11y-panel${o?' open':''}" id="a11y-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:800;font-size:14px">♿ Acessibilidade</span>
        <button onclick="A11y.close()" style="background:none;border:none;color:var(--tx2);cursor:pointer;font-size:18px;line-height:1">×</button>
      </div>
      <div class="a11y-st">🎨 Tema</div>
      <div class="a11y-g">
        <button class="a11y-o${s.theme==='dark'?' on':''}" onclick="A11y.setTheme('dark')">🌙 Escuro</button>
        <button class="a11y-o${s.theme==='light'?' on':''}" onclick="A11y.setTheme('light')">☀️ Claro</button>
      </div>
      <div class="a11y-st">👁️ Daltonismo</div>
      <div class="a11y-g">
        <button class="a11y-o${s.theme==='deuteranopia'?' on':''}" onclick="A11y.setTheme('deuteranopia')">Deuteranopia</button>
        <button class="a11y-o${s.theme==='protanopia'?' on':''}" onclick="A11y.setTheme('protanopia')">Protanopia</button>
        <button class="a11y-o${s.theme==='tritanopia'?' on':''}" onclick="A11y.setTheme('tritanopia')">Tritanopia</button>
      </div>
      <div class="a11y-st">📝 Tamanho da Fonte</div>
      <div class="a11y-g">
        <button class="a11y-o${s.fontSize==='normal'?' on':''}" onclick="A11y.setFont('normal')">A Normal</button>
        <button class="a11y-o${s.fontSize==='large'?' on':''}" onclick="A11y.setFont('large')">A+ Grande</button>
        <button class="a11y-o${s.fontSize==='xlarge'?' on':''}" onclick="A11y.setFont('xlarge')">A++ Extra</button>
      </div>
      <div class="a11y-st">📖 Leitura</div>
      <div class="a11y-g">
        <button class="a11y-o${!s.dyslexia?' on':''}" onclick="A11y.s.dyslexia=false;A11y._apply();A11y._refresh()">Normal</button>
        <button class="a11y-o${s.dyslexia?' on':''}" onclick="A11y.s.dyslexia=true;A11y._apply();A11y._refresh()">🔤 Dislexia</button>
      </div>
      <div class="a11y-st">🧠 TDAH / Foco</div>
      <div class="a11y-g">
        <button class="a11y-o${s.adhd?' on':''}" onclick="A11y.s.adhd=!A11y.s.adhd;A11y._apply();A11y._refresh()">🎯 Modo TDAH ${s.adhd?'ON':'OFF'}</button>
      </div>
      ${s.adhd?'<div style="font-size:11px;color:var(--ac);margin-top:6px;padding:6px 8px;background:rgba(79,172,222,.08);border-radius:6px">✅ <b>Modo TDAH ativo:</b> Animações desligadas, foco em um item por vez, layout simplificado, régua de leitura, indicador visual no topo.</div>':''}
      <div class="a11y-st">🔊 Texto para Áudio (TTS)</div>
      <div class="a11y-g">
        <button class="a11y-o${s.ttsEnabled?' on':''}" onclick="A11y.ttsToggle()">🔊 TTS ${s.ttsEnabled?'ON':'OFF'}</button>
      </div>
      ${s.ttsEnabled?`<div style="margin-top:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:11px;color:var(--tx2);white-space:nowrap">🐢 Velocidade:</span>
          <input type="range" class="tts-range" min="0.5" max="2" step="0.1" value="${s.ttsRate||1}" oninput="A11y.ttsSetRate(this.value);document.getElementById('tts-rate-val').textContent=this.value+'x'">
          <span id="tts-rate-val" style="font-size:11px;color:var(--ac);font-weight:700;min-width:30px">${s.ttsRate||1}x</span>
        </div>
        <div class="a11y-g" style="margin-top:4px">
          <button class="a11y-o" onclick="A11y.ttsSpeakPage()">▶️ Ler Página</button>
          <button class="a11y-o" onclick="A11y.ttsStop()">⏹️ Parar</button>
        </div>
        <div style="font-size:11px;color:var(--ac);margin-top:6px;padding:6px 8px;background:rgba(79,172,222,.08);border-radius:6px">💡 <b>Dica:</b> Com o TTS ativado, clique no botão 🔊 ao lado de textos e cards para ouvir o conteúdo.</div>
      </div>`:''}
      <div class="a11y-st">🤟 Libras</div>
      <div style="font-size:12px;color:var(--tx2);padding:4px 0">Use o widget <strong>VLibras</strong> no canto inferior da tela para tradução em Língua de Sinais.</div>
    </div>`;
  }
};

// ─── UTILS ───────────────────────────────────
const mkId=()=>'id-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const fmtDt=iso=>{if(!iso)return'-';const d=new Date(iso);return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});};
const fmtD=iso=>iso?new Date(iso).toLocaleDateString('pt-BR'):'-';
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ini=n=>(n||'U').split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase();
function gcls(g){if(g===null||g===undefined)return'p';if(g>=7)return'g';if(g>=5)return'y';return'r';}
function avHtml(user,size=36){const st=`width:${size}px;height:${size}px;font-size:${Math.round(size*.36)}px;flex-shrink:0`;if(user&&user.avatar)return`<img src="${user.avatar}" style="${st};border-radius:50%;object-fit:cover" alt="">`;return`<div class="av" style="${st}">${ini(user?.name)}</div>`;}

// ═══════════════════════════════════════════════
//  EXERCISES — Expanded content
// ═══════════════════════════════════════════════
const EX = {
  Python:[
    {title:'Olá, Mundo!',desc:'Exiba "Olá, Mundo!" usando print().',code:'# Seu código aqui\nprint("Olá, Mundo!")'},
    {title:'Calculadora',desc:'Crie funções para as 4 operações.',code:'def somar(a, b):\n    return a + b\n\ndef subtrair(a, b):\n    return a - b\n\ndef multiplicar(a, b):\n    return a * b\n\ndef dividir(a, b):\n    if b == 0:\n        return "Erro: divisão por zero"\n    return a / b\n\nprint(somar(10, 5))\nprint(dividir(10, 0))'},
    {title:'Par ou Ímpar',desc:'Diga se um número é par ou ímpar.',code:'numero = int(input("Número: "))\nif numero % 2 == 0:\n    print("Par")\nelse:\n    print("Ímpar")'},
    {title:'Fibonacci',desc:'Gere os N primeiros números de Fibonacci.',code:'def fibonacci(n):\n    seq = [0, 1]\n    for i in range(2, n):\n        seq.append(seq[-1] + seq[-2])\n    return seq[:n]\n\nprint(fibonacci(10))'},
    {title:'Lista de Compras',desc:'CRUD de lista com while loop.',code:'lista = []\nwhile True:\n    op = input("1-Add 2-Ver 3-Remover 0-Sair: ")\n    if op == "1":\n        item = input("Item: ")\n        lista.append(item)\n    elif op == "2":\n        for i, item in enumerate(lista, 1):\n            print(f"{i}. {item}")\n    elif op == "3":\n        idx = int(input("Índice: ")) - 1\n        if 0 <= idx < len(lista):\n            lista.pop(idx)\n    elif op == "0":\n        break'},
    {title:'Dicionários',desc:'Cadastro de contatos com dict.',code:'contatos = {}\n\ndef adicionar(nome, tel):\n    contatos[nome] = tel\n    print(f"{nome} adicionado!")\n\ndef buscar(nome):\n    return contatos.get(nome, "Não encontrado")\n\nadicionar("Ana", "11999991234")\nprint(buscar("Ana"))'},
  ],
  JavaScript:[
    {title:'Olá do Browser',desc:'Use alert e console.log.',code:'alert("Olá!");\nconsole.log("JavaScript! 🚀");'},
    {title:'Arrow Functions',desc:'Crie funções com =>.',code:'const saudar = nome => `Olá, ${nome}!`;\nconsole.log(saudar("Ana"));'},
    {title:'FizzBuzz',desc:'1-100: Fizz, Buzz ou FizzBuzz.',code:'for (let i=1;i<=100;i++) {\n  if(i%15===0) console.log("FizzBuzz");\n  else if(i%3===0) console.log("Fizz");\n  else if(i%5===0) console.log("Buzz");\n  else console.log(i);\n}'},
    {title:'Fetch API',desc:'Consuma uma API pública.',code:'async function buscar(id) {\n  const r = await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`);\n  const d = await r.json();\n  console.log(d.title);\n}\nbuscar(1);'},
    {title:'DOM Manipulation',desc:'Altere elementos no DOM.',code:'const btn = document.createElement("button");\nbtn.textContent = "Clique aqui!";\nbtn.addEventListener("click", () => {\n  alert("Botão clicado!");\n});\ndocument.body.appendChild(btn);'},
    {title:'Array Methods',desc:'map, filter, reduce.',code:'const nums = [1,2,3,4,5,6,7,8,9,10];\n\nconst pares = nums.filter(n => n % 2 === 0);\nconst dobro = nums.map(n => n * 2);\nconst soma = nums.reduce((acc, n) => acc + n, 0);\n\nconsole.log("Pares:", pares);\nconsole.log("Dobro:", dobro);\nconsole.log("Soma:", soma);'},
  ],
  Java:[
    {title:'Hello World',desc:'O clássico Hello World.',code:'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello!");\n    }\n}'},
    {title:'Classe Pessoa',desc:'Crie uma classe com atributos.',code:'public class Pessoa {\n    private String nome;\n    private int idade;\n    \n    public Pessoa(String nome, int idade) {\n        this.nome = nome;\n        this.idade = idade;\n    }\n    \n    public String getNome() { return nome; }\n    public int getIdade() { return idade; }\n    \n    @Override\n    public String toString() {\n        return nome + " (" + idade + " anos)";\n    }\n}'},
    {title:'Herança',desc:'Implemente herança com Animal.',code:'class Animal {\n    String nome;\n    void falar() { System.out.println("..."); }\n}\n\nclass Cachorro extends Animal {\n    void falar() { System.out.println("Au au!"); }\n}\n\nclass Gato extends Animal {\n    void falar() { System.out.println("Miau!"); }\n}'},
    {title:'ArrayList',desc:'Trabalhe com listas dinâmicas.',code:'import java.util.ArrayList;\n\npublic class Main {\n    public static void main(String[] args) {\n        ArrayList<String> lista = new ArrayList<>();\n        lista.add("Java");\n        lista.add("Python");\n        lista.add("JavaScript");\n        \n        for (String lang : lista) {\n            System.out.println(lang);\n        }\n    }\n}'},
  ],
  HTML:[
    {title:'Primeira Página',desc:'Estrutura HTML básica.',code:'<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <title>Minha Página</title>\n</head>\n<body>\n  <h1>Olá!</h1>\n  <p>Minha primeira página.</p>\n</body>\n</html>'},
    {title:'Formulário',desc:'Form de contato completo.',code:'<form action="/enviar" method="POST">\n  <label for="nome">Nome:</label>\n  <input type="text" id="nome" required>\n  \n  <label for="email">E-mail:</label>\n  <input type="email" id="email" required>\n  \n  <label for="msg">Mensagem:</label>\n  <textarea id="msg" rows="4"></textarea>\n  \n  <button type="submit">Enviar</button>\n</form>'},
    {title:'Tabela Semântica',desc:'Tabela com thead, tbody e caption.',code:'<table>\n  <caption>Notas dos Alunos</caption>\n  <thead>\n    <tr>\n      <th>Nome</th><th>Nota</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr><td>João</td><td>9.5</td></tr>\n    <tr><td>Maria</td><td>8.0</td></tr>\n  </tbody>\n</table>'},
  ],
  CSS:[
    {title:'Botão Estiloso',desc:'Botão com hover e transição.',code:'.btn {\n  background: #4facde;\n  color: white;\n  padding: 12px 24px;\n  border: none;\n  border-radius: 8px;\n  cursor: pointer;\n  transition: all 0.25s;\n}\n.btn:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgba(0,0,0,.3);\n}'},
    {title:'Flexbox Layout',desc:'Menu de navegação horizontal.',code:'.navbar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 16px 24px;\n  background: #161b22;\n}\n.nav-links {\n  display: flex;\n  gap: 24px;\n  list-style: none;\n}'},
    {title:'Grid Layout',desc:'Layout responsivo com grid.',code:'.container {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\n  gap: 20px;\n  padding: 20px;\n}\n.card {\n  background: #1c2128;\n  border-radius: 12px;\n  padding: 20px;\n  border: 1px solid #30363d;\n}'},
    {title:'Variáveis CSS',desc:'Custom Properties para temas.',code:':root {\n  --primary: #4facde;\n  --bg: #0d1117;\n  --text: #e6edf3;\n}\n\nbody {\n  background: var(--bg);\n  color: var(--text);\n}\n\n.btn {\n  background: var(--primary);\n}'},
  ],
  Angular:[
    {title:'Componente',desc:'@Input e template binding.',code:'@Component({\n  selector: "app-card",\n  template: `\n    <div class="card">\n      <h3>{{ titulo }}</h3>\n      <p>{{ descricao }}</p>\n    </div>\n  `\n})\nexport class CardComponent {\n  @Input() titulo: string;\n  @Input() descricao: string;\n}'},
    {title:'Service HTTP',desc:'Service para API REST.',code:'@Injectable({ providedIn: "root" })\nexport class DataService {\n  constructor(private http: HttpClient) {}\n  \n  getAll() {\n    return this.http.get("/api/items");\n  }\n  \n  create(item: any) {\n    return this.http.post("/api/items", item);\n  }\n}'},
    {title:'Diretivas ngIf/ngFor',desc:'Renderização condicional e listas.',code:'<!-- ngIf -->\n<div *ngIf="isLoggedIn">\n  Bem-vindo, {{ userName }}!\n</div>\n\n<!-- ngFor -->\n<ul>\n  <li *ngFor="let item of items; let i = index">\n    {{ i + 1 }}. {{ item.name }}\n  </li>\n</ul>'},
  ],
  SpringBoot:[
    {title:'Rest Controller',desc:'Endpoint GET e POST.',code:'@RestController\n@RequestMapping("/api/alunos")\npublic class AlunoController {\n  @Autowired\n  private AlunoService service;\n  \n  @GetMapping\n  public List<Aluno> listar() {\n    return service.findAll();\n  }\n  \n  @PostMapping\n  public Aluno criar(@RequestBody Aluno a) {\n    return service.save(a);\n  }\n}'},
    {title:'Entidade JPA',desc:'Mapeamento JPA/Hibernate.',code:'@Entity\n@Table(name = "alunos")\npublic class Aluno {\n  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)\n  private Long id;\n  \n  @NotBlank\n  @Column(nullable = false)\n  private String nome;\n  \n  @Email\n  private String email;\n  \n  // getters e setters\n}'},
    {title:'Repository',desc:'Spring Data JPA Repository.',code:'@Repository\npublic interface AlunoRepository extends JpaRepository<Aluno, Long> {\n  List<Aluno> findByNomeContaining(String nome);\n  Optional<Aluno> findByEmail(String email);\n}'},
  ],
  ROBOT:[
    {title:'Primeiro Teste',desc:'Estrutura básica Robot.',code:'*** Test Cases ***\nVerificar Soma\n    ${r}=    Evaluate    2 + 2\n    Should Be Equal As Numbers    ${r}    4\n\nVerificar String\n    ${texto}=    Set Variable    Hello\n    Should Be Equal    ${texto}    Hello'},
    {title:'Teste Web',desc:'Automatize fluxo web.',code:'*** Settings ***\nLibrary    SeleniumLibrary\n\n*** Variables ***\n${URL}    https://google.com\n\n*** Test Cases ***\nAcessar Google\n    Open Browser    ${URL}    chrome\n    Title Should Contain    Google\n    Input Text    name:q    Robot Framework\n    Press Keys    name:q    ENTER\n    Sleep    2s\n    Close Browser'},
  ],
  Python_OO:[
    {title:'Conta Bancária',desc:'POO com encapsulamento.',code:'class ContaBancaria:\n    def __init__(self, titular, saldo=0):\n        self.titular = titular\n        self.__saldo = saldo\n    \n    def depositar(self, v):\n        if v > 0:\n            self.__saldo += v\n            print(f"Depósito: R${v:.2f}")\n    \n    def sacar(self, v):\n        if 0 < v <= self.__saldo:\n            self.__saldo -= v\n            print(f"Saque: R${v:.2f}")\n        else:\n            print("Saldo insuficiente")\n    \n    @property\n    def saldo(self):\n        return self.__saldo'},
    {title:'Herança e Polimorfismo',desc:'Classes abstratas e herança.',code:'from abc import ABC, abstractmethod\n\nclass Forma(ABC):\n    @abstractmethod\n    def area(self):\n        pass\n\nclass Circulo(Forma):\n    def __init__(self, raio):\n        self.raio = raio\n    def area(self):\n        return 3.14159 * self.raio ** 2\n\nclass Retangulo(Forma):\n    def __init__(self, l, a):\n        self.largura = l\n        self.altura = a\n    def area(self):\n        return self.largura * self.altura\n\nformas = [Circulo(5), Retangulo(4, 6)]\nfor f in formas:\n    print(f"Área: {f.area():.2f}")'},
  ],
  TypeScript:[
    {title:'Tipagem Básica',desc:'Tipos primitivos e interfaces.',code:'interface User {\n  id: number;\n  name: string;\n  email: string;\n  active: boolean;\n}\n\nfunction greet(user: User): string {\n  return `Olá, ${user.name}!`;\n}\n\nconst user: User = {\n  id: 1,\n  name: "João",\n  email: "joao@email.com",\n  active: true\n};\n\nconsole.log(greet(user));'},
    {title:'Generics',desc:'Funções e classes genéricas.',code:'function primeiro<T>(arr: T[]): T | undefined {\n  return arr.length > 0 ? arr[0] : undefined;\n}\n\nconsole.log(primeiro([1, 2, 3]));     // 1\nconsole.log(primeiro(["a", "b"]));   // "a"'},
  ],
  React:[
    {title:'Componente Funcional',desc:'useState e props.',code:'import { useState } from "react";\n\nfunction Contador() {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <p>Contagem: {count}</p>\n      <button onClick={() => setCount(count + 1)}>\n        +1\n      </button>\n    </div>\n  );\n}\n\nexport default Contador;'},
    {title:'useEffect',desc:'Efeitos colaterais.',code:'import { useState, useEffect } from "react";\n\nfunction UserList() {\n  const [users, setUsers] = useState([]);\n  \n  useEffect(() => {\n    fetch("/api/users")\n      .then(r => r.json())\n      .then(data => setUsers(data));\n  }, []);\n  \n  return (\n    <ul>\n      {users.map(u => <li key={u.id}>{u.name}</li>)}\n    </ul>\n  );\n}'},
    {title:'Todo List',desc:'App completo com CRUD.',code:'import { useState } from "react";\n\nfunction TodoApp() {\n  const [todos, setTodos] = useState([]);\n  const [text, setText] = useState("");\n\n  const add = () => {\n    if (!text.trim()) return;\n    setTodos([...todos, { id: Date.now(), text, done: false }]);\n    setText("");\n  };\n\n  const toggle = (id) =>\n    setTodos(todos.map(t =>\n      t.id === id ? { ...t, done: !t.done } : t\n    ));\n\n  const remove = (id) =>\n    setTodos(todos.filter(t => t.id !== id));\n\n  return (\n    <div>\n      <input value={text} onChange={e => setText(e.target.value)} />\n      <button onClick={add}>Add</button>\n      {todos.map(t => (\n        <div key={t.id}>\n          <span\n            onClick={() => toggle(t.id)}\n            style={{ textDecoration: t.done ? "line-through" : "none" }}\n          >{t.text}</span>\n          <button onClick={() => remove(t.id)}>X</button>\n        </div>\n      ))}\n    </div>\n  );\n}'},
    {title:'Custom Hook',desc:'Hook reutilizável para localStorage.',code:'import { useState, useEffect } from "react";\n\nfunction useLocalStorage(key, initial) {\n  const [value, setValue] = useState(() => {\n    const saved = localStorage.getItem(key);\n    return saved ? JSON.parse(saved) : initial;\n  });\n\n  useEffect(() => {\n    localStorage.setItem(key, JSON.stringify(value));\n  }, [key, value]);\n\n  return [value, setValue];\n}\n\n// Uso:\nfunction App() {\n  const [theme, setTheme] = useLocalStorage("theme", "dark");\n  return (\n    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>\n      Tema: {theme}\n    </button>\n  );\n}'},
  ],
  NodeJS:[
    {title:'Servidor HTTP',desc:'Servidor básico com Express.',code:'const express = require("express");\nconst app = express();\n\napp.get("/", (req, res) => {\n  res.json({ message: "API funcionando!" });\n});\n\napp.get("/users", (req, res) => {\n  res.json([\n    { id: 1, name: "João" },\n    { id: 2, name: "Maria" }\n  ]);\n});\n\napp.listen(3000, () => {\n  console.log("Servidor na porta 3000");\n});'},
  ],
  SQL:[
    {title:'CRUD Básico',desc:'SELECT, INSERT, UPDATE, DELETE.',code:'-- Criar tabela\nCREATE TABLE alunos (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  nome VARCHAR(100) NOT NULL,\n  email VARCHAR(100) UNIQUE,\n  nota DECIMAL(4,2)\n);\n\n-- Inserir\nINSERT INTO alunos (nome, email, nota)\nVALUES ("João", "joao@email.com", 9.5);\n\n-- Consultar\nSELECT * FROM alunos WHERE nota >= 7;\n\n-- Atualizar\nUPDATE alunos SET nota = 10 WHERE id = 1;\n\n-- Deletar\nDELETE FROM alunos WHERE id = 1;'},
  ],
  Git:[
    {title:'Comandos Essenciais',desc:'Fluxo básico do Git.',code:'# Inicializar repositório\ngit init\n\n# Adicionar arquivos\ngit add .\n\n# Commit\ngit commit -m "feat: primeiro commit"\n\n# Criar branch\ngit checkout -b feature/login\n\n# Merge\ngit checkout main\ngit merge feature/login\n\n# Push\ngit remote add origin URL\ngit push -u origin main'},
    {title:'Branch e Merge',desc:'Crie branches e faça merge.',code:'# Criar branch de feature\ngit checkout -b feature/cadastro\n\n# Fazer alterações e commitar\ngit add .\ngit commit -m "feat: tela de cadastro"\n\n# Voltar para main\ngit checkout main\n\n# Merge da feature\ngit merge feature/cadastro\n\n# Deletar branch\ngit branch -d feature/cadastro\n\n# Ver log bonito\ngit log --oneline --graph --all'},
    {title:'Stash e Rebase',desc:'Técnicas avançadas de Git.',code:'# Salvar alterações temporárias\ngit stash save "WIP: ajuste no layout"\n\n# Listar stashes\ngit stash list\n\n# Recuperar stash\ngit stash pop\n\n# Rebase interativo\ngit rebase -i HEAD~3\n# No editor: pick, squash, edit\n\n# Rebase com main\ngit checkout feature/x\ngit rebase main'},
    {title:'Desfazendo Coisas',desc:'Reverter commits e alterações.',code:'# Desfazer último commit (manter alterações)\ngit reset --soft HEAD~1\n\n# Desfazer último commit (descartar tudo)\ngit reset --hard HEAD~1\n\n# Reverter commit (cria novo commit)\ngit revert abc123\n\n# Descartar alterações em arquivo\ngit checkout -- arquivo.js\n\n# Unstage arquivo\ngit reset HEAD arquivo.js'},
  ],
  Logica:[
    {title:'Média de Notas',desc:'Calcule a média e diga se passou.',code:'# Lógica em Python\nnotas = [8.5, 7.0, 9.0, 6.5]\nmedia = sum(notas) / len(notas)\n\nif media >= 7:\n    print(f"Aprovado com média {media:.1f}")\nelse:\n    print(f"Reprovado com média {media:.1f}")'},
    {title:'Fatorial',desc:'Calcule o fatorial de N.',code:'# Fatorial Iterativo\ndef fatorial(n):\n    resultado = 1\n    for i in range(1, n + 1):\n        resultado *= i\n    return resultado\n\n# Fatorial Recursivo\ndef fatorial_rec(n):\n    if n <= 1:\n        return 1\n    return n * fatorial_rec(n - 1)\n\nprint(fatorial(5))      # 120\nprint(fatorial_rec(5))  # 120'},
    {title:'Bubble Sort',desc:'Implemente ordenação por bolha.',code:'def bubble_sort(lista):\n    n = len(lista)\n    for i in range(n - 1):\n        for j in range(n - i - 1):\n            if lista[j] > lista[j + 1]:\n                lista[j], lista[j + 1] = lista[j + 1], lista[j]\n    return lista\n\nnumeros = [64, 34, 25, 12, 22, 11, 90]\nprint(bubble_sort(numeros))'},
    {title:'Busca Binária',desc:'Busque eficientemente em lista ordenada.',code:'def busca_binaria(lista, alvo):\n    inicio, fim = 0, len(lista) - 1\n    while inicio <= fim:\n        meio = (inicio + fim) // 2\n        if lista[meio] == alvo:\n            return meio\n        elif lista[meio] < alvo:\n            inicio = meio + 1\n        else:\n            fim = meio - 1\n    return -1\n\nnums = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]\nprint(busca_binaria(nums, 23))  # 5'},
    {title:'Palíndromo',desc:'Verifique se uma palavra é palíndromo.',code:'def eh_palindromo(texto):\n    limpo = texto.lower().replace(" ", "")\n    return limpo == limpo[::-1]\n\npalavras = ["arara", "python", "ovo", "radar", "hello"]\nfor p in palavras:\n    resultado = "✅ Sim" if eh_palindromo(p) else "❌ Não"\n    print(f"{p}: {resultado}")'},
  ],
};

// ═══════════════════════════════════════════════
//  MATERIAL CONTENT — Expanded
// ═══════════════════════════════════════════════
const MAT = {
  python:{emoji:'🐍',title:'Python',desc:'Versátil: IA, dados, web, automação.',sections:[
    {t:'O que é Python?',p:'Python é uma linguagem de programação de alto nível, interpretada e de tipagem dinâmica. Criada por Guido van Rossum em 1991, é famosa pela simplicidade e legibilidade do código. É usada em ciência de dados, inteligência artificial, desenvolvimento web (Django/Flask), automação, scripts e muito mais.',c:null},
    {t:'Variáveis e Tipos',p:'Python infere o tipo automaticamente. Os principais tipos são: str (texto), int (inteiro), float (decimal) e bool (verdadeiro/falso). Não é necessário declarar o tipo.',c:'nome = "Ana"        # str\nidade = 25          # int\naltura = 1.65       # float\nativo = True        # bool\n\nprint(type(nome))   # <class \'str\'>\nprint(f"{nome} tem {idade} anos")'},
    {t:'Estruturas de Controle',p:'if/elif/else para decisões, for/while para repetições.',c:'# Condicional\nidade = 18\nif idade >= 18:\n    print("Maior de idade")\nelif idade >= 12:\n    print("Adolescente")\nelse:\n    print("Criança")\n\n# Loop for\nfor i in range(1, 6):\n    print(f"Número: {i}")\n\n# Loop while\ncontador = 0\nwhile contador < 3:\n    print(contador)\n    contador += 1'},
    {t:'Funções',p:'Reutilize código com def. Funções podem receber parâmetros e retornar valores.',c:'def saudar(nome, hora="dia"):\n    return f"Bom {hora}, {nome}!"\n\nprint(saudar("Ana"))\nprint(saudar("João", "noite"))\n\n# Lambda\ndobro = lambda x: x * 2\nprint(dobro(5))'},
    {t:'Listas e Dicionários',p:'Estruturas de dados fundamentais em Python.',c:'# Listas\nfrutas = ["maçã", "banana", "uva"]\nfrutas.append("manga")\nprint(frutas[0])  # maçã\n\n# List comprehension\npares = [x for x in range(20) if x % 2 == 0]\n\n# Dicionários\naluno = {"nome": "João", "nota": 9.5}\nprint(aluno["nome"])'},
    {t:'Tratamento de Erros',p:'try/except para lidar com exceções.',c:'try:\n    resultado = 10 / 0\nexcept ZeroDivisionError:\n    print("Erro: divisão por zero!")\nexcept Exception as e:\n    print(f"Erro: {e}")\nfinally:\n    print("Execução finalizada")'},
  ]},
  javascript:{emoji:'🌐',title:'JavaScript',desc:'A linguagem da web — browser e servidor.',sections:[
    {t:'O que é JavaScript?',p:'JavaScript é a linguagem de programação mais usada no mundo. Roda no navegador (frontend) e no servidor (Node.js). É essencial para criar interatividade em páginas web, APIs, aplicações mobile e até desktop.',c:null},
    {t:'Variáveis e Tipos',p:'Use const (constante), let (mutável) e evite var. Tipos: string, number, boolean, object, array, null, undefined.',c:'const PI = 3.14159;\nlet nome = "João";\nlet idade = 25;\nlet ativo = true;\nlet notas = [9.5, 8.0, 7.5];\nlet pessoa = { nome: "Ana", idade: 22 };\n\nconsole.log(typeof nome);  // "string"\nconsole.log(`Olá, ${nome}!`);'},
    {t:'Funções e Arrow Functions',p:'Sintaxe moderna e concisa com arrow functions.',c:'// Função tradicional\nfunction somar(a, b) {\n  return a + b;\n}\n\n// Arrow function\nconst subtrair = (a, b) => a - b;\n\n// Com corpo\nconst saudar = (nome) => {\n  const msg = `Olá, ${nome}!`;\n  return msg;\n};\n\nconsole.log(somar(3, 4));'},
    {t:'Arrays e Métodos',p:'map, filter, reduce, find, some, every.',c:'const nums = [1, 2, 3, 4, 5];\n\nconst dobro = nums.map(n => n * 2);\nconst pares = nums.filter(n => n % 2 === 0);\nconst soma = nums.reduce((acc, n) => acc + n, 0);\nconst tres = nums.find(n => n === 3);\n\nconsole.log(dobro);  // [2, 4, 6, 8, 10]\nconsole.log(soma);   // 15'},
    {t:'Async/Await',p:'Trabalhe com operações assíncronas de forma elegante.',c:'async function buscarUsuario(id) {\n  try {\n    const resp = await fetch(`https://api.example.com/users/${id}`);\n    const data = await resp.json();\n    return data;\n  } catch (error) {\n    console.error("Erro:", error);\n  }\n}\n\nbuscarUsuario(1).then(user => console.log(user));'},
  ]},
  java:{emoji:'☕',title:'Java',desc:'Robusto para enterprise, Android e microserviços.',sections:[
    {t:'O que é Java?',p:'Java é uma linguagem de programação orientada a objetos, fortemente tipada e compilada. Segue o princípio "Write Once, Run Anywhere" (WORA) graças à JVM. É amplamente usada em aplicações corporativas, Android, sistemas bancários e mais.',c:null},
    {t:'Classes e Objetos',p:'Java é totalmente orientado a objetos. Tudo gira em torno de classes.',c:'public class Pessoa {\n    private String nome;\n    private int idade;\n    \n    public Pessoa(String nome, int idade) {\n        this.nome = nome;\n        this.idade = idade;\n    }\n    \n    public String getNome() { return nome; }\n    public int getIdade() { return idade; }\n    \n    @Override\n    public String toString() {\n        return nome + " - " + idade + " anos";\n    }\n}'},
    {t:'Herança e Polimorfismo',p:'Reutilize código com extends e override.',c:'class Animal {\n    String nome;\n    void falar() {\n        System.out.println("...");\n    }\n}\n\nclass Cachorro extends Animal {\n    @Override\n    void falar() {\n        System.out.println("Au au!");\n    }\n}\n\nclass Gato extends Animal {\n    @Override\n    void falar() {\n        System.out.println("Miau!");\n    }\n}'},
    {t:'Collections',p:'ArrayList, HashMap e outras estruturas.',c:'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        List<String> nomes = new ArrayList<>();\n        nomes.add("Ana");\n        nomes.add("Carlos");\n        \n        Map<String, Integer> notas = new HashMap<>();\n        notas.put("Ana", 95);\n        notas.put("Carlos", 88);\n        \n        for (var entry : notas.entrySet()) {\n            System.out.println(entry.getKey() + ": " + entry.getValue());\n        }\n    }\n}'},
  ]},
  html:{emoji:'🧱',title:'HTML',desc:'Estrutura e semântica de toda página web.',sections:[
    {t:'O que é HTML?',p:'HTML (HyperText Markup Language) define a estrutura e o conteúdo das páginas web. Usa tags para organizar texto, imagens, links, formulários e mais. HTML5 trouxe tags semânticas como header, nav, main, section, article e footer.',c:null},
    {t:'Estrutura Básica',p:'Todo documento HTML segue esta estrutura fundamental.',c:'<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Minha Página</title>\n</head>\n<body>\n  <header>\n    <h1>Bem-vindo!</h1>\n  </header>\n  <main>\n    <p>Conteúdo principal aqui.</p>\n  </main>\n  <footer>\n    <p>&copy; 2025 Meu Site</p>\n  </footer>\n</body>\n</html>'},
    {t:'Semântica HTML5',p:'Tags semânticas melhoram acessibilidade e SEO.',c:'<header>Cabeçalho do site</header>\n<nav>Menu de navegação</nav>\n<main>\n  <article>\n    <h2>Título do Artigo</h2>\n    <p>Conteúdo...</p>\n  </article>\n  <aside>Barra lateral</aside>\n</main>\n<footer>Rodapé</footer>'},
    {t:'Formulários',p:'Colete dados do usuário com forms.',c:'<form action="/enviar" method="POST">\n  <label for="nome">Nome:</label>\n  <input type="text" id="nome" name="nome" required>\n  \n  <label for="email">E-mail:</label>\n  <input type="email" id="email" name="email" required>\n  \n  <label for="senha">Senha:</label>\n  <input type="password" id="senha" minlength="6">\n  \n  <button type="submit">Enviar</button>\n</form>'},
  ]},
  css:{emoji:'🎨',title:'CSS',desc:'Estilização, layout, animações e responsividade.',sections:[
    {t:'O que é CSS?',p:'CSS (Cascading Style Sheets) controla toda a aparência visual de uma página web: cores, fontes, espaçamentos, layouts e animações. CSS moderno oferece Flexbox, Grid, variáveis, media queries e muito mais.',c:null},
    {t:'Flexbox',p:'Layout flexível em uma dimensão.',c:'.container {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 16px;\n}\n\n.item {\n  flex: 1;\n  padding: 20px;\n  background: #1c2128;\n  border-radius: 8px;\n}'},
    {t:'Grid',p:'Layout bidimensional poderoso.',c:'.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\n  gap: 20px;\n}\n\n.card {\n  background: #1c2128;\n  padding: 20px;\n  border-radius: 12px;\n}'},
    {t:'Animações',p:'Crie transições e keyframes.',c:'.btn {\n  transition: all 0.3s ease;\n}\n.btn:hover {\n  transform: scale(1.05);\n}\n\n@keyframes fadeIn {\n  from { opacity: 0; transform: translateY(20px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n.card {\n  animation: fadeIn 0.5s ease forwards;\n}'},
    {t:'Responsividade',p:'Adapte o layout para diferentes telas.',c:'/* Mobile first */\n.container {\n  padding: 16px;\n}\n\n/* Tablet */\n@media (min-width: 768px) {\n  .container {\n    max-width: 720px;\n    margin: 0 auto;\n  }\n}\n\n/* Desktop */\n@media (min-width: 1024px) {\n  .container {\n    max-width: 1200px;\n  }\n}'},
  ]},
  robot:{emoji:'🤖',title:'Robot Framework',desc:'Automação de testes com keywords.',sections:[
    {t:'O que é Robot Framework?',p:'Robot Framework é um framework de automação de testes de código aberto que utiliza uma abordagem de keyword-driven (dirigida por palavras-chave). É extensível, suporta testes web (SeleniumLibrary), API (RequestsLibrary), mobile e mais.',c:null},
    {t:'Estrutura Básica',p:'Arquivo .robot com seções bem definidas.',c:'*** Settings ***\nLibrary    SeleniumLibrary\nLibrary    Collections\n\n*** Variables ***\n${URL}    https://meusite.com\n${BROWSER}    chrome\n\n*** Test Cases ***\nLogin Válido\n    Open Browser    ${URL}    ${BROWSER}\n    Input Text    id:username    admin\n    Input Password    id:password    senha123\n    Click Button    Entrar\n    Page Should Contain    Bem-vindo\n    Close Browser'},
    {t:'Keywords Customizadas',p:'Crie suas próprias keywords reutilizáveis.',c:'*** Keywords ***\nFazer Login\n    [Arguments]    ${user}    ${pass}\n    Input Text    id:username    ${user}\n    Input Password    id:password    ${pass}\n    Click Button    Entrar\n\nVerificar Mensagem\n    [Arguments]    ${msg}\n    Page Should Contain    ${msg}'},
  ]},
  spring:{emoji:'🌱',title:'Spring Boot',desc:'APIs REST rápidas e robustas com Java.',sections:[
    {t:'O que é Spring Boot?',p:'Spring Boot é um framework Java que simplifica a criação de aplicações Spring. Oferece configuração automática, servidor embutido (Tomcat), e um ecossistema rico com Spring Data, Spring Security, Spring Cloud e mais.',c:null},
    {t:'Controller REST',p:'Crie endpoints para sua API.',c:'@RestController\n@RequestMapping("/api/alunos")\npublic class AlunoController {\n    @Autowired\n    private AlunoService service;\n    \n    @GetMapping\n    public ResponseEntity<List<Aluno>> listar() {\n        return ResponseEntity.ok(service.findAll());\n    }\n    \n    @PostMapping\n    public ResponseEntity<Aluno> criar(@RequestBody @Valid Aluno a) {\n        return ResponseEntity.status(201).body(service.save(a));\n    }\n    \n    @DeleteMapping("/{id}")\n    public ResponseEntity<Void> deletar(@PathVariable Long id) {\n        service.delete(id);\n        return ResponseEntity.noContent().build();\n    }\n}'},
    {t:'Service Layer',p:'Lógica de negócio separada do controller.',c:'@Service\npublic class AlunoService {\n    @Autowired\n    private AlunoRepository repo;\n    \n    public List<Aluno> findAll() {\n        return repo.findAll();\n    }\n    \n    public Aluno save(Aluno a) {\n        return repo.save(a);\n    }\n    \n    public void delete(Long id) {\n        if (!repo.existsById(id)) {\n            throw new RuntimeException("Aluno não encontrado");\n        }\n        repo.deleteById(id);\n    }\n}'},
  ]},
  angular:{emoji:'🔺',title:'Angular',desc:'SPAs robustas com TypeScript e RxJS.',sections:[
    {t:'O que é Angular?',p:'Angular é um framework front-end desenvolvido pelo Google, baseado em TypeScript. Utiliza componentes, módulos, serviços e injeção de dependência para criar SPAs (Single Page Applications) complexas e escaláveis.',c:null},
    {t:'Componentes',p:'Bloco fundamental do Angular.',c:'@Component({\n  selector: "app-card",\n  template: `\n    <div class="card">\n      <h3>{{ titulo }}</h3>\n      <p *ngIf="descricao">{{ descricao }}</p>\n      <button (click)="onClick()">Ação</button>\n    </div>\n  `,\n  styles: [`\n    .card { padding: 16px; border: 1px solid #ccc; border-radius: 8px; }\n  `]\n})\nexport class CardComponent {\n  @Input() titulo = "";\n  @Input() descricao = "";\n  @Output() acao = new EventEmitter();\n  \n  onClick() { this.acao.emit(); }\n}'},
    {t:'Services e HTTP',p:'Serviços para lógica reutilizável e chamadas HTTP.',c:'@Injectable({ providedIn: "root" })\nexport class UserService {\n  private apiUrl = "/api/users";\n  \n  constructor(private http: HttpClient) {}\n  \n  getAll(): Observable<User[]> {\n    return this.http.get<User[]>(this.apiUrl);\n  }\n  \n  create(user: User): Observable<User> {\n    return this.http.post<User>(this.apiUrl, user);\n  }\n}'},
    {t:'Diretivas Estruturais',p:'*ngIf, *ngFor e *ngSwitch controlam a renderização de elementos no template.',c:'<!-- *ngIf com else -->\n<div *ngIf="isLoggedIn; else loginTpl">\n  Bem-vindo, {{ userName }}!\n</div>\n<ng-template #loginTpl>\n  <button (click)="login()">Fazer Login</button>\n</ng-template>\n\n<!-- *ngFor com index e trackBy -->\n<ul>\n  <li *ngFor="let item of items; let i = index; trackBy: trackById">\n    {{ i + 1 }}. {{ item.name }}\n  </li>\n</ul>\n\n<!-- *ngSwitch -->\n<div [ngSwitch]="status">\n  <p *ngSwitchCase="\'active\'">✅ Ativo</p>\n  <p *ngSwitchCase="\'inactive\'">⏸ Inativo</p>\n  <p *ngSwitchDefault>❓ Desconhecido</p>\n</div>'},
    {t:'Routing e Guards',p:'Navegação entre telas com proteção de rotas.',c:'// app-routing.module.ts\nconst routes: Routes = [\n  { path: "", component: HomeComponent },\n  { path: "login", component: LoginComponent },\n  {\n    path: "dashboard",\n    component: DashboardComponent,\n    canActivate: [AuthGuard]\n  },\n  { path: "**", redirectTo: "" }\n];\n\n// auth.guard.ts\n@Injectable({ providedIn: "root" })\nexport class AuthGuard implements CanActivate {\n  constructor(private auth: AuthService, private router: Router) {}\n  \n  canActivate(): boolean {\n    if (this.auth.isLoggedIn()) return true;\n    this.router.navigate(["/login"]);\n    return false;\n  }\n}'},
    {t:'Reactive Forms',p:'Formulários reativos com validação.',c:'// No componente\nform = new FormGroup({\n  nome: new FormControl("", [\n    Validators.required,\n    Validators.minLength(3)\n  ]),\n  email: new FormControl("", [\n    Validators.required,\n    Validators.email\n  ]),\n  senha: new FormControl("", [\n    Validators.required,\n    Validators.minLength(6)\n  ])\n});\n\nonSubmit() {\n  if (this.form.valid) {\n    console.log(this.form.value);\n  }\n}\n\n<!-- No template -->\n<form [formGroup]="form" (ngSubmit)="onSubmit()">\n  <input formControlName="nome">\n  <div *ngIf="form.get(\'nome\').errors?.required">\n    Nome é obrigatório\n  </div>\n</form>'},
    {t:'Pipes',p:'Transforme dados diretamente no template.',c:'<!-- Pipes nativos -->\n<p>{{ nome | uppercase }}</p>\n<p>{{ preco | currency:"BRL" }}</p>\n<p>{{ data | date:"dd/MM/yyyy HH:mm" }}</p>\n<p>{{ texto | slice:0:100 }}...</p>\n\n<!-- Pipe customizado -->\n@Pipe({ name: "filtro" })\nexport class FiltroPipe implements PipeTransform {\n  transform(items: any[], termo: string): any[] {\n    if (!termo) return items;\n    return items.filter(i =>\n      i.nome.toLowerCase().includes(termo.toLowerCase())\n    );\n  }\n}\n\n<!-- Uso -->\n<li *ngFor="let item of items | filtro:searchTerm">\n  {{ item.nome }}\n</li>'},
  ]},
  typescript:{emoji:'🔷',title:'TypeScript',desc:'JavaScript com tipagem estática.',sections:[
    {t:'O que é TypeScript?',p:'TypeScript é um superset de JavaScript que adiciona tipagem estática. Criado pela Microsoft, compila para JavaScript puro e ajuda a prevenir erros em tempo de desenvolvimento. É obrigatório em Angular e muito usado em React e Node.js.',c:null},
    {t:'Tipos e Interfaces',p:'Defina contratos para seus dados.',c:'interface User {\n  id: number;\n  name: string;\n  email: string;\n  active?: boolean; // opcional\n}\n\ntype Role = "admin" | "user" | "guest";\n\nfunction createUser(name: string, role: Role): User {\n  return { id: Date.now(), name, email: "", active: true };\n}'},
    {t:'Generics',p:'Código reutilizável com tipos genéricos.',c:'function primeiro<T>(arr: T[]): T | undefined {\n  return arr[0];\n}\n\ninterface ApiResponse<T> {\n  data: T;\n  status: number;\n  message: string;\n}\n\nconst resp: ApiResponse<User[]> = {\n  data: [],\n  status: 200,\n  message: "OK"\n};'},
  ]},
  react:{emoji:'⚛️',title:'React',desc:'Biblioteca para interfaces reativas.',sections:[
    {t:'O que é React?',p:'React é uma biblioteca JavaScript criada pelo Facebook para construir interfaces de usuário. Usa componentes, JSX, hooks e um Virtual DOM para renderização eficiente. É a biblioteca frontend mais popular do mundo.',c:null},
    {t:'Componentes e Hooks',p:'useState, useEffect e componentes funcionais.',c:'import { useState, useEffect } from "react";\n\nfunction TodoList() {\n  const [todos, setTodos] = useState([]);\n  const [input, setInput] = useState("");\n  \n  const addTodo = () => {\n    if (input.trim()) {\n      setTodos([...todos, { id: Date.now(), text: input }]);\n      setInput("");\n    }\n  };\n  \n  return (\n    <div>\n      <input value={input} onChange={e => setInput(e.target.value)} />\n      <button onClick={addTodo}>Adicionar</button>\n      <ul>\n        {todos.map(t => <li key={t.id}>{t.text}</li>)}\n      </ul>\n    </div>\n  );\n}'},
    {t:'useEffect e Ciclo de Vida',p:'useEffect substitui componentDidMount, componentDidUpdate e componentWillUnmount dos class components.',c:'import { useState, useEffect } from "react";\n\nfunction UserProfile({ userId }) {\n  const [user, setUser] = useState(null);\n  const [loading, setLoading] = useState(true);\n\n  // Executa quando userId muda\n  useEffect(() => {\n    setLoading(true);\n    fetch(`/api/users/${userId}`)\n      .then(r => r.json())\n      .then(data => {\n        setUser(data);\n        setLoading(false);\n      });\n\n    // Cleanup (unmount)\n    return () => console.log("Limpeza!");\n  }, [userId]); // dependências\n\n  if (loading) return <p>Carregando...</p>;\n  return <h1>{user.name}</h1>;\n}'},
    {t:'Props e Composição',p:'Componentes recebem dados via props e podem ser compostos.',c:'function Card({ title, children, variant = "default" }) {\n  const styles = {\n    default: { border: "1px solid #ccc" },\n    primary: { border: "2px solid #4facde" },\n  };\n\n  return (\n    <div style={{ ...styles[variant], padding: 16, borderRadius: 8 }}>\n      <h3>{title}</h3>\n      {children}\n    </div>\n  );\n}\n\n// Uso:\n<Card title="Meu Card" variant="primary">\n  <p>Conteúdo aqui!</p>\n  <button>Ação</button>\n</Card>'},
    {t:'useContext e Estado Global',p:'Compartilhe dados entre componentes sem prop drilling.',c:'import { createContext, useContext, useState } from "react";\n\n// 1. Criar contexto\nconst ThemeContext = createContext();\n\n// 2. Provider\nfunction ThemeProvider({ children }) {\n  const [dark, setDark] = useState(true);\n  const toggle = () => setDark(!dark);\n  return (\n    <ThemeContext.Provider value={{ dark, toggle }}>\n      {children}\n    </ThemeContext.Provider>\n  );\n}\n\n// 3. Consumir\nfunction Header() {\n  const { dark, toggle } = useContext(ThemeContext);\n  return (\n    <header style={{ background: dark ? "#111" : "#fff" }}>\n      <button onClick={toggle}>🌓</button>\n    </header>\n  );\n}'},
    {t:'React Router',p:'Navegação entre páginas em Single Page Applications.',c:'import { BrowserRouter, Routes, Route, Link } from "react-router-dom";\n\nfunction App() {\n  return (\n    <BrowserRouter>\n      <nav>\n        <Link to="/">Home</Link>\n        <Link to="/about">Sobre</Link>\n        <Link to="/users/1">Usuário 1</Link>\n      </nav>\n      <Routes>\n        <Route path="/" element={<Home />} />\n        <Route path="/about" element={<About />} />\n        <Route path="/users/:id" element={<UserDetail />} />\n        <Route path="*" element={<NotFound />} />\n      </Routes>\n    </BrowserRouter>\n  );\n}'},
    {t:'Custom Hooks',p:'Crie hooks reutilizáveis para lógica compartilhada.',c:'// Hook customizado para fetch\nfunction useFetch(url) {\n  const [data, setData] = useState(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState(null);\n\n  useEffect(() => {\n    fetch(url)\n      .then(r => r.json())\n      .then(setData)\n      .catch(setError)\n      .finally(() => setLoading(false));\n  }, [url]);\n\n  return { data, loading, error };\n}\n\n// Uso:\nfunction Users() {\n  const { data, loading } = useFetch("/api/users");\n  if (loading) return <p>Carregando...</p>;\n  return data.map(u => <p key={u.id}>{u.name}</p>);\n}'},
  ]},
  nodejs:{emoji:'🟢',title:'Node.js',desc:'JavaScript no servidor.',sections:[
    {t:'O que é Node.js?',p:'Node.js é um runtime JavaScript que roda no servidor, baseado no motor V8 do Chrome. Permite criar APIs REST, servidores web, ferramentas CLI, microserviços e muito mais usando JavaScript/TypeScript.',c:null},
    {t:'Express.js',p:'Framework minimalista para APIs.',c:'const express = require("express");\nconst app = express();\napp.use(express.json());\n\nlet users = [{ id: 1, name: "João" }];\n\napp.get("/api/users", (req, res) => {\n  res.json(users);\n});\n\napp.post("/api/users", (req, res) => {\n  const user = { id: Date.now(), ...req.body };\n  users.push(user);\n  res.status(201).json(user);\n});\n\napp.listen(3000, () => console.log("🚀 Porta 3000"));'},
  ]},
  sql:{emoji:'🗄️',title:'SQL',desc:'Linguagem para bancos de dados relacionais.',sections:[
    {t:'O que é SQL?',p:'SQL (Structured Query Language) é a linguagem padrão para gerenciar bancos de dados relacionais como MySQL, PostgreSQL, Oracle e SQL Server. Permite criar, ler, atualizar e deletar dados (CRUD).',c:null},
    {t:'CRUD Básico',p:'As 4 operações fundamentais.',c:'-- CREATE\nINSERT INTO alunos (nome, email, nota)\nVALUES ("João Silva", "joao@email.com", 9.5);\n\n-- READ\nSELECT * FROM alunos WHERE nota >= 7 ORDER BY nota DESC;\n\n-- UPDATE\nUPDATE alunos SET nota = 10 WHERE id = 1;\n\n-- DELETE\nDELETE FROM alunos WHERE id = 1;'},
    {t:'JOINs',p:'Combine dados de múltiplas tabelas.',c:'SELECT a.nome, c.curso_nome, c.data_emissao\nFROM alunos a\nINNER JOIN certificados c ON a.id = c.aluno_id\nWHERE c.data_emissao >= "2025-01-01"\nORDER BY c.data_emissao DESC;'},
  ]},
  git:{emoji:'📦',title:'Git',desc:'Controle de versão e colaboração.',sections:[
    {t:'O que é Git?',p:'Git é o sistema de controle de versão mais usado no mundo. Permite rastrear mudanças no código, trabalhar em equipe com branches, reverter alterações e manter um histórico completo do projeto. GitHub, GitLab e Bitbucket são plataformas que hospedam repositórios Git.',c:null},
    {t:'Fluxo Básico',p:'Comandos essenciais do dia a dia.',c:'# Inicializar\ngit init\n\n# Status e log\ngit status\ngit log --oneline\n\n# Stage e commit\ngit add .\ngit commit -m "feat: adiciona login"\n\n# Branches\ngit branch feature/chat\ngit checkout feature/chat\ngit merge feature/chat\n\n# Remoto\ngit push origin main\ngit pull origin main'},
    {t:'Branches e Merge',p:'Branches permitem trabalhar em funcionalidades isoladas sem afetar o código principal. O merge combina as alterações de volta.',c:'# Criar e trocar de branch\ngit checkout -b feature/nova-tela\n\n# Trabalhar na branch...\ngit add .\ngit commit -m "feat: tela de cadastro"\n\n# Voltar para main e fazer merge\ngit checkout main\ngit merge feature/nova-tela\n\n# Deletar branch já mergeada\ngit branch -d feature/nova-tela\n\n# Ver todas as branches\ngit branch -a'},
    {t:'Resolvendo Conflitos',p:'Conflitos acontecem quando duas branches alteram o mesmo trecho. O Git marca os conflitos no arquivo para você resolver manualmente.',c:'# Após um merge com conflito:\n<<<<<<< HEAD\nconsole.log("versão da main");\n=======\nconsole.log("versão da feature");\n>>>>>>> feature/x\n\n# Passos para resolver:\n# 1. Edite o arquivo, escolha a versão correta\n# 2. Remova os marcadores (<<<<, ====, >>>>)\n# 3. Faça stage e commit:\ngit add arquivo.js\ngit commit -m "fix: resolve conflito"'},
    {t:'Git Stash',p:'Salve alterações temporariamente sem fazer commit, útil para trocar de branch rapidamente.',c:'# Guardar alterações\ngit stash\n\n# Ver lista de stashes\ngit stash list\n\n# Recuperar último stash\ngit stash pop\n\n# Recuperar stash específico\ngit stash apply stash@{2}\n\n# Limpar todos os stashes\ngit stash clear'},
    {t:'Git Rebase vs Merge',p:'Rebase reescreve o histórico para manter uma linha do tempo linear, enquanto merge preserva o histórico completo.',c:'# Merge (preserva histórico)\ngit checkout main\ngit merge feature/x\n# Cria um commit de merge\n\n# Rebase (histórico linear)\ngit checkout feature/x\ngit rebase main\n# Reaplica commits sobre main\n\n# Rebase interativo (editar commits)\ngit rebase -i HEAD~3\n# Permite: pick, squash, edit, drop'},
    {t:'Gitflow e Conventional Commits',p:'Gitflow é um modelo de branching popular. Conventional Commits padroniza mensagens de commit.',c:'# Gitflow - Branches:\n# main → produção\n# develop → desenvolvimento\n# feature/* → funcionalidades\n# hotfix/* → correções urgentes\n# release/* → preparação de release\n\n# Conventional Commits:\ngit commit -m "feat: adiciona autenticação"\ngit commit -m "fix: corrige validação email"\ngit commit -m "docs: atualiza README"\ngit commit -m "refactor: reorganiza utils"\ngit commit -m "test: adiciona testes de login"\ngit commit -m "chore: atualiza dependências"'},
    {t:'.gitignore',p:'O arquivo .gitignore define quais arquivos e pastas o Git deve ignorar (não rastrear).',c:'# Arquivo .gitignore\n\n# Dependências\nnode_modules/\nvenv/\n__pycache__/\n\n# Variáveis de ambiente\n.env\n.env.local\n\n# Build\ndist/\nbuild/\n*.pyc\n\n# IDE\n.vscode/\n.idea/\n*.swp\n\n# OS\n.DS_Store\nThumbs.db'},
  ]},
  logica:{emoji:'🧠',title:'Lógica de Programação',desc:'Fundamentos de algoritmos, estruturas e pensamento computacional.',sections:[
    {t:'O que é Lógica de Programação?',p:'Lógica de programação é a base de toda a computação. É a capacidade de criar sequências de instruções (algoritmos) para resolver problemas de forma organizada e eficiente. Antes de aprender qualquer linguagem, é essencial dominar os conceitos fundamentais de lógica.',c:null},
    {t:'Algoritmos e Pseudocódigo',p:'Um algoritmo é uma sequência finita de passos para resolver um problema. Pseudocódigo é uma forma de escrever algoritmos em linguagem natural antes de codificar.',c:'// Pseudocódigo: Calculadora\n\nINÍCIO\n  ESCREVER "Digite o primeiro número:"\n  LER numero1\n  ESCREVER "Digite o segundo número:"\n  LER numero2\n  ESCREVER "Operação (+, -, *, /):"\n  LER operacao\n  \n  SE operacao == "+"\n    resultado = numero1 + numero2\n  SENÃO SE operacao == "-"\n    resultado = numero1 - numero2\n  SENÃO SE operacao == "*"\n    resultado = numero1 * numero2\n  SENÃO SE operacao == "/" E numero2 != 0\n    resultado = numero1 / numero2\n  SENÃO\n    ESCREVER "Erro!"\n  FIM SE\n  \n  ESCREVER "Resultado:", resultado\nFIM'},
    {t:'Variáveis e Tipos de Dados',p:'Variáveis são "caixas" que armazenam valores na memória. Cada variável tem um tipo que define que tipo de dado ela pode guardar.',c:'// Tipos fundamentais:\n\n// Inteiro (int) - números sem decimais\nidade = 25\nquantidade = 100\n\n// Decimal (float) - números com decimais\naltura = 1.75\npreco = 29.99\n\n// Texto (string) - palavras e frases\nnome = "João Silva"\nmensagem = "Olá, mundo!"\n\n// Lógico (boolean) - verdadeiro ou falso\nativo = True\nmaior_de_idade = False\n\n// Lista (array) - coleção de valores\nnotas = [9.5, 8.0, 7.5, 10.0]\nnomes = ["Ana", "Carlos", "Maria"]'},
    {t:'Estruturas Condicionais',p:'Condicionais permitem que o programa tome decisões com base em condições. O programa executa diferentes blocos de código dependendo se a condição é verdadeira ou falsa.',c:'// SE simples\nSE idade >= 18\n  ESCREVER "Maior de idade"\nFIM SE\n\n// SE / SENÃO\nSE nota >= 7\n  ESCREVER "Aprovado!"\nSENÃO\n  ESCREVER "Reprovado"\nFIM SE\n\n// SE / SENÃO SE / SENÃO\nSE nota >= 9\n  conceito = "A"\nSENÃO SE nota >= 7\n  conceito = "B"\nSENÃO SE nota >= 5\n  conceito = "C"\nSENÃO\n  conceito = "D"\nFIM SE\n\n// Operadores lógicos\nSE idade >= 18 E possui_cnh == True\n  ESCREVER "Pode dirigir"\nFIM SE\n\nSE dia == "sábado" OU dia == "domingo"\n  ESCREVER "Final de semana!"\nFIM SE'},
    {t:'Estruturas de Repetição',p:'Loops permitem executar um bloco de código múltiplas vezes. Os três tipos principais são: PARA (for), ENQUANTO (while) e FAÇA-ENQUANTO (do-while).',c:'// PARA (for) — quando sabe quantas vezes\nPARA i DE 1 ATÉ 10\n  ESCREVER i\nFIM PARA\n\n// Tabuada\nPARA i DE 1 ATÉ 10\n  ESCREVER "5 x", i, "=", 5 * i\nFIM PARA\n\n// ENQUANTO (while) — condição no início\ncontador = 0\nENQUANTO contador < 5\n  ESCREVER contador\n  contador = contador + 1\nFIM ENQUANTO\n\n// FAÇA-ENQUANTO (do-while) — executa ao menos 1x\nFAÇA\n  ESCREVER "Digite senha:"\n  LER senha\nENQUANTO senha != "1234"\n\n// Loop com acumulador\nsoma = 0\nPARA i DE 1 ATÉ 100\n  soma = soma + i\nFIM PARA\nESCREVER "Soma 1-100:", soma  // 5050'},
    {t:'Funções e Modularização',p:'Funções são blocos de código reutilizáveis que executam uma tarefa específica. Elas recebem parâmetros (entradas) e podem retornar valores (saídas).',c:'// Definir função\nFUNÇÃO saudacao(nome)\n  RETORNAR "Olá, " + nome + "!"\nFIM FUNÇÃO\n\n// Chamar função\nmsg = saudacao("Ana")\nESCREVER msg  // "Olá, Ana!"\n\n// Função com múltiplos parâmetros\nFUNÇÃO calcularMedia(n1, n2, n3)\n  soma = n1 + n2 + n3\n  media = soma / 3\n  RETORNAR media\nFIM FUNÇÃO\n\n// Função que usa outra função\nFUNÇÃO verificarAprovacao(n1, n2, n3)\n  media = calcularMedia(n1, n2, n3)\n  SE media >= 7\n    RETORNAR "Aprovado"\n  SENÃO\n    RETORNAR "Reprovado"\n  FIM SE\nFIM FUNÇÃO\n\nresultado = verificarAprovacao(8, 6, 9)\nESCREVER resultado  // "Aprovado"'},
    {t:'Vetores e Matrizes',p:'Vetores (arrays) armazenam múltiplos valores em uma única variável. Matrizes são vetores de duas dimensões (linhas e colunas).',c:'// Vetor (array)\nnotas = [9.5, 8.0, 7.5, 10.0, 6.5]\n\n// Acessar elemento (índice começa em 0)\nESCREVER notas[0]  // 9.5\nESCREVER notas[3]  // 10.0\n\n// Percorrer vetor\nPARA i DE 0 ATÉ tamanho(notas) - 1\n  ESCREVER "Nota", i+1, ":", notas[i]\nFIM PARA\n\n// Buscar maior valor\nmaior = notas[0]\nPARA i DE 1 ATÉ tamanho(notas) - 1\n  SE notas[i] > maior\n    maior = notas[i]\n  FIM SE\nFIM PARA\nESCREVER "Maior nota:", maior\n\n// Matriz (2D)\nmatriz = [\n  [1, 2, 3],\n  [4, 5, 6],\n  [7, 8, 9]\n]\nESCREVER matriz[1][2]  // 6'},
    {t:'Algoritmos Clássicos',p:'Algoritmos de ordenação e busca são fundamentais para entender eficiência e complexidade.',c:'// Bubble Sort (Ordenação por Bolha)\nFUNÇÃO bubbleSort(vetor)\n  n = tamanho(vetor)\n  PARA i DE 0 ATÉ n - 2\n    PARA j DE 0 ATÉ n - i - 2\n      SE vetor[j] > vetor[j + 1]\n        // Troca (swap)\n        temp = vetor[j]\n        vetor[j] = vetor[j + 1]\n        vetor[j + 1] = temp\n      FIM SE\n    FIM PARA\n  FIM PARA\n  RETORNAR vetor\nFIM FUNÇÃO\n\n// Busca Binária\nFUNÇÃO buscaBinaria(vetor, alvo)\n  inicio = 0\n  fim = tamanho(vetor) - 1\n  ENQUANTO inicio <= fim\n    meio = (inicio + fim) / 2\n    SE vetor[meio] == alvo\n      RETORNAR meio\n    SENÃO SE vetor[meio] < alvo\n      inicio = meio + 1\n    SENÃO\n      fim = meio - 1\n    FIM SE\n  FIM ENQUANTO\n  RETORNAR -1  // não encontrado\nFIM FUNÇÃO'},
  ]},
};

// ─── SIDEBAR ─────────────────────────────────
function buildSidebar(active){
  const u=Auth.currentUser, isAdm=Auth.isAdmin();
  const unread=DB.getMessages(u.id).filter(m=>!m.read).length;
  const userLinks=[
    {p:'home-user',ico:'🏠',lbl:'Início'},{p:'activities-user',ico:'📝',lbl:'Atividades'},{p:'materials',ico:'📚',lbl:'Material de Estudos'},
    {p:'certificates-user',ico:'🏆',lbl:'Certificados'},{p:'chatbot',ico:'🤖',lbl:'Chat com IA'},
    {p:'messages-user',ico:'✉️',lbl:'Mensagens',badge:unread},{p:'profile',ico:'👤',lbl:'Meu Perfil'},
  ];
  const adminLinks=[
    {p:'home-admin',ico:'📊',lbl:'Dashboard'},{p:'activities-admin',ico:'📝',lbl:'Correções'},
    {p:'homework-admin',ico:'🏠',lbl:'Atividades de Casa'},{p:'certificates-admin',ico:'🏆',lbl:'Certificados'},
    {p:'messages-admin',ico:'✉️',lbl:'Mensagens'},{p:'manage-students',ico:'🎓',lbl:'Alunos'},
    {p:'settings',ico:'⚙️',lbl:'Configurações'},
  ];
  const links=isAdm?adminLinks:userLinks;
  const ava=u.avatar?`<img src="${u.avatar}" class="av" style="width:34px;height:34px" alt="">`:`<div class="av" style="width:34px;height:34px;font-size:12px">${ini(u.name)}</div>`;
  return `<nav class="sidebar" id="sidebar">
    <div class="sb-logo" onclick="Router.go('${isAdm?'home-admin':'home-user'}')">
      <img src="${LOGO_PATH}" class="sb-logo-img" alt="TSA" onerror="this.style.display='none'">
      <div><div class="sb-logo-text">Tech Start</div><div class="sb-logo-sub">Academy${isAdm?' — Admin':''}</div></div>
    </div>
    <div class="sb-nav">
      <div class="sb-sec">${isAdm?'Administração':'Aprendizado'}</div>
      ${links.map(l=>`<div class="nav-item${active===l.p?' active':''}" onclick="Router.go('${l.p}')">
        <span class="nav-ico">${l.ico}</span>${l.lbl}${l.badge?`<span class="nav-badge">${l.badge}</span>`:''}
      </div>`).join('')}
      <div class="sb-sec" style="margin-top:6px">Conta</div>
      <div class="nav-item" onclick="Auth.logout()"><span class="nav-ico">🚪</span>Sair</div>
    </div>
    <div class="sb-bot"><div class="user-chip" onclick="Router.go('${isAdm?'home-admin':'profile'}')">${ava}<div><div style="font-size:13px;font-weight:700">${u.name}</div><div style="font-size:11px;color:var(--txm)">${isAdm?'⚙️ Admin':'👨‍🎓 Aluno'}</div></div></div></div>
  </nav>`;
}

function shell(activePage,title,content){
  const u=Auth.currentUser;
  const unread=DB.getMessages(u.id).filter(m=>!m.read).length;
  return `<a href="#main" class="skip">Pular para o conteúdo</a>
  ${buildSidebar(activePage)}
  <div class="main">
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="hamburger" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button>
        <span style="font-size:16px;font-weight:800">${title}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${Auth.isAdmin()?`<span style="font-size:11px;color:${GitDB.isConfigured()?'var(--ok)':'var(--warn)'};display:flex;align-items:center;gap:3px" title="${GitDB.isConfigured()?'GitHub conectado':'GitHub não configurado'}">${GitDB.isConfigured()?'🟢':'🟡'} ${GitDB.isConfigured()?'Sync':'Offline'}</span>`:''}
        ${!Auth.isAdmin()?`<button class="btn btn-s btn-sm" onclick="Router.go('messages-user')">✉️${unread>0?` <span class="nav-badge">${unread}</span>`:''}</button>`:''}
        <button class="btn btn-s btn-sm" onclick="A11y.toggle()">♿</button>
      </div>
    </header>
    <main class="page fade" id="main">${content}</main>
  </div>
  <div id="a11y-container">${A11y._html()}</div>
  <button onclick="A11y.toggle()" style="position:fixed;right:20px;bottom:90px;z-index:503;width:44px;height:44px;border-radius:50%;border:1px solid var(--bd);background:var(--bg2);font-size:18px;cursor:pointer;box-shadow:0 2px 12px var(--sh)">♿</button>
  <div class="av-widget">
    <div class="av-bubble" id="av-bubble"></div>
    <div class="av-btn" onclick="AvatarBot.toggle()" title="Assistente"><img src="${BOT_AVATAR}" style="width:40px;height:40px;border-radius:50%" alt="Bot"></div>
  </div>
  ${A11y.s.ttsEnabled?`<div class="tts-float"><button class="tts-float-btn${A11y._speaking?' playing':''}" id="tts-float-btn" onclick="if(A11y._speaking){A11y.ttsStop();}else{A11y.ttsSpeakPage();}" title="Ler página inteira">${A11y._speaking?'⏹️':'🔊'}</button></div>`:''}`;
}

// ═══════════════════════════════════════════════
//  PAGES — All fixed
// ═══════════════════════════════════════════════
const Pages = {
  login(){
    return `<div class="login-wrap"><div class="login-bg"></div><div class="login-box">
      <img src="${LOGO_PATH}" class="login-logo" alt="Tech Start Academy" onerror="this.outerHTML='<div style=\\'width:60px;height:60px;background:linear-gradient(135deg,var(--ac),var(--ac2));border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 12px\\'>🚀</div>'">
      <div style="font-family:var(--fc);font-size:20px;font-weight:700;text-align:center">Tech Start Academy</div>
      <div style="font-size:13px;color:var(--tx2);text-align:center;margin-bottom:26px">Plataforma de Ensino de Programação</div>
      <div id="lerr" style="display:none;background:rgba(248,81,73,.1);border:1px solid var(--err);border-radius:8px;padding:10px;font-size:13px;color:var(--err);margin-bottom:14px"></div>
      <div class="fg"><label class="fl">Usuário</label><input class="fi" id="lu" placeholder="seu usuário" autocomplete="username" onkeydown="if(event.key==='Enter')Pages.doLogin()"></div>
      <div class="fg"><label class="fl">Senha</label><input class="fi" id="lp" type="password" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')Pages.doLogin()"></div>
      <button class="btn btn-p btn-full" id="lbtn" onclick="Pages.doLogin()">🔐 Entrar</button>
      <hr style="border:none;border-top:1px solid var(--bd);margin:18px 0">
      <p style="text-align:center;font-size:13px;color:var(--tx2)">Não tem conta? <span onclick="Router.go('register')" style="color:var(--ac);cursor:pointer;font-weight:700">Cadastre-se</span></p>
      <div style="text-align:center;margin-top:14px"><button class="btn btn-s btn-sm" onclick="A11y.toggle()">♿ Acessibilidade</button></div>
    </div><div id="a11y-container">${A11y._html()}</div>
    <button onclick="A11y.toggle()" style="position:fixed;right:20px;bottom:20px;z-index:503;width:44px;height:44px;border-radius:50%;border:1px solid var(--bd);background:var(--bg2);font-size:18px;cursor:pointer">♿</button></div>`;
  },

  doLogin(){
    const u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value;
    const err=document.getElementById('lerr'),btn=document.getElementById('lbtn');
    if(!u||!p){err.textContent='⚠️ Preencha todos os campos.';err.style.display='block';return;}
    btn.innerHTML='<span class="spin"></span> Entrando…';btn.disabled=true;
    // Login 100% local
    const r=Auth.login(u,p);
    if(r.ok){Toast.show('Bem-vindo, '+r.user.name+'! 🎉','ok');Router.go(Auth.isAdmin()?'home-admin':'home-user');}
    else{err.textContent='❌ '+r.error;err.style.display='block';btn.innerHTML='🔐 Entrar';btn.disabled=false;}
  },

  register(){
    return `<div class="login-wrap"><div class="login-bg"></div><div class="login-box">
      <img src="${LOGO_PATH}" class="login-logo" alt="TSA" onerror="this.outerHTML='<div style=\\'width:60px;height:60px;background:linear-gradient(135deg,var(--ac),var(--ac2));border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 12px\\'>✨</div>'">
      <div style="font-family:var(--fc);font-size:18px;font-weight:700;text-align:center">Criar Conta</div>
      <div style="font-size:13px;color:var(--tx2);text-align:center;margin-bottom:22px">Comece sua jornada na Tech Start Academy!</div>
      <div class="fg"><label class="fl">Nome Completo</label><input class="fi" id="rn" placeholder="Seu nome"></div>
      <div class="fg"><label class="fl">E-mail</label><input class="fi" id="re" type="email" placeholder="seu@email.com"></div>
      <div class="fg"><label class="fl">Usuário</label><input class="fi" id="ru" placeholder="nome de usuário"></div>
      <div class="fg"><label class="fl">Senha</label><input class="fi" id="rp" type="password" placeholder="Mínimo 6 caracteres"></div>
      <div class="fg"><label class="fl">Confirmar Senha</label><input class="fi" id="rp2" type="password" placeholder="Repita a senha"></div>
      <button class="btn btn-p btn-full" onclick="Pages.doRegister()">✨ Criar Conta</button>
      <p style="text-align:center;font-size:13px;color:var(--tx2);margin-top:14px">Já tem conta? <span onclick="Router.go('login')" style="color:var(--ac);cursor:pointer;font-weight:700">Fazer login</span></p>
    </div></div>`;
  },

  doRegister(){
    const name=document.getElementById('rn').value.trim(),email=document.getElementById('re').value.trim();
    const user=document.getElementById('ru').value.trim(),pass=document.getElementById('rp').value,pass2=document.getElementById('rp2').value;
    if(!name||!email||!user||!pass){Toast.show('Preencha todos os campos.','err');return;}
    if(pass.length<6){Toast.show('Senha mínimo 6 caracteres.','err');return;}
    if(pass!==pass2){Toast.show('Senhas não coincidem.','err');return;}
    const r=Auth.register({name,email,username:user,password:pass});
    if(r.ok){Toast.show('Conta criada! Faça login. ✅','ok');setTimeout(()=>Router.go('login'),1000);}
    else Toast.show(r.error,'err');
  },

  homeUser(){
    if(!Auth.need())return'';
    const u=Auth.currentUser,acts=DB.getActivities(u.id),graded=acts.filter(a=>a.grade!=null);
    const avg=graded.length?(graded.reduce((s,a)=>s+a.grade,0)/graded.length).toFixed(1):'–';
    const pend=acts.filter(a=>a.status==='pending').length,certs=DB.getCertificates(u.id),hw=DB.getHomework();
    const unread=DB.getMessages(u.id).filter(m=>!m.read).length;
    return shell('home-user','🏠 Início',`
      <div class="ptitle">Olá, ${u.name.split(' ')[0]}! 👋</div><p class="psub">Bem-vindo de volta à Tech Start Academy.</p>
      <div class="dash-stats">
        <div class="card stat"><div class="stat-ico" style="background:rgba(79,172,222,.12)">📝</div><div><div class="stat-val">${acts.length}</div><div class="stat-lbl">Atividades</div><div class="stat-sub" style="color:var(--warn)">${pend} pendentes</div></div></div>
        <div class="card stat"><div class="stat-ico" style="background:rgba(126,232,162,.12)">⭐</div><div><div class="stat-val">${avg}</div><div class="stat-lbl">Média Geral</div><div class="stat-sub" style="color:var(--ok)">${graded.length} corrigidas</div></div></div>
        <div class="card stat"><div class="stat-ico" style="background:rgba(188,140,255,.12)">🏠</div><div><div class="stat-val">${hw.length}</div><div class="stat-lbl">Tarefas</div><div class="stat-sub" style="color:var(--ac)">disponíveis</div></div></div>
        <div class="card stat"><div class="stat-ico" style="background:rgba(248,81,73,.12)">🏆</div><div><div class="stat-val">${certs.length}</div><div class="stat-lbl">Certificados</div><div class="stat-sub" style="color:var(--warn)">${unread} msg nova${unread!==1?'s':''}</div></div></div>
      </div>
      <div class="grid g2">
        <div><div class="sec-hd"><span class="sec-t">📋 Últimas Atividades</span><button class="btn btn-s btn-sm" onclick="Router.go('activities-user')">Ver todas</button></div>
          ${acts.length===0?`<div class="card"><div class="empty"><div class="empty-ico">📭</div><div class="empty-t">Nenhuma atividade</div></div></div>`
          :acts.slice().reverse().slice(0,4).map(a=>`<div class="card" style="margin-bottom:10px;cursor:pointer;padding:14px" onclick="Router.go('activities-user')">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div style="display:flex;align-items:center;gap:10px">${langImg(a.language,'lang-logo-sm')}<div><div style="font-weight:700;font-size:14px">${esc(a.title)}</div><div style="font-size:11px;color:var(--txm)">${a.language} · ${fmtDt(a.submittedAt)}</div></div></div>
              ${a.grade!=null?`<div class="gb ${gcls(a.grade)}">${a.grade}</div>`:'<span class="badge b-warn">⏳</span>'}
            </div></div>`).join('')}
        </div>
        <div><div class="sec-hd"><span class="sec-t">🚀 Acesso Rápido</span></div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${[{ico:'📝',lbl:'Atividades',sub:'Exercícios + enviar código',p:'activities-user'},{ico:'🏠',lbl:'Tarefas de Casa',sub:hw.length+' disponível',p:'activities-user'},{ico:'📚',lbl:'Material de Estudos',sub:Object.keys(MAT).length+' linguagens',p:'materials'},{ico:'🤖',lbl:'Chat com IA',sub:'Gemini AI',p:'chatbot'},{ico:'🏆',lbl:'Certificados',sub:certs.length+' certificado(s)',p:'certificates-user'}]
            .map(x=>`<div class="card" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px" onclick="Router.go('${x.p}')"><div style="font-size:22px">${x.ico}</div><div><div style="font-weight:700;font-size:13px">${x.lbl}</div><div style="font-size:12px;color:var(--tx2)">${x.sub}</div></div><div style="margin-left:auto;color:var(--txm)">›</div></div>`).join('')}
          </div>
        </div>
      </div>`);
  },

  homeAdmin(){
    if(!Auth.needAdmin())return'';
    const students=DB.getUsers().filter(u=>u.role==='user'),allActs=DB.getActivities();
    const pending=allActs.filter(a=>a.status==='pending').length,graded=allActs.filter(a=>a.status==='graded').length;
    const certs=DB.getCertificates(),hw=DB.getHomework();
    const avgAll=(()=>{const g=allActs.filter(a=>a.grade!=null);return g.length?(g.reduce((s,a)=>s+a.grade,0)/g.length).toFixed(1):'–';})();
    const studentRows=students.map(u=>{
      const acts=DB.getActivities(u.id),g=acts.filter(a=>a.grade!=null);
      const avg=g.length?(g.reduce((s,a)=>s+a.grade,0)/g.length).toFixed(1):'–';
      const p=acts.filter(a=>a.status==='pending').length;
      return `<div class="stu-row">${avHtml(u,38)}<div class="stu-info"><div style="font-weight:700;font-size:14px">${u.name}</div><div style="font-size:11px;color:var(--txm)">@${u.username} · ${u.email}</div></div>
        <div class="stu-badges"><span class="badge b-info">📝 ${acts.length}</span><span class="badge b-ok">⭐ ${avg}</span>${p>0?`<span class="badge b-warn">⏳ ${p}</span>`:''}<button class="btn btn-s btn-sm" onclick="Pages.quickMsg('${u.id}','${u.name}')">✉️</button></div></div>`;
    }).join('');
    const studentOptions=students.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
    return shell('home-admin','📊 Dashboard',`
      <div class="ptitle">Dashboard</div><p class="psub">Visão geral da Tech Start Academy.</p>
      <div class="dash-stats">
        <div class="card stat"><div class="stat-ico" style="background:rgba(79,172,222,.12)">🎓</div><div><div class="stat-val">${students.length}</div><div class="stat-lbl">Alunos</div></div></div>
        <div class="card stat"><div class="stat-ico" style="background:rgba(210,153,34,.12)">⏳</div><div><div class="stat-val">${pending}</div><div class="stat-lbl">Pendentes</div><div class="stat-sub"><span onclick="Router.go('activities-admin')" style="color:var(--ac);cursor:pointer">Corrigir →</span></div></div></div>
        <div class="card stat"><div class="stat-ico" style="background:rgba(63,185,80,.12)">✅</div><div><div class="stat-val">${graded}</div><div class="stat-lbl">Corrigidas</div></div></div>
        <div class="card stat"><div class="stat-ico" style="background:rgba(188,140,255,.12)">📊</div><div><div class="stat-val">${avgAll}</div><div class="stat-lbl">Média Geral</div></div></div>
      </div>
      <div class="dash-main">
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:14px 18px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center"><span style="font-weight:800;font-size:15px">🎓 Alunos Cadastrados</span><button class="btn btn-s btn-sm" onclick="Router.go('manage-students')">Gerenciar</button></div>
          <div style="max-height:400px;overflow-y:auto">${students.length===0?`<div class="empty"><div class="empty-ico">👤</div><div class="empty-t">Nenhum aluno</div></div>`:studentRows}</div>
        </div>
        <div class="card"><div class="sec-t" style="margin-bottom:12px">📈 Desempenho do Aluno</div>
          <div class="fg" style="margin-bottom:10px"><label class="fl">Selecionar Aluno</label><select class="fs" id="chartSel" onchange="Pages.renderChart()"><option value="">— Selecione —</option>${studentOptions}</select></div>
          <div class="chart-wrap"><canvas id="growthChart"></canvas></div>
          <div id="chart-empty" style="text-align:center;color:var(--txm);font-size:13px;padding:20px 0">📊 Selecione um aluno</div>
        </div>
      </div>
      <div class="dash-bottom">
        <div><div class="sec-hd"><span class="sec-t">⏳ Aguardando Correção</span><button class="btn btn-p btn-sm" onclick="Router.go('activities-admin')">Ver todas</button></div>
          ${allActs.filter(a=>a.status==='pending').slice(0,5).map(a=>`<div class="card" style="margin-bottom:8px;cursor:pointer;padding:12px" onclick="Router.go('activities-admin')"><div style="font-weight:700;font-size:13px">${esc(a.title)}</div><div style="font-size:11px;color:var(--txm)">👤 ${a.userName} · ${a.language} · ${fmtDt(a.submittedAt)}</div></div>`).join('')||`<div class="card"><div class="empty" style="padding:20px"><div class="empty-ico">🎉</div><div class="empty-t">Tudo corrigido!</div></div></div>`}
        </div>
        <div><div class="sec-hd"><span class="sec-t">📊 Insights</span></div>
          <div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            <div class="pill"><div class="pill-v">${allActs.length}</div><div class="pill-l">Atividades</div></div>
            <div class="pill"><div class="pill-v">${certs.length}</div><div class="pill-l">Certificados</div></div>
            <div class="pill"><div class="pill-v">${hw.length}</div><div class="pill-l">Tarefas</div></div>
            <div class="pill"><div class="pill-v">${students.length}</div><div class="pill-l">Alunos</div></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <button class="btn btn-p btn-sm" onclick="window._dispararInsights()" id="btn-run-insights">🚀 Disparar Insights (E-mail)</button>
            <button class="btn btn-s btn-sm" onclick="window._analisarAlunoPrompt()">🤖 Analisar Aluno</button>
          </div>
          <div id="insights-status" style="margin-top:10px;font-size:12px;color:var(--txm)"></div>
          <div id="insights-result" style="margin-top:10px;display:none" class="code-block"></div>
          </div>
        </div>
      </div>`);
  },

  renderChart(){
    const sel=document.getElementById('chartSel'),canvas=document.getElementById('growthChart'),empty=document.getElementById('chart-empty');
    if(!sel||!canvas)return;
    if(typeof Chart==='undefined'){if(empty)empty.textContent='⏳ Carregando Chart.js...';return;}
    if(window._chart){window._chart.destroy();window._chart=null;}
    const uid=sel.value;if(!uid){if(empty)empty.style.display='block';return;}
    if(empty)empty.style.display='none';
    const acts=DB.getActivities(uid).filter(a=>a.grade!=null).sort((a,b)=>new Date(a.submittedAt)-new Date(b.submittedAt));
    if(!acts.length){if(empty){empty.textContent='Sem notas para este aluno.';empty.style.display='block';}return;}
    window._chart=new Chart(canvas.getContext('2d'),{type:'line',data:{labels:acts.map(a=>a.title.substring(0,12)),datasets:[{data:acts.map(a=>a.grade),borderColor:'#4facde',backgroundColor:'rgba(79,172,222,.15)',fill:true,tension:.3,pointRadius:5,pointBackgroundColor:'#4facde'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:10,ticks:{color:'#8b949e'}},x:{ticks:{color:'#8b949e'}}}}});
  },

  quickMsg(userId,userName){
    const ov=document.createElement('div');ov.className='overlay';
    ov.innerHTML=`<div class="modal"><div class="mhd"><span style="font-weight:800">✉️ Para ${esc(userName)}</span><button class="btn btn-s btn-sm" onclick="this.closest('.overlay').remove()">✕</button></div>
      <div class="mbd"><div class="fg"><label class="fl">Assunto</label><input class="fi" id="qms" placeholder="Assunto…"></div><div class="fg"><label class="fl">Mensagem</label><textarea class="fi ft" id="qmb" rows="4" placeholder="Sua mensagem…"></textarea></div></div>
      <div class="mft"><button class="btn btn-s" onclick="this.closest('.overlay').remove()">Cancelar</button><button class="btn btn-p" id="qmSend">Enviar</button></div></div>`;
    document.body.appendChild(ov);
    document.getElementById('qmSend').onclick=()=>{
      const s=document.getElementById('qms').value.trim(),b=document.getElementById('qmb').value.trim();
      if(!s||!b){Toast.show('Preencha tudo.','err');return;}
      DB.addMessage({id:mkId(),fromId:Auth.currentUser.id,fromName:Auth.currentUser.name,toId:userId,toName:userName,subject:s,body:b,sentAt:new Date().toISOString(),read:false});
      ov.remove();Toast.show('Mensagem enviada! ✅','ok');
    };
  },

  activitiesUser(){
    if(!Auth.need())return'';
    const u=Auth.currentUser,acts=DB.getActivities(u.id),hw=DB.getHomework();
    const tab=window._actTab||'my',lang=window._actLang||'Python';
    const exLangs=Object.keys(EX);
    return shell('activities-user','📝 Atividades',`
      <div class="ptitle">Atividades</div><p class="psub">Pratique, veja notas e responda tarefas.</p>
      <div class="tabs">
        <button class="tab${tab==='my'?' active':''}" onclick="window._actTab='my';Router.go('activities-user')">📋 Minhas (${acts.length})</button>
        <button class="tab${tab==='exercises'?' active':''}" onclick="window._actTab='exercises';Router.go('activities-user')">💡 Exercícios</button>
        <button class="tab${tab==='homework'?' active':''}" onclick="window._actTab='homework';Router.go('activities-user')">🏠 Tarefas (${hw.length})</button>
        <button class="tab${tab==='send'?' active':''}" onclick="window._actTab='send';Router.go('activities-user')">➕ Enviar</button>
      </div>
      ${tab==='my'?`${acts.length===0?`<div class="card"><div class="empty"><div class="empty-ico">📭</div><div class="empty-t">Nenhuma atividade</div></div></div>`:acts.slice().reverse().map(a=>`<div class="card" style="margin-bottom:14px"><div style="display:flex;align-items:flex-start;gap:12px">
          <div class="gb ${gcls(a.grade)}">${a.grade??'?'}</div>
          <div style="flex:1"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">${langImg(a.language,'lang-logo-sm')}<div><div style="font-weight:800;font-size:15px">${esc(a.title)}</div><div style="font-size:11px;color:var(--txm)">${a.language} · ${fmtDt(a.submittedAt)}</div></div></div>
            <span class="badge ${a.status==='graded'?'b-ok':'b-warn'}">${a.status==='graded'?'✅ Corrigida':'⏳ Pendente'}</span>
          </div><div class="codeblock">${esc(a.code)}</div>
          ${a.correctedCode?`<div style="font-size:11px;font-weight:700;color:var(--ok);margin-top:8px">✅ CORRIGIDO:</div><div class="codeblock" style="border-color:rgba(63,185,80,.25)">${esc(a.correctedCode)}</div>`:''}
          ${a.comment?`<div class="card" style="margin-top:8px;background:rgba(79,172,222,.04);padding:12px"><b>💬 Comentário:</b> ${esc(a.comment)}</div>`:''}
          </div></div></div>`).join('')}`:''}
      ${tab==='exercises'?`<div style="margin-bottom:16px"><div style="font-size:13px;font-weight:700;color:var(--tx2);margin-bottom:8px">Linguagem:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${exLangs.map(l=>`<button class="btn${lang===l?' btn-p':' btn-s'} btn-sm" onclick="window._actLang='${l}';window._actTab='exercises';Router.go('activities-user')" style="display:flex;align-items:center;gap:4px"><img src="${LANG_LOGOS[l]||LANG_LOGOS.Outro}" style="width:16px;height:16px" onerror="this.style.display='none'"> ${l}</button>`).join('')}</div></div>
        <div class="grid g2">${(EX[lang]||[]).map(ex=>`<div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${langImg(lang,'lang-logo-sm')}<div style="font-size:14px;font-weight:800">${esc(ex.title)}</div></div>
          <div style="font-size:12px;color:var(--tx2);margin-bottom:10px">${esc(ex.desc)}</div>
          <div class="codeblock" style="font-size:11px;margin-bottom:10px;max-height:120px;overflow-y:auto">${esc(ex.code)}</div>
          <button class="btn btn-p btn-sm" onclick="Pages.prefill('${esc(ex.title).replace(/'/g,"\\'")}','${lang}','${btoa(unescape(encodeURIComponent(ex.code)))}')">📤 Usar como base</button>
        </div>`).join('')}</div>`:''}
      ${tab==='homework'?`${hw.length===0?`<div class="card"><div class="empty"><div class="empty-ico">🏠</div><div class="empty-t">Nenhuma tarefa</div></div></div>`:hw.map(h=>`<div class="card hw-card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">${langImg(h.language,'lang-logo-sm')}<div><div style="font-size:16px;font-weight:800">🏠 ${esc(h.title)}</div><div style="font-size:12px;color:var(--txm)">${h.language} · ${fmtD(h.createdAt)}${h.dueDate?' · ⏰ '+h.dueDate:''}</div></div></div>
          <span class="badge b-pur">📚 Tarefa</span></div>
          <p style="font-size:14px;color:var(--tx2);margin-top:10px">${esc(h.description)}</p>
          <div style="margin-top:12px"><button class="btn btn-p btn-sm" onclick="Pages.prefill('${esc(h.title).replace(/'/g,"\\'")} (Tarefa)','${h.language}','')">📤 Responder</button></div></div>`).join('')}`:''}
      ${tab==='send'?`<div class="card"><div class="sec-t" style="margin-bottom:16px">➕ Enviar Nova Atividade</div>
        <div class="grid g2"><div class="fg"><label class="fl">Título</label><input class="fi" id="actT" placeholder="Ex: Exercício 3 – Loops" value="${esc(window._pfTitle||'')}"></div>
          <div class="fg"><label class="fl">Linguagem</label><select class="fs" id="actL">${['Python','JavaScript','Java','HTML','CSS','Python_OO','ROBOT','SpringBoot','Angular','TypeScript','React','NodeJS','SQL','Git','Logica','Outro'].map(l=>`<option${window._pfLang===l?' selected':''}>${l}</option>`).join('')}</select></div></div>
        <div class="fg"><label class="fl">Código</label><textarea class="fi ft code-ta" id="actC" rows="12" placeholder="// Cole seu código…">${esc(window._pfCode||'')}</textarea></div>
        <button class="btn btn-p" onclick="Pages.submitAct()">🚀 Enviar</button>
        <button class="btn btn-s" style="margin-left:8px" onclick="window._pfTitle='';window._pfCode='';Router.go('activities-user')">🗑️ Limpar</button></div>`:''}`);
  },

  prefill(title,lang,b64){window._pfTitle=title;window._pfLang=lang;window._pfCode=b64?decodeURIComponent(escape(atob(b64))):'';window._actTab='send';Router.go('activities-user');},

  submitAct(){
    const title=document.getElementById('actT').value.trim(),lang=document.getElementById('actL').value,code=document.getElementById('actC').value.trim();
    if(!title||!code){Toast.show('Preencha título e código.','err');return;}
    const u=Auth.currentUser;
    DB.addActivity({id:mkId(),userId:u.id,userName:u.name,title,language:lang,code,submittedAt:new Date().toISOString(),status:'pending',grade:null,correctedCode:'',comment:''});
    window._pfTitle='';window._pfCode='';window._actTab='my';Toast.show('Atividade enviada! ✅','ok');Router.go('activities-user');
  },

  activitiesAdmin(){
    if(!Auth.needAdmin())return'';
    const f=window._actF||'pending';let acts=DB.getActivities();
    if(f==='pending')acts=acts.filter(a=>a.status==='pending');else if(f==='graded')acts=acts.filter(a=>a.status==='graded');
    return shell('activities-admin','📝 Correções',`
      <div class="ptitle">Correção de Atividades</div><p class="psub">Avalie e publique notas.</p>
      <div class="tabs">
        <button class="tab${f==='pending'?' active':''}" onclick="window._actF='pending';Router.go('activities-admin')">⏳ Pendentes (${DB.getActivities().filter(a=>a.status==='pending').length})</button>
        <button class="tab${f==='graded'?' active':''}" onclick="window._actF='graded';Router.go('activities-admin')">✅ Corrigidas</button>
        <button class="tab${f==='all'?' active':''}" onclick="window._actF='all';Router.go('activities-admin')">📋 Todas</button>
      </div>
      ${acts.length===0?`<div class="card"><div class="empty"><div class="empty-ico">🎉</div><div class="empty-t">Nada ${f==='pending'?'pendente':'aqui'}!</div></div></div>`:acts.slice().reverse().map(a=>`<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">${langImg(a.language,'lang-logo')}<div><div style="font-size:17px;font-weight:800">${esc(a.title)}</div><div style="font-size:12px;color:var(--txm)">👤 ${a.userName} · ${a.language} · ${fmtDt(a.submittedAt)}</div></div></div>
        <div style="display:flex;align-items:center;gap:8px">${a.grade!=null?`<div class="gb ${gcls(a.grade)}">${a.grade}</div>`:''}<span class="badge ${a.status==='graded'?'b-ok':'b-warn'}">${a.status==='graded'?'✅ Corrigida':'⏳ Pendente'}</span></div></div>
        <div style="font-size:11px;font-weight:700;color:var(--txm);margin-bottom:4px">📄 CÓDIGO:</div><div class="codeblock">${esc(a.code)}</div>
        ${a.status==='pending'?`<hr class="divider"><div style="font-size:14px;font-weight:800;color:var(--ac);margin-bottom:12px">✏️ Correção</div>
          <div class="fg"><label class="fl">Código Corrigido (opcional)</label><textarea class="fi ft code-ta" id="cc-${a.id}" rows="5">${esc(a.correctedCode||'')}</textarea></div>
          <div class="grid g2"><div class="fg"><label class="fl">Nota (0–10)</label><input class="fi" id="cg-${a.id}" type="number" min="0" max="10" step="0.5" placeholder="8.5"></div>
          <div class="fg"><label class="fl">Comentário</label><input class="fi" id="cm-${a.id}" placeholder="Feedback…"></div></div>
          <button class="btn btn-ok" onclick="Pages.gradeAct('${a.id}')">✅ Publicar Nota</button>`:
        `${a.correctedCode?`<div style="margin-top:8px;font-size:11px;font-weight:700;color:var(--ok)">✅ CORRIGIDO:</div><div class="codeblock" style="border-color:rgba(63,185,80,.25)">${esc(a.correctedCode)}</div>`:''}${a.comment?`<div class="card" style="margin-top:8px;padding:12px;background:rgba(79,172,222,.04)"><b>Comentário:</b> ${esc(a.comment)}</div>`:''}`}
      </div>`).join('')}`);
  },

  gradeAct(id){
    const g=parseFloat(document.getElementById('cg-'+id)?.value),c=document.getElementById('cm-'+id)?.value||'',cc=document.getElementById('cc-'+id)?.value||'';
    if(isNaN(g)||g<0||g>10){Toast.show('Nota 0–10.','err');return;}
    DB.gradeActivity(id,{grade:g,comment:c,correctedCode:cc});
    Toast.show('Nota publicada! ✅','ok');Router.go('activities-admin');
  },

  homeworkAdmin(){
    if(!Auth.needAdmin())return'';
    const hw=DB.getHomework();
    return shell('homework-admin','🏠 Atividades de Casa',`
      <div class="ptitle">Atividades de Casa</div><p class="psub">Publique tarefas para os alunos.</p>
      <div class="card" style="margin-bottom:24px"><div class="sec-t" style="margin-bottom:14px">➕ Nova Tarefa</div>
        <div class="fg"><label class="fl">Título</label><input class="fi" id="hwT" placeholder="Ex: Calculadora em Python"></div>
        <div class="fg"><label class="fl">Descrição</label><textarea class="fi ft" id="hwD" rows="4" placeholder="Descreva o que fazer…"></textarea></div>
        <div class="grid g2"><div class="fg"><label class="fl">Linguagem</label><select class="fs" id="hwL">${['Python','JavaScript','Java','HTML','CSS','ROBOT','SpringBoot','Angular','TypeScript','React','NodeJS','SQL','Git','Logica','Geral'].map(l=>`<option>${l}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl">Data Entrega</label><input class="fi" id="hwDue" type="date"></div></div>
        <button class="btn btn-p" onclick="Pages.addHW()">📤 Publicar</button></div>
      <div class="sec-hd"><span class="sec-t">📋 Tarefas (${hw.length})</span></div>
      ${hw.length===0?`<div class="card"><div class="empty"><div class="empty-ico">🏠</div><div class="empty-t">Nenhuma tarefa</div></div></div>`:hw.slice().reverse().map(h=>`<div class="card hw-card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div><div style="font-size:15px;font-weight:800">🏠 ${esc(h.title)}</div><div style="font-size:12px;color:var(--txm)">${h.language} · ${fmtD(h.createdAt)}${h.dueDate?' · ⏰ '+h.dueDate:''}</div></div>
        <button class="btn btn-d btn-sm" onclick="Pages.delHW('${h.id}')">🗑️</button></div>
        <p style="font-size:13px;color:var(--tx2);margin-top:8px">${esc(h.description)}</p></div>`).join('')}`);
  },

  addHW(){
    const t=document.getElementById('hwT').value.trim(),d=document.getElementById('hwD').value.trim(),l=document.getElementById('hwL').value,due=document.getElementById('hwDue').value;
    if(!t||!d){Toast.show('Preencha título e descrição.','err');return;}
    DB.addHomework({id:mkId(),title:t,description:d,language:l,dueDate:due||'',createdAt:new Date().toISOString(),createdBy:Auth.currentUser.name});
    Toast.show('Tarefa publicada! 🏠','ok');Router.go('homework-admin');
  },

  delHW(id){if(confirm('Remover tarefa?')){DB.deleteHomework(id);Toast.show('Removida.','info');Router.go('homework-admin');}},

  materials(){
    if(!Auth.need())return'';
    const items=[
      {key:'python',ico:'Python',lbl:'Python',sub:'IA, dados, web',col:'#3572A5'},
      {key:'java',ico:'Java',lbl:'Java',sub:'Enterprise e Android',col:'#b07219'},
      {key:'javascript',ico:'JavaScript',lbl:'JavaScript',sub:'A linguagem da web',col:'#f0db4f'},
      {key:'robot',ico:'ROBOT',lbl:'Robot Framework',sub:'Automação de testes',col:'#00aabb'},
      {key:'spring',ico:'SpringBoot',lbl:'Spring Boot',sub:'APIs REST com Java',col:'#6db33f'},
      {key:'angular',ico:'Angular',lbl:'Angular',sub:'SPAs com TypeScript',col:'#dd0031'},
      {key:'html',ico:'HTML',lbl:'HTML',sub:'Estrutura da web',col:'#e34c26'},
      {key:'css',ico:'CSS',lbl:'CSS',sub:'Estilização e animações',col:'#563d7c'},
      {key:'typescript',ico:'TypeScript',lbl:'TypeScript',sub:'JS com tipagem estática',col:'#3178c6'},
      {key:'react',ico:'React',lbl:'React',sub:'Interfaces reativas',col:'#61dafb'},
      {key:'nodejs',ico:'NodeJS',lbl:'Node.js',sub:'JS no servidor',col:'#339933'},
      {key:'sql',ico:'SQL',lbl:'SQL',sub:'Bancos de dados',col:'#4479a1'},
      {key:'git',ico:'Git',lbl:'Git',sub:'Controle de versão',col:'#f05032'},
      {key:'logica',ico:'Logica',lbl:'Lógica de Programação',sub:'Algoritmos e fundamentos',col:'#9b59b6'},
      {key:'python_oo',ico:'Python_OO',lbl:'Python OO',sub:'Orientação a Objetos',col:'#3572A5'},
    ];
    return shell('materials','📚 Material',`<div class="ptitle">Material de Estudos</div><p class="psub">Escolha uma linguagem para aprender.</p>
      <div class="grid g3">${items.map(it=>{const matKey=it.key==='python_oo'?'python':it.key;return `<div class="card mat-card" onclick="Router.go('mat-${it.key}')">
        <div style="margin-bottom:10px">${langImg(it.ico,'lang-logo-lg')}</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:4px">${it.lbl}</div>
        <div style="font-size:13px;color:var(--tx2);margin-bottom:10px">${it.sub}</div>
        <span class="badge" style="background:${it.col}20;border-color:${it.col}40;color:${it.col}">Ver conteúdo →</span>
      </div>`;}).join('')}</div>`);
  },

  matDetail(key){
    // Map Python_OO to correct MAT key
    const matKey = key === 'python_oo' ? 'python' : key;
    const m=MAT[matKey];if(!m)return this.materials();
    return shell('materials',`📚 ${m.title}`,`
      <div style="margin-bottom:12px"><button class="btn btn-s btn-sm" onclick="Router.go('materials')">← Voltar</button></div>
      <div class="ptitle">${m.emoji} ${m.title}</div><p class="psub">${m.desc}</p>
      ${m.sections.map(s=>`<div class="card" style="margin-bottom:18px"><div style="font-size:16px;font-weight:800;margin-bottom:8px">${s.t}</div>
        <p style="color:var(--tx2);line-height:1.7;font-size:14px;margin-bottom:${s.c?'10px':'0'}">${s.p}</p>
        ${s.c?`<div class="codeblock">${esc(s.c)}</div>`:''}</div>`).join('')}
      <div class="card" style="background:linear-gradient(135deg,rgba(79,172,222,.04),rgba(126,232,162,.04))">
        <div style="font-size:15px;font-weight:800;margin-bottom:6px">🤖 Dúvidas sobre ${m.title}?</div>
        <p style="color:var(--tx2);font-size:13px;margin-bottom:12px">Pergunte ao CodeBot!</p>
        <button class="btn btn-p" onclick="Router.go('chatbot')">💬 Chat com IA</button></div>`);
  },

  certificatesUser(){
    if(!Auth.need())return'';
    const certs=DB.getCertificates(Auth.currentUser.id);
    return shell('certificates-user','🏆 Certificados',`<div class="ptitle">Meus Certificados</div><p class="psub">Certificados emitidos pelo professor.</p>
      ${certs.length===0?`<div class="card"><div class="empty"><div class="empty-ico">🎓</div><div class="empty-t">Nenhum certificado</div></div></div>`
      :`<div class="grid g2">${certs.map(c=>`<div class="cert-card"><div style="font-size:18px;font-weight:800;margin-bottom:5px">${esc(c.courseName)}</div>
        <div style="font-size:12px;color:var(--txm);margin-bottom:6px">🗓 ${fmtD(c.issuedAt)} · ${esc(c.issuedBy)}</div>
        ${c.description?`<p style="font-size:13px;color:var(--tx2);margin-bottom:12px">${esc(c.description)}</p>`:''}
        ${c.fileData?`<a href="${c.fileData}" download="${esc(c.fileName||'cert.pdf')}" class="btn btn-p btn-sm">⬇️ Baixar PDF</a>`:`<span class="badge b-warn">📄 Sem PDF</span>`}
      </div>`).join('')}</div>`}`);
  },

  certificatesAdmin(){
    if(!Auth.needAdmin())return'';
    const users=DB.getUsers().filter(u=>u.role==='user'),certs=DB.getCertificates();
    return shell('certificates-admin','🏆 Certificados',`<div class="ptitle">Emitir Certificados</div><p class="psub">Upload de PDF para o aluno.</p>
      <div class="card" style="margin-bottom:24px"><div class="sec-t" style="margin-bottom:14px">➕ Novo Certificado</div>
        <div class="grid g2"><div class="fg"><label class="fl">Aluno</label><select class="fs" id="cUser">${users.map(u=>`<option value="${u.id}" data-name="${esc(u.name)}">${u.name}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl">Curso</label><input class="fi" id="cCourse" placeholder="Ex: Python Avançado"></div></div>
        <div class="fg"><label class="fl">Descrição</label><input class="fi" id="cDesc" placeholder="Breve descrição…"></div>
        <div class="fg"><label class="fl">PDF</label><input type="file" id="cFile" accept=".pdf" class="fi" style="padding:8px" onchange="Pages.onCertFile(this)"><div id="cFileInfo" style="font-size:12px;color:var(--txm);margin-top:5px">Selecione PDF</div></div>
        <button class="btn btn-p" onclick="Pages.issueCert()">🏆 Emitir</button></div>
      <div class="sec-hd"><span class="sec-t">📋 Emitidos (${certs.length})</span></div>
      ${certs.length===0?`<div class="card"><div class="empty"><div class="empty-ico">📭</div><div class="empty-t">Nenhum certificado</div></div></div>`
      :`<div class="twrap"><table><thead><tr><th>Aluno</th><th>Curso</th><th>Data</th><th>PDF</th><th>Ações</th></tr></thead>
        <tbody>${certs.map(c=>`<tr><td>${esc(c.userName)}</td><td>${esc(c.courseName)}</td><td>${fmtD(c.issuedAt)}</td>
          <td>${c.fileData?'<span class="badge b-ok">✅</span>':'<span class="badge b-warn">—</span>'}</td>
          <td><button class="btn btn-d btn-sm" onclick="Pages.delCert('${c.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>`}`);
  },

  _certData:null,_certName:null,
  onCertFile(inp){const f=inp.files[0];if(!f)return;const info=document.getElementById('cFileInfo');info.textContent=`⏳ ${f.name}…`;const r=new FileReader();r.onload=e=>{this._certData=e.target.result;this._certName=f.name;info.textContent=`✅ ${f.name}`;info.style.color='var(--ok)';};r.readAsDataURL(f);},

  issueCert(){
    const sel=document.getElementById('cUser'),userId=sel.value,uName=sel.options[sel.selectedIndex].dataset.name;
    const course=document.getElementById('cCourse').value.trim(),desc=document.getElementById('cDesc').value.trim();
    if(!course){Toast.show('Informe o curso.','err');return;}
    if(!this._certData){Toast.show('Selecione PDF.','err');return;}
    DB.addCertificate({id:mkId(),userId,userName:uName,courseName:course,description:desc,fileData:this._certData,fileName:this._certName,issuedAt:new Date().toISOString(),issuedBy:Auth.currentUser.name});
    this._certData=null;this._certName=null;Toast.show('Certificado emitido! 🏆','ok');Router.go('certificates-admin');
  },

  delCert(id){if(confirm('Remover certificado?')){DB.deleteCertificate(id);Toast.show('Removido.','info');Router.go('certificates-admin');}},

  chatbot(){
    if(!Auth.need())return'';
    return shell('chatbot','🤖 Chat com IA',`<div class="ptitle">CodeBot — Assistente IA</div><p class="psub">Tire dúvidas de programação com Gemini AI.</p>
      <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:calc(100vh - 215px);min-height:420px">
        <div style="background:linear-gradient(135deg,rgba(79,172,222,.1),rgba(126,232,162,.04));padding:12px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px">
          <img src="${BOT_AVATAR}" class="bot-av-img" alt="CodeBot"><div><div style="font-weight:700;font-size:13px">CodeBot — Gemini 2.5 Flash</div><div style="font-size:11px;color:var(--txm)">Powered by Google Gemini AI</div></div>
          <span class="badge b-ok" style="margin-left:auto">● Online</span></div>
        <div class="chat-msgs" id="chatMsgs"><div style="display:flex;align-items:flex-start;gap:8px"><img src="${BOT_AVATAR}" class="bot-av-img" alt="CodeBot"><div><div style="font-size:11px;color:var(--txm);font-weight:700;margin-bottom:4px">CodeBot</div>
          <div class="bubble b">Olá! 👋 Sou o <strong>CodeBot</strong>!<br><br>Posso ajudar com <strong>Python, JavaScript, Java, HTML, CSS, Angular, Spring Boot, Robot, TypeScript, React, Node.js, SQL, Git</strong> e mais.<br><br>O que quer aprender? 🚀</div></div></div></div>
        <div class="chat-bar"><input class="fi" id="chatIn" placeholder="Pergunte… (Enter)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Pages.sendChat();}">
          <button class="btn btn-p" onclick="Pages.sendChat()">🚀</button></div></div>`);
  },

  async sendChat(){
    const inp=document.getElementById('chatIn'),msg=inp?.value.trim();if(!msg)return;inp.value='';
    const box=document.getElementById('chatMsgs');
    const ud=document.createElement('div');ud.style.cssText='display:flex;justify-content:flex-end';ud.innerHTML=`<div class="bubble u">${esc(msg)}</div>`;box.appendChild(ud);
    const bd=document.createElement('div');bd.style.cssText='display:flex;align-items:flex-start;gap:8px';
    const loadId='lb-'+Date.now();bd.innerHTML=`<img src="${BOT_AVATAR}" class="bot-av-img" alt="CodeBot"><div><div style="font-size:11px;color:var(--txm);font-weight:700;margin-bottom:4px">CodeBot</div><div class="bubble b" id="${loadId}"><span class="spin" style="width:14px;height:14px"></span> Pensando…</div></div>`;
    box.appendChild(bd);box.scrollTop=box.scrollHeight;

    let reply = '';
    try {
      const resp = await fetch(CHATBOT_API + '/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: msg })
      });
      const data = await resp.json();
      reply = data.success ? data.data.reply : (data.detail || 'Erro ao conectar com o bot.');
    } catch(e) {
      reply = '⚠️ Não foi possível conectar ao servidor do chatbot. Certifique-se de que o `app.py` está rodando na porta 8090.\n\n**Dica:** Execute no terminal:\n```\npip install fastapi uvicorn google-genai\npython app.py\n```';
    }

    const el=document.getElementById(loadId);
    if(el){
      const formatted=reply.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,l,c)=>`<div class="codeblock" style="margin:8px 0">${esc(c.trim())}</div>`).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code style="background:var(--bgh);padding:1px 5px;border-radius:4px;font-family:var(--fc);font-size:12px">$1</code>').replace(/\n/g,'<br>');
      const ttsBtn=A11y.s.ttsEnabled?`<button class="tts-btn" onclick="A11y.ttsSpeak(this.closest('.bubble').innerText)" title="Ouvir">🔊</button>`:'';
      el.innerHTML=formatted+ttsBtn;
    }
    box.scrollTop=box.scrollHeight;
  },

  messagesUser(){
    if(!Auth.need())return'';
    const msgs=DB.getMessages(Auth.currentUser.id).slice().reverse();
    return shell('messages-user','✉️ Mensagens',`<div class="ptitle">Mensagens</div><p class="psub">Comunicados do professor.</p>
      ${msgs.length===0?`<div class="card"><div class="empty"><div class="empty-ico">📬</div><div class="empty-t">Nenhuma mensagem</div></div></div>`
      :msgs.map(m=>`<div class="card" style="margin-bottom:10px;cursor:pointer;${!m.read?'border-color:var(--ac)':''}" onclick="Pages.openMsg('${m.id}')">
        <div style="display:flex;align-items:center;gap:10px">${!m.read?'<div style="width:8px;height:8px;border-radius:50%;background:var(--ac)"></div>':'<div style="width:8px"></div>'}
          <div style="flex:1;min-width:0"><div style="font-weight:${m.read?'600':'800'};font-size:14px">${esc(m.subject)}</div>
            <div style="font-size:11px;color:var(--txm)">${m.fromName} · ${fmtDt(m.sentAt)}</div>
            <p style="font-size:13px;color:var(--tx2);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.body).substring(0,100)}</p></div></div></div>`).join('')}`);
  },

  openMsg(id){
    DB.markRead(id);
    const m=DB.getAllMessages().find(x=>x.id===id);if(!m)return;
    const ov=document.createElement('div');ov.className='overlay';
    ov.innerHTML=`<div class="modal"><div class="mhd"><span style="font-weight:800">✉️ ${esc(m.subject)}</span><button class="btn btn-s btn-sm" onclick="this.closest('.overlay').remove()">✕</button></div>
      <div class="mbd"><div style="font-size:12px;color:var(--txm);margin-bottom:14px">${m.fromName} · ${fmtDt(m.sentAt)}</div><div style="font-size:14px;line-height:1.7">${esc(m.body).replace(/\n/g,'<br>')}</div></div>
      <div class="mft"><button class="btn btn-s" onclick="this.closest('.overlay').remove()">Fechar</button></div></div>`;
    document.body.appendChild(ov);setTimeout(()=>Router.go('messages-user'),60);
  },

  messagesAdmin(){
    if(!Auth.needAdmin())return'';
    const users=DB.getUsers().filter(u=>u.role==='user'),msgs=DB.getAllMessages();
    return shell('messages-admin','✉️ Mensagens',`<div class="ptitle">Enviar Mensagens</div><p class="psub">Comunique-se com os alunos.</p>
      <div class="card" style="margin-bottom:22px"><div class="sec-t" style="margin-bottom:14px">📨 Nova</div>
        <div class="fg"><label class="fl">Destinatário</label><select class="fs" id="msgTo">${users.map(u=>`<option value="${u.id}" data-name="${esc(u.name)}">${u.name}</option>`).join('')}</select></div>
        <div class="fg"><label class="fl">Assunto</label><input class="fi" id="msgS" placeholder="Assunto…"></div>
        <div class="fg"><label class="fl">Mensagem</label><textarea class="fi ft" id="msgB" rows="4" placeholder="Escreva…"></textarea></div>
        <button class="btn btn-p" onclick="Pages.sendMsg()">📨 Enviar</button></div>
      <div class="sec-hd"><span class="sec-t">📋 Histórico (${msgs.length})</span></div>
      ${msgs.length===0?`<div class="card"><div class="empty"><div class="empty-ico">📭</div><div class="empty-t">Nenhuma</div></div></div>`
      :`<div class="twrap"><table><thead><tr><th>Para</th><th>Assunto</th><th>Data</th><th>Status</th></tr></thead>
        <tbody>${msgs.slice().reverse().map(m=>`<tr><td>${esc(m.toName)}</td><td>${esc(m.subject)}</td><td>${fmtDt(m.sentAt)}</td><td>${m.read?'<span class="badge b-ok">✅ Lida</span>':'<span class="badge b-warn">⏳</span>'}</td></tr>`).join('')}</tbody></table></div>`}`);
  },

  sendMsg(){
    const sel=document.getElementById('msgTo'),toId=sel.value,toName=sel.options[sel.selectedIndex].dataset.name;
    const s=document.getElementById('msgS').value.trim(),b=document.getElementById('msgB').value.trim();
    if(!s||!b){Toast.show('Preencha assunto e mensagem.','err');return;}
    DB.addMessage({id:mkId(),fromId:Auth.currentUser.id,fromName:Auth.currentUser.name,toId,toName,subject:s,body:b,sentAt:new Date().toISOString(),read:false});
    Toast.show('Mensagem enviada! ✅','ok');Router.go('messages-admin');
  },

  manageStudents(){
    if(!Auth.needAdmin())return'';
    const students=DB.getUsers().filter(u=>u.role==='user');
    return shell('manage-students','🎓 Alunos',`<div class="ptitle">Alunos</div><p class="psub">${students.length} aluno(s) cadastrado(s).</p>
      <div class="grid g2">${students.map(u=>{
        const acts=DB.getActivities(u.id),g=acts.filter(a=>a.grade!=null);
        const avg=g.length?(g.reduce((s,a)=>s+a.grade,0)/g.length).toFixed(1):'–';
        const certs=DB.getCertificates(u.id).length;
        return `<div class="card"><div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${avHtml(u,54)}<div><div style="font-size:16px;font-weight:800">${u.name}</div><div style="font-size:12px;color:var(--txm)">@${u.username}</div><div style="font-size:11px;color:var(--txm)">${u.email}</div></div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><span class="badge b-info">📝 ${acts.length}</span><span class="badge b-ok">⭐ ${avg}</span><span class="badge b-pur">🏆 ${certs}</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-s btn-sm" onclick="Pages.quickMsg('${u.id}','${u.name}')">✉️ Mensagem</button></div></div>`;
      }).join('')}</div>`);
  },

  // ─── CONFIGURAÇÕES (Admin) ─────────────────
  settings(){
    if(!Auth.needAdmin())return'';
    const cfg = GitDB.getConfig() || {};
    const isOk = GitDB.isConfigured();
    const statusBadge = isOk
      ? '<span class="badge b-ok">✅ Conectado</span>'
      : '<span class="badge b-warn">⚠️ Não configurado</span>';
    return shell('settings','⚙️ Configurações',`
      <div class="ptitle">Configurações</div><p class="psub">Configure a conexão com o GitHub para persistência dos dados.</p>
      <div class="card" style="margin-bottom:20px">
        <div class="sec-t" style="margin-bottom:14px">🔗 GitHub — Banco de Dados ${statusBadge}</div>
        <p style="font-size:13px;color:var(--tx2);margin-bottom:16px;line-height:1.6">
          Para que os dados (usuários, atividades, notas, etc.) sejam salvos de forma <strong>persistente</strong> no GitHub Pages,
          configure abaixo o acesso ao repositório. O sistema usará a <strong>GitHub Contents API</strong> para ler e gravar
          o arquivo <code>tsa_database.json</code> diretamente no seu repositório.
        </p>
        <div class="fg"><label class="fl">Personal Access Token (GitHub)</label>
          <input class="fi" id="ghToken" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" value="${esc(cfg.token||'')}">
          <div style="font-size:11px;color:var(--txm);margin-top:4px">Gere em github.com/settings/tokens → Fine-grained → permissão Contents (read/write)</div>
        </div>
        <div class="grid g2">
          <div class="fg"><label class="fl">Owner (usuário/org)</label><input class="fi" id="ghOwner" placeholder="seu-usuario" value="${esc(cfg.owner||'')}"></div>
          <div class="fg"><label class="fl">Repositório</label><input class="fi" id="ghRepo" placeholder="TechStartAcademy" value="${esc(cfg.repo||'')}"></div>
        </div>
        <div class="grid g2">
          <div class="fg"><label class="fl">Branch</label><input class="fi" id="ghBranch" placeholder="main" value="${esc(cfg.branch||'main')}"></div>
          <div class="fg"><label class="fl">Caminho do JSON</label><input class="fi" id="ghPath" placeholder="data/tsa_database.json" value="${esc(cfg.path||'data/tsa_database.json')}"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-p" onclick="Pages.saveGitConfig()">💾 Salvar Configuração</button>
          <button class="btn btn-s" onclick="Pages.testGitConnection()">🔍 Testar Conexão</button>
        </div>
        <div id="ghStatus" style="margin-top:12px;font-size:13px;display:none"></div>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="sec-t" style="margin-bottom:14px">🔄 Sincronização</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-p btn-sm" onclick="Pages.forceSyncGH()" ${!isOk?'disabled':''}>📤 Forçar Envio (push)</button>
          <button class="btn btn-s btn-sm" onclick="Pages.forceReloadGH()" ${!isOk?'disabled':''}>📥 Forçar Recarga (pull)</button>
          <button class="btn btn-d btn-sm" onclick="Pages.resetLocalData()">🗑️ Limpar Cache Local</button>
        </div>
        <div id="syncStatus" style="margin-top:12px;font-size:13px;display:none"></div>
      </div>
      <div class="card">
        <div class="sec-t" style="margin-bottom:14px">📋 Como funciona</div>
        <div style="font-size:13px;color:var(--tx2);line-height:1.8">
          <p>1. O sistema <strong>lê</strong> o <code>tsa_database.json</code> do repositório GitHub a cada carregamento.</p>
          <p>2. Alterações (novas atividades, notas, mensagens) são salvas no <strong>localStorage</strong> instantaneamente.</p>
          <p>3. Após 1.5s de inatividade, o sistema faz um <strong>commit automático</strong> no repositório via API.</p>
          <p>4. O JSON do repositório é a <strong>fonte de verdade</strong> — funciona em qualquer navegador/dispositivo.</p>
          <p style="margin-top:8px;color:var(--ac)">💡 <strong>Dica:</strong> Gere um token com permissão mínima (apenas Contents) para manter segurança.</p>
        </div>
      </div>`);
  },

  saveGitConfig(){
    const token = document.getElementById('ghToken').value.trim();
    const owner = document.getElementById('ghOwner').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    const path = document.getElementById('ghPath').value.trim() || 'data/tsa_database.json';
    if(!token||!owner||!repo){ Toast.show('Preencha Token, Owner e Repositório.','err'); return; }
    GitDB.saveConfig({ token, owner, repo, branch, path });
    Toast.show('Configuração salva! ✅','ok');
    Router.go('settings');
  },

  async testGitConnection(){
    const el = document.getElementById('ghStatus');
    if(el){ el.style.display='block'; el.innerHTML='⏳ Testando conexão...'; el.style.color='var(--tx2)'; }
    // Salva config temporariamente para testar
    const token = document.getElementById('ghToken').value.trim();
    const owner = document.getElementById('ghOwner').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    const path = document.getElementById('ghPath').value.trim() || 'data/tsa_database.json';
    if(!token||!owner||!repo){ if(el){ el.innerHTML='❌ Preencha Token, Owner e Repositório.'; el.style.color='var(--err)'; } return; }
    GitDB.saveConfig({ token, owner, repo, branch, path });
    try {
      const result = await GitDB.read();
      if(result && result.data){
        const users = (result.data.users||[]).length;
        const acts = (result.data.activities||[]).length;
        if(el){
          el.innerHTML = `✅ <strong>Conexão OK!</strong> — Arquivo encontrado (SHA: ${result.sha.substring(0,7)})<br>
            📊 ${users} usuário(s), ${acts} atividade(s) no JSON remoto.`;
          el.style.color = 'var(--ok)';
        }
        Toast.show('Conexão com GitHub OK! ✅','ok');
      } else {
        if(el){ el.innerHTML='❌ Arquivo não encontrado ou token inválido.'; el.style.color='var(--err)'; }
        Toast.show('Falha na conexão','err');
      }
    } catch(e){
      if(el){ el.innerHTML=`❌ Erro: ${e.message}`; el.style.color='var(--err)'; }
      Toast.show('Erro na conexão','err');
    }
  },

  async forceSyncGH(){
    const el = document.getElementById('syncStatus');
    if(el){ el.style.display='block'; el.innerHTML='⏳ Enviando dados para o GitHub...'; }
    const r = await DB.forceSync();
    if(r.ok){
      if(el) el.innerHTML='✅ Dados enviados com sucesso!';
      Toast.show('Push realizado! ✅','ok');
    } else {
      if(el) el.innerHTML=`❌ ${r.error||'Falha ao enviar'}`;
      Toast.show('Falha no push','err');
    }
  },

  async forceReloadGH(){
    const el = document.getElementById('syncStatus');
    if(el){ el.style.display='block'; el.innerHTML='⏳ Baixando dados do GitHub...'; }
    const r = await DB.forceReload();
    if(r.ok){
      if(el) el.innerHTML='✅ Dados recarregados do GitHub!';
      Toast.show('Pull realizado! ✅','ok');
      setTimeout(()=>Router.go('settings'),1000);
    } else {
      if(el) el.innerHTML=`❌ ${r.error||'Falha ao baixar'}`;
      Toast.show('Falha no pull','err');
    }
  },

  resetLocalData(){
    if(!confirm('Limpar cache local? Os dados do GitHub não serão afetados.\nIsso forçará reload do JSON na próxima vez.')) return;
    localStorage.removeItem('tsa_db_v5');
    localStorage.removeItem('tsa_auth');
    Toast.show('Cache limpo! Recarregando...','info');
    setTimeout(()=>location.reload(), 1000);
  },

  profile(){
    if(!Auth.need())return'';
    Auth.refreshUser();const u=Auth.currentUser;
    const avPrev=u.avatar?`<img src="${u.avatar}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid var(--ac)" alt="">`
      :`<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac2));display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:#fff;border:3px solid var(--ac)">${ini(u.name)}</div>`;
    return shell('profile','👤 Perfil',`<div class="ptitle">Meu Perfil</div><p class="psub">Personalize sua conta.</p>
      <div class="grid g2">
        <div class="card"><div class="sec-t" style="margin-bottom:16px">📸 Foto</div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px"><div id="avPrev">${avPrev}</div>
            <div style="text-align:center"><input type="file" id="avFile" accept="image/*" style="display:none" onchange="Pages.onAvatar(this)">
              <button class="btn btn-p" onclick="document.getElementById('avFile').click()">📂 Escolher</button>
              <div style="font-size:12px;color:var(--txm);margin-top:6px">JPG, PNG · Máx 2 MB</div>
              ${u.avatar?`<button class="btn btn-d btn-sm" style="margin-top:8px" onclick="Pages.removeAvatar()">🗑️ Remover</button>`:''}</div></div></div>
        <div class="card"><div class="sec-t" style="margin-bottom:16px">📋 Informações</div>
          <div class="fg"><label class="fl">Nome</label><input class="fi" id="pName" value="${esc(u.name)}"></div>
          <div class="fg"><label class="fl">E-mail</label><input class="fi" id="pEmail" type="email" value="${esc(u.email)}"></div>
          <div class="fg"><label class="fl">Usuário</label><input class="fi" value="${esc(u.username)}" disabled style="opacity:.6"></div>
          <button class="btn btn-p" onclick="Pages.savePerfil()">💾 Salvar</button></div>
        <div class="card"><div class="sec-t" style="margin-bottom:16px">🔒 Senha</div>
          <div class="fg"><label class="fl">Senha Atual</label><input class="fi" id="pOld" type="password" placeholder="••••••••"></div>
          <div class="fg"><label class="fl">Nova Senha</label><input class="fi" id="pNew" type="password" placeholder="Mínimo 6"></div>
          <div class="fg"><label class="fl">Confirmar</label><input class="fi" id="pNew2" type="password" placeholder="Repita"></div>
          <button class="btn btn-s" onclick="Pages.changePass()">🔒 Alterar</button></div>
      </div>`);
  },

  onAvatar(inp){
    const f=inp.files[0];if(!f)return;if(f.size>2*1024*1024){Toast.show('Max 2 MB.','err');return;}
    const r=new FileReader();r.onload=e=>{
      DB.updateUser(Auth.currentUser.id,{avatar:e.target.result});Auth.refreshUser();
      Toast.show('Foto atualizada! 🎉','ok');Router.go('profile');
    };r.readAsDataURL(f);
  },

  removeAvatar(){DB.updateUser(Auth.currentUser.id,{avatar:''});Auth.refreshUser();Toast.show('Foto removida.','info');Router.go('profile');},

  savePerfil(){
    const name=document.getElementById('pName')?.value.trim(),email=document.getElementById('pEmail')?.value.trim();
    if(!name||!email){Toast.show('Preencha nome e e-mail.','err');return;}
    DB.updateUser(Auth.currentUser.id,{name,email});Auth.refreshUser();Toast.show('Perfil atualizado! ✅','ok');Router.go('profile');
  },

  changePass(){
    const old=document.getElementById('pOld')?.value,nw=document.getElementById('pNew')?.value,nw2=document.getElementById('pNew2')?.value;
    if(!old||!nw||!nw2){Toast.show('Preencha todos.','err');return;}
    if(nw.length<6){Toast.show('Mínimo 6 caracteres.','err');return;}
    if(nw!==nw2){Toast.show('Senhas não coincidem.','err');return;}
    const u=DB.getUserById(Auth.currentUser.id);
    if(u.password!==old){Toast.show('Senha atual incorreta.','err');return;}
    DB.updateUser(Auth.currentUser.id,{password:nw});Auth.refreshUser();
    Toast.show('Senha alterada! 🔒','ok');
  }
};

// ─── AVATAR BOT ──────────────────────────────
const AvatarBot={
  msgs:['👋 Precisa de ajuda?','💡 Use o ChatBot para dúvidas!','🎯 Complete atividades para certificados!','📚 Explore o Material de Estudos!','🏠 Verifique tarefas de casa!'],
  i:0,
  init(){if(!document.getElementById('av-bubble'))return;setTimeout(()=>this._show(),4500);setInterval(()=>{this.i=(this.i+1)%this.msgs.length;this._show();},14000);},
  _show(){const b=document.getElementById('av-bubble');if(b){b.textContent=this.msgs[this.i];b.classList.add('show');setTimeout(()=>b.classList.remove('show'),6000);}},
  toggle(){const b=document.getElementById('av-bubble');if(b){if(b.classList.contains('show'))b.classList.remove('show');else this._show();}}
};

// ─── APP ─────────────────────────────────────
const App = {
  async init(){
    await DB.init();
    Auth.init();
    A11y.init();
    const dest=Auth.isLoggedIn()?(Auth.isAdmin()?'home-admin':'home-user'):'login';
    Router.go(dest);
  },

  render(page){
    const root=document.getElementById('app');
    let html='';
    switch(page){
      case 'login':html=Pages.login();break;
      case 'register':html=Pages.register();break;
      case 'home-user':html=Pages.homeUser();break;
      case 'home-admin':html=Pages.homeAdmin();break;
      case 'activities-user':html=Pages.activitiesUser();break;
      case 'activities-admin':html=Pages.activitiesAdmin();break;
      case 'homework-admin':html=Pages.homeworkAdmin();break;
      case 'materials':html=Pages.materials();break;
      case 'certificates-user':html=Pages.certificatesUser();break;
      case 'certificates-admin':html=Pages.certificatesAdmin();break;
      case 'chatbot':html=Pages.chatbot();break;
      case 'messages-user':html=Pages.messagesUser();break;
      case 'messages-admin':html=Pages.messagesAdmin();break;
      case 'manage-students':html=Pages.manageStudents();break;
      case 'settings':html=Pages.settings();break;
      case 'profile':html=Pages.profile();break;
      default:
        // Handle material detail pages
        if(page.startsWith('mat-')){
          const key=page.replace('mat-','');
          html=Pages.matDetail(key);
        } else {
          html=Pages.login();
        }
    }
    root.innerHTML=html;
    setTimeout(()=>{AvatarBot.init();if(page==='home-admin')Pages.renderChart();},150);
  }
};

// Inicializa
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>App.init());
else App.init();

// ─── FUNÇÕES GLOBAIS DE INSIGHTS (Admin) ───────
window._dispararInsights = async function() {
  const btn = document.getElementById('btn-run-insights');
  const status = document.getElementById('insights-status');
  if(btn) btn.disabled = true;
  if(status) status.innerHTML = '⏳ Disparando insights para todos os alunos... aguarde';
  try {
    const r = await DB.dispararInsights();
    if(r.success) {
      if(status) status.innerHTML = `✅ ${r.message}`;
      Toast.show('Insights enviados! 🚀','ok');
    } else {
      if(status) status.innerHTML = `❌ ${r.detail || 'Erro ao disparar insights'}`;
      Toast.show('Erro ao disparar insights','err');
    }
  } catch(e) {
    if(status) status.innerHTML = `❌ Backend offline ou erro: ${e.message}`;
    Toast.show('Backend indisponível','err');
  }
  if(btn) btn.disabled = false;
};

window._analisarAlunoPrompt = function() {
  const students = DB.getUsers().filter(u=>u.role==='user');
  if(!students.length){ Toast.show('Nenhum aluno cadastrado','warn'); return; }
  const opts = students.map(s=>`<option value="${s.id}">${s.name} (${s.email})</option>`).join('');
  const ov = document.createElement('div'); ov.className='overlay';
  ov.innerHTML = `<div class="modal"><div class="mhd"><span style="font-weight:800">🤖 Analisar Aluno com IA</span><button class="btn btn-s btn-sm" onclick="this.closest('.overlay').remove()">✕</button></div>
    <div class="mbd"><div class="fg"><label class="fl">Selecionar Aluno</label><select class="fs" id="analyzeSelect">${opts}</select></div>
    <div id="analyzeResult" style="margin-top:12px;display:none;background:var(--c2);border:1px solid var(--bd);border-radius:8px;padding:16px;font-size:13px;line-height:1.7;color:var(--tx);white-space:pre-wrap;max-height:300px;overflow-y:auto"></div></div>
    <div class="mft"><button class="btn btn-s" onclick="this.closest('.overlay').remove()">Fechar</button><button class="btn btn-p" id="analyzeBtn">Analisar</button></div></div>`;
  document.body.appendChild(ov);
  document.getElementById('analyzeBtn').onclick = async function() {
    const uid = document.getElementById('analyzeSelect').value;
    const res = document.getElementById('analyzeResult');
    this.disabled = true; this.textContent = '⏳ Analisando...';
    try {
      const r = await DB.analisarAluno(uid);
      if(r.success && r.data) {
        res.style.display = 'block';
        res.textContent = r.data.analise;
      } else {
        res.style.display = 'block';
        res.textContent = '❌ ' + (r.detail || 'Erro ao analisar');
      }
    } catch(e) {
      res.style.display = 'block';
      res.textContent = '❌ Backend offline: ' + e.message;
    }
    this.disabled = false; this.textContent = 'Analisar';
  };
};

