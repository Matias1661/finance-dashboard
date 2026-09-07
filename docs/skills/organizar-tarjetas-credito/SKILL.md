---
name: organizar-tarjetas-credito
description: >-
  Usar SIEMPRE que Matias pida "organizar tarjetas de crédito" o variantes
  cercanas (ej. "cargar extractos de tarjetas", "revisar tarjetas
  pendientes") sobre el Finance Dashboard (repo Matias1661/finance-dashboard).
  Este skill fuerza la verificación de contrato antes de cargar a Notion (ya
  hubo un caso de subida accidental de un extracto de una tercera tarjeta que
  no corresponde), la extracción de operaciones individuales además del
  resumen de periodo, el archivado de extractos ya cargados en la subcarpeta
  "Procesados" de Drive, y el orden completo del flujo (verificar versión del
  skill, detectar pendientes, extraer, confirmar en bloque, escribir en las
  dos DBs de Notion, sync y deploy automáticos, archivar).
---

# Organizar Tarjetas de Crédito

## Contexto

Matias tiene 2 tarjetas de crédito revolving activas (a diferencia de préstamos de cuota fija):
- **IKEA** (CaixaBank Payments & Consumer, contrato `WY 7230097`)
- **Visa Classic** (CaixaBank Payments & Consumer, contrato `9613.18.0486311-07`)

Existe una tercera tarjeta, **MyCard** (contrato `9613.18.9260197-98`), que opera en modalidad "pago total" (no revolving). Sus movimientos ya se cargan vía el CSV de Movimientos — **NUNCA cargar extractos de MyCard en estas DBs**, sería duplicar.

Dos DBs Notion relacionadas (bajo Finance Tracker):
- **Tarjetas de Crédito Revolving** (`collection://7ca19b93-347f-4cbf-8dde-753d16babf77`): una fila por tarjeta por periodo de liquidación (resumen: saldo, TIN/TAE, amortización, intereses, límite).
- **Operaciones Tarjetas de Crédito** (`collection://a7826aab-f105-4096-91f5-27903d97d60c`): una fila por operación individual (compra, fraccionada, disposición revolving), relacionada con la anterior vía "Periodo liquidación" / "Operaciones".

Extractos pendientes en Google Drive, carpeta "Tarjetas de crédito" (folder ID `1o6vv1ZNSZbKC_1AMh2eyf8wpq-HKShzT`). Los extractos ya cargados a Notion se archivan en la subcarpeta "Procesados" dentro de esa misma carpeta (folder ID `16-QivysQ_0iFdclW7D5Tv2WL_IyG6RLO`) — **la carpeta raíz "Tarjetas de crédito" solo debe contener extractos pendientes**, ver [2026-09-07] en docs/DECISIONS.md.

## Este skill corre como plugin instalado, no desde docs/skills/ del repo

**Fuente de verdad del procedimiento:** `docs/skills/organizar-tarjetas-credito/SKILL.md` en el repo. La copia que efectivamente se ejecuta vive instalada como plugin de sesión y no se actualiza sola cuando se edita el repo.

### 0. Verificar versión antes de correr el flujo
Antes del paso 1, comparar el contenido de este archivo contra `docs/skills/organizar-tarjetas-credito/SKILL.md` del repo (leer con la API autenticada de GitHub, nunca `raw.githubusercontent.com`). Si difieren de forma sustantiva (no solo espacios/formato), avisar a Matias explícitamente qué se desactualizó antes de continuar — no asumir cuál versión es la correcta ni aplicar el flujo viejo en silencio.

## Flujo

### 1. Detectar extractos pendientes
Buscar en Drive con `Google Drive:search_files`, query `parentId = '1o6vv1ZNSZbKC_1AMh2eyf8wpq-HKShzT'` (paginar con `pageToken`, la carpeta devuelve resultados en varias páginas). Esto ya excluye los archivados en "Procesados" porque están en otra carpeta. También revisar archivos subidos directo al chat.

### 2. Verificar número de contrato
Antes de tocar Notion, confirmar el número de contrato de cada extracto contra la tabla conocida:
- `WY 7230097` → IKEA
- `9613.18.0486311-07` → Visa Classic
- `9613.18.9260197-98` (MyCard) → **NUNCA cargar, ya viene por Movimientos**

Si aparece un contrato desconocido (ni IKEA, ni Visa Classic, ni MyCard), preguntar a Matias si es una tarjeta nueva a agregar o un archivo equivocado. No asumir.

### 3. Detectar duplicados
Consultar Notion en vivo con `notion-query-data-sources` contra `collection://7ca19b93-347f-4cbf-8dde-753d16babf77`, filtrando por Tarjeta + Periodo liquidación. No usar un registro/JSON local — la fuente de verdad es Notion.

### 4. Extraer datos de cada extracto pendiente
Para cada extracto nuevo, extraer DOS niveles de información:

**a) Resumen del periodo** (para "Tarjetas de Crédito Revolving"): Nombre, Tarjeta, Contrato, Periodo liquidación (rango), Fecha de cargo, Cuota mensual elegida, Aplazado periodo anterior, Operaciones del periodo, Amortización, Intereses del periodo, Aplazado próximo periodo, CER %, TIN mensual %, TIN anual %, TAE %, Límite crédito inicial, Límite disponible, Fecha proyectada cierre deuda, Fraccionado pendiente (solo IKEA), Notas.

