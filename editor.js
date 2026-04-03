/* ═══════════════════════════════════════════════════
   DEVJOB SIMULATION — editor.js  (FIXED v2)
   Free runs changed to 7. All other fixes applied.
═══════════════════════════════════════════════════ */
'use strict';

/* ── App state ── */
window.AppState = {
  lang: 'python',
  quotaUsed: parseInt(localStorage.getItem('djs_quota_used') || '0'),
  maxFreeRuns: 7,   // ← CHANGED from 5 to 7
  collabOn: false,
  ws: null,
};

/* ── Starter templates ── */
const TEMPLATES = {
  python: `# DEVJOB SIMULATION — Python Mode 🐍
# Solve challenges and discover your ideal tech role!

def fibonacci(n):
    """Return Fibonacci sequence up to n terms."""
    if n <= 0: return []
    if n == 1: return [0]
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq

def main():
    n = 10
    result = fibonacci(n)
    print(f"Fibonacci({n}): {result}")
    print(f"Sum: {sum(result)}")
    print(f"Max: {max(result)}")

if __name__ == '__main__':
    main()
`,
  cpp: `// DEVJOB SIMULATION — C++ Mode ⚙️
#include <iostream>
#include <vector>
#include <numeric>
using namespace std;

vector<long long> fibonacci(int n) {
    if (n <= 0) return {};
    if (n == 1) return {0};
    vector<long long> seq = {0, 1};
    while ((int)seq.size() < n)
        seq.push_back(seq[seq.size()-1] + seq[seq.size()-2]);
    return seq;
}

int main() {
    auto result = fibonacci(10);
    cout << "Fibonacci(10): [";
    for (size_t i = 0; i < result.size(); ++i) {
        cout << result[i];
        if (i + 1 < result.size()) cout << ", ";
    }
    cout << "]" << endl;
    cout << "Sum: " << accumulate(result.begin(), result.end(), 0LL) << endl;
    return 0;
}
`,
  javascript: `// DEVJOB SIMULATION — JavaScript Mode ✨
'use strict';

function fibonacci(n) {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const seq = [0, 1];
  while (seq.length < n)
    seq.push(seq.at(-1) + seq.at(-2));
  return seq;
}

const result = fibonacci(10);
console.log(\`Fibonacci(10): [\${result.join(', ')}]\`);
console.log(\`Sum: \${result.reduce((a, b) => a + b, 0)}\`);
console.log(\`Max: \${Math.max(...result)}\`);
`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My DevJob Project</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #080c15; color: #dde3f0;
      display: flex; align-items: center;
      justify-content: center; min-height: 100vh;
    }
    .card {
      background: #1a2236;
      border: 1px solid rgba(59,127,245,0.3);
      border-radius: 14px; padding: 32px;
      max-width: 420px; text-align: center;
    }
    h1 { color: #6ba3ff; font-size: 26px; margin-bottom: 10px; }
    p  { color: #8394b4; line-height: 1.6; margin-bottom: 20px; }
    button {
      background: #3b7ff5; color: #fff; border: none;
      padding: 10px 22px; border-radius: 7px;
      font-size: 14px; cursor: pointer;
    }
    button:hover { background: #1a47a0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 DEVJOB SIM</h1>
    <p>Edit this HTML/CSS/JS and see it render live in the Preview tab!</p>
    <button onclick="alert('Hello from DEVJOB SIM!')">Click Me!</button>
  </div>
</body>
</html>
`,
};

const LANG_META = {
  python:     { label:'Python 3.11',       ext:'py',   dotClass:'python',     file:'main.py',    sbLabel:'🐍 Python 3.11' },
  cpp:        { label:'C++ (GCC 14)',       ext:'cpp',  dotClass:'cpp',        file:'main.cpp',   sbLabel:'⚙️ C++ (GCC 14)' },
  javascript: { label:'JavaScript ES2024', ext:'js',   dotClass:'javascript', file:'main.js',    sbLabel:'✨ JavaScript' },
  html:       { label:'HTML / CSS 5',       ext:'html', dotClass:'html',       file:'index.html', sbLabel:'🌐 HTML / CSS' },
};

const $ed   = () => document.getElementById('codeEditor');
const $lns  = () => document.getElementById('lineNums');
const $out  = () => document.getElementById('outputContent');
const $errs = () => document.getElementById('errList');
const $run  = () => document.getElementById('btnRun');

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const ed = $ed();
  if (!ed) return;
  ed.value = TEMPLATES.python;

  ed.addEventListener('input',   onEditorInput);
  ed.addEventListener('scroll',  syncScrollLineNums);
  ed.addEventListener('keydown', onEditorKeydown);
  ed.addEventListener('click',   updateCursorStatus);
  ed.addEventListener('keyup',   updateCursorStatus);

  updateLineNumbers();
  renderQuotaDots();
  buildStreakCalendar();

  // Reset quota at day boundary
  const today = new Date().toDateString();
  if (localStorage.getItem('djs_quota_date') !== today) {
    localStorage.setItem('djs_quota_date', today);
    localStorage.setItem('djs_quota_used', '0');
    AppState.quotaUsed = 0;
  }

  // Apply user's plan
  const user = (typeof getUser === 'function') ? getUser() : null;
  if (user && user.plan !== 'free') AppState.maxFreeRuns = Infinity;
});

/* ════════════════════════════════════════
   EDITOR EVENTS
════════════════════════════════════════ */
function onEditorInput() {
  updateLineNumbers();
  updateTotalLines();
  debounceLiveCheck();
  if (AppState.lang === 'html') schedulePreview();
  if (AppState.collabOn && AppState.ws) broadcastCode($ed().value);
}

function onEditorKeydown(e) {
  const ed = $ed();

  if (e.key === 'Tab') {
    e.preventDefault();
    const s = ed.selectionStart, end = ed.selectionEnd;
    if (s === end) { insertText('  '); }
    else {
      const before = ed.value.substring(0,s), sel = ed.value.substring(s,end), after = ed.value.substring(end);
      const indented = sel.replace(/^/gm,'  ');
      ed.value = before + indented + after;
      ed.selectionStart = s; ed.selectionEnd = s + indented.length;
    }
    onEditorInput(); return;
  }

  const pairs = {'(':')',  '[':']', '{':'}', '"':'"', "'":"'"};
  if (pairs[e.key]) {
    e.preventDefault();
    const pos = ed.selectionStart;
    insertText(e.key + pairs[e.key]);
    ed.selectionStart = ed.selectionEnd = pos + 1;
    return;
  }

  if (e.key === 'Enter') {
    const pos = ed.selectionStart;
    const lineStart = ed.value.lastIndexOf('\n', pos-1) + 1;
    const line = ed.value.substring(lineStart, pos);
    const m = line.match(/^(\s*)/);
    const indent = m ? m[1] : '';
    const extra = (line.trimEnd().endsWith(':') || line.trimEnd().endsWith('{')) ? '  ' : '';
    e.preventDefault();
    insertText('\n' + indent + extra);
    onEditorInput(); return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    toggleComment();
  }
}

function insertText(text) {
  const ed = $ed();
  const s = ed.selectionStart, end = ed.selectionEnd;
  ed.value = ed.value.substring(0,s) + text + ed.value.substring(end);
  ed.selectionStart = ed.selectionEnd = s + text.length;
}

function toggleComment() {
  const ed = $ed();
  const commentChar = { python:'# ', cpp:'// ', javascript:'// ', html:'<!-- ' };
  const pfx = commentChar[AppState.lang] || '// ';
  const pos = ed.selectionStart;
  const lineStart = ed.value.lastIndexOf('\n', pos-1) + 1;
  const lineEnd = ed.value.indexOf('\n', pos);
  const line = ed.value.substring(lineStart, lineEnd<0 ? undefined : lineEnd);
  const newLine = line.trimStart().startsWith(pfx.trim())
    ? line.replace(pfx.trim()+' ','').replace(pfx.trim(),'')
    : pfx + line;
  ed.value = ed.value.substring(0,lineStart) + newLine + (lineEnd<0?'':ed.value.substring(lineEnd));
  onEditorInput();
}

function syncScrollLineNums() {
  const ln = $lns(); if (ln) ln.scrollTop = $ed().scrollTop;
}

function updateCursorStatus() {
  const ed = $ed();
  const pos = ed.selectionStart;
  const before = ed.value.substring(0,pos);
  const lines = before.split('\n');
  const ln = lines.length, col = lines[lines.length-1].length+1;
  const el = document.getElementById('sbCursor');
  if (el) el.textContent = `Ln ${ln}, Col ${col}`;
}

/* ════════════════════════════════════════
   LINE NUMBERS
════════════════════════════════════════ */
function updateLineNumbers() {
  const ed = $ed(); const ln = $lns();
  if (!ed || !ln) return;
  const lines = ed.value.split('\n');
  const pos = ed.selectionStart;
  const cur = ed.value.substring(0,pos).split('\n').length;
  ln.innerHTML = lines.map((_,i) =>
    `<span class="lnum${i+1===cur?' cur':''}">${i+1}</span>`
  ).join('');
}

function updateTotalLines() {
  const el = document.getElementById('sbLines');
  if (el) el.textContent = ($ed().value.split('\n').length) + ' lines';
}

/* ════════════════════════════════════════
   LANGUAGE SWITCH
════════════════════════════════════════ */
function changeLang(lang) {
  AppState.lang = lang;
  $ed().value = TEMPLATES[lang];
  updateLineNumbers(); updateTotalLines();

  const m = LANG_META[lang];
  const tabName = document.querySelector('.filetab.active .filetab-name');
  const tabDot  = document.querySelector('.filetab.active .filetab-dot');
  if (tabName) tabName.textContent = m.file;
  if (tabDot)  tabDot.className = `filetab-dot ${m.dotClass}`;

  const sbLang = document.getElementById('sbLang');
  if (sbLang) sbLang.textContent = m.sbLabel;

  const previewTab = document.getElementById('tabPreview');
  if (previewTab) {
    if (lang === 'html') { previewTab.classList.remove('hidden'); refreshPreview(); }
    else previewTab.classList.add('hidden');
  }

  clearErrors();
  showToast(`Switched to ${m.label}`, 'info');
}

/* ════════════════════════════════════════
   RUN CODE
════════════════════════════════════════ */
async function runCode() {
  const user = (typeof getUser === 'function') ? getUser() : null;
  const plan = user?.plan || 'free';

  // Quota check — 7 free runs
  if (plan === 'free' && AppState.quotaUsed >= AppState.maxFreeRuns) {
    showToast(`Daily limit reached (${AppState.maxFreeRuns} runs). Upgrade for unlimited!`, 'error');
    openModal('modalPlans');
    return;
  }

  const btn = $run();
  btn.classList.add('running');
  btn.innerHTML = '<span class="spinner"></span> Running…';

  const firstTab = document.querySelector('.otab');
  setOutTab(firstTab, 'out-output');
  setOutputHTML('<span class="out-line out-info">▶ Running your code…</span>');

  AppState.quotaUsed++;
  localStorage.setItem('djs_quota_used', AppState.quotaUsed);
  renderQuotaDots();

  const code = $ed().value;

  if (AppState.lang === 'html') {
    refreshPreview();
    document.getElementById('tabPreview')?.classList.remove('hidden');
    const preTab = document.getElementById('tabPreview');
    if (preTab) setOutTab(preTab, 'out-preview');
    endRun(btn); return;
  }

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch((window.BACKEND || 'http://localhost:3000') + '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
      body: JSON.stringify({ code, language: AppState.lang }),
    });
    const data = await res.json();
    renderOutput(data);
    if (data.stderr) renderErrors(data.stderr);
    else { clearErrors(); awardXP(10); }
  } catch {
    simulateRun(code, AppState.lang);
  }

  endRun(btn);
}

function endRun(btn) {
  btn.classList.remove('running');
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span data-i18n="run">Run Code</span>';
}

function renderOutput(data) {
  let html = '';
  if (data.stdout) html += data.stdout.split('\n').map(l=>`<span class="out-line out-std">${escHtml(l)}</span>`).join('');
  if (data.stderr) html += data.stderr.split('\n').filter(Boolean).map(l=>`<span class="out-line out-err">${escHtml(l)}</span>`).join('');
  if (!data.stdout && !data.stderr) html = '<span class="out-line out-ok">✅ Program exited cleanly (no output).</span>';
  if (data.time) html += `<span class="out-line out-time">⏱ ${data.time}ms</span>`;
  setOutputHTML(html);
}

function simulateRun(code, lang) {
  let out = '<span class="out-line out-info">▶ [Demo mode — connect backend for real execution]</span>';
  const ms = Math.round(Math.random()*160+70);

  if (lang === 'python') {
    const fib = [0,1,1,2,3,5,8,13,21,34];
    out += `\n<span class="out-line out-std">Fibonacci(10): ${JSON.stringify(fib)}</span>`;
    out += `\n<span class="out-line out-std">Sum: 88</span>`;
    out += `\n<span class="out-line out-std">Max: 34</span>`;
    clearErrors();
  } else if (lang === 'javascript') {
    out += `\n<span class="out-line out-std">Fibonacci(10): [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]</span>`;
    out += `\n<span class="out-line out-std">Sum: 88</span>`;
    out += `\n<span class="out-line out-std">Max: 34</span>`;
    clearErrors();
  } else if (lang === 'cpp') {
    out += `\n<span class="out-line out-std">Fibonacci(10): [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]</span>`;
    out += `\n<span class="out-line out-std">Sum: 88</span>`;
    clearErrors();
  }

  out += `\n<span class="out-line out-ok">✅ Exit code: 0</span>`;
  out += `\n<span class="out-line out-time">⏱ ${ms}ms (simulated)</span>`;
  setOutputHTML(out);
}

function setOutputHTML(html) { const el=$out(); if(el) el.innerHTML=html; }
function clearOutput() {
  setOutputHTML('<div class="out-placeholder"><div class="ph-icon">▶</div><span>Output cleared</span></div>');
}

/* ════════════════════════════════════════
   ERRORS
════════════════════════════════════════ */
const ERROR_WHY = {
  'SyntaxError':       'Python found code that violates its grammar. Check colons, brackets and indentation.',
  'IndentationError':  'Python uses whitespace for blocks. Every body inside a def/if/for must be consistently indented.',
  'NameError':         "You're using a name that isn't defined. Check spelling and that it was declared before use.",
  'TypeError':         "Operation on wrong data type — e.g., adding a string to an integer.",
  'ValueError':        "Right type, wrong value — e.g., int('hello') fails because 'hello' can't be a number.",
  'AttributeError':    "Method doesn't exist on that object. Check the type and method name.",
  'ZeroDivisionError': 'Division by zero is mathematically undefined. Add a check before dividing.',
  'IndexError':        'Accessed a list index that doesn\'t exist. Python lists start at 0.',
  'error:':            'A C++ compilation or linker error. Check the indicated line number.',
  'ReferenceError':    "JavaScript can't find this variable — it may be out of scope or declared after use.",
};

function renderErrors(stderr) {
  const el = $errs(); if (!el) return;
  const lines = stderr.split('\n').filter(Boolean);
  let html = '', count = 0;
  lines.forEach(line => {
    if (line.includes('Traceback') || line.trim().startsWith('File ')) return;
    let why = 'Read the error carefully and check the indicated line number.';
    let type = 'Error';
    for (const [k,w] of Object.entries(ERROR_WHY)) {
      if (line.includes(k)) { type=k; why=w; break; }
    }
    if (line.includes('Error') || line.includes('error')) {
      count++;
      html += `<div class="err-item">
        <div class="err-type">${escHtml(type)}</div>
        <div class="err-msg">${escHtml(line)}</div>
        <div class="err-why"><strong>Why did this happen?</strong> ${why}</div>
      </div>`;
    }
  });
  el.innerHTML = html || '<div class="no-err">✅ No errors detected</div>';
  const badge = document.getElementById('errBadge');
  if (badge) badge.textContent = count > 0 ? count : '0';
}

function clearErrors() {
  const el = $errs(); if(el) el.innerHTML='<div class="no-err">✅ No errors detected</div>';
  const badge = document.getElementById('errBadge');
  if (badge) badge.textContent = '0';
}

let liveCheckTimer = null;
function debounceLiveCheck() {
  clearTimeout(liveCheckTimer);
  liveCheckTimer = setTimeout(() => {
    if (AppState.lang === 'python') checkPython($ed().value);
    else if (AppState.lang === 'javascript') checkJS($ed().value);
  }, 700);
}

function checkPython(code) {
  let count = 0; const issues = [];
  code.split('\n').forEach((line,i) => {
    const t = line.trim();
    if (/^(def |class |if |elif |for |while |with |try:|except|else|finally)/.test(t) &&
        !t.endsWith(':') && !t.endsWith('\\') && t.length > 2 && !t.startsWith('#')) {
      issues.push({ln:i+1,msg:`Missing colon at end of: "${t.substring(0,28)}..."`,type:'SyntaxError'});
      count++;
    }
  });
  if (issues.length) {
    const el = $errs();
    if (el) el.innerHTML = issues.map(e=>`<div class="err-item"><div class="err-type">${e.type}</div><div class="err-msg">Line ${e.ln}: ${escHtml(e.msg)}</div><div class="err-why"><strong>Why?</strong> ${ERROR_WHY[e.type]||''}</div></div>`).join('');
  }
  const badge = document.getElementById('errBadge');
  if (badge) badge.textContent = count;
  return count;
}

function checkJS(code) {
  let b=0,p=0;
  for(const c of code){if(c==='{')b++;if(c==='}')b--;if(c==='(')p++;if(c===')')p--;}
  let count=0, html='';
  if(b!==0){count++;html+=`<div class="err-item"><div class="err-type">SyntaxError</div><div class="err-msg">Unbalanced { } braces (net: ${b})</div><div class="err-why"><strong>Why?</strong> Every { needs a matching }.</div></div>`;}
  if(p!==0){count++;html+=`<div class="err-item"><div class="err-type">SyntaxError</div><div class="err-msg">Unbalanced ( ) parentheses (net: ${p})</div><div class="err-why"><strong>Why?</strong> Every ( needs a matching ).</div></div>`;}
  const el=$errs();
  if(el) el.innerHTML = count>0 ? html : '<div class="no-err">✅ No errors detected</div>';
  const badge=document.getElementById('errBadge');
  if(badge) badge.textContent=count;
  return count;
}

/* ════════════════════════════════════════
   QUOTA DOTS — now shows 7 slots
════════════════════════════════════════ */
function renderQuotaDots() {
  const el = document.getElementById('quotaDots'); if (!el) return;
  const user = (typeof getUser === 'function') ? getUser() : null;
  const max  = (user && user.plan !== 'free') ? 7 : 7; // always show 7 dots
  const used = Math.min(AppState.quotaUsed, max);

  el.innerHTML = Array.from({length:max},(_,i)=>
    `<div class="quota-dot${i<used?' used':''}"></div>`
  ).join('');

  const txt = document.getElementById('quotaUsedTxt');
  if (txt) {
    if (user && user.plan !== 'free') {
      txt.textContent = '∞';
      el.innerHTML = Array.from({length:7},()=>`<div class="quota-dot used"></div>`).join('');
    } else {
      txt.textContent = used;
    }
  }

  const sub = document.querySelector('.quota-sub');
  if (sub) {
    if (user && user.plan !== 'free') sub.textContent = 'Unlimited runs';
    else sub.textContent = `${used}/7 runs used today`;
  }
}

/* ════════════════════════════════════════
   STREAK, XP, ACTIONS, COLLAB, TABS, etc.
════════════════════════════════════════ */
function buildStreakCalendar() {
  const el = document.getElementById('streakDays'); if (!el) return;
  const days=['M','T','W','T','F','S','S'], done=[1,1,1,1,1,1,1];
  el.innerHTML = days.map((d,i)=>`<div class="sday${done[i]?(i===6?' today':' done'):''}"><span>${d}</span></div>`).join('');
}

function awardXP(n) {
  const el = document.getElementById('xpVal'); if (!el) return;
  const cur = parseInt(el.textContent.replace(/,/g,''))||0;
  el.textContent = (cur+n).toLocaleString();
  showToast(`+${n} XP!`, 'success');
}

function clearEditor() {
  if (!confirm('Clear all code in the editor?')) return;
  $ed().value=''; updateLineNumbers(); clearErrors();
  showToast('Editor cleared','info');
}

function downloadCode() {
  const user = (typeof getUser === 'function') ? getUser() : null;
  if (!user || user.plan === 'free') {
    showToast('Download requires Basic or Pro plan','error');
    openModal('modalPlans'); return;
  }
  const blob = new Blob([$ed().value],{type:'text/plain'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`devjob_code.${LANG_META[AppState.lang].ext}`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('Downloaded!','success');
}

let previewTimer=null;
function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(refreshPreview,900);}
function refreshPreview(){const f=document.getElementById('htmlFrame');if(f)f.srcdoc=$ed().value;}

function toggleCollab() {
  const user=(typeof getUser==='function')?getUser():null;
  if (!user||user.plan!=='pro'){showToast('Collab requires Pro plan','error');openModal('modalPlans');return;}
  AppState.collabOn=!AppState.collabOn;
  const dot=document.getElementById('collabDot');
  const sb=document.getElementById('sbCollab');
  if(AppState.collabOn){dot.textContent='ON';dot.classList.add('on');if(sb)sb.textContent='● Collab ON';}
  else{dot.textContent='OFF';dot.classList.remove('on');if(sb)sb.textContent='● Collab OFF';if(AppState.ws){AppState.ws.close();AppState.ws=null;}}
  showToast(AppState.collabOn?'Collab ON':'Collab OFF','info');
}

function predictRole() {
  const code=$ed().value;
  const scores={'Backend Engineer':0,'Frontend Developer':0,'Data Analyst':0,'DevOps Engineer':0};
  if(/def |class |lambda/.test(code)) scores['Backend Engineer']+=20;
  if(/for |while /.test(code)) scores['Data Analyst']+=10;
  if(/pandas|numpy|csv|dataframe/i.test(code)) scores['Data Analyst']+=30;
  if(/html|css|dom|fetch|react/i.test(code)) scores['Frontend Developer']+=30;
  if(/docker|kubectl|nginx|bash|deploy/i.test(code)) scores['DevOps Engineer']+=30;
  if(/api|flask|express|django|fastapi/i.test(code)) scores['Backend Engineer']+=20;
  if(/<[a-z]+/i.test(code)) scores['Frontend Developer']+=20;
  if(/reduce|filter|map|sort/.test(code)) scores['Data Analyst']+=10;
  if(/try|catch|except|throw/.test(code)) scores['Backend Engineer']+=10;
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  const total=Object.values(scores).reduce((a,b)=>a+b,0)||1;
  const conf=Math.min(Math.round((best[1]/total)*100)+35,95);
  const nameEl=document.getElementById('roleName');
  const barEl=document.getElementById('roleConfBar');
  const txtEl=document.getElementById('roleConfTxt');
  if(nameEl)nameEl.textContent=best[0];
  if(barEl)barEl.style.width=conf+'%';
  if(txtEl)txtEl.textContent=conf+'%';
  showToast(`Predicted: ${best[0]} (${conf}%)`,'success');
}

let tabCounter=1;
function addTab(){
  tabCounter++;
  const m=LANG_META[AppState.lang];
  const tabs=document.getElementById('filetabs');
  const t=document.createElement('div');
  t.className='filetab'; t.setAttribute('data-id',tabCounter);
  t.innerHTML=`<span class="filetab-dot ${m.dotClass}"></span><span class="filetab-name">untitled.${m.ext}</span><button class="filetab-close" onclick="closeTab(this)">×</button>`;
  t.onclick=(e)=>{if(e.target.classList.contains('filetab-close'))return;switchTab(t);};
  tabs.insertBefore(t,tabs.lastElementChild);
  switchTab(t); $ed().value='// New file\n'; updateLineNumbers();
}
function switchTab(el){document.querySelectorAll('.filetab').forEach(t=>t.classList.remove('active'));el.classList.add('active');}
function closeTab(btn){const t=btn.closest('.filetab');const wa=t.classList.contains('active');t.remove();if(wa){const r=document.querySelector('.filetab');if(r)r.classList.add('active');}}

function setOutTab(btn,panelId){
  document.querySelectorAll('.otab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.out-body').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const el=document.getElementById(panelId);if(el)el.classList.add('active');
}

function setPanel(btn,panelId){
  document.querySelectorAll('.sicon').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidepanel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  const el=document.getElementById('panel-'+panelId);if(el)el.classList.add('active');
}

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
