# Decisions Log

## 2026-06-02 (auditoría)

### Decision
`renderMonthly` consume `filteredData()` en lugar de `getLast12MonthsData()`.

### Reason
Los filtros de periodo y mes del tab Resumen deben afectar a todos los componentes del tab, incluido el gráfico mensual. `getLast12MonthsData()` se eliminó por no tener uso.

---

### Decision
`formatEUR` vive únicamente en `charts.js`. Eliminada la copia de `app.js`.

### Reason
Una sola definición evita divergencias futuras. `charts.js` se carga antes que `app.js`, por lo que está disponible en todo el runtime.

---

### Decision
Los gastos en los KPIs se muestran como valor positivo con color rojo, no como negativo.

### Reason
Más legible. El color rojo ya comunica la naturaleza del valor; mostrar el signo negativo añade ruido visual.

---

### Decision
Añadir "Tasa de ahorro" como cuarto KPI en lugar de dejarlo fuera.

### Reason
Es el indicador más accionable del tab Resumen. Relaciona ingresos y balance en un solo número.

---

### Decision
Tabla resumen por categoría en el tab Categorías va encima de la lista de transacciones.

### Reason
La tabla resumen (categoría, total, %) tiene más densidad informativa y se consulta primero. La lista de transacciones es el detalle, va después.

---

### Decision
El filtro de categoría en Transacciones es un selector independiente, no integrado en el de mes.

### Reason
Permite combinar ambos filtros (mes + categoría) sin complejidad adicional de UI.

---

## 2026-06-02

### Decision
Tab Categorías usa gráfico de barras horizontales (indexAxis: 'y').

### Reason
Con múltiples categorías, las barras horizontales permiten leer las etiquetas sin rotación.

---

### Decision
Tab Categorías tiene su propio selector de mes independiente del selector global de Resumen.

### Reason
Cada tab mantiene su propio estado de filtro para no interferir con la vista de otros tabs.

---

### Decision
Fusionar gráfico de barras y línea de saldo acumulado del tab Guille en un único chart mixto.

### Reason
Reduce scroll y permite correlacionar visualmente flujo mensual con saldo acumulado.

---

### Decision
Eliminar el bloque <script> inline de index.html y cargar app.js como script externo.

### Reason
El bloque inline duplicaba init() y no cargaba switchTab().

---

## 2026-06-01

### Decision
Create a project memory framework inside the repository.
### Reason
Allow future AI agents and developers to reconstruct project state without relying on chat history.

### Decision
renderDonut() consumes filteredData() directly.
### Reason
Ensures the donut chart always reflects the active period and month filter.
