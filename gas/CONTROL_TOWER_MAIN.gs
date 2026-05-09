/**
 * ===============================================================
 * CONTROL TOWER v3.3 — Script Principal + QR Optimizado
 * ===============================================================
 * Spreadsheet ID: 1HEvu5vPJFpanPeD21iiEE_FsCBgeBwqrBoVOM4kAepM
 *
 * CAMBIOS v3.3 respecto a v3.2:
 *  - getPedidoFast_(): lookup QR optimizado (solo columna ID + fila target)
 *  - invalidateQRCache_(): invalida cache tras cada update
 *  - lookupSinglePedidoLegacy: usa getPedidoFast_ en vez de getConsolidatedData
 *  - handleUpdate: invalida cache QR tras SpreadsheetApp.flush()
 *  - CFG.QR_PEDIDO_CACHE_TTL: 300s (5 min cache por pedido)
 *  - Script QR_FAST_UPDATE.gs separado ya no es necesario
 * ===============================================================
 */

// ==================== CONFIG ====================

const CFG = {
  SPREADSHEET_ID: "1HEvu5vPJFpanPeD21iiEE_FsCBgeBwqrBoVOM4kAepM",
  TOKEN: PropertiesService.getScriptProperties().getProperty('TOKEN') || null,
  HMAC_KEY: PropertiesService.getScriptProperties().getProperty('HMAC_KEY') || null,
  TZ: "America/Santiago",
  TALLER_INTERNO: "Yute Impresiones",
  CACHE_TTL: 120,
  CACHE_KEY: "consolidado_full_v32",
  QR_PEDIDO_CACHE_TTL: 300,   // Cache por pedido para QR: 5 minutos
  TALLERES: [
    { id:"T1", nombre:"Yute Impresiones", tipo:"interno",  cap_imp:20000, cap_ud:20000 },
    { id:"T2", nombre:"Lidi",             tipo:"externo", cap_imp:15000, cap_ud:15000 },
    { id:"T3", nombre:"Pintapack",        tipo:"externo", cap_imp:15000, cap_ud:15000 },
    { id:"T4", nombre:"Romel",            tipo:"externo", cap_imp:10000, cap_ud:10000 },
    { id:"T5", nombre:"We Are SpA",       tipo:"externo", cap_imp:10000, cap_ud:10000 },
    { id:"T6", nombre:"Ideamania",        tipo:"externo", cap_imp:20000, cap_ud:20000 },
    { id:"T7", nombre:"Decaprint",        tipo:"externo", cap_imp:10000, cap_ud:10000 },
    { id:"T8", nombre:"SimplePrint",      tipo:"externo", cap_imp:10000, cap_ud:10000 },
  ],
  TALLERES_CORREOS: {
    "YUTE IMPRESIONES": { to:["gacevedo@yute.cl"], cc:[] },
    "LIDI":             { to:["produccion@estampadoslidi.cl"], cc:[] },
    "PINTAPACK":        { to:["produccion@pintapack.cl"], cc:["ventas@pintapack.cl"] },
    "ROMEL":            { to:["serviserigrafmg@gmail.com"], cc:[] },
    "WE ARE SPA":       { to:["camsdiseno@gmail.com"], cc:[] },
    "IDEAMANIA":        { to:["mario@ideamania.cl"], cc:["produccion@ideamania.cl","ventas@ideamania.cl","logisticaideamania@gmail.com"] },
  },
  CC_SIEMPRE: ["diseno@yute.cl"],
  ESTADOS_TALLER: [
    "Por Asignar","Asignado","Etiquetado","Pasar correo",
    "correo enviado","En Proceso","Listo Impresor",
    "Espera del VB cliente","En modificacion","Sin stock",
    "listo taller aun sin retirar","Listo Taller",
    "Ok. P. Factura","Enviado","Entregado","Anulado",
    "Pendiente de Armado","En Picking","En Packing",
    "En Tránsito Tienda","Listo Despacho","Listo Retiro Tienda",
  ],
  ESTADOS_LOGISTICOS: [
    "Pendiente de preparación","En preparación",
    "Listo para despacho","Envío Creado","Envío AM Oficina",
    "Envío PM Oficina","En tránsito","Listo retiro en Oficina",
    "Listo para Retiro en Bodega",
    "Listo en taller - Falta facturación",
    "Reprogramado/Devuelto","Incidencia en despacho",
    "Enviado","Entregado","Anulado",
  ],
  TRANSICIONES_QR_YUTE: {
    "Etiquetado":    { siguiente:"Asignado",       accion:"Confirmar picking" },
    "Asignado":      { siguiente:"En Proceso",     accion:"Iniciar impresión" },
    "En Proceso":    { siguiente:"Listo Impresor", accion:"Finalizar impresión" },
    "Listo Impresor":{ siguiente:"Listo Taller",   accion:"Aprobar QC" },
  },
  TRANSICIONES_QR_EXTERNO: {
    "Etiquetado": { siguiente:"En Proceso",   accion:"Entregar a taller" },
    "En Proceso": { siguiente:"Listo Taller", accion:"Retirar de taller" },
  },
  DIAS_ALERTA_ESTANCADO:    3,
  DIAS_ALERTA_VB:           2,
  PEDIDOS_SOBRECARGA_TALLER:8,
};

// ==================== HELPERS ====================

