// Finance Dashboard - App Orchestrator

const DATA_URL = 'finance_data.json';

let RAW = [];

function formatEUR(v){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);
}

function renderResumen(){
  if(typeof renderKPIs === 'function') renderKPIs();
  if(typeof renderMonthly === 'function') renderMonthly();
  if(typeof renderDonut === 'function') renderDonut();
}

function renderTransacciones(){
  const month = document.getElementById('tx-month-filter')?.value || '';
  const tbody = document.getElementById('tx-body');
  if(!tbody) return;

  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  let data = (window.FINANCE_STATE?.raw || []).filter(r => !excluded.includes(r.categoria));

  if(month) data = data.filter(r => r.fecha.slice(0,7) === month);

  data = data.sort((a,b) => b.fecha.localeCompare(a.fecha));

  if(data.length === 0){
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:24px">Sin transacciones</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(r => {
    const v = Number(r.monto);
    const color = v >= 0 ? 'var(--green)' : 'var(--red)';
    return `<tr>
      <td style="font-family:'DM Mono';font-size:13px">${r.fecha}</td>
      <td>${r.concepto}</td>
      <td><span class="cat-badge">${r.categoria || '—'}</span></td>
      <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:${color}">${formatEUR(v)}</td>
    </tr>`;
  }).join('');
}

function renderGuille(){
  const raw = window.FINANCE_STATE?.raw || [];
  const month = document.getElementById('guille-month-filter')?.value || '';

  // Todos los movimientos Guille
  let data = raw.filter(r => r.categoria === 'Guille');

  // --- KPIs (siempre sobre todos los datos, sin filtro de mes) ---
  const totalDeposited = data.filter(r => Number(r.monto) > 0).reduce((s,r) => s + Number(r.monto), 0);
  const totalSpent    = data.filter(r => Number(r.monto) < 0).reduce((s,r) => s + Math.abs(Number(r.monto)), 0);
  const balance       = totalDeposited - totalSpent;

  const kpisEl = document.getElementById('guille-kpis');
  if(kpisEl){
    const balColor = balance >= 0 ? 'var(--green)' : 'var(--red)';
    kpisEl.innerHTML = `
      <div class="card"><div class="card-title">Total depositado</div><div style="font-size:22px;font-weight:600;color:var(--green)">${formatEUR(totalDeposited)}</div></div>
      <div class="card"><div class="card-title">Total gastado</div><div style="font-size:22px;font-weight:600;color:var(--red)">${formatEUR(totalSpent)}</div></div>
      <div class="card"><div class="card-title">Saldo actual</div><div style="font-size:22px;font-weight:600;color:${balColor}">${formatEUR(balance)}</div></div>
    `;
  }

  // --- Gráfico barras: depositado vs gastado por mes (todos los datos) ---
  const monthMap = {};
  data.forEach(r => {
    const k = r.fecha.slice(0,7);
    if(!monthMap[k]) monthMap[k] = {dep:0, gas:0};
    const v = Number(r.monto);
    if(v > 0) monthMap[k].dep += v;
    else monthMap[k].gas += Math.abs(v);
  });

  const labels = Object.keys(monthMap).sort();
  const depValues = labels.map(k => monthMap[k].dep);
  const gasValues = labels.map(k => monthMap[k].gas);

  let running = 0;
  const cumBalance = labels.map(k => {
    running += monthMap[k].dep - monthMap[k].gas;
    return running;
  });

  const ctxGuille = document.getElementById('chart-guille-bars');
  if(ctxGuille){
    if(window.guilleChart) window.guilleChart.destroy();
    window.guilleChart = new Chart(ctxGuille, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar',  label:'Depositado',     data: depValues,  backgroundColor:'rgba(13,138,82,0.75)', yAxisID: 'y', order: 2 },
          { type: 'bar',  label:'Gastado',         data: gasValues,  backgroundColor:'rgba(201,74,48,0.75)', yAxisID: 'y', order: 2 },
          { type: 'line', label:'Saldo acumulado', data: cumBalance,
            yAxisID: 'y', order: 1,
            borderColor: '#2563be',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#2563be',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          y: { beginAtZero: true, grid: { drawOnChartArea: true } }
        }
      }
    });
  }

  // --- Tabla: filtrable por mes ---
  let tableData = data;
  if(month) tableData = tableData.filter(r => r.fecha.slice(0,7) === month);
  tableData = tableData.sort((a,b) => b.fecha.localeCompare(a.fecha));

  const tbody = document.getElementById('guille-tx-body');
  if(tbody){
    if(tableData.length === 0){
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);padding:24px">Sin movimientos</td></tr>';
    } else {
      tbody.innerHTML = tableData.map(r => {
        const v = Number(r.monto);
        const color = v >= 0 ? 'var(--green)' : 'var(--red)';
        return `<tr>
          <td style="font-family:'DM Mono';font-size:13px">${r.fecha}</td>
          <td>${r.concepto}</td>
          <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:${color}">${formatEUR(v)}</td>
        </tr>`;
      }).join('');
    }
  }
}

