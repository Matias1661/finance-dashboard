# Finance Dashboard — Project Memory

## Propósito
Memoria técnica central del proyecto. Cualquier agente de IA o desarrollador debe poder reconstruir el estado completo del proyecto leyendo solo este documento y los demás archivos en `docs/`.

Última actualización: 2026-06-02

---

## Repositorio

- Repo: `Matias1661/finance-dashboard`
- GitHub Pages: `https://matias1661.github.io/finance-dashboard/`
- Rama principal: `main`
- Frontend: HTML/CSS/JavaScript estático modularizado
- Librería de gráficos: Chart.js 4.4.1 (CDN)

---

## Pipeline de datos

```
Extracto bancario (banco)
        ↓
   Relay (categorización automática)
        ↓
   Google Sheets (fileId: 1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI)
        ↓
   GitHub Action diario → genera finance_data.json en el repo
        ↓
   GitHub Action de verificación:
     cruza con Google Calendar + Gmail
     llama Claude API
     escribe resultado al Sheet + genera verification_data.json
        ↓
   Dashboard (index.html consume finance_data.json en runtime)
```

Una sola cuenta bancaria. Relay extrae: concepto, fecha (DD-MM-AAAA), importe (negativo=gasto, positivo=ingreso), categoría.

---

## Schema de finance_data.json

Cada transacción tiene estos campos:

| Campo | Descripción |
|---|---|
| fecha | Fecha del movimiento (DD-MM-AAAA) |
| concepto | Descripción del movimiento |
| importe | Negativo=gasto, positivo=ingreso |
| categoria | Categoría asignada por Relay (campo usado en el frontend) |
| categoria_relay | Categoría original de Relay |
| verificado_claude | true / false |
| categoria_sugerida | Sugerencia de reclasificación por Claude |
| confianza | alta / media / baja |
| razon_verificacion | Explicación del criterio usado |
| fecha_verificacion | Fecha en que Claude verificó |

Claude solo escribe las últimas 5 columnas. Las primeras 4 las escribe el GitHub Action diario.

**IMPORTANTE:** En el frontend (charts.js, filters.js) el campo de importe se llama `monto`, no `importe`. Esto refleja el nombre del campo en el JSON consumido por el dashboard.

---

## Categorías

### Reglas duras — Claude no verifica

| Categoría | Criterio |
|---|---|
| Guille | PRES.323343588886 / TRANSF. A SU FAVOR / TRANSFER. EN DIV. / movimientos a pareja |
| Gastos coche | PRES.80194189697 / RECIBO UNICO MYBOX |
| Departamento | RECIBOS VARIOS |
| Nomina | Ingresos de nómina |
| Gastos en conjunto | Movimientos a cuenta conjunta con pareja |

### Reglas semi-duras (keyword) — Claude puede confirmar

| Categoría | Criterio |
|---|---|
| Combustible | REPSOL / SHELL / SANSE I |
| Comer afuera | UBER EATS / SERVIMATIC S.A |

### Categorías abiertas — Claude verifica activamente

| Categoría | Lógica de verificación |
|---|---|
| A revisar | Intentar reclasificar con Calendar + Gmail |
| Otros | Igual |
| Combustible | Verificar importe anómalo vs viaje en Calendar |
| Comer afuera vs Salidas | Mismo comercio puede ser ambos; Calendar ayuda (hora, día) |
| Viajes | Confirmar con Gmail (vuelos, hoteles) |
| Compras | Confirmar con Gmail (recibos Amazon, etc.) |

### Lista completa de categorías válidas

Salidas, Comer afuera, Combustible, Guille, Gastos coche, Compras, Gastos moto, Departamento, Club, Suscripciones, Gastos en conjunto, Inversion, Viajes, Nomina, Otros, Tarjeta, Supermercado, A revisar

### Categorías excluidas del análisis principal

`Guille` e `Inversion` están excluidas de KPIs y gráficos principales. Ver `js/state.js` → `excludedCategories`.

---

## Arquitectura del frontend

### Regla crítica de carga de scripts

index.html debe cargar los scripts en este orden exacto:

```html
<script src="js/state.js"></script>
<script src="js/filters.js"></script>
<script src="js/charts.js"></script>
<script src="js/app.js"></script>
```

No debe haber bloques `<script>` inline con lógica de negocio. Todo debe vivir en los módulos JS.

### Flujo de datos

```
finance_data.json
        ↓
   app.js (carga y orquesta)
        ↓
   state.js (almacena en window.FINANCE_STATE)
        ↓
   filters.js (transforma según periodo y mes activo)
        ↓
   charts.js (renderiza KPIs, gráficos de Resumen)
```

### Módulos

