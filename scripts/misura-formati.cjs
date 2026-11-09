// Uso: node misura.cjs <url> [cartella-screenshot]
const { chromium } = require('/home/michelefinocchiaro/barbiere/node_modules/playwright');
const URL = process.argv[2] || 'http://localhost:5173/';
const OUT = process.argv[3] || 'out';
require('fs').mkdirSync(OUT, { recursive: true });
const FORMATI = [
  ['tel-360', 360, 740, true], ['tel-390', 390, 844, true], ['tel-412', 412, 915, true],
  ['tab-v-768', 768, 1024, true], ['tab-v-820', 820, 1180, true],
  ['tab-o-1024', 1024, 768, true], ['tab-o-1180', 1180, 820, true],
  ['pc-1440', 1440, 900, false], ['pc-1920', 1920, 1080, false],
];
// controlli eseguiti nella pagina sulla schermata corrente
function controlla() {
  const vw = innerWidth, vh = innerHeight, prob = [];
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) prob.push(`pagina larga ${de.scrollWidth}px > ${vw}`);
  const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !el.closest('.sr-only'); };
  const nome = el => (el.innerText || el.value || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g,' ').slice(0, 30);
  // interattivi fuori dallo schermo in orizzontale o troppo piccoli
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > vw + 1) prob.push(`fuori schermo: "${nome(el)}" (${Math.round(r.left)}→${Math.round(r.right)})`);
    // elemento clippato da un antenato con overflow hidden
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (/(hidden|clip)/.test(s.overflowX)) { const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1) { prob.push(`tagliato: "${nome(el)}"`); break; } }
      p = p.parentElement;
    }
    const t = el.type;
    if (t !== 'checkbox' && t !== 'radio' && (r.height < 40 || r.width < 40) && el.tagName !== 'A')
      prob.push(`tocco piccolo: "${nome(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  // testo tagliato: elementi foglia con contenuto che sborda
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,label,button,div,li,td,th')) {
    if (!vis(el) || el.children.length > 2) continue;
    const s = getComputedStyle(el);
    if (s.textOverflow === 'ellipsis') continue;
    if (el.scrollWidth > el.clientWidth + 2 && /(hidden|clip)/.test(s.overflowX) && el.innerText.trim())
      prob.push(`testo tagliato: "${nome(el)}"`);
  }
  return [...new Set(prob)];
}
(async () => {
  const b = await chromium.launch();
  let totale = 0; const righe = [];
  for (const [id, w, h, touch] of FORMATI) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 800 && touch, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    const p = await c.newPage(); const errori = [];
    p.on('pageerror', e => errori.push(e.message));
    await p.goto(URL, { waitUntil: 'networkidle' });
    const vai = async (n) => { await p.getByRole('button', { name: new RegExp('^' + n) }).or(p.getByRole('link', { name: new RegExp('^' + n) })).or(p.getByRole('tab', { name: new RegExp('^' + n) })).first().click({ timeout: 3000 }); await p.waitForTimeout(350); };
    const schermate = {};
    const passo = async (nome, fn) => {
      try { await fn(); schermate[nome] = await p.evaluate(controlla); }
      catch (e) { schermate[nome] = ['NON RAGGIUNGIBILE: ' + e.message.split('\n')[0]]; }
      await p.screenshot({ path: `${OUT}/${id}-${nome}.png` });
    };
    await passo('avvio', async () => {});
    await passo('impostazioni', async () => { await vai('Impostazioni'); });
    try { await p.getByRole('button', { name: /dati demo|esempio/i }).first().click({ timeout: 2000 });
          await p.getByRole('button', { name: /^(Sì|Si|Conferma|Carica)/ }).first().click({ timeout: 2000 }); await p.waitForTimeout(500); } catch {}
    await passo('agenda', async () => { await vai('Agenda'); if (!(await p.getByText('Mario Rossi').first().isVisible().catch(() => false))) { await p.getByRole('button', { name: /▶|successivo|avanti/i }).first().click(); await p.waitForTimeout(300); } });
    await passo('pannello', async () => { await p.getByText('Mario Rossi').first().click({ timeout: 3000 }); await p.waitForTimeout(400); });
    try { await p.keyboard.press('Escape'); await p.getByRole('button', { name: /^(Chiudi|Annulla|✕|×)/ }).first().click({ timeout: 1500 }); } catch {}
    await p.waitForTimeout(300);
    await passo('promemoria', async () => { await vai('Promemoria'); });
    await passo('clienti', async () => { await vai('Clienti'); await p.getByText('Mario Rossi').first().click({ timeout: 3000 }).catch(()=>{}); await p.waitForTimeout(300); });
    await passo('da-pagare', async () => { await vai('Da pagare'); });
    await passo('segna-pagare', async () => { await p.getByRole('button', { name: /Segna da pagare/ }).first().click({ timeout: 3000 }); await p.waitForTimeout(400); });
    for (const [s, prob] of Object.entries(schermate)) { totale += prob.length; righe.push(`${id.padEnd(11)} ${s.padEnd(13)} ${prob.length}${prob.length ? '  ' + prob.slice(0, 4).join(' | ') + (prob.length > 4 ? ` (+${prob.length - 4})` : '') : ''}`); }
    if (errori.length) { totale += errori.length; righe.push(`${id} ERRORI PAGINA: ${errori.join(' | ')}`); }
    await c.close();
  }
  await b.close();
  console.log(righe.join('\n'));
  console.log(`PROBLEMI_TOTALI=${totale}`);
})();
