// Finance Dashboard - Charts Module

function formatEUR(v){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);
}

function getData(){
  if(typeof filteredData === 'function') return filteredData();
  if(window.filteredData) return window.filteredData();
  return (window.FINANCE_STATE?.raw || []);
}

// Datos fijos para renderMonthly: siempre últimos 12 meses del RAW, sin filtros
function getLast12MonthsData(){
  const raw = window.FINANCE_STATE?.raw || [];
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  const data = raw.filter(r => !excluded.includes(r.categoria));

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return data.filter(r => r.fecha >= cutoffStr);
}

// Calcula gasto neto por categoría:
// - categorías reembolsables: gastos - ingresos (mínimo 0)
// - resto: solo gastos
function netExpenseByCategory(data) {
  const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];
  const gross = {};
  const refunds = {};

  data.forEach(r => {
    const v = Number(r.monto);
    const cat = r.categoria || 'Sin categoría';
    if (v < 0) {
      gross[cat] = (gross[cat] || 0) + Math.abs(v);
    } else if (reimbursable.includes(cat)) {
      refunds[cat] = (refunds[cat] || 0) + v;
    }
  });

  const net = {};
  Object.keys(gross).forEach(cat => {
    const refund = refunds[cat] || 0;
    const val = gross[cat] - refund;
    if (val > 0) net[cat] = val;
  });
  return net;
}

function renderKPIs(){
  const data = getLast12MonthsData();
  const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];

  let income = 0;
  let expense = 0;

  data.forEach(r => {
    const v = Number(r.monto);
    // Ingresos de categorías reembolsables no cuentan como ingreso real
    if(v >= 0 && !reimbursable.includes(r.categoria)) income += v;
    else if(v < 0) expense += v;
  });

  // Restar reembolsos de los gastos
  const reimbursed = data
    .filter(r => Number(r.monto) > 0 && reimbursable.includes(r.categoria))
    .reduce((s, r) => s + Number(r.monto), 0);
  expense += reimbursed; // expense is negative, so adding positive reduces it

  const net = income + expense;

  const capital = window.FINANCE_STATE?.inversiones?.capital || [];
  const capitalFilled = fillForwardCapital(capital);
  const lastCapital = capitalFilled.length > 0 ? capitalFilled[capitalFilled.length - 1] : {};
  const invPeerberry = lastCapital.peerberry || 0;
  const invMyinvestor = lastCapital.myinvestor || 0;

  const el = document.getElementById('kpis');
  if(!el) return;

  const netColor = net >= 0 ? 'var(--green)' : 'var(--red)';

  const raw        = window.FINANCE_STATE?.raw || [];
  const lastTx     = raw.length > 0 ? raw.map(r => r.fecha).sort().reverse()[0] : '—';
  const generatedAt = window.FINANCE_STATE?.generatedAt || '—';

  // Count movements pending Claude review
  const allMovs = window.FINANCE_STATE?.raw || [];
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  const reviewed = window.FINANCE_STATE?.reviewedMovements || [];
  const reviewedKeys = new Set(reviewed);

  // Categorías siempre candidatas a revisión
  const ALWAYS_REVIEW = ['A revisar', 'Otros'];
  // Candidatas solo si el concepto es de un comercio con cruce Gmail posible
  const CONCEPT_REVIEW = ['PAYPAL', 'UBR*', 'UBER *', 'UBER   *', 'AMAZON', 'AMZN', 'WWW.AMAZON'];

  const pendingReview = allMovs.filter(r => {
    if (excluded.includes(r.categoria)) return false;
    // Suscripciones ya correctas — no revisar
    if (r.categoria === 'Suscripciones') return false;
    const key = `${r.fecha}|${r.concepto}|${Number.isInteger(r.monto) ? r.monto + '.0' : r.monto}`;
    if (reviewedKeys.has(key)) return false;
    const cat = r.categoria || '';
    const concepto = (r.concepto || '').toUpperCase();
    return ALWAYS_REVIEW.includes(cat) ||
           CONCEPT_REVIEW.some(k => concepto.includes(k));
  }).length;

  el.innerHTML = `
    <div class="card"${pendingReview > 0 ? ' style="border:1.5px solid var(--red)"' : ''}>
      <div class="card-title">Última transacción</div>
      <div style="font-size:16px;font-weight:600;font-family:'DM Mono'">${lastTx}</div>
      ${pendingReview > 0 ? `<div style="font-size:11px;font-weight:600;color:var(--red);margin-top:6px">Pendiente ejecutar Organizar movimientos en Claude (${pendingReview} ${pendingReview === 1 ? 'movimiento' : 'movimientos'})</div>` : ''}
      <div class="card-title" style="margin-top:14px">Última sincronización</div>
      <div style="font-size:13px;font-weight:500;font-family:'DM Mono';color:var(--text-secondary)">${generatedAt}</div>
    </div>
    <div class="card">
      <div class="card-title">Patrimonio invertido</div>
      <div style="font-size:22px;font-weight:600;color:var(--blue)">${formatEUR(invPeerberry + invMyinvestor)}</div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-secondary)">
        <div style="display:flex;justify-content:space-between"><span>Peerberry</span><span style="font-family:'DM Mono'">${formatEUR(invPeerberry)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px"><span>MyInvestor</span><span style="font-family:'DM Mono'">${formatEUR(invMyinvestor)}</span></div>
      </div>
    </div>
    ${(() => {
      const kpi = typeof getKpiInversiones === 'function' ? getKpiInversiones() : null;
      if(!kpi){
        return `
    <div class="card">
      <div class="card-title">Rentabilidad inversiones</div>
      <div style="font-size:13px;color:var(--text-secondary)">Sin datos suficientes todavía.</div>
    </div>`;
      }

      const pctMes  = kpi.pct_ultimo_mes;
      const mesColor = pctMes >= 0 ? 'var(--green)' : 'var(--red)';

      const pb = kpi.por_plataforma?.peerberry;
      const mi = kpi.por_plataforma?.myinvestor;

      const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const periodo = kpi.periodo_ultimo_mes;
      const nombreMes = periodo ? MESES[parseInt(periodo.split('-')[1], 10) - 1] : null;
      const tituloMes = nombreMes ? `Rentabilidad inversiones · ${nombreMes}` : 'Rentabilidad inversiones · último mes';

      return `
    <div class="card">
      <div class="card-title">${tituloMes}</div>
      <div style="font-size:22px;font-weight:600;color:${mesColor}">${pctMes !== null ? pctMes + '%' : '—'}</div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-secondary)">
        <div style="display:flex;justify-content:space-between"><span>Generado por intereses (12m)</span><span style="font-family:'DM Mono'">${formatEUR(kpi.ganancia_12m)}</span></div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.08)">
          <div style="display:flex;justify-content:space-between"><span>Peerberry · mes</span><span style="font-family:'DM Mono'">${pb?.pct_ultimo_mes !== null && pb?.pct_ultimo_mes !== undefined ? pb.pct_ultimo_mes + '%' : '—'}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px"><span>MyInvestor · mes</span><span style="font-family:'DM Mono'">${mi?.pct_ultimo_mes !== null && mi?.pct_ultimo_mes !== undefined ? mi.pct_ultimo_mes + '%' : '—'}</span></div>
        </div>
      </div>
    </div>`;
    })()}
    ${(() => {
      const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const hoy = new Date();
      const meses = [0,1,2,3].map(i => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      });
      const ratios = meses.map(m => ({ mes: m, ...computeDebtRatio(m) }));
      const colorRatio = r => r === null ? 'var(--text-secondary)'
        : r > 35 ? 'var(--red)' : r > 30 ? 'var(--amber)' : 'var(--green)';
      const fmtPct = r => r === null ? '—' : r.toFixed(1).replace('.', ',') + '%';
      const actual = ratios[0];
      const previos = ratios.slice(1).map(x => `
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span>${MESES_CORTOS[parseInt(x.mes.slice(5,7),10)-1]} ${x.mes.slice(2,4)}</span>
          <span style="font-family:'DM Mono';color:${colorRatio(x.ratio)}">${fmtPct(x.ratio)}</span>
        </div>`).join('');
      return `
    <div class="card"${actual.ratio !== null && actual.ratio > 35 ? ' style="border:1.5px solid var(--red)"' : ''}>
      <div class="card-title">Ratio de endeudamiento</div>
      <div style="font-size:22px;font-weight:600;color:${colorRatio(actual.ratio)}">${fmtPct(actual.ratio)}</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${actual.ratio !== null ? `${formatEUR(actual.cuotas)} cuotas / ${formatEUR(actual.nomina)} nómina` : 'Sin nómina disponible'}</div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.08);font-size:12px;color:var(--text-secondary)">${previos}</div>
    </div>`;
    })()}
  `;
}

