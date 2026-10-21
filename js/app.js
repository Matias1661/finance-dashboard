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
    const fechaInicio = data.length > 0 ? data.reduce((min, r) => (r.fecha < min ? r.fecha : min), data[0].fecha) : null;
    const notaDesde = fechaInicio ? `<div style="margin-top:2px;font-size:11px;color:var(--text-secondary)">desde el ${fechaInicio}</div>` : '';
    kpisEl.innerHTML = `
      <div class="card"><div class="card-title">Total depositado</div><div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--green)">${formatEUR(totalDeposited)}</div>${notaDesde}</div>
      <div class="card"><div class="card-title">Total gastado</div><div style="font-size:clamp(16px,4vw,22px);font-weight:600;color:var(--red)">${formatEUR(totalSpent)}</div>${notaDesde}</div>
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
  { name: 'Viaje a Granada',          start: '2026-07-18', end: '2026-07-19' },
  { name: 'Hells Week 2026',          start: '2026-08-10', end: '2026-08-23' },
  { name: 'Viaje a Lloret de Mar',    start: '2026-09-29', end: '2026-10-04' },
  { name: 'Viaje a Málaga (octubre)', start: '2026-10-09', end: '2026-10-12' },
];

function tripSubcategory(concepto) {
  const c = (concepto || '').toLowerCase();
  if (/repsol|shell|esso|moeve|sanse|ballenoil|p\.serv|certif|galp|\btotal\b|station avia|\bavia\b/.test(c)) return 'Combustible';
  if (/autopista|bidegi|cofiroute|atlandes|autoroutes|ap-|escota/.test(c))                                    return 'Peajes';
  if (/hotel|airbnb|hostal|apartamento|booking/.test(c))                                                       return 'Alojamiento';
  if (/iberia|vueling|ryanair|renfe|ouigo|blabla|uber|yego|parking/.test(c))                                    return 'Transporte';
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
  let inc2Val   = (inc2From !== null && inc2To !== null) ? (inc2To - inc2From) : null;

  // Si el mes actual todavía no tiene reporte real de alguna plataforma
  // (fill-forward), el incremento de capital no refleja el mes en curso.
  // En ese caso se estima con el neto de aportes/retiros del mes (categoría
  // "Inversion"), igual que en el insight de abajo. No incluye la ganancia
  // generada, solo el movimiento de fondos.
  const now2 = new Date();
  const currentMesKpi = now2.getFullYear() + '-' + String(now2.getMonth()+1).padStart(2,'0');
  const rawCurrentMonth = capital.find(d => d.mes === currentMesKpi);
  const sinReporteMesActual = !rawCurrentMonth || rawCurrentMonth.peerberry === 0 || rawCurrentMonth.myinvestor === 0;
  const inc2EsMesActual = last3.length >= 2 && last3[last3.length-1].mes === currentMesKpi;
  const inc2Estimado = inc2EsMesActual && sinReporteMesActual;

  if (inc2Estimado) {
    const invMovsMesActual = (window.FINANCE_STATE?.raw || []).filter(r => r.categoria === 'Inversion' && r.fecha.slice(0,7) === currentMesKpi);
    let aportesMes = 0, retirosMes = 0;
    invMovsMesActual.forEach(r => {
      const v = Number(r.monto);
      if (v < 0) aportesMes += Math.abs(v);
      else if (v > 0) retirosMes += v;
    });
    inc2Val = aportesMes - retirosMes;
  }

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
            <span>${inc2Label}${inc2Estimado ? ' <span style="font-size:10px;color:var(--text-secondary)">(estimado por aportes)</span>' : ''}</span>
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


/* ── Préstamos ──
 * El cuadro de amortización y el capital pendiente se calculan en el
 * cliente (sistema francés estándar: interés mensual = saldo x TIN/12,
 * amortización = cuota - interés) a partir de los datos de la DB Notion
 * "Prestamos" (capital_inicial, cuota_mensual, tin, plazo_meses,
 * fecha_inicio). Puede diferir en céntimos del cuadro real del banco por
 * convenciones de conteo de días, pero es suficiente para seguimiento
 * personal. Ver docs/DECISIONS.md, entrada [2026-08-03] (5).
 *
 * Amortizaciones anticipadas (DB Notion "Amortizaciones anticipadas", clave
 * amortizaciones_anticipadas de cada préstamo): se restan del saldo antes de
 * la primera cuota con fecha posterior. Tipo "Reducir cuota" (o vacío): la
 * cuota pasa a "Nueva cuota" del justificante del banco o, si falta, se
 * recalcula por sistema francés sobre las cuotas restantes. Tipo "Reducir
 * plazo": se mantiene la cuota y el cuadro termina antes. cuota_mensual de
 * Notion sigue siendo la cuota original del contrato. Ver docs/DECISIONS.md
 * [2026-10-21] (amortizaciones anticipadas).
 */
/* Fecha local en formato YYYY-MM-DD. No usar toISOString(): convierte a UTC
 * y en horario de Madrid una medianoche local cae en el día anterior. */
function fechaLocalISO(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Fecha de la cuota i. Sin "Día de cobro": fecha_inicio + i meses (día de la
 * firma). Con "Día de cobro" D: primera fecha con día D en o después de
 * fecha_inicio + i meses (si el mes no tiene día D, el último día del mes).
 * Ej.: inicio 25/10/2023, D = 1 → cuota 1 el 01/12/2023, cuota 48 el
 * 01/11/2027, igual que el banco. Ver docs/DECISIONS.md [2026-10-21]
 * (día de cobro). */
function fechaCuotaPrestamo(prestamo, i){
  const [y, m, d] = prestamo.fecha_inicio.split('-').map(Number);
  const diaCobro = Number(prestamo.dia_cobro) || 0;
  const ultimoDia = (yy, mm) => new Date(yy, mm + 1, 0).getDate();
  let anio = y, mes = m - 1 + i;
  anio += Math.floor(mes / 12); mes = ((mes % 12) + 12) % 12;
  const diaBase = Math.min(d, ultimoDia(anio, mes));
  if(diaCobro < 1) return new Date(anio, mes, diaBase);
  if(Math.min(diaCobro, ultimoDia(anio, mes)) < diaBase){
    mes += 1; if(mes > 11){ mes = 0; anio += 1; }
  }
  return new Date(anio, mes, Math.min(diaCobro, ultimoDia(anio, mes)));
}

function anticipadasOrdenadas(prestamo){
  return [...(prestamo.amortizaciones_anticipadas || [])]
    .filter(a => a && a.fecha && Number(a.importe) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function computeAmortizacion(prestamo){
  const capital0 = Number(prestamo.capital_inicial) || 0;
  let cuota = Number(prestamo.cuota_mensual) || 0;
  const tasaMensual = (Number(prestamo.tin) || 0) / 12;
  const plazo = Number(prestamo.plazo_meses) || 0;
  const anticipadas = anticipadasOrdenadas(prestamo);
  let idxA = 0;

  const schedule = [];
  if(!prestamo.fecha_inicio || plazo <= 0) return schedule;

  let saldo = capital0;

  for(let i = 1; i <= plazo && saldo > 0.01; i++){
    const fechaISO = fechaLocalISO(fechaCuotaPrestamo(prestamo, i));

    let anticipada = 0;
    while(idxA < anticipadas.length && anticipadas[idxA].fecha < fechaISO){
      const a = anticipadas[idxA++];
      const importe = Math.min(Number(a.importe) || 0, saldo);
      saldo = Math.max(0, saldo - importe);
      anticipada += importe;
      if(a.tipo !== 'Reducir plazo' && saldo > 0.01){
        const restantes = plazo - i + 1;
        const nueva = Number(a.nueva_cuota) || 0;
        cuota = nueva > 0 ? nueva
          : (tasaMensual > 0 ? saldo * tasaMensual / (1 - Math.pow(1 + tasaMensual, -restantes)) : saldo / restantes);
      }
    }
    if(saldo <= 0.01) break;

    const interes = saldo * tasaMensual;
    let amort = cuota - interes;
    if(amort > saldo) amort = saldo;
    if(amort < 0) amort = 0;
    saldo = Math.max(0, saldo - amort);

    schedule.push({
      numero: i,
      fecha: fechaISO,
      cuota: interes + amort,
      interes,
      amortizacion: amort,
      anticipada,
      saldo
    });
  }
  return schedule;
}

/* Saldo de la última cuota con fecha <= hoy, menos las amortizaciones
 * anticipadas hechas después de esa cuota y hasta hoy (las anteriores ya
 * están dentro del cuadro). */
function capitalPendienteHoy(prestamo, schedule){
  let saldo = Number(prestamo.capital_inicial) || 0;
  let ultimaFecha = '';
  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);
  for(const c of schedule){
    if(new Date(c.fecha + 'T00:00:00') <= hoy){ saldo = c.saldo; ultimaFecha = c.fecha; }
    else break;
  }
  anticipadasOrdenadas(prestamo).forEach(a => {
    if(a.fecha >= ultimaFecha && a.fecha <= hoyISO) saldo = Math.max(0, saldo - (Number(a.importe) || 0));
  });
  return saldo;
}

/* Cuota vigente: la de la próxima cuota del cuadro (refleja amortizaciones
 * anticipadas de tipo "Reducir cuota"); si no quedan cuotas, la original. */
function cuotaVigente(prestamo, schedule){
  const hoy = new Date();
  const proxima = schedule.find(c => new Date(c.fecha + 'T00:00:00') > hoy);
  return proxima ? proxima.cuota : (Number(prestamo.cuota_mensual) || 0);
}

/* Filas del cuadro: cuotas ordinarias y, en filas aparte con su fecha real,
 * las amortizaciones anticipadas (importe en la columna Amortización, saldo
 * tras la amortización). */
function filasCuadroPrestamo(prestamo, schedule){
  const anticipadas = anticipadasOrdenadas(prestamo);
  let idxA = 0;
  let saldoPrevio = Number(prestamo.capital_inicial) || 0;
  const filas = [];
  const filaAnticipada = a => {
    const importe = Math.min(Number(a.importe) || 0, saldoPrevio);
    saldoPrevio = Math.max(0, saldoPrevio - importe);
    const detalle = [a.tipo, a.comision ? 'comisión ' + formatEUR(Number(a.comision)) : '', a.intereses ? 'intereses ' + formatEUR(Number(a.intereses)) : ''].filter(Boolean).join(', ');
    return `<tr style="background:rgba(46,125,50,0.08)"><td>—</td><td>${a.fecha}</td><td colspan="2" style="font-size:11px;color:var(--text-secondary)">Amortización anticipada${detalle ? ' (' + detalle + ')' : ''}</td><td>${formatEUR(importe)}</td><td>${formatEUR(saldoPrevio)}</td></tr>`;
  };
  schedule.forEach(c => {
    while(idxA < anticipadas.length && anticipadas[idxA].fecha < c.fecha) filas.push(filaAnticipada(anticipadas[idxA++]));
    filas.push(`<tr><td>${c.numero}</td><td>${c.fecha}</td><td>${formatEUR(c.cuota)}</td><td>${formatEUR(c.interes)}</td><td>${formatEUR(c.amortizacion)}</td><td>${formatEUR(c.saldo)}</td></tr>`);
    saldoPrevio = c.saldo;
  });
  while(idxA < anticipadas.length && saldoPrevio > 0.01) filas.push(filaAnticipada(anticipadas[idxA++]));
  return filas.join('');
}

function togglePrestamoTabla(id){
  const div = document.getElementById(id);
  if(div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

/* Pinta las cards de préstamos dentro de la solapa Deuda y devuelve los
 * totales para los KPIs unificados de renderDeuda(). Ver docs/DECISIONS.md
 * [2026-10-21] (solapa Deuda). */
function renderPrestamos(){
  const prestamos = window.FINANCE_STATE?.prestamos || [];
  const listEl = document.getElementById('prestamos-list');
  const totales = { pendiente: 0, cuotas: 0, activos: 0, sumaPonderadaTipo: 0 };
  if(!listEl) return totales;

  if(prestamos.length === 0){
    listEl.innerHTML = '<div class="card">No hay préstamos cargados en Notion.</div>';
    return totales;
  }

  let totalPendiente = 0;
  let totalCuotas = 0;

  const prestamosOrdenados = [...prestamos].sort((a, b) => {
    if(!a.fecha_fin) return 1;
    if(!b.fecha_fin) return -1;
    return a.fecha_fin.localeCompare(b.fecha_fin);
  });

  const cards = prestamosOrdenados.map((p, idx) => {
    const schedule = computeAmortizacion(p);
    const pendiente = schedule.length > 0 ? capitalPendienteHoy(p, schedule) : (Number(p.capital_inicial) || 0);
    const cuotaActual = cuotaVigente(p, schedule);
    const cuotaOriginal = Number(p.cuota_mensual) || 0;
    const anticipadas = anticipadasOrdenadas(p);
    const totalAnticipado = anticipadas.reduce((s, a) => s + (Number(a.importe) || 0), 0);
    totalPendiente += pendiente;
    totalCuotas += cuotaActual;
    if(pendiente > 0.01){
      totales.cuotas += cuotaActual;
      totales.activos += 1;
      totales.sumaPonderadaTipo += pendiente * (Number(p.tin) || 0) * 100;
    }

    const capitalInicial = Number(p.capital_inicial) || 0;
    const pctAmortizado = capitalInicial > 0 ? Math.max(0, Math.min(100, 100 - (pendiente / capitalInicial * 100))) : 0;
    const tinPct = p.tin !== null && p.tin !== undefined ? (Number(p.tin) * 100).toFixed(2) + '%' : '—';
    const tablaId = `prestamo-tabla-${idx}`;

    return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-title" style="margin-bottom:2px">${p.nombre || p.entidad || 'Préstamo'}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${p.entidad || ''}${p.uso_real ? ' · ' + p.uso_real : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:600;color:var(--blue)">${formatEUR(pendiente)}</div>
          <div style="font-size:11px;color:var(--text-secondary)">pendiente de ${formatEUR(capitalInicial)}</div>
        </div>
      </div>

      <div style="margin-top:10px;height:6px;background:var(--bg);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pctAmortizado.toFixed(1)}%;background:var(--green)"></div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:var(--text-secondary)">${pctAmortizado.toFixed(1)}% pagado</div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;font-size:12px;color:var(--text-secondary)">
        <div><div>Cuota mensual</div><div style="font-family:'DM Mono';font-size:14px;color:var(--text)">${formatEUR(cuotaActual)}</div>${Math.abs(cuotaActual - cuotaOriginal) > 0.01 ? `<div style="font-size:11px">original ${formatEUR(cuotaOriginal)}</div>` : ''}</div>
        <div><div>TIN</div><div style="font-family:'DM Mono';font-size:14px;color:var(--text)">${tinPct}</div></div>
        <div><div>Fecha fin</div><div style="font-family:'DM Mono';font-size:14px;color:var(--text)">${p.fecha_fin || '—'}</div></div>
      </div>

      ${anticipadas.length ? `<div style="margin-top:10px;font-size:12px;color:var(--text-secondary)">Amortizado anticipadamente: ${formatEUR(totalAnticipado)} (${anticipadas.map(a => `${a.fecha.split('-').reverse().join('/')}: ${formatEUR(Number(a.importe) || 0)}${a.tipo ? ', ' + a.tipo.toLowerCase() : ''}`).join('; ')})</div>` : ''}

      ${p.notas ? `<div style="margin-top:10px;font-size:12px;color:var(--amber);background:rgba(154,98,0,0.08);padding:8px 10px;border-radius:8px">${p.notas}</div>` : ''}

      <div style="margin-top:12px">
        <button onclick="togglePrestamoTabla('${tablaId}')" style="font-size:12px;background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--text-secondary)">Ver cuadro de amortización</button>
        <div id="${tablaId}" style="display:none;margin-top:10px;max-height:300px;overflow:auto">
          <table class="tx-table">
            <thead><tr><th>#</th><th>Fecha</th><th>Cuota</th><th>Interés</th><th>Amortización</th><th>Saldo</th></tr></thead>
            <tbody>
              ${filasCuadroPrestamo(p, schedule)}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');

  listEl.innerHTML = cards;

  totales.pendiente = totalPendiente;
  return totales;
}

/* ── Tarjetas de Crédito (revolving) ──
 * A diferencia de Préstamos (cuota fija, sistema francés calculado en
 * cliente), estas son líneas revolving: el saldo aplazado se toma tal cual
 * viene de Notion (ya calculado por el banco en cada extracto), no se
 * recalcula con computeAmortizacion(). Ver docs/DECISIONS.md [2026-09-02].
 */
function toggleTarjetaHistorico(id){
  const div = document.getElementById(id);
  if(div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

function toggleTarjetaOperaciones(id){
  const div = document.getElementById(id);
  if(div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

/* Estima si falta cargar el extracto más reciente de una tarjeta.
 * Cadencia observada: cada tarjeta recibe un extracto mensual el mismo
 * día del mes (IKEA día 5, Visa Classic día 1 — se infiere del último
 * `fecha_cargo` cargado en vez de hardcodear el día, para no romper si el
 * banco cambia la fecha de facturación). Margen de gracia de 5 días sobre
 * la fecha esperada antes de marcarlo como pendiente, para no generar
 * falsos positivos por demoras normales de procesamiento del banco.
 * Ver docs/DECISIONS.md [2026-09-03].
 */
function tarjetaExtractoStatus(periodos, hoy){
  const GRACIA_DIAS = 5;
  const ultimo = periodos[periodos.length - 1];
  if(!ultimo || !ultimo.fecha_cargo) return null;
  const cargo = new Date(ultimo.fecha_cargo + 'T00:00:00');
  const proximoEsperado = new Date(cargo.getFullYear(), cargo.getMonth() + 1, cargo.getDate());
  const limite = new Date(proximoEsperado);
  limite.setDate(limite.getDate() + GRACIA_DIAS);
  return { overdue: hoy > limite, proximoEsperado };
}

/* "septiembre 2026" a partir de un Date. Ver docs/DECISIONS.md [2026-09-07]. */
function mesEsp(date){
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio',
    'agosto','septiembre','octubre','noviembre','diciembre'];
  return `${meses[date.getMonth()]} ${date.getFullYear()}`;
}

/* Instrucción concreta por tarjeta cuando el KPI "Estado extractos" marca
 * pendiente: qué app abrir y qué extracto bajar. Tarjetas sin entrada acá
 * caen al mensaje genérico (fallback). Ver docs/DECISIONS.md [2026-09-07]. */
const MENSAJE_TARJETA_PENDIENTE = {
  'IKEA': (mes) => `Entrá a la app InOne, descargá el extracto de ${mes} y subilo a la carpeta "Tarjetas de crédito" en Drive.`,
  'Visa Classic': (mes) => `Entrá a la app de CaixaBank, buscá el extracto de ${mes} y subilo a la carpeta "Tarjetas de crédito" en Drive.`
};

/* Pinta la sección de tarjetas dentro de la solapa Deuda (card de intereses
 * históricos, gráfico de saldo aplazado y una card por tarjeta) y devuelve
 * los totales para los KPIs unificados de renderDeuda(). Ver
 * docs/DECISIONS.md [2026-10-21] (solapa Deuda). */
function renderTarjetasCredito(){
  const rows = window.FINANCE_STATE?.tarjetasCredito || [];
  const operaciones = window.FINANCE_STATE?.tarjetasCreditoOperaciones || [];
  const listEl = document.getElementById('tarjetas-list');
  const kpiEl = document.getElementById('tarjetas-kpis');
  const totales = { saldo: 0, cuotas: 0, activas: 0, sumaPonderadaTipo: 0, estadoHTML: '' };
  if(!listEl) return totales;

  if(rows.length === 0){
    listEl.innerHTML = '<div class="card">No hay tarjetas de crédito cargadas en Notion.</div>';
    if(kpiEl) kpiEl.innerHTML = '';
    return totales;
  }

  const porTarjeta = {};
  rows.forEach(r => {
    const key = r.tarjeta || 'Sin nombre';
    if(!porTarjeta[key]) porTarjeta[key] = [];
    porTarjeta[key].push(r);
  });
  Object.values(porTarjeta).forEach(list =>
    list.sort((a, b) => (a.periodo_inicio || '').localeCompare(b.periodo_inicio || '')));

  let saldoTotal = 0;
  let interesesAcumulados = 0;
  let sumaPonderadaTAE = 0;
  let periodoMasAntiguo = null;
  rows.forEach(r => {
    if(r.periodo_inicio && (!periodoMasAntiguo || r.periodo_inicio < periodoMasAntiguo)) periodoMasAntiguo = r.periodo_inicio;
  });

  const cards = Object.entries(porTarjeta).map(([nombre, periodos], idx) => {
    const ultimo = periodos[periodos.length - 1];
    const saldo = Number(ultimo.aplazado_proximo) || 0;
    saldoTotal += saldo;
    sumaPonderadaTAE += saldo * (Number(ultimo.tae) || 0);
    if(saldo > 0.01){
      totales.cuotas += Number(ultimo.cuota_mensual_elegida) || 0;
      totales.activas += 1;
    }
    interesesAcumulados += periodos.reduce((acc, p) => acc + (Number(p.intereses_periodo) || 0), 0);

    const limiteInicial = Number(ultimo.limite_inicial) || 0;
    const limiteDisponible = Number(ultimo.limite_disponible) || 0;
    const dispuesto = Math.max(0, limiteInicial - limiteDisponible);
    const pctDispuesto = limiteInicial > 0 ? Math.max(0, Math.min(100, dispuesto / limiteInicial * 100)) : 0;
    const taePct = ultimo.tae !== null && ultimo.tae !== undefined ? Number(ultimo.tae).toFixed(2) + '%' : '—';
    const historicoId = `tarjeta-historico-${idx}`;
    const operacionesId = `tarjeta-operaciones-${idx}`;
    const opsTarjeta = operaciones
      .filter(o => o.tarjeta === nombre)
      .sort((a, b) => (b.fecha_operacion || '').localeCompare(a.fecha_operacion || ''));

    return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-title" style="margin-bottom:2px">${nombre}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${ultimo.contrato || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:600;color:var(--red)">${formatEUR(saldo)}</div>
          <div style="font-size:11px;color:var(--text-secondary)">saldo aplazado</div>
        </div>
      </div>

      <div style="margin-top:10px;height:6px;background:var(--bg);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pctDispuesto.toFixed(1)}%;background:var(--amber)"></div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:var(--text-secondary)">${formatEUR(dispuesto)} dispuesto de ${formatEUR(limiteInicial)} · ${formatEUR(limiteDisponible)} disponible</div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;font-size:12px;color:var(--text-secondary)">
        <div><div>TAE</div><div style="font-family:'DM Mono';font-size:14px;color:var(--text)">${taePct}</div></div>
        <div><div>Cuota elegida</div><div style="font-family:'DM Mono';font-size:14px;color:var(--text)">${formatEUR(Number(ultimo.cuota_mensual_elegida) || 0)}</div></div>
        <div><div>Cierre proyectado</div><div style="font-family:'DM Mono';font-size:14px;color:var(--text)">${ultimo.fecha_proyectada_cierre || '—'}</div></div>
      </div>

      ${ultimo.notas ? `<div style="margin-top:10px;font-size:12px;color:var(--amber);background:rgba(154,98,0,0.08);padding:8px 10px;border-radius:8px">${ultimo.notas}</div>` : ''}

      <div style="margin-top:12px">
        <button onclick="toggleTarjetaHistorico('${historicoId}')" style="font-size:12px;background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--text-secondary)">Ver histórico</button>
        <button onclick="toggleTarjetaOperaciones('${operacionesId}')" style="font-size:12px;background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--text-secondary);margin-left:8px">Ver operaciones${opsTarjeta.length ? ` (${opsTarjeta.length})` : ''}</button>
        <div id="${historicoId}" style="display:none;margin-top:10px;max-height:300px;overflow:auto">
          <table class="tx-table">
            <thead><tr><th>Periodo</th><th>Anterior</th><th>Operaciones</th><th>Amortización</th><th>Intereses</th><th>Próximo</th></tr></thead>
            <tbody>
              ${periodos.map(p => `<tr><td>${p.periodo_inicio || ''} – ${p.periodo_fin || ''}</td><td>${formatEUR(Number(p.aplazado_anterior) || 0)}</td><td>${formatEUR(Number(p.operaciones_periodo) || 0)}</td><td>${formatEUR(Number(p.amortizacion) || 0)}</td><td>${formatEUR(Number(p.intereses_periodo) || 0)}</td><td>${formatEUR(Number(p.aplazado_proximo) || 0)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div id="${operacionesId}" style="display:none;margin-top:10px;max-height:300px;overflow:auto">
          ${opsTarjeta.length === 0 ? '<div style="font-size:12px;color:var(--text-secondary)">Sin operaciones registradas.</div>' : `
          <table class="tx-table">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Tipo</th></tr></thead>
            <tbody>
              ${opsTarjeta.map(o => `<tr><td>${o.fecha_operacion || ''}</td><td>${o.concepto || ''}${o.cuotas ? ` <span style="color:var(--text-secondary);font-size:11px">(${o.cuotas})</span>` : ''}</td><td>${formatEUR(Number(o.importe) || 0)}</td><td>${o.tipo || ''}</td></tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>
    </div>`;
  }).join('');

  listEl.innerHTML = cards;

  {
    const hoy = new Date();
    const pendientes = Object.entries(porTarjeta)
      .map(([nombre, periodos]) => ({ nombre, status: tarjetaExtractoStatus(periodos, hoy) }))
      .filter(t => t.status && t.status.overdue);
    const mensajesPendientes = pendientes.map(t => {
      const mesFalta = mesEsp(t.status.proximoEsperado);
      const msgFn = MENSAJE_TARJETA_PENDIENTE[t.nombre];
      const detalle = msgFn
        ? msgFn(mesFalta)
        : `Cargar extracto de ${t.nombre} y correr "Organizar tarjetas de crédito".`;
      return `<div style="margin-top:2px;font-size:11px;color:var(--text-secondary)"><strong>${t.nombre}:</strong> ${detalle}</div>`;
    }).join('');
    const estadoValor = pendientes.length === 0
      ? `<div style="font-size:22px;font-weight:600;color:var(--green)">✓ Al día</div>`
      : `<div style="font-size:22px;font-weight:600;color:var(--amber)">⚠ Pendiente</div>${mensajesPendientes}`;

    totales.estadoHTML = estadoValor;
    if(kpiEl) kpiEl.innerHTML = `
    <div class="card">
      <div class="card-title">Intereses pagados (histórico)</div>
      <div style="font-size:22px;font-weight:600;color:var(--amber)">${formatEUR(interesesAcumulados)}</div>
      <div style="margin-top:2px;font-size:11px;color:var(--text-secondary)">${periodoMasAntiguo ? `desde el periodo iniciado el ${periodoMasAntiguo}` : ''}</div>
    </div>
  `;
  }

  totales.saldo = saldoTotal;
  totales.sumaPonderadaTipo = sumaPonderadaTAE;

  if(typeof renderTarjetasChart === 'function') renderTarjetasChart();
  return totales;
}

/* Solapa Deuda: unifica Préstamos y Tarjetas de Crédito. KPIs agregados
 * (deuda pendiente, cuota mensual, ratio de endeudamiento del mes, tipo
 * medio ponderado y estado de extractos), curva del ratio con línea de
 * objetivo y las secciones de préstamos y tarjetas sin cambios.
 * Tipo ponderado: mezcla TIN de préstamos (Notion guarda decimal, 0.0575)
 * con TAE de tarjetas (Notion guarda porcentaje, 15.39), ponderado por
 * saldo pendiente. Ver docs/DECISIONS.md [2026-10-21] (solapa Deuda). */
function renderDeuda(){
  const pr = renderPrestamos();
  const tj = renderTarjetasCredito();
  const kpiEl = document.getElementById('deuda-kpis');

  const deudaTotal = pr.pendiente + tj.saldo;
  const cuotaTotal = pr.cuotas + tj.cuotas;
  const tipoPonderado = deudaTotal > 0 ? (pr.sumaPonderadaTipo + tj.sumaPonderadaTipo) / deudaTotal : 0;

  const hoy = new Date();
  const mesKey = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const r = typeof computeDebtRatio === 'function' ? computeDebtRatio(mesKey) : { ratio: null };
  const objetivo = typeof OBJETIVO_RATIO_DEUDA !== 'undefined' ? OBJETIVO_RATIO_DEUDA : 30;
  const colorRatio = r.ratio === null ? 'var(--text-secondary)'
    : r.ratio > 35 ? 'var(--red)' : r.ratio > 30 ? 'var(--amber)' : 'var(--green)';
  const fmtPct = v => v.toFixed(1).replace('.', ',') + '%';
  const sub = txt => `<div style="margin-top:2px;font-size:11px;color:var(--text-secondary)">${txt}</div>`;

  if(kpiEl){
    kpiEl.innerHTML = `
    <div class="card">
      <div class="card-title">Deuda pendiente total</div>
      <div style="font-size:22px;font-weight:600;color:var(--blue)">${formatEUR(deudaTotal)}</div>
      ${sub(`Préstamos ${formatEUR(pr.pendiente)} · Tarjetas ${formatEUR(tj.saldo)}`)}
      ${sub(`${pr.activos} préstamos · ${tj.activas} tarjetas con saldo`)}
    </div>
    <div class="card">
      <div class="card-title">Cuota mensual total</div>
      <div style="font-size:22px;font-weight:600;color:var(--red)">${formatEUR(cuotaTotal)}</div>
      ${sub(`Préstamos ${formatEUR(pr.cuotas)} · Tarjetas ${formatEUR(tj.cuotas)}`)}
    </div>
    <div class="card"${r.ratio !== null && r.ratio > 35 ? ' style="border:1.5px solid var(--red)"' : ''}>
      <div class="card-title">Ratio de endeudamiento</div>
      <div style="font-size:22px;font-weight:600;color:${colorRatio}">${r.ratio === null ? '—' : fmtPct(r.ratio)}</div>
      ${sub(r.ratio === null ? 'Sin nómina disponible' : `Objetivo ${objetivo}% · ${r.ratio > objetivo ? `${(r.ratio - objetivo).toFixed(1).replace('.', ',')} pp por encima` : 'cumplido'}`)}
    </div>
    <div class="card">
      <div class="card-title">TIN/TAE ponderado</div>
      <div style="font-size:22px;font-weight:600">${tipoPonderado.toFixed(2).replace('.', ',')}%</div>
      ${sub('ponderado por saldo pendiente')}
    </div>
    <div class="card">
      <div class="card-title">Estado extractos</div>
      ${tj.estadoHTML || sub('Sin tarjetas cargadas')}
    </div>
  `;
  }

  if(typeof renderDebtRatioChart === 'function') renderDebtRatioChart();
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
  if(tab === 'deuda')           renderDeuda();
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
      window.FINANCE_STATE.prestamos    = rawData.prestamos    || [];
      window.FINANCE_STATE.tarjetasCredito = rawData.tarjetas_credito || [];
      window.FINANCE_STATE.tarjetasCreditoOperaciones = rawData.tarjetas_credito_operaciones || [];
      window.FINANCE_STATE.deudaForecast = rawData.deuda_forecast || null;
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
















