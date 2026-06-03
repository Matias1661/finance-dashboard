// Finance Dashboard - Global State

window.FINANCE_STATE = {
  raw: [],
  inversiones: { capital: [], rendimiento: [] },
  excludedCategories: ['Guille', 'Inversion'],
  // Categorías donde un ingreso puede ser reembolso de un gasto
  reimbursableCategories: ['Viajes', 'Club', 'Combustible', 'Comer afuera', 'Salidas', 'Gastos en conjunto'],
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
