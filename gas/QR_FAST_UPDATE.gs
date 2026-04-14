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
  // El script prueba cada uno hasta encontrar el correcto
  ID_COLUMN_NAMES: ['N° Cotización', 'N Cotizacion', 'Pedido ID', 'ID', 'pedido_id', 'NCotizacion'],

  // Nombre(s) posibles del encabezado de estado de producción
  STATUS_COLUMN_NAMES: ['Estado Produccion', 'Estado Producción', 'estado_produccion', 'Estado'],
};


// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────

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


// ─────────────────────────────────────────────
// LEER PEDIDO
// ─────────────────────────────────────────────

/**
 * Busca un pedido por ID y retorna sus datos normalizados.
 * @param {string} rawId
 * @returns {{ success: boolean, data: Object }}
 */
function getPedidoById_(rawId) {
  const id = normalizeKey_(rawId);
  const { sheet, headers, rows } = getSheetContext_();

  // Encontrar columna ID
  const idColIdx = findColumnIndex_(headers, QR_CFG.ID_COLUMN_NAMES);
  if (idColIdx === -1) throw new Error('No se encontró columna de ID en la hoja.');

  // Encontrar la fila del pedido
  for (let i = 0; i < rows.length; i++) {
    const rowId = normalizeKey_(String(rows[i][idColIdx] || ''));
    if (rowId === id) {
      const pedido = buildPedidoObject_(headers, rows[i]);
      return { success: true, data: pedido };
    }
  }

  return { success: false, error: 'Pedido ' + id + ' no encontrado.' };
}


// ─────────────────────────────────────────────
// ACTUALIZAR ESTADO
// ─────────────────────────────────────────────

/**
 * Actualiza el estado y las celdas adicionales de un pedido.
 * Las celdas extra se pasan como params individuales con clave = letra de columna.
 * Ej: ?action=updateStatus&pedidoId=123&newStatus=Asignado&J=2025-01-01&AJ=Gabriel
 *
 * @param {string} rawId
 * @param {string} newStatus
 * @param {Object} params  — todos los query params del request
 * @returns {{ success: boolean }}
 */
function updatePedidoStatus_(rawId, newStatus, params) {
  const id = normalizeKey_(rawId);
  const { sheet, headers, rows } = getSheetContext_();

  const idColIdx = findColumnIndex_(headers, QR_CFG.ID_COLUMN_NAMES);
  if (idColIdx === -1) throw new Error('No se encontró columna de ID en la hoja.');

  const statusColIdx = findColumnIndex_(headers, QR_CFG.STATUS_COLUMN_NAMES);

  // Fila real en la hoja (1-based, considerando header row)
  let targetRowNum = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowId = normalizeKey_(String(rows[i][idColIdx] || ''));
    if (rowId === id) {
      // rows[i] es el índice desde el primer dato; sumamos header row + 1 para fila real
      targetRowNum = QR_CFG.HEADER_ROW + 1 + i;
      break;
    }
  }

  if (targetRowNum === -1) {
    return { success: false, error: 'Pedido ' + id + ' no encontrado para actualizar.' };
  }

  // Actualizar columna de estado si la encontramos
  if (statusColIdx !== -1) {
    sheet.getRange(targetRowNum, statusColIdx + 1).setValue(newStatus);
  }

  // Actualizar celdas adicionales por letra de columna (J, K, L, F, AH, AI, AJ, etc.)
  const RESERVED_PARAMS = new Set(['action', 'pedidoId', 'newStatus', 'sig', 'b', 't']);
  Object.keys(params).forEach(key => {
    if (RESERVED_PARAMS.has(key)) return;

    // Detectar si es una letra de columna válida (A–ZZ)
    if (/^[A-Z]{1,2}$/.test(key)) {
      const colIdx = colLetterToIndex_(key); // 1-based
      const value = params[key];

      // Convertir 'true'/'false' a booleano para columnas de checkbox
      let finalValue = value;
      if (value === 'true') finalValue = true;
      else if (value === 'false') finalValue = false;

      sheet.getRange(targetRowNum, colIdx).setValue(finalValue);
    }
  });

  SpreadsheetApp.flush();
  console.log('[QR_FAST_UPDATE] Pedido ' + id + ' → ' + newStatus + ' (fila ' + targetRowNum + ')');

  return { success: true, updatedId: rawId, newStatus: newStatus };
}


// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

/**
 * Carga el contexto de la hoja: headers normalizados y filas de datos.
 */
function getSheetContext_() {
  const ss = SpreadsheetApp.openById(QR_CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(QR_CFG.SHEET_NAME);
  if (!sheet) throw new Error('No se encontró la hoja "' + QR_CFG.SHEET_NAME + '"');

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  // Encabezados en la fila configurada
  const headersRaw = sheet.getRange(QR_CFG.HEADER_ROW, 1, 1, lastCol).getValues()[0];
  const headers = headersRaw.map(h => normalizeHeader_(String(h)));

  // Filas de datos (desde fila siguiente al header hasta el final)
  const dataStartRow = QR_CFG.HEADER_ROW + 1;
  const numRows = lastRow - dataStartRow + 1;
  let rows = [];
  if (numRows > 0) {
    rows = sheet.getRange(dataStartRow, 1, numRows, lastCol).getValues();
  }

  return { sheet, headers, rows, headersRaw };
}

/**
 * Construye el objeto pedido a partir de una fila de datos.
 * Usa los nombres de encabezado originales como claves pero también
 * mapea los campos que usa el frontend a sus nombres esperados.
 */
function buildPedidoObject_(headers, row) {
  const obj = {};

  // Mapeo de encabezados normalizados → nombre de campo para el frontend
  const FIELD_MAP = {
    'ncotizacion':            'pedido_id',
    'n cotizacion':           'pedido_id',
    'pedido id':              'pedido_id',
    'id':                     'pedido_id',
    'nombre proyecto':        'nombre_proyecto',
    'nombre del proyecto':    'nombre_proyecto',
    'proyecto':               'nombre_proyecto',
    'sku':                    'sku',
    'codigo':                 'sku',
    'unidades':               'unidades',
    'cantidad':               'unidades',
    'taller':                 'taller',
    'proveedor':              'taller',
    'estado produccion':      'estado_produccion',
    'estado produccion':      'estado_produccion',
    'estado':                 'estado_produccion',
    // Columnas de trazabilidad Yute (por posición de letra, pero también por nombre)
    'fecha envio taller':     'fecha_envio_taller_diseno',
    'fecha envio taller diseno': 'fecha_envio_taller_diseno',
    'operario picking':       'operario_picking',
    'vb':                     'vb',
    'fecha vb':               'fecha_vb',
    'inicio impresion':       'fecha_vb',
    'impresor':               'impresor',
    'fecha retiro real':      'fecha_retiro_real',
    'retiro real':            'fecha_retiro_real',
    'comentario calidad':     'comentario_calidad',
  };

  headers.forEach((h, i) => {
    const fieldName = FIELD_MAP[h] || h.replace(/\s+/g, '_');
    const value = row[i];
    // Formatear fechas como strings legibles si son objetos Date
    if (value instanceof Date) {
      obj[fieldName] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    } else {
      obj[fieldName] = value;
    }
  });

  return obj;
}

/**
 * Busca la primera columna cuyos encabezados normalizado coincide con
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
 * A=1, B=2, Z=26, AA=27, AJ=36, etc.
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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/\s+/g, ' ')
    .trim();
}
