// Finance Dashboard - Insights Module
// Detección de cargos recurrentes/suscripciones e insights mensuales.
// Carga: después de filters.js, antes de charts.js.

// ---------- KPI de rentabilidad de inversiones (consumido por renderKPIs en charts.js) ----------

// Devuelve el bloque inversiones.kpi de finance_data.json, ya calculado por
// sync_finance_data.py (build_kpi_inversiones): % último mes, % 12m (TWR
// compuesto) y descomposición aportado/generado, total y por plataforma.
// Reemplaza el antiguo KPI "Ahorro real 12m" (ver DECISIONS.md 2026-07-06):
// ese KPI mezclaba balance líquido con rendimiento de inversiones en una
// sola cifra en euros; este separa rentabilidad porcentual real de cuánto
// del crecimiento de capital es aporte propio vs interés/ganancia generada.
function getKpiInversiones(){
  return window.FINANCE_STATE?.inversiones?.kpi || null;
}

// ---------- Detección de cargos recurrentes ----------

// Alias de suscripciones conocidas (concepto + importe exacto → nombre legible).
// Verificar periódicamente: los precios pueden cambiar con las renovaciones.
const SUB_ALIASES = [
  { kw: 'APPLE.COM/BILL', amt: 2.99,  name: 'iCloud+' },
  { kw: 'APPLE.COM/BILL', amt: 3.49,  name: 'Hevy Pro' },
  { kw: 'APPLE.COM/BILL', amt: 22.00, name: 'Claude Pro' },
  { kw: 'APPLE.COM/BILL', amt: 29.99, name: 'LinkedIn Premium Career' },
  { kw: 'AMAZON.ES',      amt: 9.99,  name: 'Kindle Unlimited' },
  { kw: 'PAYPAL EUROPE',  amt: 10.00, name: 'Microsoft 365 Personal' },
  { kw: 'AMAZON PRIME',   amt: null,  name: 'Amazon Prime' },
  { kw: 'AD FREE FOR PRIME', amt: null, name: 'Prime Video sin anuncios' }
];

// Comercios que son suscripción aunque su categoría no sea "Suscripciones"
const SUB_KEYWORDS = [
  'AMAZON PRIME', 'APPLE.COM/BILL', 'WELLHUB', 'GYMPASS', 'VIVAGYM',
  'SKYSHOWTI', 'NETFLIX', 'SPOTIFY', 'HBO', 'DISNEY', 'YOIGO', 'DIGI SPAIN',
  'SANITAS', 'AD FREE FOR PRIME', 'KINDLE', 'LINKEDIN'
];
// Casos con condición de importe (mismo comercio puede ser compra puntual)
const SUB_KEYWORDS_AMT = [
  { kw: 'AMAZON.ES', amt: 9.99 },
  { kw: 'PAYPAL EUROPE', amt: 10.00 }
];

// Suscripciones canceladas: importe = último cargo mensual real antes de la
// cancelación (verificado en finance_data.json, no un valor de lista de precios).
// Actualizar esta lista cuando se confirme una nueva cancelación.
const CANCELLED_SUBS = [
  { name: 'Microsoft 365 Personal', monto: 10.00, cancelada: '2026-07' },
  { name: 'Kindle Unlimited',       monto: 9.99,  cancelada: '2026-07' },
  { name: 'Wellhub',                monto: 22.99, cancelada: '2026-06' }
];

const RECURRING_EXCLUDED_CATS = ['Guille', 'Talho Argentino', 'Nomina', 'Inversion'];
const RECURRING_MIN_CHARGES = 3;
const RECURRING_GAP_MIN = 25;   // días — cadencia mensual
const RECURRING_GAP_MAX = 35;
const RECURRING_ACTIVE_DAYS = 45; // sin cobro en más de 45 días → inactiva
const RECURRING_HIDE_DAYS = 180;  // sin cobro en más de 180 días (6 meses) → dejar de mostrar