function renderCategorias(){
  const month = document.getElementById('cat-month-filter')?.value || '';
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  let data = (window.FINANCE_STATE?.raw || []).filter(r => !excluded.includes(r.categoria));

  if(month) data = data.filter(r => r.fecha.slice(0,7) === month);

  // Only expenses
  const map = {};
  data.forEach(r => {
    const v = Number(r.monto);
    if(v >= 0) return;
    const cat = r.categoria || 'Sin categoría';
    map[cat] = (map[cat] || 0) + Math.abs(v);
  });

  const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  const colors = [
    'rgba(37,99,190,0.75)','rgba(13,138,82,0.75)','rgba(201,74,48,0.75)',
    'rgba(154,98,0,0.75)','rgba(107,107,99,0.75)','rgba(79,70,229,0.75)',
    'rgba(6,148,162,0.75)','rgba(180,83,9,0.75)','rgba(5,122,85,0.75)',
    'rgba(157,23,77,0.75)','rgba(17,94,89,0.75)','rgba(67,56,202,0.75)',
    'rgba(146,64,14,0.75)','rgba(3,105,161,0.75)','rgba(88,28,135,0.75)',
    'rgba(21,128,61,0.75)','rgba(185,28,28,0.75)','rgba(30,64,175,0.75)'
  ];

  const ctx = document.getElementById('chart-categorias');
  if(!ctx) return;

  if(window.categoriasChart) window.categoriasChart.destroy();

  window.categoriasChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_,i) => colors[i % colors.length]),
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(ctx.parsed.x)
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
          }
        },
        y: { grid: { display: false } }
      }
    }
  });

  // --- Tabla de transacciones ---
  const expenses = data.filter(r => Number(r.monto) < 0)
    .sort((a,b) => b.fecha.localeCompare(a.fecha));

  const tbody = document.getElementById('cat-tx-body');
  if(tbody){
    if(expenses.length === 0){
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:24px">Sin transacciones</td></tr>';
    } else {
      tbody.innerHTML = expenses.map(r => {
        const v = Number(r.monto);
        return `<tr>
          <td style="font-family:'DM Mono';font-size:13px">${r.fecha}</td>
          <td>${r.concepto}</td>
          <td><span class="cat-badge">${r.categoria || '—'}</span></td>
          <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:var(--red)">${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v)}</td>
        </tr>`;
      }).join('');
    }
  }
}

function switchTab(tab, el){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  if(panel) panel.classList.add('active');

  if(el) el.classList.add('active');

  if(tab === 'categorias') { populateCatMonthSelector(); renderCategorias(); }
  if(tab === 'transacciones') renderTransacciones();
  if(tab === 'guille') renderGuille();
}

function populateTxMonthSelector(){
  const sel = document.getElementById('tx-month-filter');
  if(!sel) return;
  const months = [...new Set(RAW.map(r => r.fecha.slice(0,7)))].sort().reverse();
  sel.innerHTML = `<option value="">Todos los meses</option>` +
    months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function populateCatMonthSelector(){
  const sel = document.getElementById('cat-month-filter');
  if(!sel) return;
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  const data = (window.FINANCE_STATE?.raw || []).filter(r => !excluded.includes(r.categoria));
  const months = [...new Set(data.map(r => r.fecha.slice(0,7)))].sort().reverse();
  sel.innerHTML = `<option value="">Todos los meses</option>` +
    months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function populateGuilleMonthSelector(){
  const sel = document.getElementById('guille-month-filter');
  if(!sel) return;
  const guilleData = RAW.filter(r => r.categoria === 'Guille');
  const months = [...new Set(guilleData.map(r => r.fecha.slice(0,7)))].sort().reverse();
  sel.innerHTML = `<option value="">Todos los meses</option>` +
    months.map(m => `<option value="${m}">${m}</option>`).join('');
}

async function init(){
  const res = await fetch(DATA_URL);
  RAW = await res.json();

  if(window.FINANCE_STATE){
    window.FINANCE_STATE.raw = RAW;
  }

  if(typeof populateMonthSelector === 'function') populateMonthSelector(RAW);
  populateTxMonthSelector();
  populateGuilleMonthSelector();
  populateCatMonthSelector();

  document.getElementById('app').style.display='block';
  document.getElementById('loading').style.display='none';

  renderResumen();
}

window.addEventListener('DOMContentLoaded', init);