function normalizeString(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeKey(v) {
  const s = String(v || '').replace(/#/g, '').trim();
  const digits = s.match(/\d{5,}/);
  return digits ? digits[0] : s.toLowerCase();
}

function parseNumber(val) {
  if (!val && val !== 0) return 0;
  let clean = String(val).trim().replace(/[$%\s]/g, '');
  if (!clean) return 0;
  const dots   = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g)  || []).length;
  if (dots > 1)   return parseFloat(clean.replace(/\./g, ''));
  if (commas > 1) return parseFloat(clean.replace(/,/g, ''));
  if (dots === 1 && commas === 1) {
    return clean.indexOf('.') < clean.indexOf(',')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.'))
      : parseFloat(clean.replace(/,/g, ''));
  }
  if (dots === 1) {
    const parts = clean.split('.');
    return parts[1].length === 3 ? parseFloat(clean.replace(/\./g, '')) : parseFloat(clean);
  }
  if (commas === 1) {
    const parts = clean.split(',');
    return parts[1].length === 3 ? parseFloat(clean.replace(/,/g, '')) : parseFloat(clean.replace(',', '.'));
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function formatYMD(d) {
  if (!d) return "";
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return "";
  try { return Utilities.formatDate(d, CFG.TZ, "yyyy-MM-dd"); } catch(e) { return ""; }
}

function getWeekKey(d) {
  if (!d) return "";
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return "";
  const date = new Date(d.getTime());
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return date.getFullYear() + "-W" + String(weekNum).padStart(2, '0');
}

function getSheetData(sheet, headerRow) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= headerRow) return [];
  const values  = sheet.getRange(headerRow, 1, lastRow - headerRow + 1, lastCol).getValues();
  const headers = values[0];
  const data    = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    let hasData = false;
    headers.forEach((h, colIdx) => {
      if (h) {
        const val = values[i][colIdx];
        obj[normalizeString(h)] = val;
        if (val !== "") hasData = true;
      }
    });
    if (hasData) data.push(obj);
  }
  return data;
}

function getHeaderCol(sheet, headerName, headerRow) {
  const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const norm    = normalizeString(headerName);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeString(String(headers[i])) === norm) return i + 1;
  }
  return -1;
}

/**
 * Convierte letra(s) de columna a número 1-based.
 * "A"→1, "F"→6, "J"→10, "K"→11, "L"→12, "AH"→34, "AI"→35, "AJ"→36
 */
function colLetterToNum(letter) {
  letter = String(letter).toUpperCase().trim();
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num;
}

function businessDaysInclusive(startDate, endDate, holidayTs) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end   = new Date(endDate);   end.setHours(0,0,0,0);
  if (start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6 && (!holidayTs || !holidayTs.includes(cur.getTime()))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function delayBusinessDays(ideal, real, holidayTs) {
  if (!ideal || !real) return 0;
  const i = new Date(ideal); i.setHours(0,0,0,0);
  const r = new Date(real);  r.setHours(0,0,0,0);
  if (r <= i) return 0;
  return businessDaysInclusive(i, r, holidayTs) - 1;
}

function getHolidayIndex() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get("dash_holidays");
  if (cached) return JSON.parse(cached);
  try {
    const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Feriados");
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const ts = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
      .map(r => { const d = new Date(r[0]); d.setHours(0,0,0,0); return d.getTime(); })
      .filter(t => !isNaN(t));
    cache.put("dash_holidays", JSON.stringify(ts), 21600);
    return ts;
  } catch(e) { return []; }
}

function detectQRFlow(estado, taller) {
  const esYute      = normalizeString(taller).includes('yute');
  const transitions = esYute ? CFG.TRANSICIONES_QR_YUTE : CFG.TRANSICIONES_QR_EXTERNO;
  const current     = transitions[estado];
  if (!current) return null;
  return { flujo: esYute ? "interno" : "externo", siguiente: current.siguiente, accion_label: current.accion };
}