function _median(arr){
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function _daysBetween(a, b){
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

// Devuelve grupos recurrentes: mismo concepto + mismo importe, >=3 cobros,
// mediana de intervalo entre 25 y 35 días (cadencia mensual).
function detectRecurring(){
  const raw = window.FINANCE_STATE?.raw || [];
  const lastTx = window.FINANCE_STATE?.lastTxDate;
  if(!raw.length || !lastTx) return [];

  const groups = {};
  raw.forEach(r => {
    const v = Number(r.monto);
    if(v >= 0) return;
    if(RECURRING_EXCLUDED_CATS.includes(r.categoria)) return;
    const concepto = (r.concepto || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const amt = Math.abs(v).toFixed(2);
    const key = concepto + '|' + amt;
    if(!groups[key]) groups[key] = { concepto, amt: Number(amt), items: [] };
    groups[key].items.push(r);
  });

  const result = [];
  Object.values(groups).forEach(g => {
    if(g.items.length < RECURRING_MIN_CHARGES) return;
    const fechas = g.items.map(i => i.fecha).sort();
    const gaps = [];
    for(let i = 1; i < fechas.length; i++) gaps.push(_daysBetween(fechas[i - 1], fechas[i]));
    const med = _median(gaps);
    if(med < RECURRING_GAP_MIN || med > RECURRING_GAP_MAX) return;

    // Categoría modal del grupo
    const catCount = {};
    g.items.forEach(i => { catCount[i.categoria] = (catCount[i.categoria] || 0) + 1; });
    const modalCat = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0];

    const ultimo = fechas[fechas.length - 1];
    const diasSinCobro = _daysBetween(ultimo, lastTx);
    const activa = diasSinCobro <= RECURRING_ACTIVE_DAYS;

    // Clasificación suscripción vs otro cargo recurrente
    const esSub =
      modalCat === 'Suscripciones' ||
      SUB_KEYWORDS.some(k => g.concepto.includes(k)) ||
      SUB_KEYWORDS_AMT.some(k => g.concepto.includes(k.kw) && Math.abs(g.amt - k.amt) < 0.005);

    // Nombre legible: alias conocido > nota más reciente > concepto
    let alias = null;
    for(const a of SUB_ALIASES){
      if(g.concepto.includes(a.kw) && (a.amt === null || Math.abs(g.amt - a.amt) < 0.005)){
        alias = a.name; break;
      }
    }
    if(!alias){
      const conNota = g.items.filter(i => i.nota).sort((a, b) => b.fecha.localeCompare(a.fecha));
      if(conNota.length && esSub) alias = conNota[0].nota;
    }

    result.push({
      concepto: g.concepto, alias, monto: g.amt, categoria: modalCat,
      cobros: g.items.length, ultimo, activa, diasSinCobro, esSuscripcion: esSub
    });
  });

  // Activas primero, luego por importe descendente
  return result.sort((a, b) => (a.activa === b.activa) ? b.monto - a.monto : (a.activa ? -1 : 1));
}

function renderSuscripciones(){
  const el = document.getElementById('subs-card');
  if(!el) return;
  const recs = detectRecurring();
  if(!recs.length){ el.style.display = 'none'; return; }
  el.style.display = '';

  const subs        = recs.filter(r => r.esSuscripcion && r.diasSinCobro <= RECURRING_HIDE_DAYS);
  const otros       = recs.filter(r => !r.esSuscripcion && r.diasSinCobro <= RECURRING_HIDE_DAYS);
  const subsAct     = subs.filter(r => r.activa);
  const subsInact   = subs.filter(r => !r.activa);
  const totalSubsAct  = subsAct.reduce((s, r) => s + r.monto, 0);
  const totalOtrosAct = otros.filter(r => r.activa).reduce((s, r) => s + r.monto, 0);
  const totalAnualSubs   = totalSubsAct * 12;
  const ahorroAnualCanceladas = CANCELLED_SUBS.reduce((s, c) => s + c.monto, 0) * 12;

  const row = r => `<tr style="${r.activa ? '' : 'opacity:0.55'}">
    <td>${r.alias ? `<strong>${r.alias}</strong><div style="font-size:11px;color:var(--text-secondary)">${r.concepto}</div>` : r.concepto}</td>
    <td><span class="cat-badge">${r.categoria}</span></td>
    <td style="text-align:right;font-family:'DM Mono';font-size:13px">${formatEUR(-r.monto)}</td>
    <td style="font-family:'DM Mono';font-size:12px">${r.ultimo}</td>
    <td>${r.activa
      ? '<span style="color:var(--green);font-size:12px;font-weight:600">Activa</span>'
      : '<span style="color:var(--text-secondary);font-size:12px">Sin cobros</span>'}</td>
  </tr>`;

  const tableHead = `<thead><tr>
    <th style="text-align:left">Concepto</th><th style="text-align:left">Categoría</th>
    <th style="text-align:right">Importe</th><th style="text-align:left">Último cobro</th>
    <th style="text-align:left">Estado</th></tr></thead>`;

  el.innerHTML = `
    <div class="card-title">Suscripciones · detección automática por recurrencia mensual</div>
    <div style="font-size:13px;margin-bottom:12px">
      <strong>${subs.filter(r => r.activa).length} activas</strong> ·
      <span style="font-family:'DM Mono';color:var(--red)">${formatEUR(-totalSubsAct)}/mes</span>
      <span style="color:var(--text-secondary);font-size:12px"> (${formatEUR(-totalAnualSubs)}/año proyectado)</span>
      <span style="color:var(--text-secondary);font-size:12px"> · "Sin cobros" = más de ${RECURRING_ACTIVE_DAYS} días sin cargo (cancelación verificada)</span>
    </div>
    <div style="font-size:13px;margin-bottom:12px;color:var(--green)">
      Ahorro anual conseguido por cancelaciones (Microsoft 365, Kindle Unlimited, Wellhub):
      <span style="font-family:'DM Mono';font-weight:600">${formatEUR(ahorroAnualCanceladas)}/año</span>
    </div>
    <div style="overflow-x:auto"><table>${tableHead}<tbody>${subsAct.map(row).join('')}</tbody></table></div>
    ${subsInact.length ? `
    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:13px;color:var(--text-secondary)">
        Inactivas: ${subsInact.length}
      </summary>
      <div style="overflow-x:auto;margin-top:10px"><table>${tableHead}<tbody>${subsInact.map(row).join('')}</tbody></table></div>
    </details>` : ''}
    ${otros.length ? `
    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:13px;color:var(--text-secondary)">
        Otros cargos recurrentes (financiación, recibos, cuotas): ${otros.filter(r => r.activa).length} activos ·
        <span style="font-family:'DM Mono'">${formatEUR(-totalOtrosAct)}/mes</span>
      </summary>
      <div style="overflow-x:auto;margin-top:10px"><table>${tableHead}<tbody>${otros.map(row).join('')}</tbody></table></div>
    </details>` : ''}
  `;
}

// ---------- Alerta de nómina faltante ----------

// La nómina se cobra el último día hábil del mes. Se comprueba el mes
// calendario anterior al actual (ya cerrado), con un margen de gracia en
// días para no alertar en falso mientras la carga/sincronización del mes
// recién cerrado todavía está en curso. Ver docs/ROADMAP.md (propuesta
// 17/07/2026) y docs/DECISIONS.md.
const NOMINA_GRACIA_DIAS = 5;

// Devuelve el mes (YYYY-MM) sin nómina registrada, o null si no aplica
// alertar todavía (dentro del margen de gracia) o si el mes esperado ya
// tiene registro en window.FINANCE_STATE.nominas (poblado por build_nominas()
// en sync_finance_data.py, que ya combina DB Notion "Nominas" y el fallback
// de Movimientos categoría "Nomina").
function checkNominaFaltante(){
  const nominas = window.FINANCE_STATE?.nominas || [];
  if(!nominas.length) return null; // sin datos de nóminas cargados aún, no alertar en falso

  const hoy = new Date();
  if(hoy.getDate() <= NOMINA_GRACIA_DIAS) return null; // aún dentro del margen del mes en curso

  const mesEsperadoDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesEsperado = `${mesEsperadoDate.getFullYear()}-${String(mesEsperadoDate.getMonth() + 1).padStart(2, '0')}`;

  const existe = nominas.some(n => n.mes === mesEsperado);
  return existe ? null : mesEsperado;
}

// ---------- Insights mensuales ----------

// Gasto neto por categoría y mes, con la misma lógica de reembolsables que charts.js:
// en categorías reembolsables los ingresos restan del gasto (mínimo 0).
function _netExpenseByCatMonth(monthKeyStr){
  const raw = window.FINANCE_STATE?.raw || [];
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];
  const out = {};
  raw.forEach(r => {
    if(r.fecha.slice(0, 7) !== monthKeyStr) return;
    if(excluded.includes(r.categoria)) return;
    const v = Number(r.monto);
    if(!out[r.categoria]) out[r.categoria] = { gasto: 0, reembolso: 0 };
    if(v < 0) out[r.categoria].gasto += -v;
    else if(reimbursable.includes(r.categoria)) out[r.categoria].reembolso += v;
  });
  const net = {};
  Object.keys(out).forEach(c => { net[c] = Math.max(0, out[c].gasto - out[c].reembolso); });
  return net;
}

function _prevMonthKey(key, back){
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeInsights(){
  const lastTx = window.FINANCE_STATE?.lastTxDate;
  if(!lastTx) return null;

  // Mes de referencia: el último mes COMPLETO. Si el mes de la última transacción
  // es el mes en curso (parcial), se compara el anterior contra su previo.
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  let mesRef = lastTx.slice(0, 7);
  if(mesRef === currentKey) mesRef = _prevMonthKey(mesRef, 1);
  const mesPrev = _prevMonthKey(mesRef, 1);

  const catRef  = _netExpenseByCatMonth(mesRef);
  const catPrev = _netExpenseByCatMonth(mesPrev);
  const totalRef  = Object.values(catRef).reduce((s, v) => s + v, 0);
  const totalPrev = Object.values(catPrev).reduce((s, v) => s + v, 0);
  if(totalRef === 0 && totalPrev === 0) return null;

  // Variaciones por categoría (delta absoluto)
  const cats = [...new Set([...Object.keys(catRef), ...Object.keys(catPrev)])];
  const deltas = cats.map(c => ({
    cat: c, ref: catRef[c] || 0, prev: catPrev[c] || 0,
    delta: (catRef[c] || 0) - (catPrev[c] || 0)
  })).filter(d => Math.abs(d.delta) >= 50)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Alertas: gasto del mes de referencia fuera de rango histórico
  // (> media + 2 desviaciones de los 6 meses previos, con >=4 meses de datos y gasto >100€)
  const alertas = [];
  cats.forEach(c => {
    const hist = [];
    for(let i = 1; i <= 6; i++){
      const k = _prevMonthKey(mesRef, i);
      const v = _netExpenseByCatMonth(k)[c];
      if(v !== undefined) hist.push(v);
    }
    if(hist.length < 4) return;
    const mean = hist.reduce((s, v) => s + v, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / hist.length);
    const ref = catRef[c] || 0;
    if(ref > 100 && ref > mean + 2 * sd && ref > mean * 1.2){
      alertas.push({ cat: c, ref, mean });
    }
  });

  return { mesRef, mesPrev, totalRef, totalPrev, deltas: deltas.slice(0, 3), alertas };
}

function renderInsights(){
  const el = document.getElementById('insights-card');
  if(!el) return;
  const ins = computeInsights();
  const mesNominaFaltante = checkNominaFaltante();
  if(!ins && !mesNominaFaltante){ el.style.display = 'none'; return; }
  el.style.display = '';

  const nominaLine = mesNominaFaltante ? `
    <div style="margin-bottom:12px;padding:8px 10px;background:rgba(201,74,48,0.08);border-radius:8px;font-size:13px">
      <span style="color:var(--red);font-weight:600">Nómina sin cargar:</span>
      no hay registro de nómina de ${mesNominaFaltante} (se cobra el último día hábil del mes).
      Verificar si falta subir el PDF a Drive.
    </div>` : '';

  if(!ins){
    el.innerHTML = `<div class="card-title">Insights</div>${nominaLine}`;
    return;
  }

  const diff = ins.totalRef - ins.totalPrev;
  const pct = ins.totalPrev > 0 ? Math.round(Math.abs(diff) / ins.totalPrev * 100) : null;
  const menos = diff < 0;
  const totalLine = pct === null
    ? `Gasto de ${ins.mesRef}: <strong>${formatEUR(-ins.totalRef)}</strong>`
    : `En ${ins.mesRef} gastaste un <strong style="color:${menos ? 'var(--green)' : 'var(--red)'}">${pct}% ${menos ? 'menos' : 'más'}</strong> que en ${ins.mesPrev} (${formatEUR(-Math.abs(diff)) } ${menos ? 'menos' : 'más'}: ${formatEUR(-ins.totalRef)} vs ${formatEUR(-ins.totalPrev)})`;

  const deltaLines = ins.deltas.map(d => {
    const up = d.delta > 0;
    return `<li style="margin-top:6px;font-size:13px">
      <span class="cat-badge">${d.cat}</span>
      <span style="color:${up ? 'var(--red)' : 'var(--green)'};font-family:'DM Mono';font-size:12px">
        ${up ? '+' : '−'}${formatEUR(Math.abs(d.delta)).replace('-', '')}</span>
      <span style="color:var(--text-secondary);font-size:12px">(${formatEUR(-d.prev)} → ${formatEUR(-d.ref)})</span>
    </li>`;
  }).join('');

  const alertLines = ins.alertas.map(a => `
    <li style="margin-top:6px;font-size:13px">
      <span style="color:var(--amber);font-weight:600">Fuera de rango:</span>
      <span class="cat-badge">${a.cat}</span>
      ${formatEUR(-a.ref)} este mes vs ${formatEUR(-a.mean)} de media en los 6 previos
    </li>`).join('');

  el.innerHTML = `
    <div class="card-title">Insights · ${ins.mesRef} vs ${ins.mesPrev}</div>
    ${nominaLine}
    <div style="font-size:14px">${totalLine}</div>
    ${deltaLines ? `<ul style="list-style:none;padding:0;margin:10px 0 0">${deltaLines}</ul>` : ''}
    ${alertLines ? `<ul style="list-style:none;padding:0;margin:10px 0 0">${alertLines}</ul>` : ''}
  `;
}

