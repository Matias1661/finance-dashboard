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
    <div class="card"><div class="card-title">Balance</div><div style="font-size:22px;font-weight:600;color:${netColor}">${formatEUR(net)}</div></div>
    <div class="card"><div class="card-title">Tasa de ahorro</div><div style="font-size:22px;font-weight:600;color:${netColor}">${income > 0 ? ((net/income)*100).toFixed(1) : '0.0'}%</div></div>
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

function renderDonut(){
  const data = getData();
  const map = netExpenseByCategory(data);

  const labels = Object.keys(map).sort((a,b) => map[b] - map[a]);
  const values = labels.map(k => map[k]);

  const ctx = document.getElementById('chart-donut');
  if(!ctx) return;

  if(window.donutChart) window.donutChart.destroy();

  window.donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${formatEUR(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