// Nómina neta habitual del mes (ver DECISIONS 2026-10-21, ratio de endeudamiento):
// usa la última nómina con mes <= mesKey. Meses con IRPF: solo la suma de `detalle`
// (sin la devolución). Meses con más de un pago (cambio de empresa, extras): se toma
// la nómina habitual del mes anterior.
function nominaHabitual(mesKey){
  const noms = [...(window.FINANCE_STATE?.nominas || [])]
    .filter(n => n.mes && n.mes <= mesKey)
    .sort((a, b) => a.mes.localeCompare(b.mes));
  for(let i = noms.length - 1; i >= 0; i--){
    const n = noms[i];
    if((n.pagos || 1) > 1) continue;
    const det = (n.detalle || []).reduce((s, x) => s + (Number(x.monto) || 0), 0);
    const v = det > 0 ? det : Number(n.monto) || 0;
    if(v > 0) return v;
  }
  return null;
}

// Objetivo de ratio de endeudamiento (línea punteada en la solapa Deuda) e
// inicio de la curva. Enero 2026 porque los extractos revolving empiezan en
// diciembre 2025: antes el ratio sale subestimado. Ver DECISIONS 2026-10-21
// (solapa Deuda).
const OBJETIVO_RATIO_DEUDA = 30;
const INICIO_CURVA_RATIO_DEUDA = '2026-01';

// Ratio de endeudamiento del mes (criterio bancario, umbral 35%):
// cuotas de préstamos con cuota en ese mes (según computeAmortizacion, app.js)
// + amortización + intereses de los extractos revolving con cargo en ese mes,
// dividido por la nómina habitual. Las cuotas fraccionadas 0% de IKEA no se incluyen.
function computeDebtRatio(mesKey){
  let cuotas = 0;
  const prestamos = window.FINANCE_STATE?.prestamos || [];
  if(typeof computeAmortizacion === 'function'){
    prestamos.forEach(p => {
      computeAmortizacion(p).forEach(c => {
        if(c.fecha.slice(0,7) === mesKey) cuotas += c.cuota;
      });
    });
  }
  (window.FINANCE_STATE?.tarjetasCredito || []).forEach(t => {
    if(t.fecha_cargo && t.fecha_cargo.slice(0,7) === mesKey){
      cuotas += (Number(t.amortizacion) || 0) + (Number(t.intereses_periodo) || 0);
    }
  });
  const nomina = nominaHabitual(mesKey);
  const ratio = nomina ? cuotas / nomina * 100 : null;
  return { cuotas, nomina, ratio };
}

