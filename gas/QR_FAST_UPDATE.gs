/**
 * ============================================================
 * QR FAST UPDATE — Google Apps Script Dedicado
 * ============================================================
 * Script INDEPENDIENTE del GAS principal.
 * Maneja únicamente el flujo de actualización vía QR escaneado.
 *
 * SETUP:
 * 1. Crear un nuevo proyecto en script.google.com
 * 2. Pegar este archivo completo
 * 3. Rellenar QR_CFG con los valores correctos
 * 4. Deploy → Web App → Execute as: Me → Access: Anyone
 * 5. Copiar la URL del deploy y ponerla en public/update.html (QR_GAS_URL)
 * ============================================================
 */

const QR_CFG = {
  // ⚠️ REEMPLAZAR con el ID de tu Google Sheet (URL: /spreadsheets/d/ESTE_ID/edit)
  SPREADSHEET_ID: '1HEvu5vPJFpanPeD21iiEE_FsCBgeBwqrBoVOM4kAepM',

  // Nombre exacto de la hoja de producción
  SHEET_NAME: 'Seguimiento talleres',

  // Fila donde están los encabezados (la mayoría usa fila 1 o 2)
  HEADER_ROW: 2,

  // Debe coincidir exactamente con CLIENT_SALT en src/config/security.js
  CLIENT_SALT: 'yute_impresiones_secure_2024_auth_key_v1',

  // Nombre(s) posibles del encabezado de la columna de ID de pedido
  ID_COLUMN_NAMES: ['N° Cotización', 'N Cotizacion', 'Pedido ID', 'ID', 'pedido_id', 'NCotizacion'],

  // Nombre(s) posibles del encabezado de estado de producción
  STATUS_COLUMN_NAMES: ['Estado Produccion', 'Estado Producción', 'estado_produccion', 'Estado'],

  // TTL del cache de pedidos en segundos (5 minutos)
  CACHE_TTL: 300,
};


// ─────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────

function doGet(e) {
  const params = e.parameter || {};
  let result;

  try {
    const action = params.action || 'getPedido';

    if (action === 'getPedido') {
      if (!params.pedidoId) throw new Error('Falta pedidoId');
      result = getPedidoById_(params.pedidoId);

    } else if (action === 'updateStatus') {
      if (!params.pedidoId) throw new Error('Falta pedidoId');
      if (!params.newStatus) throw new Error('Falta newStatus');
      result = updatePedidoStatus_(params.pedidoId, params.newStatus, params);

    } else if (action === 'fraudReport') {
      // Solo loguear, no bloquear la respuesta
      console.warn('[QR_FAST_UPDATE] Posible fraude QR. pedidoId:', params.pedidoId, 'sig:', params.sig);
      result = { success: true };

    } else {
      result = { success: false, error: 'Acción no reconocida: ' + action };
    }

  } catch (err) {
    result = { success: false, error: err.message };
    console.error('[QR_FAST_UPDATE] Error:', err.message);
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


// ─────────────────────────────────────────
// LEER PEDIDO (con cache)
// ─────────────────────────────────────────

/**
 * Busca un pedido por ID y retorna sus datos normalizados.
 * Usa CacheService para evitar leer la hoja completa en cada scan.
 * Solo lee la columna ID para ubicar la fila, luego solo esa fila.
 */
function getPedidoById_(rawId) {
  const id = normalizeKey_(rawId);

  // 1. Intentar desde cache (evita toda lectura de Sheets)
  const cache = CacheService.getScriptCache();
  const cacheKey = 'qr_pedido_' + id;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return { success: true, data: JSON.parse(cached), fromCache: true };
    } catch (e) {
      // cache corrupto — continuar con lectura fresca
    }
  }

  // 2. Leer hoja solo donde es necesario
  const { sheet, headers, idColIdx, dataStartRow, numRows, lastCol } = getSheetMeta_();

  // 3. Leer SOLO la columna ID para encontrar la fila (mucho menos datos)
  const idColumn = sheet.getRange(dataStartRow, idColIdx + 1, numRows, 1).getValues();

  let targetRowNum = -1;
  for (let i = 0; i < idColumn.length; i++) {
    if (normalizeKey_(String(idColumn[i][0] || '')) === id) {
      targetRowNum = dataStartRow + i;
      break;
    }
  }

  if (targetRowNum === -1) {
    return { success: false, error: 'Pedido ' + rawId + ' no encontrado.' };
  }

  // 4. Leer SOLO la fila del pedido (no toda la hoja)
  const rowData = sheet.getRange(targetRowNum, 1, 1, lastCol).getValues()[0];
  const pedido = buildPedidoObject_(headers, rowData);

  // 5. Guardar en cache
  try {
    cache.put(cacheKey, JSON.stringify(pedido), QR_CFG.CACHE_TTL);
  } catch (e) {
    // Dato demasiado grande para cache — ignorar
  }

  return { success: true, data: pedido };
}


// ─────────────────────────────────────────
// ACTUALIZAR ESTADO
// ─────────────────────────────────────────

/**
 * Actualiza el estado y celdas adicionales de un pedido.
 * Invalida el cache del pedido actualizado.
 * Las celdas extra se pasan como params con clave = letra de columna.
 * Ej: ?action=updateStatus&pedidoId=123&newStatus=Asignado&J=2025-01-01&AJ=Gabriel
 */