**js/state.js**
- Estado global centralizado en `window.FINANCE_STATE`
- Contiene: raw (datos brutos), excludedCategories, activePeriod, activeMonth
- Fuente única de verdad para el estado de la aplicación

**js/filters.js**
- Filtrado por periodo (6m / 12m / todo)
- Filtrado por mes específico (overrides al periodo)
- Lógica de exclusión de categorías
- `filteredData()` consumida por charts.js
- `setMonthFilter()` → llama a `renderResumen()` al cambiar el selector de mes
- `populateMonthSelector()` → puebla el select de Resumen con meses disponibles

**js/charts.js**
- `renderKPIs()` — tarjetas de ingresos, gastos, balance
- `renderMonthly()` — gráfico de barras ingresos vs gastos por mes
- `renderDonut()` — donut de gastos por categoría (responde al filtro de mes)
- Todos consumen `filteredData()`

**js/app.js**
- Carga `finance_data.json` e inyecta en `window.FINANCE_STATE`
- `init()` — punto de entrada, llamado en DOMContentLoaded
- `renderResumen()` → llama renderKPIs + renderMonthly + renderDonut
- `renderCategorias()` — barras horizontales de gasto por categoría, filtrable por mes; excluye Guille e Inversion
- `renderTransacciones()` — tabla filtrable por mes; excluye Guille e Inversion
- `renderGuille()` — KPIs + chart mixto (barras dep/gas + línea saldo acumulado, eje Y dual) + tabla filtrable
- `switchTab(tab, el)` — control de pestañas; llama la función de render correspondiente
- `populateMonthSelector()` — selector de Resumen
- `populateTxMonthSelector()` — selector de Transacciones
- `populateCatMonthSelector()` — selector de Categorías
- `populateGuilleMonthSelector()` — selector de Guille

**index.html**
- Solo estructura HTML, contenedores y `<link>`/`<script>` imports
- Sin lógica de negocio ni funciones inline

---

## Tabs

| Tab | ID panel | Función de render | Estado |
|---|---|---|---|
| Resumen | tab-resumen | renderResumen() | Activo |
| Categorías | tab-categorias | renderCategorias() | Activo |
| Transacciones | tab-transacciones | renderTransacciones() | Activo |
| Guille | tab-guille | renderGuille() | Activo |

---

## Contenido por tab

### Resumen
- KPIs: ingresos, gastos, balance
- Selector de periodo: 6m / 12m / Todo
- Selector de mes
- Gráfico de barras: ingresos vs gastos mensual
- Donut: gastos por categoría

### Categorías
- Selector de mes (propio, independiente del de Resumen)
- Gráfico de barras horizontales ordenado de mayor a menor gasto
- Color distinto por categoría
- Tooltip con importe en EUR

### Transacciones
- Selector de mes
- Tabla: fecha, concepto, categoría, importe

### Guille
- KPIs: total depositado, total gastado, saldo actual
- Chart mixto: barras (depositado/gastado por mes) + línea (saldo acumulado), eje Y dual
- Selector de mes + tabla de movimientos

---

## Design system

- Fondo: `#f8f8f6`
- Superficie: `#ffffff`
- Max-width: 1100px
- Fuentes: DM Sans (texto) + DM Mono (valores numéricos) — Google Fonts
- Verde: `#0d8a52`
- Rojo: `#c94a30`
- Ámbar: `#9a6200`
- Azul: `#2563be`
- Tooltips: fondo blanco, borde `rgba(0,0,0,0.12)`
- Border: `rgba(0,0,0,0.08)`
- Shadow: `0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)`
- Border radius: 12px

---

## Patrones de trabajo

- Dashboards 100% dinámicos — HTML consume JSON en runtime, sin datos embebidos
- Ediciones quirúrgicas sobre reescritura estructural
- Ante cualquier duda, preguntar antes de asumir
- Idioma de trabajo: español
- Actualizar docs/ al cierre de cualquier cambio significativo
- Excel: siempre con fórmulas

---

## Estado actual del sistema

Todos los tabs están operativos. El dashboard cubre análisis de gastos personales, exploración de transacciones y seguimiento de movimientos Guille.

Próxima fase posible:
- Capa de insights automáticos vía Claude API
- Motor de comparación mes a mes
- Detección de anomalías
- Capa de verificación (verification_data.json ya existe en el pipeline)

---

## Regla de trabajo obligatoria

Antes de implementar cambios significativos:
1. Revisar todos los docs/
2. Registrar decisiones en docs/DECISIONS.md
3. Implementar el cambio
4. Actualizar docs/CHANGELOG.md
5. Actualizar docs/ROADMAP.md si aplica
6. Actualizar este documento si el contexto general cambia