function renderMonthly(){
  const data = getLast12MonthsData();
  const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];

  const map = {};

  data.forEach(r => {
    const key = r.fecha.slice(0,7);
    if(!map[key]) map[key] = {income:0, expense:0, refund:0};

    const v = Number(r.monto);
    if(v >= 0 && !reimbursable.includes(r.categoria)) map[key].income += v;
    else if(v >= 0 && reimbursable.includes(r.categoria)) map[key].refund += v;
    else map[key].expense += v;
  });

  const labels = Object.keys(map).sort();
  const income  = labels.map(k => map[k].income);
  const expense = labels.map(k => Math.max(0, Math.abs(map[k].expense) - map[k].refund));

  // Rombo: promedio de gastos de los 3 meses anteriores hasta el día de la última transacción
  const _lastTx = window.FINANCE_STATE?.lastTxDate ? new Date(window.FINANCE_STATE.lastTxDate + 'T00:00:00') : new Date();
  const now = _lastTx;
  const currentDay = now.getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const currentMonthIdx = labels.indexOf(currentMonthKey);

  let avgDiamond = null;
  if(currentMonthIdx !== -1){
    const raw = window.FINANCE_STATE?.raw || [];
    const excluded = window.FINANCE_STATE?.excludedCategories || [];
    const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];

    // Calcular gasto acumulado hasta el día N para cada uno de los 3 meses previos
    const prevMonthExpenses = [];
    for(let i = 1; i <= 3; i++){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth()+1).padStart(2,'0');
      const monthPrefix = `${yr}-${mo}-`;
      let gross = 0, refund = 0;
      raw.forEach(r => {
        if(excluded.includes(r.categoria)) return;
        if(!r.fecha || !r.fecha.startsWith(monthPrefix)) return;
        const day = parseInt(r.fecha.slice(8,10), 10);
        if(day > currentDay) return;
        const v = Number(r.monto);
        if(v < 0) gross += Math.abs(v);
        else if(reimbursable.includes(r.categoria)) refund += v;
      });
      prevMonthExpenses.push(Math.max(0, gross - refund));
    }

    if(prevMonthExpenses.length > 0){
      avgDiamond = prevMonthExpenses.reduce((a,b) => a+b, 0) / prevMonthExpenses.length;
    }
  }

  // Dataset scatter para el rombo (solo un punto en el mes actual)
  const diamondData = labels.map((lbl, idx) => {
    if(avgDiamond !== null && idx === currentMonthIdx) return avgDiamond;
    return null;
  });

  // Rombo: proyección de fin de mes (DECISIONS 2026-10-21, reemplaza el run-rate de 2026-09-07)
  //   = gasto neto real acumulado del mes
  //   + recurrentes activos (detectRecurring, insights.js) que todavía no cobraron este mes
  //     y cuyo día habitual de cobro + RECURRING_DUE_MARGIN_DAYS no pasó; si ya pasó, se
  //     asume que ese mes no se cobra
  //   + gasto variable medio de los días restantes (día > currentDay) en los 3 meses
  //     anteriores, sin contar los cobros de grupos recurrentes. Así un gasto puntual del
  //     mes en curso no se extrapola a fin de mes.
  // detectRecurring() ya excluye Guille/Talho Argentino/Nomina/Inversion/Amortización deuda,
  // igual que excludedCategories en state.js.
  let projDiamond = null;
  if(currentMonthIdx !== -1 && typeof detectRecurring === 'function'){
    const raw = window.FINANCE_STATE?.raw || [];
    const excluded = window.FINANCE_STATE?.excludedCategories || [];
    const recurringAll = detectRecurring();
    const recurringItems = new Set();
    recurringAll.forEach(r => (r.items || []).forEach(i => recurringItems.add(i)));

    let fixedPending = 0;
    recurringAll.filter(r => r.activa).forEach(r => {
      if(r.ultimo && r.ultimo.slice(0, 7) === currentMonthKey) return;
      if(currentDay <= r.diaHabitual + RECURRING_DUE_MARGIN_DAYS) fixedPending += r.monto;
    });

    const prevRemaining = [];
    for(let i = 1; i <= 3; i++){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthPrefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-`;
      let gross = 0, refund = 0;
      raw.forEach(r => {
        if(excluded.includes(r.categoria)) return;
        if(!r.fecha || !r.fecha.startsWith(monthPrefix)) return;
        if(parseInt(r.fecha.slice(8,10), 10) <= currentDay) return;
        const v = Number(r.monto);
        if(v < 0){ if(!recurringItems.has(r)) gross += Math.abs(v); }
        else if(reimbursable.includes(r.categoria)) refund += v;
      });
      prevRemaining.push(Math.max(0, gross - refund));
    }
    const variableRemaining = prevRemaining.reduce((a,b) => a+b, 0) / prevRemaining.length;

    const currentExpense = expense[currentMonthIdx] || 0;
    projDiamond = currentExpense + fixedPending + variableRemaining;
  }

  const projDiamondData = labels.map((lbl, idx) => {
    if(projDiamond !== null && idx === currentMonthIdx) return projDiamond;
    return null;
  });

  // Promedio de gastos de los últimos 12 meses completos (excluye el mes actual)
  const completeMonthsExpense = expense.filter((_, idx) => idx !== currentMonthIdx);
  const avgExpense12m = completeMonthsExpense.length > 0
    ? completeMonthsExpense.reduce((a,b) => a+b, 0) / completeMonthsExpense.length
    : null;
  const avgExpenseLine = avgExpense12m !== null ? labels.map(() => avgExpense12m) : null;

  const ctx = document.getElementById('chart-monthly');
  if(!ctx) return;

  if(window.monthChart) window.monthChart.destroy();

  window.monthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Ingresos', data: income, borderColor: 'rgba(13,138,82,1)', backgroundColor: 'rgba(13,138,82,0.08)', borderWidth: 2, tension: 0.25, pointRadius: 3, pointBackgroundColor: 'rgba(13,138,82,1)', fill: false },
        { label:'Gastos netos', data: expense, borderColor: 'rgba(201,74,48,1)', backgroundColor: 'rgba(201,74,48,0.08)', borderWidth: 2, tension: 0.25, pointRadius: 3, pointBackgroundColor: 'rgba(201,74,48,1)', fill: false },
        ...(avgExpenseLine !== null ? [{
          label: 'Promedio gastos (12m)',
          data: avgExpenseLine,
          borderColor: 'rgba(120,120,120,0.9)',
          borderDash: [6,4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0
        }] : []),
        ...(avgDiamond !== null ? [{
          label: `Ritmo promedio (día ${currentDay})`,
          type: 'scatter',
          data: diamondData.map((v, i) => v !== null ? {x: labels[i], y: v} : null).filter(Boolean),
          pointStyle: 'rectRot',
          pointRadius: 8,
          pointHoverRadius: 10,
          backgroundColor: 'rgba(201,74,48,1)',
          borderColor: 'rgba(255,255,255,0.9)',
          borderWidth: 1.5,
          order: 0
        }] : []),
        ...(projDiamond !== null ? [{
          label: 'Proyección fin de mes',
          type: 'scatter',
          data: projDiamondData.map((v, i) => v !== null ? {x: labels[i], y: v} : null).filter(Boolean),
          pointStyle: 'rectRot',
          pointRadius: 8,
          pointHoverRadius: 10,
          backgroundColor: 'rgba(37,99,190,1)',
          borderColor: 'rgba(255,255,255,0.9)',
          borderWidth: 1.5,
          order: 0
        }] : [])
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(ctx){
              if(ctx.dataset.label && ctx.dataset.label.startsWith('Ritmo')){
                return `Promedio hasta día ${currentDay}: ${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(ctx.parsed.y)}`;
              }
              if(ctx.dataset.label === 'Proyección fin de mes'){
                return `Proyección fin de mes: ${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(ctx.parsed.y)}`;
              }
              return `${ctx.dataset.label}: ${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: { type: 'category' },
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
          }
        }
      }
    }
  });
}

