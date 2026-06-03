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

function renderKPIs(){
  const data = getLast12MonthsData();

  let income = 0;
  let expense = 0;

  data.forEach(r => {
    const val = Number(r.monto);
    if(val >= 0) income += val;
    else expense += val;
  });

  const net = income + expense;

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
    <div class="card"><div class="card-title">Gastos</div><div style="font-size:22px;font-weight:600;color:var(--red)">${formatEUR(Math.abs(expense))}</div></div>
    <div class="card"><div class="card-title">Balance</div><div style="font-size:22px;font-weight:600;color:${netColor}">${formatEUR(net)}</div></div>
    <div class="card"><div class="card-title">Tasa de ahorro</div><div style="font-size:22px;font-weight:600;color:${netColor}">${income > 0 ? ((net/income)*100).toFixed(1) : '0.0'}%</div></div>
  `;
}

function renderMonthly(){
  const data = getLast12MonthsData();

  const map = {};

  data.forEach(r => {
    const key = r.fecha.slice(0,7);
    if(!map[key]) map[key] = {income:0, expense:0};

    const v = Number(r.monto);
    if(v >= 0) map[key].income += v;
    else map[key].expense += v;
  });

  const labels = Object.keys(map).sort();
  const income = labels.map(k => map[k].income);
  const expense = labels.map(k => Math.abs(map[k].expense));

  const ctx = document.getElementById('chart-monthly');
  if(!ctx) return;

  if(window.monthChart) window.monthChart.destroy();

  window.monthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Ingresos', data: income, backgroundColor: 'rgba(13,138,82,0.75)' },
        { label:'Gastos', data: expense, backgroundColor: 'rgba(201,74,48,0.75)' }
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

  const map = {};
  data.forEach(r => {
    const v = Number(r.monto);
    if(v >= 0) return;
    const cat = r.categoria || 'Sin categoría';
    map[cat] = (map[cat] || 0) + Math.abs(v);
  });

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


