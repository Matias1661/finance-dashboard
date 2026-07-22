---
name: organizar-movimientos
description: Usar SIEMPRE que Matias pida "organizar movimientos", "revisar movimientos pendientes", "qué falta categorizar", o cualquier variante sobre el flujo de revisión de movimientos del Finance Dashboard (repo Matias1661/finance-dashboard). Este skill fuerza el orden completo de fases (PayPal, Uber, Amazon, Viajes, residual) y NO debe saltearse ninguna, en particular el cruce contra TRIP_WINDOWS de js/app.js, que es fácil de olvidar porque no vive en ningún doc central del repo.
---

# Organizar Movimientos — Finance Dashboard

Flujo de revisión periódica de movimientos bancarios sin categorizar o sin confirmar,
del repo `Matias1661/finance-dashboard`. Repo es fuente de verdad (`docs/PROJECT_MEMORY.md`,
`DECISIONS.md`, `CHANGELOG.md`, `ROADMAP.md`) — leer eso primero si hay dudas de arquitectura
antes de asumir nada del historial de chat.

## Antes de empezar

1. Leer `docs/PROJECT_MEMORY.md` del repo (vía API autenticada de GitHub, nunca
   `raw.githubusercontent.com` si luego vas a editar — cache puede estar desactualizado).
2. Correr `scripts/find_pending.py` (bundled en este skill) para obtener el listado de
   movimientos pendientes YA cruzado contra viajes. No arrastres una lista hecha a mano en
   una sesión anterior — el repo puede haber cambiado.

```bash
python3 scripts/find_pending.py --github-token TOKEN
# o export GITHUB_TOKEN=... antes de correrlo (solo lectura, no hace falta para repos públicos)
```

Esto genera `pending_movements.json` y una tabla en consola con una columna `Viaje` que
indica si el movimiento cae dentro de una ventana de `TRIP_WINDOWS` (con el buffer de 3 días
que usa el propio dashboard para cargos de tarjeta demorados). **Esta es la fase que se había
olvidado antes** — el script la hace obligatoria porque no depende de la memoria de la sesión.

## Fases del flujo (en este orden)

1. **PayPal** — cruzar contra Gmail si hay movimientos con concepto PAYPAL.
2. **Uber** — distinguir Uber Rides vs Uber Eats vía Gmail si hace falta.
3. **Amazon** — Gmail + reglas automáticas (ver abajo), distinguir compras de reembolsos.
4. **Viajes** — cualquier movimiento cuya fecha caiga dentro de una ventana de
   `TRIP_WINDOWS` (columna `Viaje` del script) es candidato a categoría "Viajes". OJO:
   la ventana solo indica coincidencia de fecha, no causalidad — hay gastos recurrentes
   (cuotas, financiaciones) que caen ahí por casualidad del ciclo de tarjeta. Confirmar
   con el usuario cuáles son realmente del viaje antes de escribir en Notion.
5. **Residual** — el resto de los movimientos pendientes, uno por uno o en bloque si ya
   tienen categoría/nota razonable.

## Reglas automáticas de categorización (sin verificar por Gmail)

- `AMAZON.ES` o `WWW.AMAZON` a exactamente ±9.99€ → Kindle Unlimited (cargo o reembolso).
  Verificar el signo: -9.99 = cargo, +9.99 = reembolso del cargo de ese mes.
- `APPLE.COM/BILL`: -22€ Claude Pro, -3.49€ Hevy Pro, -2.99€ iCloud+, -29.99€ LinkedIn
  Premium Career (revisar periódicamente por cambios de precio).
- Pares de cargo/reembolso idénticos el mismo día o días cercanos (mismo concepto, mismo
  monto con signo opuesto) → probable cargo duplicado. Confirmar con el usuario cuál de
  los cargos negativos es la compra real antes de anotar "duplicado, reembolsado".

## Categorías siempre excluidas de "pendiente" (salvo flag forzado)

`Guille`, `Inversion`, `Talho Argentino`, `Suscripciones` — excepto si el concepto matchea
`PAYPAL`, `UBR`, `UBER `, `AMAZON`, `AMZN`, `WWW.AMAZON`, que se flaggean siempre.

## Escritura (solo tras confirmación del usuario)

1. **Notion**: `notion-query-data-sources` (SQL) sobre el data source de Movimientos
   (`367d58ce-928b-4e31-832d-07707f876365`) para localizar la página exacta por
   Fecha + Concepto + Monto. Si hay duplicados de esa clave (mismo concepto/monto/fecha),
   preguntar antes de escribir — no asumir cuál es cuál.
   `notion-update-page` con `command: update_properties` para Categoria y/o Nota.
   Esperar ~8 segundos entre llamadas sucesivas (rate limit de Notion).
2. **`reviewed_movements.json`** (GitHub): agregar la clave `fecha|concepto|monto` (monto
   como float) de CADA movimiento presentado, haya cambiado o no su categoría/nota.
   Requiere token de GitHub pegado por el usuario en la sesión — nunca se guarda, se usa
   una vez y se recomienda revocar después. Patrón: GET fresco del SHA → editar en memoria
   → PUT con ese SHA (nunca reusar un SHA de antes en la sesión).

## Al terminar

Si el flujo generó una decisión de categorización nueva y no obvia (ej. una regla automática
que no coincidía exactamente, un patrón de duplicado nuevo), registrarla en `docs/DECISIONS.md`
para que quede disponible para la próxima sesión, no solo en este skill.
