// Finance Dashboard - App Orchestrator

const DATA_URL = 'finance_data.json';

let RAW = [];

function renderResumen(){
  if(typeof renderKPIs === 'function') renderKPIs();
  if(typeof renderMonthly === 'function') renderMonthly();
  if(typeof renderDonut === 'function') renderDonut();
}

function renderTransacciones(){
  const month = document.getElementById('tx-month-filter')?.value || '';
  const cat   = document.getElementById('tx-cat-filter')?.value || '';
  const tbody = document.getElementById('tx-body');
  if(!tbody) return;

  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  let data = (window.FINANCE_STATE?.raw || []).filter(r => !excluded.includes(r.categoria));

  if(month) data = data.filter(r => r.fecha.slice(0,7) === month);
  if(cat)   data = data.filter(r => r.categoria === cat);

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
  const totalSpent     = data.filter(r => Number(r.monto) < 0).reduce((s,r) => s + Math.abs(Number(r.monto)), 0);
  const balance        = totalDeposited - totalSpent;

  const kpisEl = document.getElementById('guille-kpis');
  if(kpisEl){
    const balColor = balance >= 0 ? 'var(--green)' : 'var(--red)';
    kpisEl.innerHTML = `
      <div class="card"><div class="card-title">Total depositado</div><div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--green)">${formatEUR(totalDeposited)}</div></div>
      <div class="card"><div class="card-title">Total gastado</div><div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--red)">${formatEUR(totalSpent)}</div></div>
      <div class="card"><div class="card-title">Saldo actual</div><div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:${balColor}">${formatEUR(balance)}</div></div>
    `;
  }

  // --- Gráfico: últimos 12 meses ---
  const allMonths = [...new Set(data.map(r => r.fecha.slice(0,7)))].sort();
  const last12    = allMonths.slice(-12);

  const monthMap = {};
  data.forEach(r => {
    const k = r.fecha.slice(0,7);
    if(!last12.includes(k)) return;
    if(!monthMap[k]) monthMap[k] = {dep:0, gas:0};
    const v = Number(r.monto);
    if(v > 0) monthMap[k].dep += v;
    else monthMap[k].gas += Math.abs(v);
  });

  // Saldo acumulado desde el inicio (todos los datos, no solo últimos 12)
  const allSorted = allMonths;
  const fullMap   = {};
  data.forEach(r => {
    const k = r.fecha.slice(0,7);
    if(!fullMap[k]) fullMap[k] = {dep:0, gas:0};
    const v = Number(r.monto);
    if(v > 0) fullMap[k].dep += v;
    else fullMap[k].gas += Math.abs(v);
  });

  let running = 0;
  const balanceByMonth = {};
  allSorted.forEach(k => {
    const m = fullMap[k] || {dep:0, gas:0};
    running += m.dep - m.gas;
    balanceByMonth[k] = running;
  });

  const labels    = last12;
  const depValues = labels.map(k => (monthMap[k]||{dep:0}).dep);
  const gasValues = labels.map(k => (monthMap[k]||{gas:0}).gas);
  const cumBalance = labels.map(k => balanceByMonth[k] || 0);

  const fmtEurK = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
  const tooltipDefaults = {
    backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.12)', borderWidth: 1,
    titleColor: '#1a1a18', bodyColor: '#6b6b63'
  };
  const xAxisDefaults = {
    grid: { display: false },
    ticks: { font: { size: 11 } }
  };

  // Gráfico 1: barras depositado / gastado
  const ctxGuille = document.getElementById('chart-guille-bars');
  if(ctxGuille){
    if(window.guilleChart) window.guilleChart.destroy();
    window.guilleChart = new Chart(ctxGuille, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Depositado',
            data: depValues,
            backgroundColor: 'rgba(13,138,82,0.75)',
            borderRadius: 3
          },
          {
            label: 'Gastado',
            data: gasValues,
            backgroundColor: 'rgba(201,74,48,0.75)',
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: { ...tooltipDefaults, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtEurK(ctx.parsed.y)}` } }
        },
        scales: {
          x: xAxisDefaults,
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: fmtEurK } }
        }
      }
    });
  }

  // Gráfico 2: saldo acumulado
  const ctxBal = document.getElementById('chart-guille-balance');
  if(ctxBal){
    if(window.guilleBalChart) window.guilleBalChart.destroy();
    window.guilleBalChart = new Chart(ctxBal, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo acumulado',
          data: cumBalance,
          borderColor: '#2563be',
          backgroundColor: 'rgba(37,99,190,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#2563be',
          pointBorderWidth: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: { ...tooltipDefaults, callbacks: { label: ctx => ` Saldo acumulado: ${fmtEurK(ctx.parsed.y)}` } }
        },
        scales: {
          x: xAxisDefaults,
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: fmtEurK } }
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

  // --- Tabla resumen por categoría ---
  const summaryEl = document.getElementById('cat-summary-body');
  if(summaryEl){
    const total = values.reduce((a,b) => a+b, 0);
    summaryEl.innerHTML = sorted.map(([cat, amt]) => {
      const pct   = total > 0 ? ((amt/total)*100).toFixed(1) : '0.0';
      const count = data.filter(r => r.categoria === cat && Number(r.monto) < 0).length;
      return `<tr>
        <td>${cat}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:13px">${count}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:var(--red)">${formatEUR(-amt)}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:var(--text-secondary)">${pct}%</td>
      </tr>`;
    }).join('');
  }

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


function renderInversiones(){
  const inv   = window.FINANCE_STATE?.inversiones || { capital: [], rendimiento: [] };
  const capital    = inv.capital    || [];
  const rendimento = inv.rendimiento || [];

  const fmt    = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
  const fmtPct = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

  // ── KPIs ──
  const latest      = capital[capital.length - 1] || {};
  const totalCapital = (latest.peerberry || 0) + (latest.myinvestor || 0);
  const miKpi        = latest.myinvestor || 0;
  const pbKpi        = latest.peerberry  || 0;

  const last2 = capital.slice(-2);
  const capitalActual   = last2.length >= 1 ? (last2[last2.length-1].peerberry + last2[last2.length-1].myinvestor) : 0;
  const capitalAnterior = last2.length >= 2 ? (last2[last2.length-2].peerberry + last2[last2.length-2].myinvestor) : 0;
  const incrementoMes   = capitalActual - capitalAnterior;

  const kpisEl = document.getElementById('inv-kpis');
  if(kpisEl){
    kpisEl.innerHTML = `
      <div class="card">
        <div class="card-title">Capital total</div>
        <div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--blue)">${fmt(totalCapital)}</div>
      </div>
      <div class="card">
        <div class="card-title">MyInvestor</div>
        <div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--green)">${fmt(miKpi)}</div>
      </div>
      <div class="card">
        <div class="card-title">Peerberry</div>
        <div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--amber)">${pbKpi > 0 ? fmt(pbKpi) : '—'}</div>
      </div>
      <div class="card">
        <div class="card-title">Incremento último mes</div>
        <div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:${incrementoMes >= 0 ? 'var(--green)' : 'var(--red)'}">${incrementoMes >= 0 ? '+' : ''}${fmt(incrementoMes)}</div>
      </div>
    `;
  }

  // ── Gráfico 1: capital apilado ──
  const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function formatMesLabel(isoMes) {
    const [y, m] = isoMes.split('-');
    return MESES_LARGO[parseInt(m,10)-1] + '-' + y;
  }

  // Rellenar meses sin datos con el ultimo valor conocido de cada plataforma
  // (ej: MyInvestor actualiza ~dia 10, Peerberry puede no tener entrada ese mes aun)
  function fillForward(capitalArr) {
    const filled = [];
    let lastPB = 0, lastMI = 0;
    for (const d of capitalArr) {
      lastPB = d.peerberry  > 0 ? d.peerberry  : lastPB;
      lastMI = d.myinvestor > 0 ? d.myinvestor : lastMI;
      filled.push({ mes: d.mes, peerberry: lastPB, myinvestor: lastMI });
    }
    return filled;
  }

  const capital13 = fillForward(capital).slice(-13);
  const capLabels = capital13.map(d => formatMesLabel(d.mes));
  const capPB     = capital13.map(d => d.peerberry);
  const capMI     = capital13.map(d => d.myinvestor);

  const ctxCap = document.getElementById('chart-inv-capital');
  if(ctxCap){
    if(window.invCapChart) window.invCapChart.destroy();
    window.invCapChart = new Chart(ctxCap, {
      type: 'bar',
      data: {
        labels: capLabels,
        datasets: [
          {
            label: 'Peerberry',
            data: capPB,
            backgroundColor: 'rgba(154,98,0,0.75)',
            borderRadius: 3,
            stack: 'capital'
          },
          {
            label: 'MyInvestor',
            data: capMI,
            backgroundColor: 'rgba(13,138,82,0.75)',
            borderRadius: 3,
            stack: 'capital'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: {
            backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.12)', borderWidth: 1,
            titleColor: '#1a1a18', bodyColor: '#6b6b63',
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
              footer: items => ` Total: ${fmt(items.reduce((s,i) => s + i.parsed.y, 0))}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            stacked: true, beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 }, callback: v => fmt(v) }
          }
        }
      }
    });
  }

  // ── Gráfico 2: rendimiento % ──
  const rend13    = rendimento.slice(-13);
  const pctLabels = rend13.map(d => formatMesLabel(d.mes));
  const pctPB     = rend13.map(d => d.peerberry);
  const pctMI     = rend13.map(d => d.myinvestor);

  const ctxPct = document.getElementById('chart-inv-pct');
  if(ctxPct){
    if(window.invPctChart) window.invPctChart.destroy();
    window.invPctChart = new Chart(ctxPct, {
      type: 'bar',
      data: {
        labels: pctLabels,
        datasets: [
          {
            label: 'Peerberry %',
            data: pctPB,
            backgroundColor: pctPB.map(v => v >= 0 ? 'rgba(154,98,0,0.75)' : 'rgba(154,98,0,0.35)'),
            borderRadius: 3
          },
          {
            label: 'MyInvestor %',
            data: pctMI,
            backgroundColor: pctMI.map(v => v >= 0 ? 'rgba(13,138,82,0.75)' : 'rgba(201,74,48,0.75)'),
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: {
            backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.12)', borderWidth: 1,
            titleColor: '#1a1a18', bodyColor: '#6b6b63',
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 }, callback: v => fmtPct(v) }
          }
        }
      }
    });
  }
}

