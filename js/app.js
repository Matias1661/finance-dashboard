// Finance Dashboard - App Orchestrator

const DATA_URL = 'finance_data.json';

let RAW = [];

// Categoría activa en el tab Categorías (null = todas)
let activeCatBarFilter = null;

function renderResumen(){
  if(typeof renderKPIs === 'function') renderKPIs();
  if(typeof renderInsights === 'function') renderInsights();
  if(typeof renderMonthly === 'function') renderMonthly();
  if(typeof renderNominaTrend === 'function') renderNominaTrend();
  if(typeof renderSuscripciones === 'function') renderSuscripciones();
  if(typeof renderCategoryTrend === 'function') renderCategoryTrend();
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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:24px">Sin transacciones</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(r => {
    const v = Number(r.monto);
    const color = v >= 0 ? 'var(--green)' : 'var(--red)';
    return `<tr>
      <td style="font-family:'DM Mono';font-size:13px">${r.fecha}</td>
      <td>${r.concepto}</td>
      <td style="color:var(--text-secondary);font-size:13px">${r.nota || ''}</td>
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


// ── Viajes ────────────────────────────────────────────────────────────────────

const TRIP_WINDOWS = [
  { name: 'Gijón',                    start: '2025-07-06', end: '2025-07-11' },
  { name: 'Spain Run',                start: '2025-09-12', end: '2025-09-14' },
  { name: 'Hotel Natursun',           start: '2025-10-25', end: '2025-10-26' },
  { name: 'Bagger Racing',            start: '2025-11-07', end: '2025-11-09' },
  { name: 'Toledo',                   start: '2025-12-08', end: '2025-12-14' },
  { name: 'Alojamiento en Francia',   start: '2026-03-25', end: '2026-03-29' },
  { name: '45 Aniversario París',     start: '2026-04-18', end: '2026-04-18' },
  { name: 'Málaga',                   start: '2026-05-01', end: '2026-05-03' },
  { name: 'Viaje a Portugal',         start: '2026-05-08', end: '2026-05-11' },
];

function tripSubcategory(concepto) {
  const c = (concepto || '').toLowerCase();
  if (/repsol|shell|esso|moeve|sanse|ballenoil|p\.serv|certif|galp/.test(c)) return 'Combustible';
  if (/autopista|bidegi|cofiroute|atlandes|autoroutes|ap-/.test(c))           return 'Peajes';
  if (/hotel|airbnb|hostal|apartamento|booking/.test(c))                      return 'Alojamiento';
  if (/iberia|vueling|ryanair|renfe|ouigo|blabla|uber|parking/.test(c))       return 'Transporte';
  return 'Comida y otros';
}

function getTripForDate(fecha) {
  const CARD_BUFFER_DAYS = 3;
  return TRIP_WINDOWS.find(t => {
    if (fecha < t.start) return false;
    // Extend end by CARD_BUFFER_DAYS to catch delayed card charges
    const endDt = new Date(t.end);
    endDt.setDate(endDt.getDate() + CARD_BUFFER_DAYS);
    const endBuffered = endDt.toISOString().slice(0, 10);
    return fecha <= endBuffered;
  }) || null;
}

function renderTripBreakdown(data) {
  const container = document.getElementById('trip-breakdown');
  if (!container) return;

  // Solo movimientos de Viajes con monto negativo
  const viajes = data.filter(r => r.categoria === 'Viajes' && Number(r.monto) < 0);

  // Agrupar por viaje
  const byTrip = {};
  TRIP_WINDOWS.forEach(t => { byTrip[t.name] = { trip: t, movs: [] }; });

  viajes.forEach(r => {
    const trip = getTripForDate(r.fecha);
    if (trip) byTrip[trip.name].movs.push(r);
  });

  // Filtrar viajes sin movimientos en el período
  const activeTrips = TRIP_WINDOWS.filter(t => byTrip[t.name].movs.length > 0);

  if (activeTrips.length === 0) {
    container.innerHTML = '';
    return;
  }

  const fmtEUR = v => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

  container.innerHTML = activeTrips.map(t => {
    const movs = byTrip[t.name].movs.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const total = movs.reduce((s, r) => s + Math.abs(Number(r.monto)), 0);

    // Subcategorías
    const subcats = {};
    movs.forEach(r => {
      const sub = tripSubcategory(r.concepto);
      subcats[sub] = (subcats[sub] || 0) + Math.abs(Number(r.monto));
    });
    const subcatRows = Object.entries(subcats)
      .sort((a, b) => b[1] - a[1])
      .map(([sub, amt]) => `
        <tr>
          <td style="color:var(--text-secondary);font-size:13px">${sub}</td>
          <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:var(--red)">${fmtEUR(-amt)}</td>
        </tr>`).join('');

    // Transacciones individuales (colapsables)
    const txRows = movs.map(r => {
      const v = Number(r.monto);
      return `<tr>
        <td style="font-family:'DM Mono';font-size:12px;color:var(--text-secondary)">${r.fecha}</td>
        <td style="font-size:12px">${r.concepto}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:12px;color:${v >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtEUR(v)}</td>
      </tr>`;
    }).join('');

    const tripId = t.name.replace(/[^a-z0-9]/gi, '_');

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-weight:600;font-size:15px">${t.name}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;font-family:'DM Mono'">${t.start} → ${t.end}</div>
          </div>
          <div style="font-size:18px;font-weight:600;color:var(--red)">${fmtEUR(-total)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
          <tbody>${subcatRows}</tbody>
        </table>
        <button
          onclick="document.getElementById('trip-tx-${tripId}').style.display = document.getElementById('trip-tx-${tripId}').style.display === 'none' ? '' : 'none'"
          style="font-size:12px;padding:3px 12px;border:1px solid rgba(0,0,0,0.15);border-radius:6px;background:#fff;cursor:pointer;color:var(--text-secondary)">
          Ver ${movs.length} transacciones
        </button>
        <div id="trip-tx-${tripId}" style="display:none;margin-top:10px">
          <table style="width:100%;border-collapse:collapse">
            <tbody>${txRows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

function renderCatTxTable(data, selectedCat, month){
  // Render transaction table for categorias tab
  // data: all expenses (already filtered by month and excluded categories)
  // selectedCat: category to filter on, or null for all
  const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];
  // Si la categoría seleccionada es reembolsable, mostrar también los ingresos (reembolsos)
  const isReimbursableCat = selectedCat && reimbursable.includes(selectedCat);
  const expenses = data.filter(r => Number(r.monto) < 0 || (isReimbursableCat && Number(r.monto) > 0));
  const filtered = selectedCat ? expenses.filter(r => r.categoria === selectedCat) : expenses;
  const sorted   = filtered.sort((a,b) => b.fecha.localeCompare(a.fecha));

  // Header label
  const headerEl = document.getElementById('cat-tx-header');
  if(headerEl){
    if(selectedCat){
      headerEl.innerHTML = `
        <span style="font-weight:600">${selectedCat}</span>
        <span style="color:var(--text-secondary);font-size:13px;margin-left:8px">${sorted.length} movimiento${sorted.length !== 1 ? 's' : ''}</span>
        <button onclick="clearCatBarFilter()" style="margin-left:12px;font-size:12px;padding:2px 10px;border:1px solid rgba(0,0,0,0.15);border-radius:6px;background:#fff;cursor:pointer;color:var(--text-secondary)">Ver todas</button>
      `;
    } else {
      headerEl.innerHTML = `Transacciones <span style="color:var(--text-secondary);font-size:13px;margin-left:6px">${sorted.length} movimientos</span>`;
    }
  }

  const tbody = document.getElementById('cat-tx-body');
  if(!tbody) return;

  if(sorted.length === 0){
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:24px">Sin transacciones</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(r => {
    const v = Number(r.monto);
    return `<tr>
      <td style="font-family:'DM Mono';font-size:13px">${r.fecha}</td>
      <td>${r.concepto}</td>
      <td style="color:var(--text-secondary);font-size:13px">${r.nota || ''}</td>
      <td><span class="cat-badge">${r.categoria || '—'}</span></td>
      <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:${v >= 0 ? 'var(--green)' : 'var(--red)'}">${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v)}</td>
    </tr>`;
  }).join('');
}

function clearCatBarFilter(){
  activeCatBarFilter = null;
  // Re-use existing month filter
  const month = document.getElementById('cat-month-filter')?.value || '';
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  let data = (window.FINANCE_STATE?.raw || []).filter(r => !excluded.includes(r.categoria));
  if(month) data = data.filter(r => r.fecha.slice(0,7) === month);
  renderCatTxTable(data, null, month);
}

function renderCategorias(){
  const month = document.getElementById('cat-month-filter')?.value || '';
  const excluded = window.FINANCE_STATE?.excludedCategories || [];
  let data = (window.FINANCE_STATE?.raw || []).filter(r => !excluded.includes(r.categoria));

  if(month) data = data.filter(r => r.fecha.slice(0,7) === month);

  // Gasto neto por categoría (reembolsos restan en categorías reembolsables)
  const map = netExpenseByCategory(data);

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

  // Active index for highlight
  const activeIdx = activeCatBarFilter ? labels.indexOf(activeCatBarFilter) : -1;

  const ctx = document.getElementById('chart-categorias');
  if(!ctx) return;

  // Rombo por categoría: promedio de gastos hasta el día de la última transacción
  const _lastTxCat = window.FINANCE_STATE?.lastTxDate ? new Date(window.FINANCE_STATE.lastTxDate + 'T00:00:00') : new Date();
  const now = _lastTxCat;
  const currentDay = now.getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const isCurrentMonth = !month || month === currentMonthKey;

  let diamondByCategory = {};
  if(isCurrentMonth){
    const rawAll = window.FINANCE_STATE?.raw || [];
    const reimbursable = window.FINANCE_STATE?.reimbursableCategories || [];
    for(let i = 1; i <= 3; i++){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth()+1).padStart(2,'0');
      const monthPrefix = `${yr}-${mo}-`;
      rawAll.forEach(r => {
        if(excluded.includes(r.categoria)) return;
        if(!r.fecha || !r.fecha.startsWith(monthPrefix)) return;
        const day = parseInt(r.fecha.slice(8,10), 10);
        if(day > currentDay) return;
        const v = Number(r.monto);
        const cat = r.categoria || 'Sin categoría';
        if(v < 0){
          if(!diamondByCategory[cat]) diamondByCategory[cat] = {gross:0, refund:0, count:0};
          diamondByCategory[cat].gross += Math.abs(v);
          diamondByCategory[cat].count++;
        } else if(reimbursable.includes(r.categoria)){
          if(!diamondByCategory[cat]) diamondByCategory[cat] = {gross:0, refund:0, count:0};
          diamondByCategory[cat].refund += v;
        }
      });
    }
    // Promediar dividiendo por 3
    Object.keys(diamondByCategory).forEach(cat => {
      const {gross, refund} = diamondByCategory[cat];
      diamondByCategory[cat] = Math.max(0, (gross - refund) / 3);
    });
  }

  const diamondDataset = isCurrentMonth ? {
    label: `Promedio últimos 3 meses (día ${currentDay})`,
    type: 'scatter',
    data: labels.map((cat, i) => diamondByCategory[cat] != null ? {y: cat, x: diamondByCategory[cat]} : null).filter(Boolean),
    pointStyle: 'rectRot',
    pointRadius: 7,
    pointHoverRadius: 9,
    backgroundColor: 'rgba(154,98,0,1)',
    borderColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    order: 0
  } : null;

  if(window.categoriasChart) window.categoriasChart.destroy();

  window.categoriasChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Gasto mes actual',
          data: values,
          backgroundColor: labels.map((_, i) => {
            const base = colors[i % colors.length];
            if(activeIdx >= 0 && i !== activeIdx){
              return base.replace(/[\d.]+\)$/, '0.25)');
            }
            return base;
          }),
          borderWidth: labels.map((_, i) => (i === activeIdx ? 2 : 0)),
          borderColor: labels.map((_, i) => (i === activeIdx ? colors[i % colors.length].replace(/[\d.]+\)$/, '1)') : 'transparent')),
          borderRadius: 4
        },
        ...(diamondDataset ? [diamondDataset] : [])
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: {
          display: isCurrentMonth,
          labels: {
            filter: item => item.datasetIndex !== 0
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx){
              if(ctx.dataset.label && ctx.dataset.label.startsWith('Promedio')){
                return ` Promedio día ${currentDay}: ` + new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(ctx.parsed.x);
              }
              return ' ' + new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(ctx.parsed.x);
            }
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
        y: { type: 'category', grid: { display: false } }
      },
      onClick: (event, elements) => {
        if(!elements || elements.length === 0){
          // Click on empty area — clear filter
          activeCatBarFilter = null;
          renderCategorias();
          return;
        }
        const idx = elements[0].index;
        const clickedCat = labels[idx];
        // Toggle: clicking the same bar again clears the filter
        if(activeCatBarFilter === clickedCat){
          activeCatBarFilter = null;
        } else {
          activeCatBarFilter = clickedCat;
        }
        renderCategorias();
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
      const isActive = activeCatBarFilter === cat;
      return `<tr style="${isActive ? 'background:rgba(37,99,190,0.06);' : ''}" onclick="activeCatBarFilter='${cat}';renderCategorias();" style="cursor:pointer">
        <td style="cursor:pointer">${cat}${isActive ? ' <span style=\'color:var(--blue);font-size:11px\'>▶</span>' : ''}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:13px">${count}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:var(--red)">${formatEUR(-amt)}</td>
        <td style="text-align:right;font-family:'DM Mono';font-size:13px;color:var(--text-secondary)">${pct}%</td>
      </tr>`;
    }).join('');
  }

  // --- Tabla de transacciones ---
  renderCatTxTable(data, activeCatBarFilter, month);

  // --- Vista ampliada de Viajes ---
  const tripSection = document.getElementById('trip-breakdown');
  if (tripSection) {
    if (activeCatBarFilter === 'Viajes') {
      tripSection.style.display = '';
      renderTripBreakdown(data);
    } else {
      tripSection.style.display = 'none';
      tripSection.innerHTML = '';
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
  // Aplicar fill-forward antes de calcular KPIs para evitar que meses sin dato
  // (valor 0) distorsionen el incremento respecto al mes anterior
  const capitalFilled = fillForwardCapital(capital);

  const latest      = capitalFilled[capitalFilled.length - 1] || {};
  const totalCapital = (latest.peerberry || 0) + (latest.myinvestor || 0);
  const miKpi        = latest.myinvestor || 0;
  const pbKpi        = latest.peerberry  || 0;

  const last3 = capitalFilled.slice(-3);
  const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function labelMes(isoMes) {
    if(!isoMes) return '—';
    const [,m] = isoMes.split('-');
    return MESES_ES[parseInt(m,10)-1];
  }
  // Incremento mes-2 → mes-1
  const inc1From  = last3.length >= 3 ? ((last3[0].peerberry||0) + (last3[0].myinvestor||0)) : null;
  const inc1To    = last3.length >= 3 ? ((last3[1].peerberry||0) + (last3[1].myinvestor||0)) : null;
  const inc1Label = last3.length >= 3 ? `${labelMes(last3[0].mes)} → ${labelMes(last3[1].mes)}` : '—';
  const inc1Val   = (inc1From !== null && inc1To !== null) ? (inc1To - inc1From) : null;
  // Incremento mes-1 → mes actual
  const inc2From  = last3.length >= 2 ? ((last3[last3.length-2].peerberry||0) + (last3[last3.length-2].myinvestor||0)) : null;
  const inc2To    = last3.length >= 2 ? ((last3[last3.length-1].peerberry||0) + (last3[last3.length-1].myinvestor||0)) : null;
  const inc2Label = last3.length >= 2 ? `${labelMes(last3[last3.length-2].mes)} → ${labelMes(last3[last3.length-1].mes)}` : '—';
  const inc2Val   = (inc2From !== null && inc2To !== null) ? (inc2To - inc2From) : null;

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
        <div class="card-title">Incrementos</div>
        <div style="margin-top:6px;font-size:13px;color:var(--text-secondary)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span>${inc1Label}</span>
            <span style="font-family:'DM Mono';font-weight:600;color:${inc1Val !== null ? (inc1Val >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-secondary)'}">${inc1Val !== null ? (inc1Val >= 0 ? '+' : '') + fmt(inc1Val) : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span>${inc2Label}</span>
            <span style="font-family:'DM Mono';font-weight:600;color:${inc2Val !== null ? (inc2Val >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-secondary)'}">${inc2Val !== null ? (inc2Val >= 0 ? '+' : '') + fmt(inc2Val) : '—'}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Gráfico 1: capital apilado ──
  const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function formatMesLabel(isoMes) {
    const [y, m] = isoMes.split('-');
    return MESES_LARGO[parseInt(m,10)-1] + '-' + y;
  }

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

  const now = new Date();
  const currentMes = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const capital13 = fillForward(capital).filter(d => d.mes >= '2025-01' && d.mes <= currentMes);
  const capLabels = capital13.map(d => formatMesLabel(d.mes));
  const capPB     = capital13.map(d => d.peerberry);
  const capMI     = capital13.map(d => d.myinvestor);

  const capTotal = capital13.map((_, i) => (capPB[i] || 0) + (capMI[i] || 0));

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
            stack: 'capital',
            order: 2
          },
          {
            label: 'MyInvestor',
            data: capMI,
            backgroundColor: 'rgba(13,138,82,0.75)',
            borderRadius: 3,
            stack: 'capital',
            order: 2
          },
          {
            label: 'Total',
            data: capTotal,
            type: 'line',
            borderColor: 'rgba(37,99,190,0.85)',
            backgroundColor: 'rgba(37,99,190,0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: 'rgba(37,99,190,0.9)',
            fill: false,
            tension: 0.3,
            yAxisID: 'y',
            order: 1
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

  renderInvAportesRetiros();
  renderInvRendimiento();
  renderInvBenchmark();
  renderInvAcumuladoAnual();
}

// Auditoria 2026-07, fila 7. La categoria "Inversion" mezcla depositos y
// retiros (liquidacion parcial de Peerberry): el neto no sirve como medida
// de ahorro. Convencion (decidida con el usuario): monto negativo = aporte,
// monto positivo = retiro. Se reportan ambos por separado, nunca el neto.
function renderInvAportesRetiros(){
  const el = document.getElementById('inv-aportes-retiros');
  if(!el) return;

  const fmt = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
  const invMovs = (window.FINANCE_STATE?.raw || []).filter(r => r.categoria === 'Inversion');

  const now = new Date();
  const currentMes = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const hace12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const desde12 = hace12.getFullYear() + '-' + String(hace12.getMonth()+1).padStart(2,'0');

  function splitAportesRetiros(movs){
    let aportes = 0, retiros = 0;
    movs.forEach(r => {
      const v = Number(r.monto);
      if (v < 0) aportes += Math.abs(v);
      else if (v > 0) retiros += v;
    });
    return { aportes, retiros };
  }

  const mesActual = splitAportesRetiros(invMovs.filter(r => r.fecha.slice(0,7) === currentMes));
  const ult12     = splitAportesRetiros(invMovs.filter(r => r.fecha.slice(0,7) >= desde12));

  function fila(label, aportes, retiros){
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06)">
        <span style="font-size:13px;color:var(--text-secondary)">${label}</span>
        <span style="font-family:'DM Mono';font-size:13px">
          <span style="color:var(--green)">Aportes ${fmt(aportes)}</span>
          &nbsp;·&nbsp;
          <span style="color:var(--red)">Retiros ${fmt(retiros)}</span>
        </span>
      </div>`;
  }

  el.innerHTML = `
    ${fila('Este mes', mesActual.aportes, mesActual.retiros)}
    ${fila('Últimos 12 meses', ult12.aportes, ult12.retiros)}
    <div style="font-size:11px;color:var(--text-secondary);margin-top:8px">
      Aportes = movimientos con monto negativo (depósito a Peerberry/MyInvestor). Retiros = movimientos con monto positivo (liquidación parcial). El neto no se usa como indicador de ahorro.
    </div>
  `;
}