function getImpresiones(row, tallerNorm) {
  const unidades    = parseNumber(row.ud || row.unidades || row.cantidad);
  const impresiones = parseNumber(row.impresiones);
  if (tallerNorm && (tallerNorm.includes('yute') || tallerNorm.includes('we are'))) return unidades;
  return impresiones || unidades;
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== QR FAST LOOKUP ====================

/**
 * Lookup optimizado para QR: solo lee "Seguimiento talleres",
 * lee SOLO la columna ID para ubicar la fila y luego solo esa fila.
 * Cachea el resultado 5 minutos → scans repetidos del mismo pedido
 * son instantáneos (~0.5s vs ~4s sin cache).
 */
function getPedidoFast_(rawId) {
  const id = normalizeKey(rawId);

  // 1. Intentar desde cache (evita toda lectura de Sheets)
  const cache    = CacheService.getScriptCache();
  const cacheKey = 'qr_pedido_' + id;
  const cached   = cache.get(cacheKey);
  if (cached) {
    try { return { success: true, data: JSON.parse(cached), fromCache: true }; }
    catch(e) {} // cache corrupto — continuar con lectura fresca
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

  // 3. Leer encabezados (1 call)
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

  // 5. Leer SOLO la columna ID (1 call, N filas × 1 col en vez de N×M)
  const idColumn = sheet.getRange(dataStartRow, idColIdx + 1, numRows, 1).getValues();

  let targetRowNum = -1;
  for (let i = 0; i < idColumn.length; i++) {
    if (normalizeKey(String(idColumn[i][0] || '')) === id) {
      targetRowNum = dataStartRow + i;
      break;
    }
  }
  if (targetRowNum === -1) return { success: false, error: "Pedido " + rawId + " no encontrado." };

  // 6. Leer SOLO la fila del pedido (1 call, 1 fila × M cols)
  const rowData = sheet.getRange(targetRowNum, 1, 1, lastCol).getValues()[0];

  // 7. Construir objeto normalizado con los campos que necesita el QR
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

  // 8. Guardar en cache por 5 minutos
  try { cache.put(cacheKey, JSON.stringify(pedido), CFG.QR_PEDIDO_CACHE_TTL); } catch(e) {}

  return { success: true, data: pedido };
}

/**
 * Invalida el cache de un pedido QR.
 * Se llama automáticamente en handleUpdate tras cada cambio de estado.
 */
function invalidateQRCache_(pedidoId) {
  try { CacheService.getScriptCache().remove('qr_pedido_' + normalizeKey(pedidoId)); } catch(e) {}
}

// ==================== PEDIDOS ====================

function getConsolidatedData() {
  const ss      = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let allData   = [];
  const sources = [
    { name:"Seguimiento talleres",        headerRow:2, flujo:"CON IMPRESIÓN" },
    { name:"Hoja 22",                     headerRow:1, flujo:"CON IMPRESIÓN" },
    { name:"Respuestas de formulario 2",  headerRow:1, flujo:"CON IMPRESIÓN" },
    { name:"Sin Impresión",               headerRow:1, flujo:"DIRECTO"       },
  ];

  sources.forEach(source => {
    try {
      const sheet = ss.getSheetByName(source.name);
      if (!sheet) { console.warn(`Hoja "${source.name}" no encontrada.`); return; }

      const data       = getSheetData(sheet, source.headerRow);
      const normalized = data.map((row, idx) => {
        const id = normalizeKey(row.ncotizacion || row.nproyecto || row.pedidoid || row.id || row.idpedido || "");
        if (!id) return null;
        const taller     = row.taller || (source.flujo === "DIRECTO" ? "Fulfillment Directo" : "");
        const tallerNorm = normalizeString(taller);
        const statusVal  = row.estado || row.estadotaller || row.estadoproduccion || row.estadooperativo
                        || (source.flujo === "DIRECTO" ? "Pendiente de Armado" : "");
        return {
          _row_key:                `${source.name.replace(/\s/g,'').substring(0,6)}_${idx}`,
          id,
          pedido_id:               row.ncotizacion || row.nproyecto || id,
          nombre_proyecto:         row.nombredelproyecto || row.proyecto || "",
          cliente:                 row.cliente || row.nombre || "",
          documento:               row.documento || "",
          manifiesto:              row.manifiesto || "",
          taller,
          estado_produccion:       statusVal,
          estado_logistico:        row.estadologistico || row.estadooperativo || "",
          bultos:                  parseNumber(row.bultos || row.cajas),
          tipo_flujo:              source.flujo,
          fecha_envio_taller_diseno: formatYMD(row.fechaenviotaller || row.fechaenviotallerdiseno || row.entregaataller),
          vb_cliente: row.vb === true || String(row.vb || "").toLowerCase() === "true"
                   || row.vbcliente === true || String(row.vbcliente || "").toLowerCase() === "true",
          vb:         row.vb === true || String(row.vb || "").toLowerCase() === "true"
                   || row.vbcliente === true || String(row.vbcliente || "").toLowerCase() === "true",
          fecha_vb:                formatYMD(row.fechavb || row.inicioimpresion),
          fecha_retiro_ideal:      formatYMD(row.fecharetirotallerideal || row.fecharetiroideal || row.retiroideal
                                          || row.entregaestimada || row.fechaentrega || row.fecharetiro
                                          || row.entrega || row.retiro),
          fecha_retiro_real:       formatYMD(row.fecharetiroreal || row.fecharealderetiro || row.retirotaller),
          fecha_entrega:           formatYMD(row.fechaentrega || row.fechadeentrega || row.fechadadespacho),
          canal:                   row.canal || row.metodo || row.metodoventa || "",
          metodo_entrega:          row.metodoentrega || row.metododeentrega || "",
          comentario_kam:          row.comentarioskam || row.comentariokam || "",
          impresor:                row.impresor || row.operarioimpresion || "",
          comentario_taller:       row.comentariostaller || "",
          operario_picking:        row.operariopicking || "",
          nota_calidad:            row.controlcalidad || row.notacalidad || row.comentariocalidad || row.calidad || row.observacioncalidad || "",
          sku:                     row.sku || "",
          familia:                 row.familia || "",
          vendedor:                row.vendedor || row.kam || "",
          unidades:                parseNumber(row.ud || row.unidades || row.cantidad),
          impresiones:             getImpresiones(row, tallerNorm),
          semana:                  getWeekKey(row.fechaentrega || row.fechadeentrega || row.fecharetirotallerideal),
          _source:                 source.name,
        };
      }).filter(p => p !== null);

      allData = allData.concat(normalized);
    } catch(e) {
      console.error(`Error procesando hoja "${source.name}": ${e.message}`);
    }
  });

  // ── Merge datos logísticos desde hoja "Logística" ─────────────
  try {
    const logSheet = ss.getSheetByName("Logística") || ss.getSheetByName("Logistica");
    if (logSheet) {
      const logData = getSheetData(logSheet, 1);
      const logMap  = {};
      logData.forEach(row => {
        const pid = normalizeKey(
          row.npedidocotizacion || row.ncotizacion || row.nproyecto ||
          row.pedidoid || row.id || row.nro || ""
        );
        if (!pid) return;
        logMap[pid] = {
          canal:            row.metodo            || row.canal            || "",
          estado_logistico: row.estadologistico   || row.estadooperativo  || "",
          fecha_entrega:    formatYMD(
                              row.despachodeentregareal || row.despachoentregareal ||
                              row.despachorealentrega   || row.fechadespacho       || ""
                            ),
          metodo_entrega:   row.metododeentrega   || row.metodoentrega    || "",
          vendedor:         row.vendedor          || row.kam              || "",
          documento:        row.documentos        || row.documento        || "",
          comentario_kam:   row.comentariokam     || row.comentarioskam   || "",
        };
      });
      allData = allData.map(p => {
        const lp = logMap[normalizeKey(p.pedido_id)] || {};
        return {
          ...p,
          canal:            lp.canal            || p.canal            || "",
          estado_logistico: lp.estado_logistico || p.estado_logistico || "",
          fecha_entrega:    lp.fecha_entrega    || p.fecha_entrega    || "",
          metodo_entrega:   lp.metodo_entrega   || p.metodo_entrega   || "",
          vendedor:         lp.vendedor         || p.vendedor         || "",
          documento:        lp.documento        || p.documento        || "",
          comentario_kam:   lp.comentario_kam   || p.comentario_kam   || "",
        };
      });
      console.log(`[Logística] merge OK — ${Object.keys(logMap).length} filas`);
    } else {
      console.warn('[Logística] hoja no encontrada, saltando merge.');
    }
  } catch(e) {
    console.error("Error merging hoja Logística: " + e.message);
  }

  return allData;
}

// ==================== CAPACIDAD ====================

function getCapacidadPorTaller(semana) {
  try {
    const allPedidos   = getConsolidatedData();
    const capsVigentes = getCapacidadesVigentes(semana);
    const holidayTs    = getHolidayIndex();
    const hoy          = new Date();

    const pedidosSemana = allPedidos.filter(p => {
      const est = normalizeString(p.estado_produccion);
      return p.semana === semana &&
        !["listo taller","listo taller aun sin retirar","enviado","entregado","anulado"].includes(est);
    });

    return CFG.TALLERES.map(tInfo => {
      const tNorm     = normalizeString(tInfo.nombre);
      const tPedidos  = pedidosSemana.filter(p => normalizeString(p.taller) === tNorm);
      const cap       = capsVigentes[tNorm] || { imp: tInfo.cap_imp, ud: tInfo.cap_ud };
      const impUsadas = tPedidos.reduce((a, p) => a + (p.impresiones || 0), 0);
      const udUsadas  = tPedidos.reduce((a, p) => a + (p.unidades   || 0), 0);
      const pctMax    = Math.max(cap.imp > 0 ? impUsadas/cap.imp : 0, cap.ud > 0 ? udUsadas/cap.ud : 0);

      let totalRetraso = 0, cantConFecha = 0;
      tPedidos.forEach(p => {
        if (p.fecha_entrega) {
          const d = delayBusinessDays(p.fecha_entrega, hoy, holidayTs);
          if (d > 0) { totalRetraso += d; cantConFecha++; }
        }
      });

      return {
        taller:          tInfo.nombre,
        tipo:            tInfo.tipo,
        cap_max_imp:     cap.imp,
        cap_max_ud:      cap.ud,
        imp_usadas:      impUsadas,
        ud_usadas:       udUsadas,
        pct_ocupado:     Math.round(pctMax * 100),
        pedidos_activos: tPedidos.length,
        atraso_prom:     cantConFecha > 0 ? Math.round(totalRetraso / cantConFecha * 10) / 10 : 0,
        score:           calculateScore(pctMax, cantConFecha > 0 ? totalRetraso/cantConFecha : 0),
      };
    });
  } catch(e) {
    console.error("Error en getCapacidadPorTaller: " + e.message);
    return [];
  }
}

function getCapacidadesVigentes(semana) {
  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Capacidades Talleres");
  if (!sheet) return {};
  const caps = {};
  getSheetData(sheet, 1).forEach(row => {
    if (String(row.semana) === String(semana)) {
      caps[normalizeString(row.taller)] = { imp: parseNumber(row.capimp), ud: parseNumber(row.capud) };
    }
  });
  return caps;
}

function getCapacidadesMax() {
  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Capacidades Talleres") || createCapacidadesSheet();
  return getSheetData(sheet, 1);
}

function setCapacidad(taller, semana, capImp, capUd, usuario) {
  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Capacidades Talleres") || createCapacidadesSheet();
  sheet.appendRow([taller, semana, parseNumber(capImp), parseNumber(capUd), usuario, new Date()]);
  return { success: true };
}

function createCapacidadesSheet() {
  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.insertSheet("Capacidades Talleres");
  const hdrs  = ["Taller","Semana","Cap.Imp","Cap.Ud","Usuario","Timestamp"];
  sheet.appendRow(hdrs);
  sheet.getRange(1, 1, 1, hdrs.length).setFontWeight("bold").setBackground("#d9ead3");
  sheet.setFrozenRows(1);
  return sheet;
}

function calculateScore(occupancy, avgDelay) {
  let score = 100;
  if (occupancy > 0.85) score -= (occupancy - 0.85) * 200;
  score -= avgDelay * 10;
  return Math.max(0, Math.round(score));
}

// ==================== ESTADOS ====================

function handleQRScan(pedidoId, usuario, comentario, bulto, total, signature) {
  if (CFG.HMAC_KEY && !validateHMAC(pedidoId, bulto, total, signature)) {
    throw new Error("Firma QR inválida o manipulada.");
  }
  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Seguimiento talleres");
  if (!sheet) throw new Error("Hoja 'Seguimiento talleres' no encontrada.");

  const data     = getSheetData(sheet, 2);
  const searchId = normalizeKey(pedidoId);
  let rowIndex = -1, pedidoRaw = null;

  for (let i = 0; i < data.length; i++) {
    if (normalizeKey(data[i].ncotizacion || data[i].nproyecto || data[i].pedidoid || "") === searchId) {
      rowIndex  = i + 3;
      pedidoRaw = data[i];
      break;
    }
  }
  if (!pedidoRaw) throw new Error("Pedido no encontrado en taller.");

  const estadoActual = pedidoRaw.estado || pedidoRaw.estadotaller || pedidoRaw.estadoproduccion || "";
  const flow         = detectQRFlow(estadoActual, pedidoRaw.taller || "");
  if (!flow) throw new Error(`No hay acción QR configurada para el estado "${estadoActual}"`);

  const colStatus = getHeaderCol(sheet, "Estado", 2)
    || getHeaderCol(sheet, "Estado taller", 2)
    || getHeaderCol(sheet, "Estado Produccion", 2)
    || getHeaderCol(sheet, "Estado Producción", 2);
  if (colStatus === -1) throw new Error("Columna de estado no encontrada.");

  sheet.getRange(rowIndex, colStatus).setValue(flow.siguiente);
  logCambio({
    pedidoId: searchId, campo: "Estado",
    anterior: estadoActual, nuevo: flow.siguiente,
    usuario, taller: pedidoRaw.taller || "",
    tipoAccion: "QR_SCAN",
    comentario: `Bulto ${bulto}/${total}. ${comentario || ""}`,
  });

  invalidateQRCache_(pedidoId);

  return { success: true, estado_anterior: estadoActual, estado_nuevo: flow.siguiente, mensaje: flow.accion_label + " completado." };
}

/**
 * Actualiza estado y/o celdas de un pedido en "Seguimiento talleres".
 * cells acepta LETRAS de columna (J, AH, AJ, etc.) o nombres de encabezado.
 * Ejemplo: cells = { "J": "2024-01-15", "AH": "Gabriel Acevedo" }
 */
function handleUpdate(pedidoId, estado, bultos, usuario, cells) {
  const ss       = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const searchId = normalizeKey(pedidoId);
  let sheet, rowIndex = -1, pedidoRaw = null, headerRow = 2, isDirecto = false;

  // ── 1. Buscar en "Seguimiento talleres" ──────────────────────
  const sheetSeg = ss.getSheetByName("Seguimiento talleres");
  if (sheetSeg) {
    const data = getSheetData(sheetSeg, 2);
    for (let i = 0; i < data.length; i++) {
      const rowId = normalizeKey(data[i].ncotizacion || data[i].nproyecto || data[i].pedidoid || data[i].id || "");
      if (rowId === searchId) {
        sheet     = sheetSeg;
        rowIndex  = i + 3;
        pedidoRaw = data[i];
        headerRow = 2;
        break;
      }
    }
  }

  // ── 2. Si no encontrado, buscar en "Sin Impresión" ───────────
  if (!pedidoRaw) {
    const sheetSin = ss.getSheetByName("Sin Impresión");
    if (sheetSin) {
      const dataSin = getSheetData(sheetSin, 1);
      for (let i = 0; i < dataSin.length; i++) {
        const rowId = normalizeKey(dataSin[i].nproyecto || dataSin[i].ncotizacion || dataSin[i].pedidoid || dataSin[i].id || "");
        if (rowId === searchId) {
          sheet     = sheetSin;
          rowIndex  = i + 2;
          pedidoRaw = dataSin[i];
          headerRow = 1;
          isDirecto = true;
          break;
        }
      }
    }
  }

  if (!pedidoRaw) throw new Error("Pedido no encontrado: " + pedidoId);

  // ── Actualizar celdas específicas ──────────────────────────
  if (cells && typeof cells === 'object') {
    for (const key in cells) {
      if (!key || cells[key] === undefined || cells[key] === null) continue;
      let col = getHeaderCol(sheet, key, headerRow);
      if (col === -1 && /^[A-Z]{1,3}$/.test(String(key).toUpperCase())) {
        col = colLetterToNum(key);
      }
      if (col > 0) {
        const val  = cells[key];
        const cell = sheet.getRange(rowIndex, col);
        if      (val === true  || val === 'true')  cell.setValue(true);
        else if (val === false || val === 'false') cell.setValue(false);
        else cell.setValue(String(val));
      } else {
        console.warn(`[handleUpdate] Columna "${key}" no encontrada.`);
      }
    }
  }

  // ── Actualizar estado de producción ───────────────────────
  if (estado) {
    const colStatus = isDirecto
      ? getHeaderCol(sheet, "Estado Operativo", headerRow)
      : (getHeaderCol(sheet, "Estado", headerRow)
         || getHeaderCol(sheet, "Estado taller", headerRow)
         || getHeaderCol(sheet, "Estado Produccion", headerRow)
         || getHeaderCol(sheet, "Estado Producción", headerRow));

    if (colStatus > 0) {
      const anterior = pedidoRaw.estadooperativo || pedidoRaw.estado || pedidoRaw.estadotaller || "";
      sheet.getRange(rowIndex, colStatus).setValue(estado);
      logCambio({
        pedidoId: searchId, campo: "Estado",
        anterior, nuevo: estado,
        usuario: usuario || "Dashboard",
        taller:  pedidoRaw.taller || "Bodega",
        tipoAccion: isDirecto ? "BODEGA" : "MANUAL",
      });
    }

    // ── Columnas específicas de bodega (Sin Impresión) ─────────
    if (isDirecto) {
      const now        = new Date();
      const usuarioVal = usuario || "Bodega";
      const estadoNorm = normalizeString(estado);

      if (estadoNorm === "enpicking") {
        const colFecha   = getHeaderCol(sheet, "Fecha de Picking", headerRow);
        const colUsuario = getHeaderCol(sheet, "Usuario Picking", headerRow);
        if (colFecha   > 0) sheet.getRange(rowIndex, colFecha).setValue(now);
        if (colUsuario > 0) sheet.getRange(rowIndex, colUsuario).setValue(usuarioVal);
      }

      if (estadoNorm === "listodespacho" || estado === "Listo Retiro Tienda" || estado === "Listo Despacho" || estado === "En Tránsito Tienda") {
        const colFecha   = getHeaderCol(sheet, "Fecha Despacho", headerRow);
        const colUsuario = getHeaderCol(sheet, "Usuario Despacho", headerRow);
        if (colFecha   > 0) sheet.getRange(rowIndex, colFecha).setValue(now);
        if (colUsuario > 0) sheet.getRange(rowIndex, colUsuario).setValue(usuarioVal);
      }
    }
  }

  // ── Actualizar bultos / cajas ──────────────────────────────
  if (bultos) {
    const colBultos = getHeaderCol(sheet, "Bultos", headerRow)
      || getHeaderCol(sheet, "Cajas", headerRow);
    if (colBultos > 0) sheet.getRange(rowIndex, colBultos).setValue(bultos);
  }

  SpreadsheetApp.flush();
  invalidateQRCache_(pedidoId);   // Cache QR invalidado → próximo scan lee estado nuevo
  return { success: true, row: rowIndex };
}

function handleUpdateAction(params) {
  try {
    const estado = params.estado || params.newStatus;
    let cells = null;
    if (params.cells) {
      try { cells = JSON.parse(params.cells); } catch(e) {}
    }
    return handleUpdate(params.pedidoId, estado, params.bultos, params.usuario || "QR", cells);
  } catch(e) {
    return { success: false, error: e.message };
  }
}

/**
 * Inserta pedidos nuevos desde un manifiesto (ingesta directa).
 * Evita duplicar pedidos que ya existen por ID.
 */
function handleIngestDirectOrders(pedidosArray) {
  if (!pedidosArray || !pedidosArray.length) {
    return { success: false, error: "Array vacío" };
  }

  const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Seguimiento talleres");
  if (!sheet) throw new Error("Hoja 'Seguimiento talleres' no encontrada.");

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

  const headerColMap = {};
  headers.forEach((h, i) => { if (h) headerColMap[normalizeString(String(h))] = i + 1; });

  const data       = getSheetData(sheet, 2);
  const existingIds = new Set(
    data.map(r => normalizeKey(r.ncotizacion || r.nproyecto || r.pedidoid || r.id || ""))
  );

  let inserted = 0, skipped = 0;

  pedidosArray.forEach(p => {
    const pid = normalizeKey(p.pedido_id || p.id || "");
    if (!pid || existingIds.has(pid)) { skipped++; return; }

    const newRow = new Array(lastCol).fill("");
    Object.entries(p).forEach(([key, val]) => {
      const colNum = headerColMap[normalizeString(key)];
      if (colNum) newRow[colNum - 1] = val;
    });

    sheet.appendRow(newRow);
    existingIds.add(pid);
    inserted++;
  });

  SpreadsheetApp.flush();
  try { CacheService.getScriptCache().remove(CFG.CACHE_KEY); } catch(e) {}

  return { success: true, inserted, skipped };
}

function logCambio(params) {
  try {
    const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    let logSheet = ss.getSheetByName("Log Cambios");
    if (!logSheet) {
      logSheet = ss.insertSheet("Log Cambios");
      const hdrs = ["Timestamp","Pedido ID","Campo","Estado anterior","Estado nuevo","Usuario","Taller","Tipo acción","Comentario"];
      logSheet.appendRow(hdrs);
      logSheet.getRange(1, 1, 1, hdrs.length).setFontWeight("bold").setBackground("#f3f3f3");
      logSheet.setFrozenRows(1);
    }
    logSheet.appendRow([
      new Date(), params.pedidoId, params.campo,
      params.anterior || "", params.nuevo || "",
      params.usuario || "Desconocido", params.taller || "",
      params.tipoAccion || "MANUAL", params.comentario || "",
    ]);
  } catch(e) { console.error("Error en logCambio: " + e.message); }
}

function validateHMAC(pedidoId, bulto, total, signature) {
  if (!CFG.HMAC_KEY) return true;
  const message    = `${pedidoId}|${bulto}|${total}`;
  const hmac       = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, message, CFG.HMAC_KEY);
  const calculated = hmac.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  return calculated === signature;
}

// ==================== INFORMES ====================

function generarInformeTalleres() {
  const semana = getWeekKey(new Date());
  const kpis   = getCapacidadPorTaller(semana);
  const data   = getConsolidatedData();
  let txt = `*📊 INFORME OPERATIVO DE TALLERES - Semana ${semana}*\n_Generado el ${formatYMD(new Date())}_\n\n`;
  kpis.forEach(t => {
    const emoji = t.pct_ocupado > 90 ? "🔴" : t.pct_ocupado > 70 ? "🟡" : "🟢";
    txt += `${emoji} *${t.taller.toUpperCase()}*\n`;
    txt += `   • Carga: ${t.pct_ocupado}% (${t.imp_usadas.toLocaleString()} / ${t.cap_max_imp.toLocaleString()} imp)\n`;
    txt += `   • Pedidos Activos: ${t.pedidos_activos}\n`;
    txt += `   • Atraso Promedio: ${t.atraso_prom} días hábiles\n`;
    txt += `   • Salud: ${t.score}/100\n\n`;
  });
  const hoy    = new Date();
  const index  = getHolidayIndex();
  const criticos = data
    .filter(p => !p.fecha_retiro_real && p.fecha_retiro_ideal)
    .map(p => ({ ...p, delay: delayBusinessDays(p.fecha_retiro_ideal, hoy, index) }))
    .filter(p => p.delay > 0)
    .sort((a,b) => b.delay - a.delay)
    .slice(0, 5);
  if (criticos.length > 0) {
    txt += `*⚠️ TOP 5 ATRASOS CRÍTICOS:*\n`;
    criticos.forEach(p => { txt += `• #${p.pedido_id} - ${p.nombre_proyecto} (${p.taller}): *+${p.delay}d*\n`; });
  }
  return txt;
}

function generarInformeComercial() {
  const data   = getConsolidatedData();
  const hoyStr = formatYMD(new Date());
  const kams   = {};
  data.forEach(p => {
    const kam = p.vendedor || "Sin Asignar";
    if (!kams[kam]) kams[kam] = { total:0, pendientes:0, sin_vb:0, urgentes:0 };
    kams[kam].total++;
    const est = normalizeString(p.estado_produccion);
    if (!["enviado","entregado","anulado"].includes(est)) {
      kams[kam].pendientes++;
      if (!p.vb_cliente) kams[kam].sin_vb++;
      if (p.fecha_retiro_ideal <= hoyStr) kams[kam].urgentes++;
    }
  });
  let txt = `*💼 RESUMEN COMERCIAL - ESTADO DE PROYECTOS*\n\n`;
  Object.keys(kams).sort().forEach(kam => {
    const k = kams[kam];
    if (k.pendientes === 0) return;
    txt += `👤 *${kam}*\n• Pendientes: ${k.pendientes}\n`;
    if (k.sin_vb   > 0) txt += `⚠️ Sin VB Cliente: ${k.sin_vb}\n`;
    if (k.urgentes > 0) txt += `🚨 Vencidos/Hoy: ${k.urgentes}\n`;
    txt += `\n`;
  });
  return txt;
}

// ==================== ROUTER PRINCIPAL ====================

function doGet(e) {
  const startTime = Date.now();
  try {
    const params   = e ? (e.parameter || {}) : {};
    const action   = params.action;
    const token    = params.token;
    const pedidoId = params.pedidoId;

    // ── MODO LEGACY: sin token ni action ────────────────────────
    if (!action && !token) {
      if (pedidoId) return lookupSinglePedidoLegacy(pedidoId);

      const cache  = CacheService.getScriptCache();
      const cached = cache.get(CFG.CACHE_KEY);
      if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);

      const consolidated = getConsolidatedData();
      const out = JSON.stringify({ success:true, data:consolidated, ts:Date.now() });
      try { cache.put(CFG.CACHE_KEY, out, CFG.CACHE_TTL); } catch(cErr) { console.warn("No se pudo cachear:", cErr); }
      return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
    }

    // ── MODO NUEVO: con token ────────────────────────────────────
    if (CFG.TOKEN && token !== CFG.TOKEN) return response({ success:false, error:"401: Token inválido" });

    let result = null;
    switch (action) {
      case "all":
        result = { data: getConsolidatedData(), kpis: getCapacidadPorTaller(getWeekKey(new Date())), ts: new Date().toISOString() };
        break;
      case "lookup":
        result = lookupPedido(pedidoId);
        break;
      case "capacidad":
        result = { data: getCapacidadPorTaller(params.semana || getWeekKey(new Date())) };
        break;
      case "capacidades_max":
        result = { data: getCapacidadesMax() };
        break;
      case "feriados":
        result = { data: getHolidayIndex().map(ts => ({ fecha: formatYMD(new Date(ts)) })) };
        break;
      case "informe_talleres":
        result = { texto: generarInformeTalleres() };
        break;
      case "informe_comercial":
        result = { texto: generarInformeComercial() };
        break;
      case "updateStatus":
        result = handleUpdateAction(params);
        break;
      default:
        throw new Error(`Acción GET "${action}" no implementada.`);
    }

    return response({ success:true, ...result, _duration: Date.now() - startTime });

  } catch(err) {
    console.error("doGet error:", err.message);
    return response({ success:false, error: err.toString() });
  }
}

