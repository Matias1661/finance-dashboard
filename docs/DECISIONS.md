# Decisions Log

## 2026-06-02

### Decision
Tab Categorías usa gráfico de barras horizontales (indexAxis: 'y') en lugar de donut o barras verticales.

### Reason
Con múltiples categorías, las barras horizontales permiten leer las etiquetas sin rotación y comparar magnitudes de un vistazo. El donut ya existe en el tab Resumen.

---

### Decision
Tab Categorías tiene su propio selector de mes independiente del selector global de Resumen.

### Reason
Cada tab mantiene su propio estado de filtro para no interferir con la vista de otros tabs.

---

### Decision
Fusionar el gráfico de barras y la línea de saldo acumulado del tab Guille en un único chart mixto con eje Y dual.

### Reason
Reduce el scroll vertical del tab y permite correlacionar visualmente el flujo mensual con el saldo acumulado en el mismo espacio.

---

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
