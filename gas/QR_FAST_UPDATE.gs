/**
 * ================================================================
 * QR FAST UPDATE — FUSIONADO EN CONTROL TOWER v3.2
 * ================================================================
 * Este script ya NO se despliega por separado.
 * Su lógica fue integrada en el GAS principal (Control Tower v3.2).
 *
 * INSTRUCCIONES PARA FUSIONAR EN EL GAS PRINCIPAL:
 * Agrega los bloques marcados como [PASO 1], [PASO 2], [PASO 3]
 * en los lugares indicados del script v3.2.
 * ================================================================
 */


// ================================================================
// [PASO 1] — Agregar en CFG (dentro del objeto CFG existente):
// ================================================================
//
//   QR_PEDIDO_CACHE_TTL: 300,   // Cache por pedido para QR: 5 minutos
//
// Ejemplo, justo después de CACHE_TTL:
//   CACHE_TTL: 120,
//   QR_PEDIDO_CACHE_TTL: 300,    // ← agregar esta línea
//   CACHE_KEY: "consolidado_full_v32",


// ================================================================
// [PASO 2] — Agregar estas dos funciones como una nueva sección,
// por ejemplo después de la sección "// ===== PEDIDOS =====" y
// antes de getConsolidatedData():
// ================================================================

/**
 * Lookup optimizado para QR: solo lee "Seguimiento talleres",
 * lee SOLO la columna ID para ubicar la fila y luego solo esa fila.
 * Cachea el resultado 5 minutos para que scans repetidos del mismo
 * pedido sean instantáneos (~0.5s vs ~4s sin cache).
 */
function getPedidoFast_(rawId) {
  const id = normalizeKey(rawId);

  // 1. Intentar desde cache (evita toda lectura de Sheets)
  const cache    = CacheService.getScriptCache();
  const cacheKey = 'qr_pedido_' + id;
  const cached   = cache.get(cacheKey);
  if (cached) {
    try { return { success: true, data: JSON.parse(cached), fromCache: true }; }
    catch(e) {} // cache corrupto, continuar
  }

  // 2. Abrir hoja
  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Seguimiento talleres");
  if (!sheet) throw new Error("Hoja 'Seguimiento talleres' no encontrada.");

  const lastCol      = sheet.getLastColumn();
  const lastRow      = sheet.getLastRow();
  const headerRow    = 2;
  const dataStartRow = headerRow + 1;
  const numRows      = Math.max(0, lastRow - dataStartRow + 1);
  if (numRows === 0) return { success: false, error: "Pedido no encontrado." };

  // 3. Leer encabezados
  const headersRaw  = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  const headersNorm = headersRaw.map(h => normalizeString(String(h)));

  // 4. Encontrar columna ID
  const ID_CANDIDATES = ['ncotizacion', 'nproyecto', 'pedidoid', 'id'];
  let idColIdx = -1;
  for (const c of ID_CANDIDATES) {
    const idx = headersNorm.indexOf(c);
    if (idx !== -1) { idColIdx = idx; break; }
  }
  if (idColIdx === -1) throw new Error("Columna ID no encontrada en encabezados.");

  // 5. Leer SOLO la columna ID (no toda la hoja)
  const idColumn = sheet.getRange(dataStartRow, idColIdx + 1, numRows, 1).getValues();

  let targetRowNum = -1;
  for (let i = 0; i < idColumn.length; i++) {
    if (normalizeKey(String(idColumn[i][0] || '')) === id) {
      targetRowNum = dataStartRow + i;
      break;
    }
  }
  if (targetRowNum === -1) return { success: false, error: "Pedido " + rawId + " no encontrado." };

  // 6. Leer SOLO la fila del pedido
  const rowData = sheet.getRange(targetRowNum, 1, 1, lastCol).getValues()[0];

  // 7. Construir objeto con los campos que necesita el QR
  const obj = {};
  headersNorm.forEach((h, i) => { if (headersRaw[i]) obj[h] = rowData[i]; });

  const pedido = {
    _row_key:                  'fast_' + targetRowNum,
    id,
    pedido_id:                 obj.ncotizacion || obj.nproyecto || id,
    nombre_proyecto:           obj.nombredelproyecto || obj.proyecto || "",
    sku:                       obj.sku || "",
    taller:                    obj.taller || "",
    estado_produccion:         obj.estado || obj.estadotaller || obj.estadoproduccion || "",
    unidades:                  parseNumber(obj.ud || obj.unidades || obj.cantidad),
    impresiones:               parseNumber(obj.impresiones || obj.ud || obj.unidades || 0),
    vb:                        obj.vb === true || String(obj.vb || "").toLowerCase() === "true",
    vb_cliente:                obj.vbcliente === true || String(obj.vbcliente || "").toLowerCase() === "true",
    fecha_vb:                  formatYMD(obj.fechavb || obj.inicioimpresion),
    fecha_envio_taller_diseno: formatYMD(obj.fechaenviotaller || obj.fechaenviotallerdiseno),
    fecha_retiro_ideal:        formatYMD(obj.fecharetirotallerideal || obj.fecharetiroideal),
    fecha_retiro_real:         formatYMD(obj.fecharetiroreal || obj.fecharealderetiro),
    impresor:                  obj.impresor || obj.operarioimpresion || "",
    operario_picking:          obj.operariopicking || "",
    comentario_calidad:        obj.controlcalidad || obj.notacalidad || "",
  };

  // 8. Guardar en cache
  try { cache.put(cacheKey, JSON.stringify(pedido), CFG.QR_PEDIDO_CACHE_TTL); } catch(e) {}

  return { success: true, data: pedido };
}

/**
 * Invalida el cache de un pedido QR.
 * Llamar después de cada actualización de estado.
 */
function invalidateQRCache_(pedidoId) {
  try { CacheService.getScriptCache().remove('qr_pedido_' + normalizeKey(pedidoId)); } catch(e) {}
}


// ================================================================
// [PASO 3a] — REEMPLAZAR la función lookupSinglePedidoLegacy
// para que use getPedidoFast_ en vez de getConsolidatedData()
// (getConsolidatedData carga TODAS las hojas — demasiado lento para QR)
// ================================================================

function lookupSinglePedidoLegacy(pedidoId) {
  const result = getPedidoFast_(pedidoId);
  if (!result.success) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: result.error }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Devolver en array para mantener compatibilidad con QuickUpdate.jsx (data[0])
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: [result.data], fromCache: result.fromCache || false }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ================================================================
// [PASO 3b] — En handleUpdate, AGREGAR esta línea justo después
// de la llamada a SpreadsheetApp.flush():
//
//   SpreadsheetApp.flush();
//   invalidateQRCache_(pedidoId);   // ← agregar esta línea
//   return { success: true, row: rowIndex };
//
// Esto asegura que el próximo scan QR del mismo pedido
// lea el estado nuevo en vez de devolver el cache viejo.
// ================================================================