function switchTab(tab, el){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  if(panel) panel.classList.add('active');

  if(el) el.classList.add('active');

  if(tab === 'categorias')   { populateCatMonthSelector(); renderCategorias(); }
  if(tab === 'transacciones') renderTransacciones();
  if(tab === 'guille')        renderGuille();
  if(tab === 'inversiones')   renderInversiones();
}

function populateTxMonthSelector(){
  const sel = document.getElementById('tx-month-filter');
  if(!sel) return;
  const months = [...new Set(RAW.map(r => r.fecha.slice(0,7)))].sort().reverse();
  sel.innerHTML = `<option value="">Todos los meses</option>` +
    months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function populateTxCatSelector(){
  const sel = document.getElementById('tx-cat-filter');
  if(!sel) return;
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  const cats = [...new Set(RAW.filter(r => !excluded.includes(r.categoria)).map(r => r.categoria))].sort();
  sel.innerHTML = `<option value="">Todas las categorías</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
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

  // finance_data.json puede ser array plano (legado) o { movimientos, inversiones }
  const rawData = RAW;
  if(Array.isArray(rawData)){
    // formato legado
    RAW = rawData;
  } else {
    RAW = rawData.movimientos || [];
    if(window.FINANCE_STATE){
      window.FINANCE_STATE.inversiones = rawData.inversiones || { capital: [], rendimiento: [] };
    }
  }
  if(window.FINANCE_STATE){
    window.FINANCE_STATE.raw = RAW;
  }

  // Fill last-updated header
  const lastEl = document.getElementById('last-updated');
  if(lastEl && RAW.length > 0){
    const latest = RAW.map(r => r.fecha).sort().reverse()[0];
    lastEl.textContent = 'Actualizado: ' + latest;
  }

  if(typeof populateMonthSelector === 'function') populateMonthSelector(RAW);
  populateTxMonthSelector();
  populateTxCatSelector();
  populateGuilleMonthSelector();
  populateCatMonthSelector();

  document.getElementById('app').style.display='block';
  document.getElementById('loading').style.display='none';

  renderResumen();
}

window.addEventListener('DOMContentLoaded', init);

