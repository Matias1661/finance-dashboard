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
     cruza con Google Calendar + Gmail → llama Claude API
     escribe resultado al Sheet + genera verification_data.json
        ↓
   Dashboard (index.html consume finance_data.json en runtime)
```

Una sola cuenta bancaria. Relay extrae: concepto, fecha (YYYY-MM-DD), importe (negativo=gasto, positivo=ingreso), categoría.

---

## Schema de finance_data.json

| Campo | Descripción |
|---|---|
| fecha | Fecha del movimiento (YYYY-MM-DD) |
| concepto | Descripción del movimiento |
| monto | Negativo=gasto, positivo=ingreso |
| categoria | Categoría asignada por Relay |
| categoria_relay | Categoría original de Relay |
| verificado_claude | true / false |
| categoria_sugerida | Sugerencia de reclasificación por Claude |
| confianza | alta / media / baja |
| razon_verificacion | Explicación del criterio usado |
| fecha_verificacion | Fecha en que Claude verificó |

Claude solo escribe las últimas 5 columnas.

---

## Categorías

### Excluidas del análisis principal
`Guille` e `Inversion` — ver `js/state.js` → `excludedCategories`.

### Lista completa de categorías válidas
Salidas, Comer afuera, Combustible, Guille, Gastos coche, Compras, Gastos moto, Departamento, Club, Suscripciones, Gastos en conjunto, Inversion, Viajes, Nomina, Otros, Tarjeta, Supermercado, A revisar

---

## Arquitectura del frontend

### Regla crítica de carga de scripts

```html
<script src="js/state.js"></script>
<script src="js/filters.js"></script>
<script src="js/charts.js"></script>
<script src="js/app.js"></script>
```

Sin bloques `<script>` inline con lógica de negocio.

### Módulos

**js/state.js**
- `window.FINANCE_STATE`: raw, excludedCategories, activePeriod, activeMonth

**js/filters.js**
- `filteredData()` — filtra por periodo, mes y categorías excluidas. Consumida por charts.js y app.js.
- `setPeriod(m, el)` — actualiza activePeriod. "Todo" usa valor `999`.
- `setMonthFilter(m)` — actualiza activeMonth
- `populateMonthSelector(RAW)` — selector del tab Resumen

**js/charts.js**
- `formatEUR(v)` — fuente única del formateador EUR. No duplicar en otros módulos.
- `renderKPIs()` — 4 tarjetas: Ingresos, Gastos (positivo con rojo), Balance, Tasa de ahorro. Consume `filteredData()`.
- `renderMonthly()` — barras ingresos/gastos por mes. Consume `filteredData()`. Eje Y en EUR.
- `renderDonut()` — donut de gastos por categoría. Consume `filteredData()`.

**js/app.js**
- `init()` — carga finance_data.json, inyecta en FINANCE_STATE, puebla selectores, rellena #last-updated, llama renderResumen()
- `renderResumen()` → renderKPIs + renderMonthly + renderDonut
- `renderCategorias()` — barras horizontales + tabla resumen (cat/movimientos/total/%) + lista transacciones
- `renderTransacciones()` — tabla filtrable por mes y categoría (ingresos y gastos)
- `renderGuille()` — KPIs (3) + chart mixto + tabla filtrable por mes
- `switchTab(tab, el)` — activa panel, llama render correspondiente
- Selectores: `populateTxMonthSelector`, `populateTxCatSelector`, `populateCatMonthSelector`, `populateGuilleMonthSelector`
- `populateCatMonthSelector` se llama también en `switchTab('categorias')` por compatibilidad con Safari

**index.html**
- Solo estructura HTML e imports. Sin lógica inline.
- Clases de altura de chart: `.chart-wrap` (260px), `.chart-wrap-tall` (320px), `.chart-wrap-xtall` (420px)

---

## Gráfico de Guille — especificación técnica

El gráfico mixto de Guille requiere configuración específica por la diferencia de escala entre datasets:

- Barras (Depositado, Gastado): rango típico 300–2000€/mes → eje Y izquierdo (`y`)
- Línea (Saldo acumulado): rango típico -2700 a +11000€ → eje Y derecho (`y2`)
- Ambos ejes formateados en EUR con `maximumFractionDigits: 0`
- `type: 'bar'` obligatorio a nivel raíz del chart (Chart.js 4 lo requiere aunque los datasets lo declaren individualmente)
- `interaction: { mode: 'index', intersect: false }` para tooltip unificado por mes
- Línea con `fill: true` y `backgroundColor: rgba(37,99,190,0.08)` para área bajo la curva
- Puntos con borde azul y fondo blanco para visibilidad sobre las barras
- Canvas en `.chart-wrap-xtall` (420px) para acomodar 18 meses sin compresión

---

## Tabs

| Tab | Función de render | Contenido |
|---|---|---|
| Resumen | renderResumen() | KPIs (4), periodo pills, selector mes, gráfico mensual EUR, donut categorías |
| Categorías | renderCategorias() | Selector mes, barras horizontales, tabla resumen por cat, lista transacciones |
| Transacciones | renderTransacciones() | Selector mes + categoría, tabla completa |
| Guille | renderGuille() | KPIs (3), chart mixto dual-Y, selector mes, tabla movimientos |

---

## Design system

- Fondo: `#f8f8f6` / Superficie: `#ffffff` / Max-width: 1100px
- Fuentes: DM Sans + DM Mono (Google Fonts)
- Verde: `#0d8a52` / Rojo: `#c94a30` / Ámbar: `#9a6200` / Azul: `#2563be`
- Border: `rgba(0,0,0,0.08)` / Shadow: `0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)`
- Border radius: 12px
- KPI values: `font-size:22px; font-weight:600` con color semántico
- Gastos siempre en positivo con color rojo
- Tooltips: `backgroundColor: #ffffff`, `borderColor: rgba(0,0,0,0.12)`, `borderWidth: 1`
- Mobile: KPI grid 2 columnas en ≤640px