// ── Gráfico entre 2 y 3: acumulado de la cartera vs benchmark (MSCI World, IWDA.AS) desde enero-25 ──
// Auditoria 2026-07, fila 8. Base fija en enero 2025 (no se mueve con filtros del dashboard).
function renderInvBenchmark(){
  const inv = window.FINANCE_STATE?.inversiones || {};
  const rendMensual = (inv.rendimiento_mensual || []).filter(d => d.mes >= '2025-01');

  const ctx = document.getElementById('chart-inv-benchmark');
  if(!ctx) return;

  const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function formatMesLabel(isoMes) {
    const [y, m] = isoMes.split('-');
    return MESES_LARGO[parseInt(m,10)-1] + '-' + y;
  }

  const labels  = rendMensual.map(d => formatMesLabel(d.mes));
  const accData = rendMensual.map(d => d.acumulado);
  const bmData  = rendMensual.map(d => d.benchmark_acumulado);

  const fmtPct = v => v === null || v === undefined ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

  // Periodos de cartera MyInvestor (roboadvisor), confirmado por email
  // (asunto "Rentabilidad de tu cartera en <mes>"): GREY hasta jun-2025,
  // cambio a RED el 01/07/2025 (traspaso interno ese dia). No hay campo
  // de cartera en Notion/finance_data.json, por eso el rango va hardcodeado
  // aca en vez de leerse de un dato. Actualizar manualmente si vuelve a
  // cambiar de cartera.
  const CARTERA_PERIODS = [
    { hasta: '2025-06', nombre: 'GREY', color: 'rgba(137,135,129,0.10)' },
    { desde: '2025-07', nombre: 'RED',  color: 'rgba(226,74,74,0.07)' }
  ];
  // Nota: la etiqueta en pantalla agrega "+ Peerberry" porque la linea
  // "Cartera" de este grafico es el acumulado total (MyInvestor + Peerberry),
  // no solo la parte MyInvestor a la que corresponde el nombre GREY/RED.

  const carteraBandsPlugin = {
    id: 'carteraBands',
    beforeDraw(chart) {
      const { ctx: c, chartArea, scales } = chart;
      if (!chartArea) return;
      const xScale = scales.x;

      c.save();
      CARTERA_PERIODS.forEach(period => {
        let startIdx = 0;
        let endIdx = rendMensual.length - 1;
        if (period.desde) {
          const i = rendMensual.findIndex(d => d.mes >= period.desde);
          if (i === -1) return;
          startIdx = i;
        }
        if (period.hasta) {
          let last = -1;
          rendMensual.forEach((d, i) => { if (d.mes <= period.hasta) last = i; });
          if (last === -1) return;
          endIdx = last;
        }

        const xStart = startIdx === 0 ? chartArea.left : xScale.getPixelForValue(startIdx - 0.5);
        const xEnd = endIdx === rendMensual.length - 1 ? chartArea.right : xScale.getPixelForValue(endIdx + 0.5);

        c.fillStyle = period.color;
        c.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.height);

        c.fillStyle = 'rgba(60,60,55,0.55)';
        c.font = '11px sans-serif';
        c.textAlign = 'center';
        c.fillText(`Cartera ${period.nombre} + Peerberry`, (xStart + xEnd) / 2, chartArea.top + 14);
      });
      c.restore();
    }
  };

  if(window.invBenchmarkChart) window.invBenchmarkChart.destroy();
  window.invBenchmarkChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cartera',
          data: accData,
          borderColor: 'rgba(37,99,190,0.9)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          spanGaps: false
        },
        {
          label: 'MSCI World (IWDA.AS, EUR)',
          data: bmData,
          borderColor: 'rgba(137,135,129,0.9)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 3],
          pointRadius: 3,
          tension: 0.3,
          spanGaps: false
        }
      ]
    },
    plugins: [carteraBandsPlugin],
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
          ticks: { font: { size: 11 }, callback: v => v + '%' }
        }
      }
    }
  });
}

