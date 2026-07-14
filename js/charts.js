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
    <div class="card">
      <div class="card-title">Última transacción</div>
      <div style="font-size:16px;font-weight:600;font-family:'DM Mono'">${lastTx}</div>
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
    <div class="card" style="${pendingReview > 0 ? 'border:1.5px solid var(--amber)' : ''}">
      <div class="card-title">Sin analizar por Claude</div>
      <div style="font-size:22px;font-weight:600;color:${pendingReview > 0 ? 'var(--amber)' : 'var(--green)'}">${pendingReview}</div>
      ${pendingReview > 0 ? '<div style="font-size:11px;color:var(--text-secondary);margin-top:6px">Usa el trigger <strong>"Organizar Movimientos"</strong> en el chat de Claude</div>' : '<div style="font-size:11px;color:var(--text-secondary);margin-top:6px">Todo al día</div>'}
    </div>
  `;
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

  const ctx = document.getElementById('chart-monthly');
  if(!ctx) return;

  if(window.monthChart) window.monthChart.destroy();

  window.monthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Ingresos', data: income, backgroundColor: 'rgba(13,138,82,0.75)' },
        { label:'Gastos netos', data: expense, backgroundColor: 'rgba(201,74,48,0.75)' },
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

  allData.forEach(r => {
    if((r.categoria || 'Sin categoría') !== selectedCat) return;
    const v = Number(r.monto);
    if(v >= 0) return;
    const key = r.fecha ? r.fecha.slice(0,7) : '';
    if(key in monthTotals) monthTotals[key] += Math.abs(v);
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

    const avg = (year, minMonths = 3) => {
      const months = Object.keys(byMonth).filter(m => m.startsWith(year) && m !== currentMonth);
      const withData = months.filter(m => byMonth[m] > 0);
      if(withData.length < minMonths) return null;
      return withData.reduce((s, m) => s + byMonth[m], 0) / withData.length;
    };

    const avgPrevYear = avg(lastYear, 3);
    const avgThisYear = avg(thisYear, 1); // año actual: mínimo 1 mes
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

// Paleta fija por empresa: mismo color siempre para la misma empresa entre
// renders. Gris para meses sin nómina (huecos reales, ej. cambio de empleo).
const _NOMINA_EMPRESA_COLORS = {
  'Valeo España, S.A.U.':    'rgba(66,133,180,0.9)',
  'Between Technology S.L':  'rgba(13,138,82,0.9)',
  'Luzutania Group SLU':     'rgba(160,80,190,0.9)'
};
const _NOMINA_GAP_COLOR = 'rgba(160,160,160,0.6)';

function _nominaColorFor(empresa){
  return empresa ? (_NOMINA_EMPRESA_COLORS[empresa] || 'rgba(120,120,120,0.9)') : _NOMINA_GAP_COLOR;
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
  const irpfFlags = labels.map(mes => byMonth[mes] ? !!byMonth[mes].irpf : false);

  // Promedio móvil 12 meses (incluye los meses en 0 como ingreso real, según
  // decisión: solo se excluyen huecos de DATOS, no meses reales sin ingreso)
  const movingAvg = labels.map((_, i) => {
    const start = Math.max(0, i - 11);
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

  // Nota de períodos por empresa (auto-generada a partir de los datos)
  const noteEl = document.getElementById('nomina-empresa-note');
  if(noteEl){
    const periodos = [];
    let curEmpresa = undefined, curStart = null;
    labels.forEach((mes, i) => {
      const emp = empresas[i];
      if(emp !== curEmpresa){
        if(curEmpresa !== undefined) periodos.push({empresa: curEmpresa, start: curStart, end: labels[i-1]});
        curEmpresa = emp; curStart = mes;
      }
    });
    periodos.push({empresa: curEmpresa, start: curStart, end: labels[labels.length-1]});

    const partes = periodos.map(p => {
      const nombre = p.empresa || 'Sin nómina';
      const rango = p.start === p.end ? p.start : `${p.start} – ${p.end}`;
      return `${nombre} (${rango})`;
    });
    noteEl.textContent = partes.join(' · ');
  }

  // Leyenda fija de meses con devolución de Hacienda (IRPF) incluida
  const irpfEl = document.getElementById('nomina-irpf-note');
  if(irpfEl){
    const mesesIrpf = labels.filter((mes, i) => irpfFlags[i]);
    irpfEl.textContent = mesesIrpf.length > 0
      ? `Incluye devolución de Hacienda (IRPF) en: ${mesesIrpf.join(', ')}`
      : '';
  }

  // Bandas de fondo por empresa (Between Technology / Luzutania), calculadas
  // a partir de los mismos segmentos que la nota de texto
  const bandColors = {
    'Between Technology S.L': 'rgba(13,138,82,0.07)',
    'Luzutania Group SLU':    'rgba(160,80,190,0.07)'
  };
  const segments = [];
  {
    let curEmpresa = undefined, curStartIdx = 0;
    labels.forEach((mes, i) => {
      const emp = empresas[i];
      if(emp !== curEmpresa){
        if(curEmpresa !== undefined) segments.push({empresa: curEmpresa, startIdx: curStartIdx, endIdx: i-1});
        curEmpresa = emp; curStartIdx = i;
      }
    });
    segments.push({empresa: curEmpresa, startIdx: curStartIdx, endIdx: labels.length-1});
  }

  const nominaBandsPlugin = {
    id: 'nominaBands',
    beforeDatasetsDraw(chart){
      const {ctx, chartArea, scales} = chart;
      if(!chartArea) return;
      segments.forEach(seg => {
        const color = bandColors[seg.empresa];
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
          pointBackgroundColor: labels.map((_, i) => _nominaColorFor(empresas[i])),
          pointBorderColor: labels.map((_, i) => _nominaColorFor(empresas[i])),
          pointStyle: labels.map((_, i) => irpfFlags[i] ? 'rectRot' : 'circle'),
          pointRadius: labels.map((_, i) => irpfFlags[i] ? 7 : 4),
          pointHoverRadius: 8,
          spanGaps: false,
          tension: 0.15,
          fill: false
        },
        {
          label: 'Promedio móvil 12m',
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
      plugins: {
        legend: { display: true },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctxPoint){
              const i = ctxPoint.dataIndex;
              if(ctxPoint.dataset.label.startsWith('Promedio')){
                return `Promedio 12m: ${formatEUR(ctxPoint.parsed.y)}`;
              }
              const emp = empresas[i];
              const irpfStr = irpfFlags[i] ? ' (incluye devolución IRPF)' : '';
              return `${emp || 'Sin nómina'}${irpfStr}: ${formatEUR(ctxPoint.parsed.y)}`;
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