---

## Flujo "Organizar Movimientos" — implementado 2026-06-04

**Trigger:** escribir "Organizar Movimientos" en el chat de Claude.

**Qué hace Claude al recibir el trigger:**
1. Lee `finance_data.json` del repo (GitHub API)
2. Lee `reviewed_movements.json` del repo — lista de claves `fecha|concepto|monto` ya revisadas
3. Filtra candidatos no revisados por fase (PayPal, Uber, Amazon, Viajes)
4. Para PayPal/Uber/Amazon: busca en Gmail el recibo por fecha y remitente
5. Presenta propuestas al usuario fase a fase, una por una en el chat
6. Aplica aprobados en batch via `update-sheet-cells.yml`
7. Actualiza `reviewed_movements.json` con todos los presentados (aprobados y rechazados)

**Registro:** `reviewed_movements.json` — `{ "reviewed": ["fecha|concepto|monto", ...] }`

**KPI:** card "Sin analizar por Claude" en tab Resumen — cuenta movimientos candidatos no en `reviewed_movements.json`

## Vista ampliada de Viajes — implementado 2026-06-04

**Trigger para iniciar:** "Implementa la vista ampliada de Viajes en el tab Categorías"

**Contexto:** Al filtrar por categoría "Viajes" en el tab Categorías, debe aparecer una sección adicional debajo del gráfico que agrupa los movimientos por viaje y muestra el desglose por subcategoría.

**Fuente de datos de viajes:** Los viajes se definen por eventos del Google Calendar. Para el dashboard (sin acceso al calendar en runtime), los viajes se hardcodean como constante `TRIP_WINDOWS` en `app.js` — lista de objetos `{ name, start, end }`. Se actualiza manualmente cuando se añaden viajes nuevos. Viajes confirmados a incluir (con movimientos reales en el dataset):

```js
const TRIP_WINDOWS = [
  { name: 'Gijón',         start: '2025-07-06', end: '2025-07-11' },
  { name: 'Spain Run',     start: '2025-09-12', end: '2025-09-14' },
  { name: 'Hotel Natursun (oct)', start: '2025-10-25', end: '2025-10-26' },
  { name: 'Bagger Racing', start: '2025-11-07', end: '2025-11-09' },
  { name: 'Toledo',        start: '2025-12-08', end: '2025-12-14' },
  { name: 'Alojamiento en Francia', start: '2026-03-25', end: '2026-03-29' },
  { name: '45 Aniversario París',   start: '2026-04-18', end: '2026-04-18' },
  { name: 'Málaga',        start: '2026-05-01', end: '2026-05-03' },
  { name: 'Viaje a Portugal', start: '2026-05-08', end: '2026-05-10' },
];
```

**Subcategorías** (inferidas del concepto, función `tripSubcategory(concepto)`):
- Combustible: repsol, shell, esso, moeve, sanse, ballenoil, p.serv, certif, galp
- Peajes: autopista, bidegi, cofiroute, atlandes, autoroutes, ap-
- Alojamiento: hotel, airbnb, hostal, apartamento, booking
- Transporte: iberia, vueling, ryanair, renfe, ouigo, blabla, uber, parking
- Comida: (resto de gastos negativos)
- Otros: lo que no encaje

**Comportamiento UI:**
- Solo visible cuando `activeCatBarFilter === 'Viajes'` en `renderCategorias()`
- Selector de mes existente aplica también a esta sección
- Por cada viaje dentro del período filtrado: card con nombre, fechas, total y tabla de subcategorías (nombre + importe)
- Debajo de cada card: lista colapsable de transacciones individuales del viaje
- Viajes sin movimientos en el período filtrado no se muestran
- Estilo: mismas cards del design system, sin librerías nuevas