function doPost(e) {
  const startTime = Date.now();
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Cuerpo del POST vacío.");

    const body   = JSON.parse(e.postData.contents);
    const action = body.action || (e.parameter && e.parameter.action) || "";

    if (CFG.TOKEN && body.token !== CFG.TOKEN) return response({ success:false, error:"401: Token inválido" });

    let result = null;
    switch (action) {
      case "update":
        result = handleUpdate(body.pedidoId, body.estado, body.bultos, body.usuario, body.cells);
        break;

      case "qr_scan":
        result = handleQRScan(body.pedidoId, body.usuario, body.comentario, body.bulto, body.total, body.sig);
        break;

      case "set_capacidad":
        result = setCapacidad(body.taller, body.semana, body.capImp, body.capUd, body.usuario);
        break;

      case "batch_update":
        if (Array.isArray(body.updates)) {
          body.updates.forEach(u => handleUpdate(u.pedidoId, u.estado, u.bultos, u.usuario, u.cells));
        } else if (Array.isArray(body)) {
          body.forEach(u => handleUpdateAction(u));
        }
        result = { success: true };
        break;

      case "ingestDirectOrders":
        const pedidos = Array.isArray(body) ? body : (body.data || []);
        result = handleIngestDirectOrders(pedidos);
        break;

      default:
        throw new Error(`Acción POST "${action}" no implementada.`);
    }

    return response({ success:true, ...result, _duration: Date.now() - startTime });

  } catch(err) {
    console.error("doPost error:", err.message);
    return response({ success:false, error: err.message });
  }
}

