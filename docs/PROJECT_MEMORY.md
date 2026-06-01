# Finance Dashboard - Project Memory

## Purpose
Central technical memory for the Finance Dashboard project. This document is intended to allow any future AI agent or developer to quickly understand the project state, decisions, roadmap and pending work.

## Current State (2026-06-01)

### Repository
- Repository: Matias1661/finance-dashboard
- Frontend: Static HTML/CSS/JavaScript
- Charts: Chart.js
- Data source: finance_data.json

### Existing Features
- KPI summary cards
- Monthly income vs expense chart
- Monthly savings chart
- Expense category analysis
- Transaction explorer
- Time-period filters

### Data Model
Transactions currently contain:
- fecha
- concepto
- monto
- categoria

### Special Categories
The dashboard currently excludes the following categories from core analysis:
- Guille
- Inversion

## Findings From Review

### Strengths
- Clean architecture
- Simple deployment model
- Well-organized category structure
- Good financial visibility

### Improvement Candidates
Priority 1:
1. Real savings KPI including investments
2. Shared-expense dashboard (Guille)
3. Automatic financial insights

Priority 2:
4. Housing dashboard
5. Mobility dashboard
6. Subscription tracking
7. Expense anomaly detection

Priority 3:
8. Net worth tracking
9. Forecasting
10. Business + personal consolidated view

## Change Log

### 2026-06-01
- Created project memory system.
- Performed first technical review of dashboard architecture.
- Performed first review of finance_data.json structure.
- Identified roadmap candidates.

## Working Rule
Before implementing significant changes, update this document so future agents can reconstruct project context.