**b) Operaciones individuales** (para "Operaciones Tarjetas de Crédito"): cada compra, compra fraccionada o disposición revolving que aparezca en el extracto — con Concepto, Fecha operación, Importe, Tipo (Compra normal / Fraccionada 0% / Disposición revolving / Otro), Cuotas (ej. "8/10", solo si aplica).

**Criterio clave para operaciones — evento único, no una fila por cuota:** una compra fraccionada a N cuotas aparece en N extractos consecutivos (con el contador de cuota avanzando cada vez), pero es UNA sola operación. Antes de crear una fila nueva en "Operaciones Tarjetas de Crédito", verificar si esa operación ya existe (mismo Concepto + Fecha operación + Tarjeta) — si existe, NO crear una fila nueva, solo actualizar el campo Cuotas de la fila existente con el progreso más reciente (ej. de "7/10" a "8/10"). Si la operación es nueva (primera aparición), crearla y vincularla al periodo de liquidación actual vía la relación "Periodo liquidación".

### 5. Confirmar en bloque
Mostrar TODOS los extractos pendientes juntos (resumen de periodo + operaciones detectadas) para que Matias confirme de una vez — no uno por uno.

### 6. Escribir en Notion
Tras la confirmación:
- Crear/actualizar filas en "Tarjetas de Crédito Revolving".
- Crear operaciones nuevas o actualizar el campo Cuotas de las existentes en "Operaciones Tarjetas de Crédito", vinculándolas a su periodo.

### 7. Sync y deploy automáticos
Sin pedir confirmación adicional:
1. Disparar `sync-finance-data` (workflow ID `286832931`), `POST /repos/Matias1661/finance-dashboard/actions/workflows/286832931/dispatches` con `{"ref":"main"}`.
2. Poll `/actions/workflows/286832931/runs?per_page=1` hasta que `status` sea `completed`.
3. Verificar que `finance_data.json` tenga las filas nuevas en `tarjetas_credito` y `tarjetas_credito_operaciones`.
4. Disparar `deploy-pages` (workflow ID `304763313`) de la misma forma.

### 8. Archivar extractos procesados
Sin pedir confirmación adicional (ya fue confirmado en el paso 5): mover cada PDF recién cargado de la carpeta "Tarjetas de crédito" a la subcarpeta "Procesados" (folder ID `16-QivysQ_0iFdclW7D5Tv2WL_IyG6RLO`) con `Google Drive:update_file`, pasando `parentId` = ID de "Procesados". Verificar al final que la carpeta raíz "Tarjetas de crédito" solo contenga la subcarpeta "Procesados" y, si los hubiera, extractos genuinamente nuevos que hayan llegado durante la ejecución.

## Notas técnicas

- Autenticación GitHub: token pegado por Matias en la página de Notion designada (ver sus preferencias de usuario). Nunca guardarlo en memoria ni repetirlo en texto plano.
- Rate limit Notion: sleep de 8 segundos entre llamadas consecutivas a `notion-update-page`.
- Fetch de SHA de GitHub siempre inmediatamente antes de cada PUT, nunca reusar uno de antes en la sesión.
