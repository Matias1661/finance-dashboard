// Finance Dashboard - Global State

window.FINANCE_STATE = {
  raw: [],
  inversiones: { capital: [], rendimiento: [] },
  excludedCategories: ['Guille', 'Inversion'],
  activePeriod: 6,
  activeMonth: null
};

function getState() {
  return window.FINANCE_STATE;
}

function setState(partial) {
  window.FINANCE_STATE = {
    ...window.FINANCE_STATE,
    ...partial
  };
}
