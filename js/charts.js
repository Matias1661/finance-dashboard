// Finance Dashboard - Charts Module

function formatEUR(v){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);
}

function getData(){
  if(typeof filteredData === 'function') return filteredData();
  if(window.filteredData) return window.filteredData();
  return (window.FINANCE_STATE?.raw || []);
}

function renderKPIs(){
  const data = getData();

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

  el.innerHTML = `
    <div class="card"><div class="card-title">Ingresos</div><div>${formatEUR(income)}</div></div>
    <div class="card"><div class="card-title">Gastos</div><div>${formatEUR(expense)}</div></div>
    <div class="card"><div class="card-title">Balance</div><div>${formatEUR(net)}</div></div>
  `;
}

function renderMonthly(){
  const data = getData();

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
        { label:'Ingresos', data: income },
        { label:'Gastos', data: expense }
      ]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:true}}
    }
  });
}

function renderDonut(){
  const data = getData();

  // Solo gastos (negativos), excluir Guille e Inversion ya filtrados por filteredData()
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