function renderCategoryTrend(){
  const raw = window.FINANCE_STATE?.raw || [];
  const excluded = window.FINANCE_STATE?.excludedCategories || [];

  // Todas las categorias con gasto en los datos sin filtro de periodo
  const allData = raw.filter(r => !excluded.includes(r.categoria));
  const catSet = new Set();
  allData.forEach(r => { if(Number(r.monto) < 0) catSet.add(r.categoria || 'Sin categoría'); });
  const allCats = Array.from(catSet).sort();

  // Poblar selector
  const sel = document.getElementById('cat-trend-selector');
  if(sel && sel.options.length <= 1){
    sel.innerHTML = '';
    allCats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
    // Default: primera categoría con más gasto en últimos 12 meses
    const last12 = getLast12MonthsData();
    const totals = {};
    last12.forEach(r => {
      const v = Number(r.monto);
      if(v < 0) totals[r.categoria] = (totals[r.categoria]||0) + Math.abs(v);
    });
    const topCat = Object.keys(totals).sort((a,b) => totals[b]-totals[a])[0];
    if(topCat && allCats.includes(topCat)) sel.value = topCat;
  }

  const selectedCat = sel ? sel.value : (allCats[0] || '');

  // Rango dinámico: desde el primer mes con datos hasta el mes actual
  const now = new Date();
  const allDates = allData.map(r => r.fecha).filter(Boolean).sort();
  const firstMonth = allDates.length ? allDates[0].slice(0,7) : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const months = [];
  const endMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  let cur = new Date(firstMonth + '-01');
  while(true){
    const m = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
    months.push(m);
    if(m >= endMonth) break;
    cur.setMonth(cur.getMonth()+1);
  }

  const monthTotals = {};
  months.forEach(m => monthTotals[m] = 0);

  // Gasto neto por mes para la categoría seleccionada: en categorías
  // reembolsables (ver reimbursableCategories) los reintegros restan del
  // gasto bruto de ese mes, misma lógica que netExpenseByCategory().
  months.forEach(m => {
    const monthData = allData.filter(r => r.fecha && r.fecha.slice(0,7) === m);
    const net = netExpenseByCategory(monthData);
    monthTotals[m] = net[selectedCat] || 0;
  });

  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    return new Date(y, mo-1, 1).toLocaleDateString('es-ES', {month:'short', year:'2-digit'});
  });
  const values = months.map(m => monthTotals[m]);

  // Promedio por año: excluir mes actual (incompleto) y años con menos de 3 meses de datos
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const yearGroups = {};
  months.forEach(m => {
    if(m === currentMonth) return;
    const y = m.slice(0,4);
    if(!yearGroups[y]) yearGroups[y] = { sum: 0, count: 0 };
    if(monthTotals[m] > 0){
      yearGroups[y].sum += monthTotals[m];
      yearGroups[y].count++;
    }
  });
  const avgValues = months.map(m => {
    const y = m.slice(0,4);
    const g = yearGroups[y];
    if(!g || g.count < 3) return null; // menos de 3 meses con datos: no mostrar promedio
    return parseFloat((g.sum / g.count).toFixed(2));
  });

  // Rombo: promedio de gastos de esta categoría hasta el día de la última transacción
  const _lastTxTrend = window.FINANCE_STATE?.lastTxDate ? new Date(window.FINANCE_STATE.lastTxDate + 'T00:00:00') : now;
  const currentDay = _lastTxTrend.getDate();
  const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];
  const prevTotals = [];
  for(let i = 1; i <= 3; i++){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth()+1).padStart(2,'0');
    const monthPrefix = `${yr}-${mo}-`;
    let gross = 0, refund = 0;
    allData.forEach(r => {
      if((r.categoria || 'Sin categoría') !== selectedCat) return;
      if(!r.fecha || !r.fecha.startsWith(monthPrefix)) return;
      const day = parseInt(r.fecha.slice(8,10), 10);
      if(day > currentDay) return;
      const v = Number(r.monto);
      if(v < 0) gross += Math.abs(v);
      else if(reimbursable.includes(r.categoria)) refund += v;
    });
    prevTotals.push(Math.max(0, gross - refund));
  }
  const avgDiamond = prevTotals.length > 0 ? prevTotals.reduce((a,b) => a+b, 0) / prevTotals.length : null;

  // El rombo va en el índice del mes actual (último label)
  const currentMonthIdx = months.length - 1;
  const diamondData = labels.map((_, i) => i === currentMonthIdx && avgDiamond !== null ? avgDiamond : null);

  const ctx = document.getElementById('chart-cat-trend');
  if(!ctx) return;
  if(window.catTrendChart) window.catTrendChart.destroy();

  window.catTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: selectedCat,
          data: values,
          borderColor: '#2563be',
          backgroundColor: 'rgba(37,99,190,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.3,
          order: 1
        },
        {
          label: 'Promedio anual',
          data: avgValues,
          borderColor: '#9a6200',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0,
          spanGaps: true,
          order: 0,
          segment: {
            borderDash: ctx => [6, 4]
          }
        },
        ...(avgDiamond !== null ? [{
          label: `Ritmo promedio (día ${currentDay})`,
          type: 'scatter',
          data: diamondData.map((v, i) => v !== null ? {x: labels[i], y: v} : null).filter(Boolean),
          pointStyle: 'rectRot',
          pointRadius: 8,
          pointHoverRadius: 10,
          backgroundColor: 'rgba(201,74,48,1)',
          borderColor: 'rgba(255,255,255,0.9)',
          borderWidth: 1.5,
          order: -1
        }] : [])
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 20, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if(ctx.parsed.y === null) return null;
              return ` ${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
          }
        }
      }
    }
  });

  renderCategoryAvgTable();
}

function renderCategoryAvgTable(){
  const raw = window.FINANCE_STATE?.raw || [];
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  const allData = raw.filter(r => !excluded.includes(r.categoria));

  const now = new Date();
  const thisYear  = String(now.getFullYear());
  const lastYear  = String(now.getFullYear() - 1);
  const currentMonth = `${thisYear}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // Mes anterior
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

  // Categorías con gasto
  const cats = new Set();
  allData.forEach(r => { if(Number(r.monto) < 0) cats.add(r.categoria || 'Sin categoría'); });

  const rows = [];
  cats.forEach(cat => {
    const movs = allData.filter(r => (r.categoria || 'Sin categoría') === cat && Number(r.monto) < 0);

    const byMonth = {};
    movs.forEach(r => {
      const k = r.fecha ? r.fecha.slice(0,7) : '';
      if(k) byMonth[k] = (byMonth[k] || 0) + Math.abs(Number(r.monto));
    });

    // Promedio sobre meses TRANSCURRIDOS reales (incluye meses sin gasto en el
    // denominador), no solo sobre los meses con movimientos. Año anterior: 12
    // meses fijos (año completo). Año actual: meses de enero al mes anterior
    // al actual (excluye el mes en curso, con datos incompletos).
    const avg = (year, elapsedMonths) => {
      if(elapsedMonths <= 0) return null;
      const months = Object.keys(byMonth).filter(m => m.startsWith(year) && m !== currentMonth);
      const sum = months.reduce((s, m) => s + byMonth[m], 0);
      if(sum === 0) return null;
      return sum / elapsedMonths;
    };

    const avgPrevYear = avg(lastYear, 12);
    const avgThisYear = avg(thisYear, now.getMonth()); // meses transcurridos (ene..mes anterior)
    const lastMonthVal = byMonth[prevMonth] || 0;

    // Mostrar solo si hay algo útil
    if(avgPrevYear === null && avgThisYear === null && lastMonthVal === 0) return;

    rows.push({ cat, avgPrevYear, avgThisYear, lastMonthVal });
  });

  // Ordenar por gasto mes anterior desc, luego avg año actual desc
  rows.sort((a, b) => a.cat.localeCompare(b.cat, 'es'));

  const fmt = v => v != null
    ? new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
    : '—';

  const prevLabel = prevDate.toLocaleDateString('es-ES', {month:'long'});
  const thStyle = 'text-align:right;padding:6px 10px;border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:500;white-space:nowrap';
  const thStyleL = 'text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:500';

  let html = `<div style="overflow-x:auto;margin-top:4px">
<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px">
  <colgroup>
    <col style="width:40%">
    <col style="width:20%">
    <col style="width:20%">
    <col style="width:20%">
  </colgroup>
  <thead>
    <tr>
      <th style="${thStyleL}">Categoría</th>
      <th style="${thStyle}">Ø ${lastYear}</th>
      <th style="${thStyle}">Ø ${thisYear}</th>
      <th style="${thStyle}">${prevLabel}</th>
    </tr>
  </thead>
  <tbody>`;

  const GREEN = 'color:var(--green);font-weight:500';
  const RED   = 'color:var(--red);font-weight:500';
  const MUTED = 'color:var(--text-secondary)';

  rows.forEach(({cat, avgPrevYear, avgThisYear, lastMonthVal}) => {
    // Ø año actual vs Ø año anterior
    let avgColor = MUTED;
    if(avgPrevYear != null && avgThisYear != null){
      avgColor = avgThisYear > avgPrevYear ? RED : GREEN;
    }

    // Mes anterior vs Ø año actual (o año anterior si no hay actual)
    const ref = avgThisYear ?? avgPrevYear;
    let lastColor = MUTED;
    if(ref != null && lastMonthVal > 0){
      lastColor = lastMonthVal > ref ? RED : GREEN;
    }

    const tdR = 'text-align:right;padding:7px 10px;border-bottom:1px solid var(--border)';
    const tdL = 'text-align:left;padding:7px 10px;border-bottom:1px solid var(--border)';

    html += `<tr>
      <td style="${tdL}">${cat}</td>
      <td style="${tdR};${MUTED}">${fmt(avgPrevYear)}</td>
      <td style="${tdR};${avgColor}">${fmt(avgThisYear)}</td>
      <td style="${tdR};${lastColor}">${lastMonthVal > 0 ? fmt(lastMonthVal) : '—'}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';

  const el = document.getElementById('cat-avg-table');
  if(el) el.innerHTML = html;
}

function renderNominaTrend(){
  const raw = window.FINANCE_STATE?.nominas || [];
  const ctx = document.getElementById('chart-nomina');
  if(!ctx || raw.length === 0) return;

  // Serie ordenada y mapa mes -> {monto, empresa}
  const sorted = [...raw].sort((a,b) => a.mes.localeCompare(b.mes));
  const byMonth = {};
  sorted.forEach(r => byMonth[r.mes] = r);

  // Eje continuo de meses (sin huecos): del primer al último mes disponible.
  // Los meses sin registro son período real sin nómina (ej. cambio de
  // empleo) -> monto 0, no un hueco de datos a excluir.
  const [minY, minM] = sorted[0].mes.split('-').map(Number);
  const [maxY, maxM] = sorted[sorted.length-1].mes.split('-').map(Number);
  const labels = [];
  let y = minY, m = minM;
  while(y < maxY || (y === maxY && m <= maxM)){
    labels.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if(m > 12){ m = 1; y++; }
  }

  const montos = labels.map(mes => byMonth[mes] ? byMonth[mes].monto : 0);
  const empresas = labels.map(mes => byMonth[mes] ? byMonth[mes].empresa : null);
  const etapas = labels.map(mes => byMonth[mes] ? (byMonth[mes].etapa || byMonth[mes].empresa) : null);
  const estimados = labels.map(mes => byMonth[mes] ? !!byMonth[mes].estimado : false);
  const irpfFlags = labels.map(mes => byMonth[mes] ? !!byMonth[mes].irpf : false);
  const pagosPorMes = labels.map(mes => byMonth[mes] ? (byMonth[mes].pagos || 0) : 0);
  const detallePorMes = labels.map(mes => byMonth[mes] ? (byMonth[mes].detalle || []) : []);

  // Promedio móvil "consciente de etapa": se reinicia cada vez que cambia
  // la etapa (ej. paro -> Between -> Luzutania), para no marcar como
  // anómalo el salto normal de nivel de ingresos tras un cambio de empleo.
  // Dentro de una misma etapa sigue siendo un promedio móvil de hasta 12
  // meses, así que sí detecta anomalías reales dentro de la etapa (IRPF,
  // doble pago).
  const movingAvg = labels.map((_, i) => {
    let start = i;
    while(start > 0 && etapas[start - 1] === etapas[i] && (i - start) < 11) start--;
    const window_ = montos.slice(start, i+1);
    return window_.reduce((a,b) => a+b, 0) / window_.length;
  });

  // Variación interanual del último mes disponible
  const lastIdx = labels.length - 1;
  const yoyIdx = lastIdx - 12;
  const lastVal = montos[lastIdx];
  const yoyLabelEl = document.getElementById('nomina-yoy-label');
  if(yoyLabelEl){
    if(yoyIdx >= 0 && montos[yoyIdx] > 0){
      const pct = ((lastVal - montos[yoyIdx]) / montos[yoyIdx]) * 100;
      const signo = pct >= 0 ? '+' : '';
      yoyLabelEl.textContent = `${labels[lastIdx]}: ${formatEUR(lastVal)} · variación interanual: ${signo}${pct.toFixed(1)}%`;
    } else {
      yoyLabelEl.textContent = `${labels[lastIdx]}: ${formatEUR(lastVal)} · variación interanual: N/D (sin nómina hace 12 meses)`;
    }
  }

  // Colores por etapa (banda de fondo + puntos), usados también en la leyenda
  const ETAPA_COLORS = {
    'Ford Argentina S.C.A.':  { punto: 'rgba(235,104,52,0.9)',  banda: 'rgba(235,104,52,0.07)' },
    'Mudanza':                { punto: 'rgba(163,60,60,0.9)',  banda: 'rgba(163,60,60,0.06)' },
    'Valeo España, S.A.U.':   { punto: 'rgba(66,133,180,0.9)',  banda: 'rgba(66,133,180,0.06)' },
    'Paro':                   { punto: 'rgba(120,120,120,0.9)', banda: 'rgba(120,120,120,0.08)' },
    'Between Technology S.L': { punto: 'rgba(13,138,82,0.9)',   banda: 'rgba(13,138,82,0.07)' },
    'Luzutania Group SLU':    { punto: 'rgba(160,80,190,0.9)',  banda: 'rgba(160,80,190,0.07)' }
  };
  function etapaColor(etapa){
    return (ETAPA_COLORS[etapa] || { punto: 'rgba(120,120,120,0.9)', banda: null });
  }

  // Nota de períodos por etapa (auto-generada a partir de los datos)
  const noteEl = document.getElementById('nomina-empresa-note');
  if(noteEl){
    const periodos = [];
    let curEtapa = undefined, curStart = null;
    labels.forEach((mes, i) => {
      const et = etapas[i];
      if(et !== curEtapa){
        if(curEtapa !== undefined) periodos.push({etapa: curEtapa, start: curStart, end: labels[i-1]});
        curEtapa = et; curStart = mes;
      }
    });
    periodos.push({etapa: curEtapa, start: curStart, end: labels[labels.length-1]});

    const partes = periodos.map(p => {
      const nombre = p.etapa || 'Sin nómina';
      const rango = p.start === p.end ? p.start : `${p.start} – ${p.end}`;
      return `${nombre} (${rango})`;
    });
    noteEl.textContent = partes.join(' · ');
  }

  // Leyenda de qué significa cada sombreado (solo las etapas presentes en los datos)
  const legendEl = document.getElementById('nomina-etapas-legend');
  if(legendEl){
    const etapasPresentes = [...new Set(etapas.filter(Boolean))];
    let html = etapasPresentes.map(et => {
      const c = etapaColor(et);
      return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px">
        <span style="width:10px;height:10px;border-radius:2px;background:${c.banda || c.punto}"></span>${et}
      </span>`;
    }).join('');
    if(estimados.some(Boolean)){
      html += `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px">
        <span style="width:9px;height:9px;border-radius:50%;border:2px solid var(--text-secondary);background:transparent"></span>Estimado (de memoria)
      </span>`;
    }
    legendEl.innerHTML = html;
  }

  // Panel lateral: meses más de 15% por encima del promedio móvil por etapa,
  // más los meses con devolución IRPF siempre (se detectan con certeza vía
  // Nota="IRPF", no dependen del cálculo estadístico -- ver DECISIONS.md)
  const outliersEl = document.getElementById('nomina-outliers');
  if(outliersEl){
    const outliers = [];
    labels.forEach((mes, i) => {
      if(montos[i] <= 0) return;
      const delta = movingAvg[i] > 0 ? (montos[i] - movingAvg[i]) / movingAvg[i] : 0;
      if(irpfFlags[i] || delta > 0.15){
        outliers.push({ mes, monto: montos[i], delta, irpf: irpfFlags[i], pagos: pagosPorMes[i], detalle: detallePorMes[i] });
      }
    });

    if(outliers.length === 0){
      outliersEl.innerHTML = '<div style="color:var(--text-secondary)">Ningún mes supera el 15% por encima del promedio.</div>';
    } else {
      outliersEl.innerHTML = outliers.map(o => {
        let motivo;
        if(o.irpf) motivo = 'incluye devolución de Hacienda (IRPF)';
        else if(o.pagos > 1 && o.detalle && o.detalle.length > 1){
          motivo = o.detalle.map(d => `${formatEUR(d.monto)} ${d.empresa || 'sin empresa'}`).join(' + ');
        }
        else motivo = 'sin explicación automática disponible';
        const pctStr = o.delta > 0.001 ? ` · +${(o.delta*100).toFixed(0)}%` : '';
        return `<div style="margin-bottom:8px">
          <div style="font-weight:500">${o.mes}${pctStr}</div>
          <div style="color:var(--text-secondary)">${formatEUR(o.monto)} — ${motivo}</div>
        </div>`;
      }).join('');
    }
  }

  // Bandas de fondo por etapa, calculadas a partir de los mismos segmentos
  // que la nota de texto
  const segments = [];
  {
    let curEtapa = undefined, curStartIdx = 0;
    labels.forEach((mes, i) => {
      const et = etapas[i];
      if(et !== curEtapa){
        if(curEtapa !== undefined) segments.push({etapa: curEtapa, startIdx: curStartIdx, endIdx: i-1});
        curEtapa = et; curStartIdx = i;
      }
    });
    segments.push({etapa: curEtapa, startIdx: curStartIdx, endIdx: labels.length-1});
  }

  const nominaBandsPlugin = {
    id: 'nominaBands',
    beforeDatasetsDraw(chart){
      const {ctx, chartArea, scales} = chart;
      if(!chartArea) return;
      segments.forEach(seg => {
        const color = etapaColor(seg.etapa).banda;
        if(!color) return;
        const xStart = scales.x.getPixelForValue(seg.startIdx) - (scales.x.width / labels.length / 2);
        const xEnd = scales.x.getPixelForValue(seg.endIdx) + (scales.x.width / labels.length / 2);
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
        ctx.restore();
      });
    }
  };

  if(window.nominaChart) window.nominaChart.destroy();

  window.nominaChart = new Chart(ctx, {
    type: 'line',
    plugins: [nominaBandsPlugin],
    data: {
      labels,
      datasets: [
        {
          label: 'Ingreso mensual (nómina)',
          data: montos,
          borderColor: 'rgba(66,133,180,0.9)',
          pointBackgroundColor: labels.map((_, i) => estimados[i] ? 'rgba(255,255,255,1)' : etapaColor(etapas[i]).punto),
          pointBorderColor: labels.map((_, i) => etapaColor(etapas[i]).punto),
          pointBorderWidth: labels.map((_, i) => estimados[i] ? 2 : 1),
          pointStyle: labels.map((_, i) => irpfFlags[i] ? 'rectRot' : 'circle'),
          pointRadius: labels.map((_, i) => irpfFlags[i] ? 7 : 4),
          pointHoverRadius: 8,
          spanGaps: false,
          tension: 0.15,
          fill: false
        },
        {
          label: 'Promedio móvil (por etapa)',
          data: movingAvg,
          borderColor: 'rgba(201,74,48,0.9)',
          borderDash: [5,4],
          pointRadius: 0,
          fill: false,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctxPoint){
              const i = ctxPoint.dataIndex;
              if(ctxPoint.dataset.label.startsWith('Promedio')){
                return `Promedio (etapa actual): ${formatEUR(ctxPoint.parsed.y)}`;
              }
              const et = etapas[i];
              const irpfStr = irpfFlags[i] ? ' (incluye devolución IRPF)' : '';
              const estStr = estimados[i] ? ' [estimado]' : '';
              return `${et || 'Sin nómina'}${irpfStr}${estStr}: ${formatEUR(ctxPoint.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: { type: 'category' },
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
          }
        }
      }
    }
  });
}



/* Evolución del saldo aplazado por tarjeta (Tarjetas de Crédito Revolving).
 * Una línea por tarjeta, eje X = mes de cierre del periodo. Si una tarjeta
 * no tiene fila en un mes dado (ej. otra tarjeta se cargó ese mes y esta
 * no), se mantiene el último saldo conocido en vez de cortar la línea, ya
 * que el saldo no cambia hasta el próximo extracto real.
 */
function renderTarjetasChart(){
  const rows = window.FINANCE_STATE?.tarjetasCredito || [];
  const ctx = document.getElementById('chart-tarjetas');
  if(!ctx || rows.length === 0) return;

  const porTarjeta = {};
  rows.forEach(r => {
    const key = r.tarjeta || 'Sin nombre';
    if(!porTarjeta[key]) porTarjeta[key] = [];
    porTarjeta[key].push(r);
  });

  const labelsSet = new Set();
  Object.values(porTarjeta).forEach(list => {
    list.sort((a, b) => (a.periodo_inicio || '').localeCompare(b.periodo_inicio || ''));
    list.forEach(r => labelsSet.add((r.periodo_fin || r.periodo_inicio || '').slice(0, 7)));
  });
  const labels = [...labelsSet].sort();

  const COLORS = ['rgba(66,133,180,0.9)', 'rgba(235,104,52,0.9)', 'rgba(13,138,82,0.9)', 'rgba(160,80,190,0.9)'];

  const datasets = Object.entries(porTarjeta).map(([nombre, list], idx) => {
    const byMonth = {};
    list.forEach(r => { byMonth[(r.periodo_fin || r.periodo_inicio || '').slice(0, 7)] = Number(r.aplazado_proximo) || 0; });
    let last = null;
    const data = labels.map(m => {
      if(byMonth[m] !== undefined){ last = byMonth[m]; return last; }
      return last;
    });
    return {
      label: nombre,
      data,
      borderColor: COLORS[idx % COLORS.length],
      backgroundColor: COLORS[idx % COLORS.length],
      tension: 0.2,
      spanGaps: true
    };
  });

  // Curva independiente de compras fraccionadas a 0% TIN (ej. IKEA). Se
  // grafica aparte porque no tiene costo financiero y su lógica de saldo
  // (cuotas fijas) no tiene nada que ver con el revolving — mezclarla en la
  // misma serie que el saldo revolving daría una lectura engañosa del costo
  // real de la deuda.
  Object.entries(porTarjeta).forEach(([nombre, list], idx) => {
    const tieneFraccionado = list.some(r => r.fraccionado_pendiente !== null && r.fraccionado_pendiente !== undefined);
    if(!tieneFraccionado) return;
    const byMonth = {};
    list.forEach(r => {
      const v = r.fraccionado_pendiente;
      if(v !== null && v !== undefined) byMonth[(r.periodo_fin || r.periodo_inicio || '').slice(0, 7)] = Number(v);
    });
    let last = null;
    const data = labels.map(m => {
      if(byMonth[m] !== undefined){ last = byMonth[m]; return last; }
      return last;
    });
    datasets.push({
      label: `${nombre} · fraccionado 0% (sin costo)`,
      data,
      borderColor: COLORS[idx % COLORS.length],
      backgroundColor: COLORS[idx % COLORS.length],
      borderDash: [6, 4],
      tension: 0.2,
      spanGaps: true
    });
  });

  if(window.tarjetasChart) window.tarjetasChart.destroy();

  window.tarjetasChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom' } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => formatEUR(v) }
        }
      }
    }
  });
}

/* Evolución del ratio de endeudamiento (solapa Deuda): histórico desde
 * INICIO_CURVA_RATIO_DEUDA hasta el mes en curso con computeDebtRatio(),
 * pronóstico hasta FIN_CURVA_RATIO_DEUDA con la serie que genera
 * sync_finance_data.py (deuda_forecast en finance_data.json) y "Curva ideal"
 * fija (CURVA_IDEAL_RATIO_DEUDA). Desde 2026-10-21 sin línea de objetivo,
 * marca de llegada ni banderitas de cambios de pronóstico. Ver DECISIONS
 * 2026-10-21 (curva ideal). */
const FIN_CURVA_RATIO_DEUDA = '2028-12';

/* Curva ideal: foto fija calculada el 21/10/2026, no se recalcula. Supuestos
 * (versión 2, 21/10/2026): venta del Golf en marzo 2027 por 22.800 € (cobro
 * 15/03/2027) que cancela Golf, IKEA, Visa Classic y moto de Guille y amortiza
 * el Ibiza con el remanente; desde abril 2027, amortización fija de 787,69 €/mes
 * al préstamo de mayor tipo (Ibiza y luego Talho), reduciendo cuota, el monto
 * justo para llegar a deuda 0 en diciembre 2028 (Ibiza cancelado en octubre
 * 2027); el resto del presupuesto de 1.111,26 €/mes va a inversiones; comisión
 * 1% en préstamos (Talho sin comisión); nómina 2.648,99 € constante. Ver
 * DECISIONS 2026-10-21 (curva ideal v2). */
const CURVA_IDEAL_RATIO_DEUDA = {
  '2026-10': 42.9,
  '2026-11': 42.0,
  '2026-12': 42.0,
  '2027-01': 42.0,
  '2027-02': 42.0,
  '2027-03': 42.0,
  '2027-04': 13.0,
  '2027-05': 12.2,
  '2027-06': 11.2,
  '2027-07': 10.3,
  '2027-08': 9.3,
  '2027-09': 8.3,
  '2027-10': 7.3,
  '2027-11': 6.9,
  '2027-12': 6.4,
  '2028-01': 5.9,
  '2028-02': 5.5,
  '2028-03': 5.0,
  '2028-04': 4.5,
  '2028-05': 4.1,
  '2028-06': 3.6,
  '2028-07': 3.1,
  '2028-08': 2.6,
  '2028-09': 2.1,
  '2028-10': 1.6,
  '2028-11': 1.1,
  '2028-12': 0.5
};

function renderDebtRatioChart(){
  const ctx = document.getElementById('chart-ratio-deuda');
  if(!ctx) return;

  const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const hoy = new Date();
  const fin = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const meses = [];
  let [y, m] = INICIO_CURVA_RATIO_DEUDA.split('-').map(Number);
  while(true){
    const k = `${y}-${String(m).padStart(2,'0')}`;
    if(k > FIN_CURVA_RATIO_DEUDA) break;
    meses.push(k);
    m++; if(m > 12){ m = 1; y++; }
  }
  const idxFin = meses.indexOf(fin);
  const mesCorto = k => `${MESES_CORTOS[parseInt(k.slice(5,7),10)-1]} ${k.slice(2,4)}`;
  const r1 = v => v === null || v === undefined ? null : Math.round(v * 10) / 10;
  const fmtPct = v => v.toFixed(1).replace('.', ',') + '%';
  const colorPunto = v => v === null ? 'rgba(0,0,0,0.2)'
    : v > 35 ? 'rgba(200,40,40,0.95)' : v > 30 ? 'rgba(154,98,0,0.95)' : 'rgba(13,138,82,0.95)';

  // Histórico
  const datos = meses.map(k => k <= fin ? computeDebtRatio(k) : null);
  const hist = datos.map(d => d && d.ratio !== null ? r1(d.ratio) : null);

  // Pronóstico (desde el mes en curso, para que la línea empalme con el histórico)
  const fc = window.FINANCE_STATE?.deudaForecast || null;
  const fcMap = {};
  (fc?.meses || []).forEach(x => { fcMap[x.mes] = x; });
  const prono = meses.map((k, i) => {
    if(k < fin) return null;
    if(k === fin) return hist[i];
    return fcMap[k] ? r1(fcMap[k].ratio) : null;
  });

  // Curva ideal (fija)
  const ideal = meses.map(k => CURVA_IDEAL_RATIO_DEUDA[k] ?? null);

  if(window.debtRatioChart) window.debtRatioChart.destroy();

  window.debtRatioChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses.map(mesCorto),
      datasets: [
        {
          label: 'Ratio de endeudamiento',
          data: hist,
          borderColor: 'rgba(66,133,180,0.9)',
          backgroundColor: 'rgba(66,133,180,0.9)',
          pointBackgroundColor: hist.map(colorPunto),
          pointBorderColor: hist.map(colorPunto),
          pointRadius: 5,
          tension: 0.2,
          spanGaps: true
        },
        {
          label: 'Pronóstico',
          data: prono,
          borderColor: 'rgba(66,133,180,0.6)',
          backgroundColor: 'rgba(66,133,180,0.6)',
          borderDash: [5, 4],
          pointBackgroundColor: '#fff',
          pointBorderColor: prono.map(colorPunto),
          pointRadius: prono.map((v, i) => i === idxFin ? 0 : 3),
          tension: 0,
          spanGaps: false
        },
        {
          label: 'Curva ideal',
          data: ideal,
          borderColor: 'rgba(13,138,82,0.9)',
          backgroundColor: 'rgba(13,138,82,0.9)',
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0,
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          filter: it => it.raw !== null && it.raw !== undefined
            && !(it.datasetIndex === 1 && it.dataIndex === idxFin),
          callbacks: {
            label: c => {
              if(c.datasetIndex === 2) return `Curva ideal: ${fmtPct(c.parsed.y)}`;
              if(c.datasetIndex === 1){
                const f = fcMap[meses[c.dataIndex]];
                const txt = `Pronóstico: ${fmtPct(c.parsed.y)}`;
                return f ? `${txt} (${formatEUR(f.cuotas)} / ${formatEUR(f.nomina)})` : txt;
              }
              const d = datos[c.dataIndex];
              if(!d || d.ratio === null) return 'Sin nómina disponible';
              return `Ratio: ${fmtPct(d.ratio)} (${formatEUR(d.cuotas)} / ${formatEUR(d.nomina)})`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 50,
          ticks: { callback: v => v + '%' }
        }
      }
    }
  });
}