**Archivos a modificar:** solo `js/app.js` (añadir `TRIP_WINDOWS`, `tripSubcategory()`, y sección en `renderCategorias()`) e `index.html` si hace falta un contenedor HTML nuevo.

---

## Categorías reembolsables

Las categorías listadas en `reimbursableCategories` (state.js) aplican netting: los ingresos de esa categoría restan al gasto bruto para calcular el gasto neto. Estas categorías son: Viajes, Club, Combustible, Comer afuera, Salidas, Gastos en conjunto.

La función canónica es `netExpenseByCategory(data)` en `charts.js`. No duplicar esta lógica en otros módulos.

Los ingresos de categorías reembolsables **no** se suman a los ingresos totales en KPIs ni en el gráfico mensual.

La tabla de transacciones individuales siempre muestra los movimientos sin modificar — el netting es solo en los agregados.

---

## Convenciones importantes

- `formatEUR` vive solo en `charts.js`. No duplicar.
- `filteredData()` es la función canónica para obtener datos filtrados en el tab Resumen.
- El periodo "Todo" usa valor numérico `999` en `setPeriod`.
- Los gastos en KPIs se muestran como positivos — el color rojo comunica el signo.
- `populateCatMonthSelector()` se llama en `init()` Y en `switchTab('categorias')`.
- El gráfico de Guille necesita `type: 'bar'` a nivel raíz aunque use datasets mixtos.

---

## Estado actual del sistema

Dashboard sin bugs conocidos. Todos los tabs operativos.

Próxima fase posible:
- Insights automáticos vía Claude API (comparación vs mes anterior, alertas)
- Detección de anomalías
- Capa de verificación (verification_data.json ya existe en el pipeline)
- Tab Inversiones

---

## Regla de trabajo obligatoria

1. Revisar todos los docs/ antes de implementar
2. Registrar decisiones en DECISIONS.md
3. Implementar
4. Actualizar CHANGELOG.md
5. Actualizar ROADMAP.md si aplica
6. Actualizar este documento si el contexto general cambia

---

## Mobile responsive (estado actual)

Breakpoints activos:
- `@media(max-width:640px)` — layout principal mobile
- `@media(max-width:380px)` — pantallas muy pequeñas (oculta header-meta)

Alturas de charts:
| Clase | Desktop | Mobile (≤640px) |
|---|---|---|
| `.chart-wrap` | 260px | 200px |
| `.chart-wrap-tall` | 320px | 240px |
| `.chart-wrap-xtall` | 340px | 260px |

Patrones CSS establecidos:
- Tabs: `width:100%`, cada `.tab` con `flex:1`
- Filtros: `flex-wrap:wrap` en `.filter-row`
- Selects: `flex:1; min-width:0; max-width:220px`
- KPIs con valores monetarios: `font-size: clamp(16px, 4vw, 22px)`

---

## Gráfico Guille — especificación actual

- **Ventana temporal:** últimos 12 meses disponibles en los datos
- **Saldo acumulado:** calculado desde el origen histórico completo, recortado a los últimos 12 para visualización
- **Ejes:** Y izquierdo = barras (dep/gas), Y derecho = línea saldo acumulado
- **Tipo raíz Chart.js:** `type:'bar'` obligatorio


---

## Tab Inversiones — especificación actual

**Fuente de datos:** `window.FINANCE_STATE.inversiones`, populado en `init()` desde `finance_data.json`. Se actualiza automáticamente con el sync diario — no requiere intervención manual.

**KPIs (4):**
- Capital total = Peerberry + MyInvestor último mes
- MyInvestor capital (último mes)
- Peerberry capital (último mes, muestra '—' si es 0)
- Rendimiento acumulado MyInvestor: producto de (1 + r/100) para todos los meses con % disponible

**Gráfico 1 — Capital apilado:**
- Tipo: `bar` apilado (`stack: 'capital'`)
- Datasets: Peerberry (ámbar), MyInvestor (verde)
- Tooltip muestra total apilado en footer
- Peerberry = 0 desde diciembre 2025 (plataforma liquidada)

**Gráfico 2 — Rendimiento %:**
- Tipo: `bar` agrupado
- MyInvestor negativo → rojo; MyInvestor positivo → verde
- Peerberry negativo → ámbar tenue; positivo → ámbar sólido
- Eje Y formateado con signo (+/-)

**Ventana temporal:** dinámica — todos los meses disponibles en la hoja `Inversiones` del sheet. Se extiende automáticamente con cada sync.

