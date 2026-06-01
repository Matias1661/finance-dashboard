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
      data: {
        labels,
        datasets: [
          { type: 'bar',  label:'Depositado',      data: depValues,   backgroundColor:'rgba(13,138,82,0.75)', yAxisID: 'y',  order: 2 },
          { type: 'bar',  label:'Gastado',          data: gasValues,   backgroundColor:'rgba(201,74,48,0.75)', yAxisID: 'y',  order: 2 },
          { type: 'line', label:'Saldo acumulado',  data: cumBalance,
            yAxisID: 'y2', order: 1,
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
          y: {
            beginAtZero: true,
            position: 'left',
            grid: { drawOnChartArea: true }
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false }
          }
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

function switchTab(tab, el){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  if(panel) panel.classList.add('active');

  if(el) el.classList.add('active');

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

  document.getElementById('app').style.display='block';
  document.getElementById('loading').style.display='none';

  renderResumen();
}

window.addEventListener('DOMContentLoaded', init);

