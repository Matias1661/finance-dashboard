# Finance Dashboard - Project Memory

## Purpose
Central technical memory for the Finance Dashboard project. This document is intended to allow any future AI agent or developer to quickly understand the project state, architecture, decisions, roadmap and pending work.

---

## Current State (2026-06-01)

### Repository
- Repository: Matias1661/finance-dashboard
- Frontend: Static HTML/CSS/JavaScript (modularized)
- Charts: Chart.js
- Data source: finance_data.json

---

## 🏗️ Current Architecture (NEW - IMPORTANT)

The system has been refactored from a monolithic dashboard into a modular frontend architecture:

### 1. State Layer
- `js/state.js`
- Centralized global state (`window.FINANCE_STATE`)
- Holds:
  - raw transaction data
  - active period (6m / 12m / all)
  - active month filter
  - excluded categories

👉 Single source of truth for application state

---

### 2. Filters Layer
- `js/filters.js`

Responsible for:
- time filtering (6m / 12m / all)
- month-specific filtering
- category exclusion logic
- filter UI handlers
- month selector population

👉 Pure transformation layer over state

---

### 3. Charts Layer
- `js/charts.js`

Responsible for:
- KPI rendering (income, expenses, balance)
- monthly income vs expense chart

👉 Consumes filtered state only

---

### 4. Application Orchestrator
- `js/app.js`

Responsible for:
- application initialization
- loading finance_data.json
- injecting state
- coordinating renders
- tab switching

👉 Replaces all inline initialization logic in index.html

---

### 5. UI Layer
- `index.html`

Now reduced to:
- layout structure
- containers
- script imports

👉 No business logic should live here

---

## Data Flow (CRITICAL)

```
finance_data.json
        ↓
   app.js (load)
        ↓
 state.js (store)
        ↓
filters.js (transform)
        ↓
charts.js (render)
```

---

## Existing Features

- KPI summary cards
- Monthly income vs expense chart
- Monthly savings chart
- Expense category analysis
- Transaction explorer
- Time-period filters
- Month-specific filtering (NEW)

---

## Data Model

Transactions contain:
- fecha
- concepto
- monto
- categoria

---

## Special Categories

Excluded from core analytics:
- Guille
- Inversion

---

## Key Design Decisions

### 1. Centralized State
All application state lives in `window.FINANCE_STATE`.

### 2. Unidirectional Flow
State → Filters → Charts → UI

### 3. UI is Stateless
UI only reflects computed state.

### 4. Month filter overrides period filter
If a month is selected, it takes priority over 6m/12m/all.

---

## Strengths
- Modular architecture implemented
- Clear separation of concerns
- Easy to extend with new analytics layers
- Compatible with future AI-driven features

---

## Improvement Candidates

### Priority 1
1. Real savings KPI including investments
2. Shared-expense dashboard (Guille)
3. Automatic financial insights

### Priority 2
4. Housing dashboard
5. Mobility dashboard
6. Subscription tracking
7. Expense anomaly detection

### Priority 3
8. Net worth tracking
9. Forecasting
10. Unified personal + business view

---

## Current System Status

The project is now a:

> Modular financial analytics frontend (pre-intelligence layer)

---

## Next Evolution Phase

The architecture is ready for:

- AI-generated insights layer
- month-over-month comparison engine
- anomaly detection system
- financial assistant behavior layer

---

## Working Rule

Before implementing significant changes:
- update this document
- preserve modular architecture
- never reintroduce monolithic logic in index.html