// ── Gráfico 3: acumulado por año (una curva por año calendario, reinicia en enero) ──
function renderInvAcumuladoAnual(){
  const inv = window.FINANCE_STATE?.inversiones || {};
  const rendMensual = (inv.rendimiento_mensual || []).filter(d => d.mes >= '2025-01');

  const ctx = document.getElementById('chart-inv-acumulado-anual');
  if(!ctx) return;

  const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const byYear = {};
  rendMensual.forEach(d => {
    const [y, m] = d.mes.split('-');
    if(!byYear[y]) byYear[y] = Array(12).fill(null);
    byYear[y][parseInt(m,10)-1] = d.acumulado_anio;
  });

  const years = Object.keys(byYear).sort();
  const palette = ['#4a3aa7', '#2a78d6', '#1baf7a', '#eb6834'];
  const fmtPct = v => v === null || v === undefined ? '' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

  const datasets = years.map((y, i) => ({
    label: y,
    data: byYear[y],
    borderColor: palette[i % palette.length],
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: i === years.length - 1 ? [5, 3] : [],
    pointRadius: 3,
    pointBackgroundColor: palette[i % palette.length],
    fill: {
      target: { value: 0 },
      above: 'transparent',
      below: 'rgba(226,74,74,0.15)'
    },
    tension: 0.3,
    spanGaps: false
  }));

  if(window.invAccAnualChart) window.invAccAnualChart.destroy();
  window.invAccAnualChart = new Chart(ctx, {
    type: 'line',
    data: { labels: MESES_CORTO, datasets },
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
          ticks: { font: { size: 11 }, callback: v => v + '%' }
        }
      }
    }
  });
}

