// mockConsolidatedData.js
// Esta estructura consolida las 3 hojas de origen en una sola tabla maestra llamada "master_operaciones_talleres"
// utilizando pedido_id como clave única.

const today = new Date();
const addDays = (d, days) => {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};
const subtractDays = (d, days) => addDays(d, -days);

const hoy = today.toISOString().split('T')[0];
const manana = addDays(today, 1);
const ayer = subtractDays(today, 1);
const haceDosDias = subtractDays(today, 2);
const enDosDias = addDays(today, 2);
const enTresDias = addDays(today, 3);
const laProximaSemana = addDays(today, 7);

export const mockConsolidatedData = [
  {
    pedido_id: "PED-1001",
    nombre_proyecto: "Afiches Retail Verano",
    sku: "AF-001",
    unidades: 500,
    vendedor: "Juan Pérez",
    familia: "Impresión Offset",
    
    // Diseño / Técnico (Hoja 3)
    superficie: "Papel Couche 130g",
    formato_diseno: "Tiro",
    dimensiones: "50x70 cm",
    colores_tiro: 4,
    colores_retiro: 0,
    
    // Estado y Taller (Hoja 1)
    taller: "Yute Impresiones",
    estado_produccion: "En Proceso",
    vb_cliente: true,
    
    // Fechas Clave (Hoja 1 y 2)
    fecha_envio_taller: haceDosDias,
    fecha_retiro_ideal: hoy,
    fecha_entrega_cliente: manana,
    fecha_retiro_real: null,
    
    // Métricas (Hoja 1)
    impresiones: 500,
    costo: 150000,
    merma: 10,
    tiempo_produccion_estimado: 3,
    dias_retraso: 0,
    
    // Logística (Hoja 2)
    estado_logistico: "Pendiente Retiro",
    metodo_entrega: "Despacho Express",
    comentario_kam: "Cliente lo necesita antes de las 18:00 hrs"
  },
  {
    pedido_id: "PED-1002",
    nombre_proyecto: "Catálogos Corporativos 2026",
    sku: "CT-002",
    unidades: 2000,
    vendedor: "Ana Gómez",
    familia: "Encuadernación",
    
    superficie: "Esmaltado 170g",
    formato_diseno: "Tiro y Retiro",
    dimensiones: "A4 Cerrado",
    colores_tiro: 4,
    colores_retiro: 4,
    
    taller: "Taller Offset Pro",
    estado_produccion: "Atrasado",
    vb_cliente: true,
    
    fecha_envio_taller: subtractDays(today, 7),
    fecha_retiro_ideal: ayer,
    fecha_entrega_cliente: hoy,
    fecha_retiro_real: null,
    
    impresiones: 16000, // 2000 * 8 pliegos ej.
    costo: 850000,
    merma: 50,
    tiempo_produccion_estimado: 5,
    dias_retraso: 1,
    
    estado_logistico: "Esperando Taller",
    metodo_entrega: "Retiro Cliente",
    comentario_kam: "URGENTE - Taller no responde llamados"
  },
  {
    pedido_id: "PED-1003",
    nombre_proyecto: "Volantes Promocionales",
    sku: "VL-003",
    unidades: 5000,
    vendedor: "Carlos Ruiz",
    familia: "Impresión Digital",
    
    superficie: "Bond 90g",
    formato_diseno: "Tiro y Retiro",
    dimensiones: "10x15 cm",
    colores_tiro: 1,
    colores_retiro: 1,
    
    taller: "Digital Fast",
    estado_produccion: "Terminado",
    vb_cliente: true,
    
    fecha_envio_taller: ayer,
    fecha_retiro_ideal: hoy,
    fecha_entrega_cliente: enDosDias,
    fecha_retiro_real: null, // Debería haberse retirado si está terminado, a menos que sea hoy mismo
    
    impresiones: 5000,
    costo: 35000,
    merma: 0,
    tiempo_produccion_estimado: 1,
    dias_retraso: 0,
    
    estado_logistico: "Pendiente Retiro",
    metodo_entrega: "Moto Courier",
    comentario_kam: ""
  },
  {
    pedido_id: "PED-1004",
    nombre_proyecto: "Cajas Troqueladas Navidad",
    sku: "PK-004",
    unidades: 1500,
    vendedor: "Juan Pérez",
    familia: "Packaging",
    
    superficie: "Cartulina 300g",
    formato_diseno: "Tiro",
    dimensiones: "Desarrollo 40x40",
    colores_tiro: 4,
    colores_retiro: 0,
    
    taller: "Yute Impresiones",
    estado_produccion: "Pre-prensa",
    vb_cliente: false, // ALERTA: Retiro próximo sin VB
    
    fecha_envio_taller: haceDosDias,
    fecha_retiro_ideal: enDosDias,
    fecha_entrega_cliente: enTresDias,
    fecha_retiro_real: null,
    
    impresiones: 1500,
    costo: 450000,
    merma: 0,
    tiempo_produccion_estimado: 4,
    dias_retraso: 0,
    
    estado_logistico: "En Espera VB",
    metodo_entrega: "Despacho Normal",
    comentario_kam: "Cliente de viaje, intentar conseguir VB hoy."
  },
  {
    pedido_id: "PED-1005",
    nombre_proyecto: "Pendones Roller Feria",
    sku: "GF-005",
    unidades: 10,
    vendedor: "Ana Gómez",
    familia: "Gran Formato",
    
    superficie: "Tela PVC",
    formato_diseno: "Tiro",
    dimensiones: "80x200 cm",
    colores_tiro: 4,
    colores_retiro: 0,
    
    taller: "Digital Fast",
    estado_produccion: "Entregado",
    vb_cliente: true,
    
    fecha_envio_taller: subtractDays(today, 5),
    fecha_retiro_ideal: haceDosDias,
    fecha_entrega_cliente: ayer,
    fecha_retiro_real: haceDosDias,
    
    impresiones: 10,
    costo: 120000,
    merma: 0,
    tiempo_produccion_estimado: 2,
    dias_retraso: 0,
    
    estado_logistico: "Despachado",
    metodo_entrega: "Instalación en sitio",
    comentario_kam: ""
  },
  {
    pedido_id: "PED-1006",
    nombre_proyecto: "Dípticos Institucionales",
    sku: "DP-006",
    unidades: 3000,
    vendedor: "Carlos Ruiz",
    familia: "Impresión Offset",
    
    superficie: "Couche 170g",
    formato_diseno: "Tiro y Retiro",
    dimensiones: "A3 Abierto",
    colores_tiro: 4,
    colores_retiro: 4,
    
    taller: "Taller Offset Pro",
    estado_produccion: "En Proceso",
    vb_cliente: true,
    
    fecha_envio_taller: ayer,
    fecha_retiro_ideal: laProximaSemana,
    fecha_entrega_cliente: addDays(today, 9),
    fecha_retiro_real: null,
    
    impresiones: 3000,
    costo: 210000,
    merma: 0,
    tiempo_produccion_estimado: 4,
    dias_retraso: 0,
    
    estado_logistico: "Esperando Taller",
    metodo_entrega: "Despacho Normal",
    comentario_kam: ""
  },
  {
    pedido_id: "PED-1007",
    nombre_proyecto: "Adhesivos Troquelados",
    sku: "ST-007",
    unidades: 10000,
    vendedor: "Juan Pérez",
    familia: "Impresión Digital",
    
    superficie: "Vinilo Blanco",
    formato_diseno: "Tiro",
    dimensiones: "5x5 cm",
    colores_tiro: 4,
    colores_retiro: 0,
    
    taller: "Digital Fast",
    estado_produccion: "Terminado",
    vb_cliente: true,
    
    fecha_envio_taller: ayer,
    fecha_retiro_ideal: hoy,
    fecha_entrega_cliente: manana,
    fecha_retiro_real: null,
    
    impresiones: 150, // calculando pliegos aprox
    costo: 80000,
    merma: 5,
    tiempo_produccion_estimado: 1,
    dias_retraso: 0,
    
    estado_logistico: "Listo para Despacho", // INCOHERENCIA DE ESTADO INTENCIONAL (Taller dice "Terminado", Logística dice "Listo para despacho", pero no hay retiro real)
    metodo_entrega: "Despacho Express",
    comentario_kam: "Retirar apenas salga"
  }
];

export const getTalleres = () => {
    return [
        { id: "T1", nombre: "Yute Impresiones", capacidad_semanal_impresiones: 20000 },
        { id: "T2", nombre: "Taller Offset Pro", capacidad_semanal_impresiones: 50000 },
        { id: "T3", nombre: "Digital Fast", capacidad_semanal_impresiones: 15000 }
    ];
};