function updatePedidoStatus_(rawId, newStatus, params) {
  const id = normalizeKey_(rawId);
  const { sheet, headers, idColIdx, statusColIdx, dataStartRow, numRows } = getSheetMeta_();

  // Leer solo columna ID para ubicar la fila
  const idColumn = sheet.getRange(dataStartRow, idColIdx + 1, numRows, 1).getValues();

  let targetRowNum = -1;
  for (let i = 0; i < idColumn.length; i++) {
    if (normalizeKey_(String(idColumn[i][0] || '')) === id) {
      targetRowNum = dataStartRow + i;
      break;
    }
  }

  if (targetRowNum === -1) {
    return { success: false, error: 'Pedido ' + rawId + ' no encontrado para actualizar.' };
  }

  // Actualizar columna de estado
  if (statusColIdx !== -1) {
    sheet.getRange(targetRowNum, statusColIdx + 1).setValue(newStatus);
  }

  // Actualizar celdas adicionales por letra de columna (J, K, L, F, AH, AI, AJ, etc.)
  const RESERVED_PARAMS = new Set(['action', 'pedidoId', 'newStatus', 'sig', 'b', 't']);
  Object.keys(params).forEach(key => {
    if (RESERVED_PARAMS.has(key)) return;
    if (/^[A-Z]{1,2}$/.test(key)) {
      const colIdx = colLetterToIndex_(key);
      let finalValue = params[key];
      if (finalValue === 'true') finalValue = true;
      else if (finalValue === 'false') finalValue = false;
      sheet.getRange(targetRowNum, colIdx).setValue(finalValue);
    }
  });

  SpreadsheetApp.flush();

  // Invalidar cache para que el próximo scan lea el estado actualizado
  try {
    CacheService.getScriptCache().remove('qr_pedido_' + id);
  } catch (e) {}

  console.log('[QR_FAST_UPDATE] Pedido ' + rawId + ' → ' + newStatus + ' (fila ' + targetRowNum + ')');
  return { success: true, updatedId: rawId, newStatus: newStatus };
}


// ─────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────

/**
 * Carga el contexto mínimo necesario de la hoja:
 * headers, índices de columnas clave, dimensiones.
 * NO lee las filas de datos (se hace por separado solo donde se necesita).
 */
function getSheetMeta_() {
  const ss = SpreadsheetApp.openById(QR_CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(QR_CFG.SHEET_NAME);
  if (!sheet) throw new Error('No se encontró la hoja "' + QR_CFG.SHEET_NAME + '"');

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  const headersRaw = sheet.getRange(QR_CFG.HEADER_ROW, 1, 1, lastCol).getValues()[0];
  const headers = headersRaw.map(h => normalizeHeader_(String(h)));

  const idColIdx = findColumnIndex_(headers, QR_CFG.ID_COLUMN_NAMES);
  if (idColIdx === -1) throw new Error('No se encontró columna de ID en la hoja.');

  const statusColIdx = findColumnIndex_(headers, QR_CFG.STATUS_COLUMN_NAMES);

  const dataStartRow = QR_CFG.HEADER_ROW + 1;
  const numRows = Math.max(0, lastRow - dataStartRow + 1);

  return { sheet, headers, headersRaw, idColIdx, statusColIdx, dataStartRow, numRows, lastCol };
}

/**
 * Construye el objeto pedido a partir de una fila de datos.
 */
function buildPedidoObject_(headers, row) {
  const obj = {};

  const FIELD_MAP = {
    'ncotizacion':                'pedido_id',
    'n cotizacion':               'pedido_id',
    'pedido id':                  'pedido_id',
    'id':                         'pedido_id',
    'nombre proyecto':            'nombre_proyecto',
    'nombre del proyecto':        'nombre_proyecto',
    'proyecto':                   'nombre_proyecto',
    'sku':                        'sku',
    'codigo':                     'sku',
    'unidades':                   'unidades',
    'cantidad':                   'unidades',
    'taller':                     'taller',
    'proveedor':                  'taller',
    'estado produccion':          'estado_produccion',
    'estado':                     'estado_produccion',
    'fecha envio taller':         'fecha_envio_taller_diseno',
    'fecha envio taller diseno':  'fecha_envio_taller_diseno',
    'operario picking':           'operario_picking',
    'vb':                         'vb',
    'fecha vb':                   'fecha_vb',
    'inicio impresion':           'fecha_vb',
    'impresor':                   'impresor',
    'fecha retiro real':          'fecha_retiro_real',
    'retiro real':                'fecha_retiro_real',
    'comentario calidad':         'comentario_calidad',
  };

  headers.forEach((h, i) => {
    const fieldName = FIELD_MAP[h] || h.replace(/\s+/g, '_');
    const value = row[i];
    if (value instanceof Date) {
      obj[fieldName] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    } else {
      obj[fieldName] = value;
    }
  });

  return obj;
}

/**
 * Busca la primera columna cuyo encabezado normalizado coincide con
 * alguno de los nombres candidatos. Retorna el índice 0-based o -1.
 */
function findColumnIndex_(normalizedHeaders, candidateNames) {
  const candidates = candidateNames.map(normalizeHeader_);
  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (candidates.includes(normalizedHeaders[i])) return i;
  }
  return -1;
}

/**
 * Convierte una letra de columna (A, B, Z, AA, AJ, etc.) en índice 1-based.
 */
function colLetterToIndex_(col) {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

/**
 * Normaliza una clave de ID: quita #, espacios, minúsculas.
 */
function normalizeKey_(val) {
  return String(val || '').replace(/#/g, '').trim().toLowerCase();
}

/**
 * Normaliza un nombre de encabezado: minúsculas, sin acentos, sin dobles espacios.
 */
function normalizeHeader_(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
