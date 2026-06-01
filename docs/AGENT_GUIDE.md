# Finance Dashboard - Agent Guide

## Objective

This document defines the operating rules for any AI agent or developer working on the Finance Dashboard project.

The goal is to ensure full continuity of understanding across different agents without relying on chat history.

---

## Source of Truth

The GitHub repository is the only source of truth.

Before any action, the agent must review:

- docs/PROJECT_MEMORY.md
- docs/ROADMAP.md
- docs/DECISIONS.md
- docs/CHANGELOG.md

If there is a conflict between chat instructions and repository documentation, repository documentation always takes priority.

---

## Mandatory Workflow

Before implementing any change:

1. Review all documentation files
2. Register design decisions in docs/DECISIONS.md (if applicable)
3. Implement the change in code
4. Update docs/CHANGELOG.md
5. Update docs/ROADMAP.md
6. Update docs/PROJECT_MEMORY.md if project context changes

No significant change should be made without updating documentation.

---

## Current System Overview

### Architecture
- Static frontend application (HTML/CSS/JavaScript)
- Charting library: Chart.js
- Data source: finance_data.json

### Core Features
- KPI dashboard (income, expenses, savings)
- Monthly evolution charts
- Category-based expense analysis
- Transaction explorer
- Time filtering system

### Special Categories
These categories require special handling:
- Guille (shared expenses tracking)
- Inversion (investment flows)

---

## Roadmap Summary

### High Priority
- Real savings KPI including investments
- Shared expenses dashboard (Guille)
- Automated financial insights

### Medium Priority
- Housing cost dashboard
- Mobility dashboard
- Subscription tracking
- Expense anomaly detection

### Future Enhancements
- Net worth tracking
- Forecasting engine
- Personal + business unified view

---

## Design Principles

### Priorities
- Actionable insights over raw data
- Simplicity over complexity
- Performance over excessive computation
- Traceability of all decisions

### Avoid
- Redundant KPIs
- Over-engineering
- Hidden logic without documentation

---

## Agent Continuity Rule

No agent should assume access to prior conversations.

All necessary context must be reconstructable from repository documentation alone.

This repository is designed to be self-contained for multi-agent collaboration.
