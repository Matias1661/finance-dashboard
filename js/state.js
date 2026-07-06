// Finance Dashboard - Global State

window.FINANCE_STATE = {
  raw: [],
  inversiones: { capital: [], rendimiento: [] },
  excludedCategories: ['Guille', 'Inversion', 'Talho Argentino'],
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

// Fill-forward sobre el array de capital por plataforma: si un mes no tiene
// reporte (valor 0), arrastra el último valor > 0 conocido. Se usa tanto en
// Resumen (card "Patrimonio invertido") como en Inversiones (card "Capital
// total") para que ambos números coincidan siempre.
function fillForwardCapital(arr) {
  let lastPB = 0, lastMI = 0;
  return arr.map(d => {
    lastPB = d.peerberry  > 0 ? d.peerberry  : lastPB;
    lastMI = d.myinvestor > 0 ? d.myinvestor : lastMI;
    return { mes: d.mes, peerberry: lastPB, myinvestor: lastMI };
  });
}
