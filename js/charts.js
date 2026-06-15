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
  const lastCapital = capital.length > 0 ? capital[capital.length - 1] : {};
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

  const ctx = document.getElementById('chart-monthly');
  if(!ctx) return;

  if(window.monthChart) window.monthChart.destroy();

  window.monthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Ingresos', data: income, backgroundColor: 'rgba(13,138,82,0.75)' },
        { label:'Gastos netos', data: expense, backgroundColor: 'rgba(201,74,48,0.75)' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
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

  // Promedio por año: excluir mes actual (incompleto) y meses con 0
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const yearGroups = {};
  months.forEach(m => {
    if(m === currentMonth) return; // mes en curso, datos incompletos
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
    return g && g.count > 0 ? parseFloat((g.sum / g.count).toFixed(2)) : null;
  });

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
        }
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
}





