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