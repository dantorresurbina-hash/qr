import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// === URL DE GOOGLE APPS SCRIPT (MODO HIBRIDO: LOGISTICA + IMPRESION) ===
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuW-H13vlkvvPfPxLueo6hGEtJbthOTkWxBPvrdYN8Si3VRDGrem-VjM2cP4KhCJ_y/exec';

// Utilidad global para normalizar IDs (quitar # y espacios)
export const cleanId = (id) => String(id || '').replace(/#/g, '').trim();

// Configuramos las capacidades de taller, permitiendo sobreescribir con LocalStorage
const getInitialTalleres = () => {
  const saved = localStorage.getItem('dash_talleres_config');
  if (saved) return JSON.parse(saved);
  return [
    { id: "T1", nombre: "Yute Impresiones", capacidad_semanal_impresiones: 20000, direccion: "Lo Aguirre 1200 Pudahuel", email: "gacevedo@yute.cl", telefono: "994111596" },
    { id: "T2", nombre: "Lidi", capacidad_semanal_impresiones: 15000, direccion: "Santiago Concha 1324", email: "produccion@estampadoslidi.cl", telefono: "990486163" },
    { id: "T3", nombre: "Pintapack", capacidad_semanal_impresiones: 15000, direccion: "santa elvira 040 ñuñoa", email: "produccion@pintapack.cl", telefono: "958817605" },
    { id: "T4", nombre: "Romel", capacidad_semanal_impresiones: 10000, direccion: "PEDRO LEON UGALDE 1322", email: "serviserigrafmg@gmail.com", telefono: "935266119" },
    { id: "T5", nombre: "We Are SpA", capacidad_semanal_impresiones: 10000, direccion: "Caliche 855, Recoleta", email: "camsdiseno@gmail.com", telefono: "982936946" },
    { id: "T6", nombre: "Ideamania", capacidad_semanal_impresiones: 20000, direccion: "CHOPIN 3090 SAN JOAQUIN", email: "mario@ideamania.cl", telefono: "932388065" }
  ];
};

// Utilidad para obtener la fecha local en formato YYYY-MM-DD correcta para Chile
// Utilidad para limpiar y parsear números provenientes de Google Sheets (Locale indiferente)
export const parseNumber = (val) => {
  if (!val && val !== 0) return 0;
  
  let clean = String(val).trim().replace(/[$%\s]/g, '');
  if (!clean) return 0;

  // Contar ocurrencias de separadores
  const dots = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g) || []).length;

  // Caso de múltiples puntos (ej: 1.234.567) -> Miles
  if (dots > 1) return parseFloat(clean.replace(/\./g, ''));
  // Caso de múltiples comas (ej: 1,234,567) -> Miles
  if (commas > 1) return parseFloat(clean.replace(/,/g, ''));
  
  // Caso de uno de cada uno (ej: 1.234,56 o 1,234.56)
  if (dots === 1 && commas === 1) {
    const dotIdx = clean.indexOf('.');
    const commaIdx = clean.indexOf(',');
    if (dotIdx < commaIdx) {
      // 1.234,56 (Latam)
      return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } else {
      // 1,234.56 (US)
      return parseFloat(clean.replace(/,/g, ''));
    }
  }
  
  // Un solo separador: heurística de 3 dígitos (Miles vs Decimal)
  if (dots === 1) {
    const parts = clean.split('.');
    if (parts[1].length === 3) return parseFloat(clean.replace(/\./g, ''));
    return parseFloat(clean);
  }
  
  if (commas === 1) {
    const parts = clean.split(',');
    if (parts[1].length === 3) return parseFloat(clean.replace(/,/g, ''));
    return parseFloat(clean.replace(',', '.'));
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const SYNC_QUEUE_KEY = 'dash_sync_queue';

export const getLocalYMD = (date) => {
  if (!date) return ""; 
  
  // Si ya es un string YYYY-MM-DD
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.split('T')[0];
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Nueva utilidad para obtener hoy
export const getTodayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Formatea una fecha (Date o string ISO/YMD) para mostrar al usuario como DD/MM/YYYY
export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "-";
  try {
    // Si ya viene formateado YYYY-MM-DD (de nuestro GAS), evitar desfases
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};
export const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('dash_data_cache');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(() => {
    const saved = localStorage.getItem('dash_last_sync');
    return saved ? new Date(saved) : null;
  });
  const [isLocalStorage, setIsLocalStorage] = useState(!!localStorage.getItem('dash_data_cache'));
  const [turboSpeed, setTurboSpeed] = React.useState(null); // Tiempo de la última sincronización
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('dash_role') || 'kam');

  const [talleres, setTalleres] = useState(getInitialTalleres);

  // Función para cambiar de rol
  const updateRole = (role) => {
    setUserRole(role);
    sessionStorage.setItem('dash_role', role);
  };

  // Función para guardar nuevas capacidades
  const updateTalleres = (nuevosTalleres) => {
    setTalleres(nuevosTalleres);
    localStorage.setItem('dash_talleres_config', JSON.stringify(nuevosTalleres));
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();
    
    // Timeout de 30 segundos para evitar bloqueos infinitos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    try {
      // Agregamos timestamp y varios headers de no-cache para forzar datos nuevos
      const response = await fetch(`${SCRIPT_URL}?ts=${Date.now()}&_cb=${Math.random()}`, { 
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      const json = await response.json();
      clearTimeout(timeoutId);
      
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      if (json.success && Array.isArray(json.data)) {
        console.log("Datos recibidos:", json.data.length, "items");
        // Forzar actualización incluso si los datos parecen iguales para refrescar lastSync
        const filteredData = json.data.filter(p => 
          String(p.estado_produccion || '').toLowerCase() !== 'anulado' && 
          String(p.estado_logistico || '').toLowerCase() !== 'anulado'
        );
        
        setData([...filteredData]); 
        setLastSync(new Date());
        localStorage.setItem('dash_last_sync', new Date().toISOString());
        setTurboSpeed(duration);
        setIsLocalStorage(false);
        
        // V10.0: Intento de caché con manejo de cuota excedida (3.2MB+ es mucho para localStorage)
        try {
          localStorage.setItem('dash_data_cache', JSON.stringify(json.data));
        } catch (e) {
          console.warn("No se pudo guardar en caché (LocalStorage lleno).", e);
          // Opcional: Podríamos limpiar caches antiguos o simplemente ignorar
        }
      } else {
        throw new Error(json.error || "Formato de respuesta inválido");
      }
    } catch (err) {
      console.error("Error sincronizando:", err);
      setError(err.message || "Error desconocido");
      setIsLocalStorage(true);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const [syncQueue, setSyncQueue] = useState(() => {
    const saved = localStorage.getItem(SYNC_QUEUE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Guardar cola al cambiar
  useEffect(() => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
  }, [syncQueue]);

  // Procesador de Cola (Cada 15 segundos)
  useEffect(() => {
    const processQueue = async () => {
      if (syncQueue.length === 0) return;
      
      console.log(`Intentando sincronizar ${syncQueue.length} items pendientes...`);
      const remainingQueue = [];
      
      for (const item of syncQueue) {
        try {
          const params = new URLSearchParams({
            'action': 'updateStatus',
            'pedidoId': item.pedidoId,
            'estado': item.newStatus || ''
          });
          
          if (item.extraData && item.extraData.cells) {
            params.append('cells', JSON.stringify(item.extraData.cells));
          } else if (item.extraData) {
            Object.keys(item.extraData).forEach(k => params.append(k, item.extraData[k]));
          }

          const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
          const result = await response.json();
          if (!result.success) remainingQueue.push(item);
        } catch (e) {
          remainingQueue.push(item);
        }
      }
      
      setSyncQueue(remainingQueue);
    };

    const qInterval = setInterval(processQueue, 15000);
    return () => clearInterval(qInterval);
  }, [syncQueue]);

  const updatePedidoStatus = async (pedidoId, newStatus, extraData = {}) => {
    // Actualización local inmediata para UX
    setData(prev => (prev || []).map(p => 
      cleanId(p.pedido_id || p.id) === cleanId(pedidoId) 
      ? { ...p, estado_produccion: newStatus || p.estado_produccion, ...extraData } 
      : p
    ));

    try {
      const params = new URLSearchParams({
        'action': 'updateStatus',
        'pedidoId': pedidoId,
        'estado': newStatus || ''
      });
      
      Object.keys(extraData).forEach(key => {
        if (key === 'cells') {
          params.append('cells', JSON.stringify(extraData[key]));
        } else {
          params.append(key, extraData[key]);
        }
      });

      const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) return true;
      
      // Si falla pero es un error del servidor, encolamos
      setSyncQueue(prev => [...prev, { pedidoId, newStatus, extraData, timestamp: Date.now() }]);
      return true; // Mentimos a la UI para que el operario siga trabajando
    } catch (err) {
      console.error("Error offline. Encolando para re-intento:", err);
      setSyncQueue(prev => [...prev, { pedidoId, newStatus, extraData, timestamp: Date.now() }]);
      return true; // Modo Offline: reportamos éxito local
    }
  };

  const updatePedidoStatusBulk = async (updates) => {
    // Actualización local en masa para UI instantánea
    setData(prev => {
      let newData = [...(prev || [])];
      updates.forEach(u => {
        newData = newData.map(p => 
          String(p.pedido_id || p.id) === String(u.pedidoId) 
          ? { ...p, estado_produccion: u.estado, ...u.extraData } 
          : p
        );
      });
      return newData;
    });

    try {
      const response = await fetch(`${SCRIPT_URL}?action=batchUpdate`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error("Error en batch update:", err);
      // Fallback: encolar uno por uno si el batch falla
      updates.forEach(u => {
        setSyncQueue(prev => [...prev, { pedidoId: u.pedidoId, newStatus: u.estado, extraData: u.extraData, timestamp: Date.now() }]);
      });
      return true;
    }
  };

  const uploadDirectOrders = async (pedidosArray) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s para ingesta

    try {
      console.log("Iniciando ingesta directa...", pedidosArray.length);
      // Enviamos el action en la URL para que e.parameter.action funcione en el script de Google
      const response = await fetch(`${SCRIPT_URL}?action=ingestDirectOrders`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(pedidosArray),
        signal: controller.signal
      });
      
      const result = await response.json();
      clearTimeout(timeoutId);
      
      if (!result.success) throw new Error(result.error || "Error en el servidor");
      
      // No bloqueamos la respuesta esperando el refresco
      fetchData().catch(e => console.error("Error refrescando post-ingesta:", e));
      
      return { success: true, inserted: result.inserted };
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Error in uploadDirectOrders:', err);
      const errorMsg = err.name === 'AbortError' ? "Timeout: El script de Google tardó demasiado." : err.message;
      return { success: false, error: errorMsg };
    }
  };

  useEffect(() => {
    fetchData(); // Carga inicial
  }, []);

  // Selector centralizado y memorizado para evitar cálculos repetidos y limpiar la data globalmente
  const pedidosFiltrados = useMemo(() => {
    return (data || []).filter(p => {
      // 1. No considerar Pedidos Anulados
      const estProd = String(p.estado_produccion || '').toLowerCase();
      const estLog = String(p.estado_logistico || '').toLowerCase();
      if (estProd === 'anulado' || estLog === 'anulado') return false;

      // 3. Eliminar filas vacías o sin ID (evita los '#' vacíos en la UI)
      if (!p.pedido_id || String(p.pedido_id).trim() === '') return false;

      return true;
    });
  }, [data]);

  return (
    <DataContext.Provider value={{ 
      data: pedidosFiltrados, // Ahora 'data' expone siempre la versión limpia
      rawData: data, // Mantenemos acceso a la data original por si acaso
      isLoading, 
      error, 
      lastSync, 
      turboSpeed,
      isLocalStorage,
      talleres, 
      updateTalleres, 
      SCRIPT_URL, 
      fetchData, 
      userRole, 
      updateRole,
      updatePedidoStatus,
      updatePedidoStatusBulk,
      uploadDirectOrders,
      syncQueueStatus: syncQueue.length
    }}>
      {children}
    </DataContext.Provider>
  );
};
