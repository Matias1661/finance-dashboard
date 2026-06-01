// Finance Dashboard - Filters Module (Refactored with State)

function monthKey(d) {
  return d.slice(0, 7);
}

function cutoffDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function getState() {
  return window.FINANCE_STATE;
}

function filteredData() {
  const state = getState();

  let data = state.raw.filter(r => !state.excludedCategories.includes(r.categoria));

  const cutoff = state.activePeriod >= 999 ? '2000-01-01' : cutoffDate(state.activePeriod);
  data = data.filter(r => r.fecha >= cutoff);

  if (state.activeMonth) {
    data = data.filter(r => monthKey(r.fecha) === state.activeMonth);
  }

  return data;
}

function setPeriod(m, el) {
  const state = getState();
  state.activePeriod = m;
  state.activeMonth = null;

  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');

  const selector = document.getElementById('month-selector');
  if (selector) selector.value = '';

  if (typeof renderResumen === 'function') renderResumen();
}

function setMonthFilter(m) {
  const state = getState();
  state.activeMonth = m || null;

  if (typeof renderResumen === 'function') renderResumen();
}

function populateMonthSelector(RAW) {
  const sel = document.getElementById('month-selector');
  if (!sel || !RAW) return;

  const months = [...new Set(RAW.map(r => monthKey(r.fecha)))].sort();

  sel.innerHTML = `
    <option value="">Todos los meses</option>
    ${months.map(m => `<option value="${m}">${m}</option>`).join('')}
  `;
}