// Finance Dashboard - Global State

// Centralized application state
window.FINANCE_STATE = {
  raw: [],
  excludedCategories: ['Guille', 'Inversion'],
  activePeriod: 6,
  activeMonth: null
};

// Helpers to access state safely
function getState() {
  return window.FINANCE_STATE;
}

function setState(partial) {
  window.FINANCE_STATE = {
    ...window.FINANCE_STATE,
    ...partial
  };
}