// ── Búsqueda legacy para QR (optimizada con getPedidoFast_) ──────
function lookupSinglePedidoLegacy(pedidoId) {
  const result = getPedidoFast_(pedidoId);
  if (!result.success) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: result.error }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Devolver en array para mantener compatibilidad con QuickUpdate.jsx (usa data[0])
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: [result.data], fromCache: result.fromCache || false }))
    .setMimeType(ContentService.MimeType.JSON);
}

function lookupPedido(pedidoId) {
  if (!pedidoId) throw new Error("pedidoId es obligatorio.");
  const allData = getConsolidatedData();
  const pedido  = allData.find(p => p.id === normalizeKey(pedidoId));
  if (!pedido) throw new Error("Pedido no encontrado.");
  const flow = detectQRFlow(pedido.estado_produccion, pedido.taller);
  return {
    data:             pedido,
    flujo:            flow ? flow.flujo : null,
    siguiente_estado: flow ? flow.siguiente : null,
    accion_label:     flow ? flow.accion_label : null,
  };
}

// ==================== DIAGNÓSTICO ====================

/**
 * Ejecuta esta función desde el editor para verificar la configuración.
 * Menú: Ejecutar → diagnostico → revisar "Registros de ejecución"
 */
function diagnostico() {
  Logger.log("========== DIAGNÓSTICO CONTROL TOWER v3.3 ==========");

  // 1. Verificar hoja principal
  try {
    const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Seguimiento talleres");
    if (sheet) {
      Logger.log("✅ Hoja 'Seguimiento talleres' → " + sheet.getLastRow() + " filas");
    } else {
      Logger.log("❌ Hoja 'Seguimiento talleres' NO encontrada");
      Logger.log("   Hojas disponibles: " + ss.getSheets().map(s => s.getName()).join(", "));
    }
  } catch(e) {
    Logger.log("❌ Error accediendo al Spreadsheet: " + e.message);
    return;
  }

  // 2. Verificar colLetterToNum
  const tests = [["A",1],["F",6],["J",10],["K",11],["L",12],["AH",34],["AI",35],["AJ",36]];
  let allOk   = true;
  tests.forEach(([letter, expected]) => {
    const got  = colLetterToNum(letter);
    const pass = got === expected;
    if (!pass) allOk = false;
    Logger.log(`${pass ? "✅" : "❌"} colLetterToNum("${letter}") = ${got} (esperado: ${expected})`);
  });
  Logger.log(allOk ? "✅ Conversión de columnas correcta" : "⚠️  Error en conversión de columnas");

  // 3. Verificar headers de la hoja principal
  try {
    const ss      = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheet   = ss.getSheetByName("Seguimiento talleres");
    const headers = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
    const relevant = ["Estado","Impresor","Operario","Bultos","VB","Fecha"];
    Logger.log("\nEncabezados encontrados en fila 2:");
    headers.forEach((h, i) => {
      if (h && relevant.some(r => String(h).toLowerCase().includes(r.toLowerCase()))) {
        Logger.log(`  Col ${i+1}: "${h}"`);
      }
    });
  } catch(e) {
    Logger.log("❌ Error leyendo headers: " + e.message);
  }

  // 4. Test rápido de datos
  try {
    const data = getConsolidatedData();
    Logger.log(`\n✅ getConsolidatedData() → ${data.length} pedidos cargados`);
    if (data.length > 0) {
      const sample = data[0];
      Logger.log(`   Ejemplo: #${sample.pedido_id} - "${sample.nombre_proyecto}" - ${sample.taller}`);
    }
  } catch(e) {
    Logger.log("❌ Error en getConsolidatedData: " + e.message);
  }

  // 5. Test QR fast lookup
  try {
    const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Seguimiento talleres");
    const data  = getSheetData(sheet, 2);
    if (data.length > 0) {
      const sampleId = data[0].ncotizacion || data[0].nproyecto || "";
      if (sampleId) {
        const result = getPedidoFast_(sampleId);
        Logger.log(`\n${result.success ? "✅" : "❌"} getPedidoFast_("${sampleId}") → ${result.success ? "OK" : result.error}`);
        if (result.success) Logger.log(`   Estado: ${result.data.estado_produccion} | Taller: ${result.data.taller}`);
      }
    }
  } catch(e) {
    Logger.log("❌ Error en test getPedidoFast_: " + e.message);
  }

  Logger.log("\n=== FIN DIAGNÓSTICO ===");
}
