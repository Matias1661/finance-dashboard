# Decisions Log

## 2026-06-02

### Decision
Eliminar el bloque <script> inline de index.html y cargar app.js como script externo.

### Reason
El bloque inline duplicaba init() y no cargaba switchTab(). La función de navegación por tabs debe vivir en app.js junto con el resto de la orquestación. index.html debe ser solo estructura e imports.

---

## 2026-06-01

### Decision
Create a project memory framework inside the repository.

### Reason
Allow future AI agents and developers to reconstruct project state without relying on chat history.

---

### Decision
Treat GitHub documentation as the primary source of technical truth.

### Reason
Version control, traceability and agent continuity.

---

### Decision
Keep category-based financial analysis as the core dashboard model.

### Reason
Current dataset is already structured around categories and supports incremental improvements.

---

### Decision
renderDonut() consumes filteredData() directly, same as renderKPIs() and renderMonthly().

### Reason
Ensures the donut chart always reflects the active period and month filter without additional state management.

---

### Decision
renderResumen() calls renderDonut() on every render cycle.

### Reason
Month selector calls renderResumen() on change; all three chart components must update together.
