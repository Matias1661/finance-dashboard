// Finance Dashboard - App Orchestrator

const DATA_URL = 'finance_data.json';

let RAW = [];

function renderResumen(){
  if(typeof renderKPIs === 'function') renderKPIs();
  if(typeof renderMonthly === 'function') renderMonthly();
  if(typeof renderDonut === 'function') renderDonut();
}

function switchTab(tab){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  if(panel) panel.classList.add('active');

  if(event?.target) event.target.classList.add('active');
}

async function init(){
  const res = await fetch(DATA_URL);
  RAW = await res.json();

  // sync state
  if(window.FINANCE_STATE){
    window.FINANCE_STATE.raw = RAW;
  }

  // populate filters
  if(typeof populateMonthSelector === 'function'){
    populateMonthSelector(RAW);
  }

  document.getElementById('app').style.display='block';
  document.getElementById('loading').style.display='none';

  renderResumen();
}

window.addEventListener('DOMContentLoaded', init);
