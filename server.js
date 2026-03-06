const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 59900;
const distDir = path.join(__dirname, 'dist');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

app.get('/api/chart', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '');
    const range = String(req.query.range || '5y');
    if (!symbol) {
      res.status(400).json({ error: 'symbol is required' });
      return;
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${encodeURIComponent(range)}&interval=1d&events=div`;
    const r = await fetch(url);
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: 'proxy_failed' });
  }
});

app.use(express.static(distDir, { etag: false, maxAge: 0 }));
app.get('*', (_req, res) => {
  try {
    const htmlPath = path.join(distDir, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const inject = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Cairo:wght@400;700;800;900&family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet" />
    <div id="boot-overlay"><div class="box"><div>جاري تحميل HalalVest...</div><div id="boot-err" class="err" style="display:none"></div></div></div>
    <script>(function(){function ins(){var s=document.createElement('style');s.textContent='html,body{font-family:\"DIN Next Arabic\",\"IBM Plex Sans Arabic\",\"Cairo\",\"Tajawal\",system-ui,-apple-system,Segoe UI,Arial,sans-serif !important}#root *{font-family:\"DIN Next Arabic\",\"IBM Plex Sans Arabic\",\"Cairo\",\"Tajawal\",system-ui,-apple-system,Segoe UI,Arial,sans-serif !important}#boot-overlay{position:fixed;inset:0;background:#0b1020;color:#e5e7eb;display:flex;align-items:center;justify-content:center;z-index:9999}#boot-overlay .box{padding:16px;border:1px solid #334155;border-radius:8px;background:#0f172a}#boot-overlay .err{color:#fecaca;margin-top:8px;white-space:pre-wrap;direction:ltr;text-align:left}';document.head.appendChild(s);}function showError(m){var el=document.getElementById('boot-err');if(!el)return;el.style.display='block';el.textContent=String(m||'Unknown error');}function removeAlerts(){try{var txt='تنبيهات أسعار';var all=document.querySelectorAll('#root *');for(var i=0;i<all.length;i++){var el=all[i];if(el && el.textContent && el.textContent.trim().indexOf(txt)>-1){var p=el;for(var j=0;j<3 && p;j++){if(p.tagName==='BUTTON'||p.getAttribute('role')==='button'){p.style.display='none';break;}p=p.parentElement;}if(p){p.style.display='none';}}}}catch(e){}}ins();var mo=new MutationObserver(function(){removeAlerts()});document.addEventListener('DOMContentLoaded',function(){removeAlerts();var r=document.getElementById('root');if(r)mo.observe(r,{subtree:true,childList:true});});window.addEventListener('error',function(e){showError(e&&(e.message||e.error));});window.addEventListener('unhandledrejection',function(e){showError(e&&(e.reason&&e.reason.message)||e);});window.addEventListener('app-mounted',function(){var ov=document.getElementById('boot-overlay');if(ov)ov.style.display='none';removeAlerts();});})();</script>`;
    html = html.replace('</body>', inject + '\n</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch (e) {
    res.sendFile(path.join(distDir, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`HalalVest running at http://localhost:${PORT}`);
});