// ── Gráfico 2: rentabilidad mensual por plataforma (barras agrupadas + acumulado) ──
function renderInvRendimiento(){
  const inv = window.FINANCE_STATE?.inversiones || {};
  const rendMensual = (inv.rendimiento_mensual || []).filter(d => d.mes >= '2025-01');

  const ctx = document.getElementById('chart-inv-rendimiento');
  if(!ctx) return;

  const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function formatMesLabel(isoMes) {
    const [y, m] = isoMes.split('-');
    return MESES_LARGO[parseInt(m,10)-1] + '-' + y;
  }

  const labels = rendMensual.map(d => formatMesLabel(d.mes));
  const pbData = rendMensual.map(d => d.peerberry);
  const miData = rendMensual.map(d => d.myinvestor);
  const totalData = rendMensual.map(d => d.total);

  const fmtPct = v => v === null || v === undefined ? '' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

  if(window.invRendChart) window.invRendChart.destroy();
  window.invRendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Peerberry',
          data: pbData,
          backgroundColor: 'rgba(154,98,0,0.75)',
          borderRadius: 3,
          yAxisID: 'y',
          order: 3
        },
        {
          label: 'MyInvestor',
          data: miData,
          backgroundColor: 'rgba(13,138,82,0.75)',
          borderRadius: 3,
          yAxisID: 'y',
          order: 3
        },
        {
          label: 'Total del mes',
          data: totalData,
          type: 'scatter',
          pointStyle: 'rectRot',
          pointRadius: 6,
          pointHoverRadius: 8,
          backgroundColor: 'rgba(37,99,190,0.9)',
          borderColor: '#ffffff',
          borderWidth: 1.5,
          yAxisID: 'y',
          order: 2
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
            label: ctx => {
              const d = rendMensual[ctx.dataIndex];
              let sinAportes = false;
              if(ctx.dataset.label === 'Peerberry') sinAportes = d && d.sin_aportes_pb;
              if(ctx.dataset.label === 'MyInvestor') sinAportes = d && d.sin_aportes_mi;
              const nota = sinAportes ? ' (sin aportes ese mes)' : '';
              return ` ${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}${nota}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45, autoSkip: true } },
        y: {
          position: 'left',
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 11 }, callback: v => v + '%' }
        }
      }
    }
  });
}


function renderTalho(){
  const RAW = window.FINANCE_STATE?.raw || [];
  const fmt = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
  const fmtFull = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);

  // All Talho movements (expenses only)
  const talhoAll = RAW.filter(r => r.categoria === 'Talho Argentino' && Number(r.monto) < 0);

  // Helper: ISO week number and Monday of that week
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function mondayOf(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return d;
  }
  function fmtMonday(d) {
    return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function weekKey(d) {
    const m = mondayOf(d);
    return m.toISOString().slice(0,10);
  }

  // Build weekly buckets from first Talho movement to today
  const now = new Date();
  const lastMonday = mondayOf(now);

  // Find Monday of the week containing the earliest Talho transaction
  const firstTalhoDate = talhoAll.length
    ? talhoAll.map(r => r.fecha).sort()[0]
    : now.toISOString().slice(0,10);
  const firstMonday = mondayOf(new Date(firstTalhoDate + 'T00:00:00Z'));

  const weeks = [];
  for(let d = new Date(firstMonday); d <= lastMonday; d.setUTCDate(d.getUTCDate() + 7)){
    weeks.push(new Date(d));
  }

  // Aggregate Talho spend by week
  const weekTotals = weeks.map(mon => {
    const sun = new Date(mon); sun.setUTCDate(sun.getUTCDate() + 6);
    return talhoAll
      .filter(r => {
        const rd = new Date(r.fecha + 'T00:00:00Z');
        return rd >= mon && rd <= sun;
      })
      .reduce((acc, r) => acc + Math.abs(Number(r.monto)), 0);
  });

  // Cumulative totals
  const cumulative = [];
  let running = 0;
  for(const v of weekTotals){ running += v; cumulative.push(running); }

  // Labels: "DD/MM (WkXX)"
  const labels = weeks.map(mon => {
    const wk = isoWeek(mon);
    return `${fmtMonday(mon)} (Wk${String(wk).padStart(2,'0')})`;
  });

  // Populate month selector (keep monthly for transaction filtering)
  const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const sel = document.getElementById('talho-month-filter');
  if(sel){
    const talhoMonths = [...new Set(talhoAll.map(r => r.fecha.slice(0,7)))].sort().reverse();
    sel.innerHTML = '<option value="">Todos los meses</option>' +
      talhoMonths.map(m => {
        const [y, mo] = m.split('-');
        return `<option value="${m}">${MESES_ES[parseInt(mo,10)-1]} ${y}</option>`;
      }).join('');
  }

  // Render chart
  const ctx = document.getElementById('chart-talho-bars');
  if(ctx){
    if(window.talhoChart) window.talhoChart.destroy();
    window.talhoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Gasto semanal',
            data: weekTotals,
            backgroundColor: 'rgba(201,74,48,0.70)',
            borderRadius: 4,
            borderSkipped: false,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Acumulado',
            data: cumulative,
            borderColor: 'rgba(37,99,190,0.9)',
            backgroundColor: 'rgba(37,99,190,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: 'rgba(37,99,190,0.9)',
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: 'rgba(0,0,0,0.12)',
            borderWidth: 1,
            titleColor: '#1a1a17',
            bodyColor: '#1a1a17',
            callbacks: {
              label: c => ' ' + c.dataset.label + ': ' + fmtFull(c.parsed.y)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            position: 'left',
            ticks: { callback: v => fmt(v) }
          }
        }
      }
    });
  }

  // Transaction list
  const selectedMonth = document.getElementById('talho-month-filter')?.value || '';
  let txData = talhoAll;
  if(selectedMonth) txData = txData.filter(r => r.fecha.slice(0,7) === selectedMonth);
  txData = [...txData].sort((a,b) => b.fecha.localeCompare(a.fecha));

  const listEl = document.getElementById('talho-tx-list');
  if(listEl){
    if(txData.length === 0){
      listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Sin transacciones</div>';
    } else {
      listEl.innerHTML = `<table class="tx-table" style="font-size:13px">
        <thead><tr>
          <th>Fecha</th>
          <th>Concepto</th>
          <th style="text-align:right">Importe</th>
        </tr></thead>
        <tbody>
          ${txData.map(r => {
            const [,fm,fd] = r.fecha.split('-');
            const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
            const fechaCorta = fd + '\u00a0' + meses[parseInt(fm,10)-1];
            const conceptoHtml = r.nota
              ? '<span title="' + r.concepto + '">' + r.nota + '</span>'
              : r.concepto;
            return '<tr>' +
              '<td style="font-family:DM Mono,monospace;font-size:12px;white-space:nowrap;color:var(--text-secondary);padding-right:8px">' + fechaCorta + '</td>' +
              '<td style="word-break:break-word">' + conceptoHtml + '</td>' +
              '<td style="text-align:right;font-family:DM Mono,monospace;color:var(--red)">' + fmtFull(Math.abs(Number(r.monto))) + '</td>' +
              '</tr>';
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="font-weight:600;padding-top:10px">Total</td>
            <td style="text-align:right;font-family:'DM Mono';font-weight:600;color:var(--red);padding-top:10px">
              ${fmtFull(txData.reduce((a,r) => a + Math.abs(Number(r.monto)), 0))}
            </td>
          </tr>
        </tfoot>
      </table>`;
    }
  }
}

// ── Gastos de la sociedad (sociedad_data.json) ─────────────────────────────
let _sociedadData = null;
let _sociedadLoading = false;

async function fetchSociedadData() {
  if (_sociedadData !== null) return _sociedadData;
  if (_sociedadLoading) return null;
  _sociedadLoading = true;

  try {
    const r = await fetch('sociedad_data.json?v=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    _sociedadData = await r.json();
  } catch (e) {
    console.error('sociedad_data.json fetch error:', e);
    _sociedadData = [];
  }
  _sociedadLoading = false;
  return _sociedadData;
}

async function renderSociedad() {
  const fmt     = v => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  const fmtFull = v => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

  const listEl = document.getElementById('sociedad-tx-list');

  if (listEl) listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Cargando…</div>';

  const allRows = await fetchSociedadData();
  if (!allRows || allRows.length === 0) {
    if (listEl) listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Sin datos — lanza el workflow <strong>Sync Sociedad Data</strong> para generar <code>sociedad_data.json</code>.</div>';
    return;
  }

  // Week helpers (same as renderTalho)
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function mondayOf(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return d;
  }
  function fmtMonday(d) {
    return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }

  const now        = new Date();
  const lastMonday = mondayOf(now);
  const firstDate  = allRows.map(r => r.fecha).sort()[0];
  const firstMonday = mondayOf(new Date(firstDate + 'T00:00:00Z'));

  const weeks = [];
  for (let d = new Date(firstMonday); d <= lastMonday; d.setUTCDate(d.getUTCDate() + 7)) {
    weeks.push(new Date(d));
  }

  const matiTotals  = [];
  const willyTotals = [];
  const cumulative  = [];
  let running = 0;

  for (const mon of weeks) {
    const sun = new Date(mon); sun.setUTCDate(sun.getUTCDate() + 6);
    const weekRows = allRows.filter(r => {
      const rd = new Date(r.fecha + 'T00:00:00Z');
      return rd >= mon && rd <= sun;
    });
    const mati  = weekRows.filter(r => r.pagado === 'Mati').reduce((a, r) => a + r.costo, 0);
    const willy = weekRows.filter(r => r.pagado === 'Willy').reduce((a, r) => a + r.costo, 0);
    matiTotals.push(mati);
    willyTotals.push(willy);
    running += mati + willy;
    cumulative.push(running);
  }

  const labels = weeks.map(mon => {
    const wk = isoWeek(mon);
    return `${fmtMonday(mon)} (Wk${String(wk).padStart(2,'0')})`;
  });

  const PRESUPUESTO = 75000;

  const ctx = document.getElementById('chart-sociedad-bars');
  if (ctx) {
    if (window.sociedadChart) window.sociedadChart.destroy();
    window.sociedadChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Mati',
            data: matiTotals,
            backgroundColor: 'rgba(13,138,82,0.75)',
            borderRadius: 4,
            borderSkipped: false,
            stack: 'gastos',
            yAxisID: 'y'
          },
          {
            type: 'bar',
            label: 'Willy',
            data: willyTotals,
            backgroundColor: 'rgba(8,145,178,0.75)',
            borderRadius: 4,
            borderSkipped: false,
            stack: 'gastos',
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Acumulado',
            data: cumulative,
            borderColor: 'rgba(37,99,190,0.9)',
            backgroundColor: 'rgba(37,99,190,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: 'rgba(37,99,190,0.9)',
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
            tension: 0.3,
            stack: 'acumulado',
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Presupuesto',
            data: Array(weeks.length).fill(PRESUPUESTO),
            borderColor: 'rgba(13,138,82,0.85)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            tension: 0,
            stack: 'presupuesto',
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: 'rgba(0,0,0,0.12)',
            borderWidth: 1,
            titleColor: '#1a1a17',
            bodyColor: '#1a1a17',
            callbacks: {
              label: c => ' ' + c.dataset.label + ': ' + fmtFull(c.parsed.y)
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { callback: v => fmt(v) }
          }
        }
      }
    });
  }

  // Alerta: filas sin pagado válido (no aparecen en ningún gráfico)
  const sinPagado = allRows.filter(r => r.pagado !== 'Mati' && r.pagado !== 'Willy');
  const alertEl = document.getElementById('sociedad-alert');
  if (alertEl) {
    if (sinPagado.length > 0) {
      const total = sinPagado.reduce((a,r)=>a+r.costo,0);
      const lista = sinPagado.map(r => {
        const [,_m,_d] = r.fecha.split('-');
        const _mn = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        return _d + '\u00a0' + _mn[parseInt(_m,10)-1] + ' · ' + r.concepto + ' · ' + fmtFull(r.costo);
      }).join('<br>');
      alertEl.innerHTML = '<strong>⚠ ' + sinPagado.length + ' gasto' + (sinPagado.length > 1 ? 's' : '') + ' sin responsable asignado — ' + fmtFull(total) + ' excluidos de los gráficos</strong><br><span style="font-weight:400;opacity:0.85">' + lista + '</span>';
      alertEl.style.display = 'block';
    } else {
      alertEl.style.display = 'none';
    }
  }

  // Pie chart — porcentaje por socio
  const matiTotal_all  = allRows.filter(r => r.pagado === 'Mati').reduce((a,r)=>a+r.costo,0);
  const willyTotal_all = allRows.filter(r => r.pagado === 'Willy').reduce((a,r)=>a+r.costo,0);
  const ctxPie = document.getElementById('chart-sociedad-pie');
  if (ctxPie) {
    if (window.sociedadPieChart) window.sociedadPieChart.destroy();
    window.sociedadPieChart = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: ['Mati', 'Willy'],
        datasets: [{
          data: [matiTotal_all, willyTotal_all],
          backgroundColor: ['rgba(13,138,82,0.8)', 'rgba(8,145,178,0.8)'],
          borderColor: ['#ffffff','#ffffff'],
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true,
        cutout: '60%',
        layout: { padding: { top: 30, bottom: 10, left: 60, right: 60 } },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: 'rgba(0,0,0,0.12)',
            borderWidth: 1,
            titleColor: '#1a1a17',
            bodyColor: '#1a1a17',
            callbacks: {
              label: c => {
                const total = c.dataset.data.reduce((a,v)=>a+v,0);
                const pct = total > 0 ? ((c.parsed / total)*100).toFixed(1) : 0;
                return ` ${fmtFull(c.parsed)} (${pct}%)`;
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            offset: 10,
            color: '#1a1a17',
            font: { family: 'DM Sans', size: 12, weight: '600' },
            formatter: (value, ctx) => {
              const total = ctx.dataset.data.reduce((a, v) => a + v, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              const name = ctx.chart.data.labels[ctx.dataIndex];
              return name + '\n' + pct + '%\n' + fmtFull(value);
            },
            textAlign: 'center'
          }
        }
      }
    });
  }

  // Month selector — poblar solo la primera vez para no resetear la selección
  const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const sel = document.getElementById('sociedad-month-filter');
  if (sel && sel.options.length <= 1) {
    const months = [...new Set(allRows.map(r => r.fecha.slice(0,7)))].sort().reverse();
    sel.innerHTML = '<option value="">Todos los meses</option>' +
      months.map(m => {
        const [y, mo] = m.split('-');
        return `<option value="${m}">${MESES_ES[parseInt(mo,10)-1]} ${y}</option>`;
      }).join('');
  }

  // Transaction table
  const selectedMonth = document.getElementById('sociedad-month-filter')?.value || '';
  let txData = allRows;
  if (selectedMonth) txData = txData.filter(r => r.fecha.slice(0,7) === selectedMonth);
  txData = [...txData].sort((a,b) => b.fecha.localeCompare(a.fecha));

  if (listEl) {
    if (txData.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Sin transacciones</div>';
    } else {
      const matiTotal  = txData.filter(r => r.pagado === 'Mati').reduce((a,r)=>a+r.costo, 0);
      const willyTotal = txData.filter(r => r.pagado === 'Willy').reduce((a,r)=>a+r.costo, 0);
      const total = matiTotal + willyTotal;
      listEl.innerHTML = `<div style="overflow:hidden;border-radius:6px;border:1px solid var(--border)">
        <table class="tx-table" style="font-size:13px;table-layout:fixed;width:100%;margin:0">
          <colgroup>
            <col style="width:64px">
            <col>
            <col style="width:44px">
            <col style="width:80px">
          </colgroup>
          <thead><tr>
            <th>Fecha</th>
            <th>Concepto</th>
            <th>Quién</th>
            <th style="text-align:right">Importe</th>
          </tr></thead>
          <tbody>
            ${txData.map(r => {
              const [,_m,_d] = r.fecha.split('-');
              const _mn = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
              const _f = _d + ' ' + _mn[parseInt(_m,10)-1];
              return `<tr>
              <td style="font-family:'DM Mono';font-size:12px;white-space:nowrap;color:var(--text-secondary)">${_f}</td>
              <td title="${r.concepto}">${r.concepto}</td>
              <td><span style="font-size:11px;padding:2px 5px;border-radius:4px;background:${r.pagado==='Mati'?'rgba(13,138,82,0.12)':'rgba(8,145,178,0.12)'};color:${r.pagado==='Mati'?'var(--green)':'#0891b2'};white-space:nowrap">${r.pagado}</span></td>
              <td style="text-align:right;font-family:'DM Mono';font-size:12px;white-space:nowrap">${fmtFull(r.costo)}</td>
            </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border)">
              <td colspan="4" style="padding-top:8px;padding-bottom:4px;font-size:11px;color:var(--text-secondary)">
                <span style="color:var(--green);font-weight:600">Mati</span> ${fmtFull(matiTotal)} &nbsp;·&nbsp; <span style="color:#0891b2;font-weight:600">Willy</span> ${fmtFull(willyTotal)} &nbsp;·&nbsp; <strong>Total ${fmtFull(total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    }
  }
}

function switchTab(tab, el){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  if(panel) panel.classList.add('active');

  if(el) el.classList.add('active');

  if(tab === 'categorias')    { activeCatBarFilter = null; populateCatMonthSelector(); renderCategorias(); }
  if(tab === 'transacciones') renderTransacciones();
  if(tab === 'guille')        renderGuille();
  if(tab === 'inversiones')   renderInversiones();
  if(tab === 'talho')           { renderTalho(); renderSociedad(); }
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
  // Load reviewed movements registry
  try {
    const rr = await fetch('reviewed_movements.json?v=' + Date.now());
    const rrData = await rr.json();
    if (window.FINANCE_STATE) {
      window.FINANCE_STATE.reviewedMovements = Array.isArray(rrData) ? rrData : (rrData.reviewed || []);
    }
  } catch(e) {
    if (window.FINANCE_STATE) window.FINANCE_STATE.reviewedMovements = [];
  }

  const res = await fetch(DATA_URL + '?v=' + Date.now());
  RAW = await res.json();

  // finance_data.json puede ser array plano (legado) o { movimientos, inversiones }
  const rawData = RAW;
  if(Array.isArray(rawData)){
    // formato legado
    RAW = rawData;
  } else {
    RAW = rawData.movimientos || [];
    if(window.FINANCE_STATE){
      window.FINANCE_STATE.inversiones  = rawData.inversiones  || { capital: [], rendimiento: [], ganancia: [], kpi: null };
      window.FINANCE_STATE.nominas      = rawData.nominas      || [];
      window.FINANCE_STATE.generatedAt  = rawData.generated_at || '—';
    }
  }
  if(window.FINANCE_STATE){
    window.FINANCE_STATE.raw = RAW;
    const _lastTxDate = RAW.length > 0 ? RAW.map(r => r.fecha).filter(Boolean).sort().reverse()[0] : null;
    window.FINANCE_STATE.lastTxDate = _lastTxDate || null;
  }

  // last-updated moved to KPI card

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















