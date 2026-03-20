import React, { useState, useMemo, useEffect } from 'react';
import { useData, parseNumber } from '../context/DataContext';
import { Factory, PlayCircle, CheckCircle2, Calendar as CalendarIcon, RefreshCw, X, FileText, Info, Maximize2, Palette, User, Package, ClipboardCheck, MessageSquare } from 'lucide-react';
import WorkshopCalendar from './WorkshopCalendar';

// Mapeo Hexadecimal de colores (Reutilizado de WorkshopMode para consistencia)
const getColorHex = (text) => {
  if (!text) return null;
  const clean = String(text).toLowerCase().trim();
  const colorMap = {
    'rojo': '#ef4444', 'azul': '#3b82f6', 'verde': '#22c55e', 'amarillo': '#eab308',
    'negro': '#001a1a', 'blanco': '#f8fafc', 'gris': '#94a3b8', 'naranja': '#f97316',
    'morado': '#a855f7', 'purpura': '#a855f7', 'rosado': '#ec4899', 'rosa': '#ec4899',
    'cafe': '#78350f', 'marron': '#78350f', 'celeste': '#0ea5e9', 'turquesa': '#14b8a6',
    'cian': '#06b6d4', 'magenta': '#d946ef', 'oro': '#fbbf24', 'plata': '#cbd5e1'
  };
  for (const [key, hex] of Object.entries(colorMap)) {
    if (clean.includes(key)) return hex;
  }
  const hexMatch = clean.match(/#[0-9a-f]{3,6}/);
  if (hexMatch) return hexMatch[0];
  return null;
};

const ColorSwatch = ({ text }) => {
  const hex = getColorHex(text);
  if (!hex) return null;
  return <div className="w-3 h-3 rounded-full border border-slate-200 shadow-inner inline-block" style={{ backgroundColor: hex }} title={text} />;
};

// Modal de Detalle con Flujo Avanzado Yute V7.0
const YutePedidoModal = ({ pedido, operario, onClose, onUpdateAction, isUpdating }) => {
  if (!pedido) return null;
  const [comentario, setComentario] = useState('');
  const [showComentarioModal, setShowComentarioModal] = useState(false);

  const estado = String(pedido.estado_produccion || '').toLowerCase();
  
  // Determinar el paso actual
  // 1. Etiquetado (o vacío) -> REALIZAR PICKING
  // 2. Asignado -> INICIAR IMPRESIÓN
  // 3. En Proceso -> LISTO IMPRESOR
  // 4. Listo Impresor -> LISTO TALLER (Control Calidad)
  
  const isPicking = estado.includes('etiquetado') || estado === '' || estado.includes('pendiente');
  const isPickingOk = estado.includes('asignado');
  const isEnProceso = estado.includes('proceso');
  const isListoImpresor = estado.includes('impresor');
  const isListoTaller = estado.includes('taller') || estado.includes('terminado');

  const handleAction = async (actionType) => {
    if (!operario && (actionType === 'picking' || actionType === 'start')) {
       alert("Por favor selecciona tu nombre antes de continuar.");
       return;
    }
    
    if (actionType === 'ready_taller' && !showComentarioModal) {
      setShowComentarioModal(true);
      return;
    }

    onUpdateAction(pedido, actionType, operario, comentario);
    if (showComentarioModal) setShowComentarioModal(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
        {/* Header Yute */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-white relative">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">PEDIDO #{pedido.pedido_id}</span>
                <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{pedido.estado_produccion || 'PENDIENTE'}</span>
              </div>
              <h2 className="text-3xl font-black tracking-tighter">{pedido.nombre_proyecto}</h2>
              <div className="flex items-center gap-2 mt-2 text-slate-400 text-xs font-bold">
                 <User size={14} className="text-indigo-400" />
                 OPERARIO ACTUAL: <span className="text-white">{operario || 'SIN SELECCIONAR'}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X size={32} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
          {/* Ficha Técnica Simplificada para Operario */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
               <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">UNIDADES</span>
               <span className="text-xl font-black text-slate-800">{parseNumber(pedido.unidades).toLocaleString()}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
               <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">IMPRESIONES</span>
               <span className="text-xl font-black text-indigo-600">{(parseNumber(pedido.impresiones) || parseNumber(pedido.unidades)).toLocaleString()}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
               <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">BULTOS</span>
               <span className="text-xl font-black text-emerald-600">{pedido.bultos || 1}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
               <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">COLOR TIRO</span>
               <div className="flex items-center gap-2">
                 <ColorSwatch text={pedido.pantone_t} />
                 <span className="text-xs font-black text-slate-700">{pedido.pantone_t || '--'}</span>
               </div>
            </div>
          </div>

          {/* Registro de Trazabilidad Existente */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <ClipboardCheck size={16} /> LOG DE TIEMPOS
             </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                <div className="flex justify-between p-3 bg-slate-50 rounded-2xl">
                   <span className="text-slate-400">PICKING (J): {pedido.operario_picking}</span>
                   <span className="text-slate-700">{pedido.fecha_envio_taller_diseno || '---'}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-2xl">
                   <span className="text-slate-400">VB (K/L): {pedido.vb ? '✅' : '❌'}</span>
                   <span className="text-slate-700">{pedido.fecha_vb || '---'}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-2xl">
                   <span className="text-slate-400">IMPRESOR (AH):</span>
                   <span className="text-indigo-700">{pedido.impresor || '---'}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-2xl">
                   <span className="text-slate-400">RETIRO (F):</span>
                   <span className="text-slate-700">{pedido.fecha_retiro_real || '---'}</span>
                </div>
              </div>
             {pedido.comentario_taller && (
               <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs">
                 <span className="block font-black text-amber-600 mb-1 uppercase tracking-tighter">COMENTARIO CALIDAD:</span>
                 <p className="text-amber-800 italic">{pedido.comentario_taller}</p>
               </div>
             )}
          </div>
        </div>

        {/* Footer con Acciones de Workflow */}
        <div className="p-8 bg-white border-t border-slate-100">
          {isUpdating === (pedido.pedido_id || pedido.id) ? (
            <div className="flex items-center justify-center h-20 text-indigo-600 font-bold gap-3">
              <RefreshCw className="animate-spin" /> SINCRONIZANDO CON PLANILLA...
            </div>
          ) : (
            <div className="flex gap-4">
              {isPicking && (
                <button 
                  onClick={() => handleAction('picking')}
                  className="flex-1 bg-indigo-600 text-white h-20 rounded-[2rem] font-black text-lg shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-transform flex flex-col items-center justify-center leading-tight"
                >
                  <Package className="mb-1" />
                  <span>COMPLETAR PICKING</span>
                  <span className="text-[10px] opacity-70">MARCAR ENTREGA A TALLER (J)</span>
                </button>
              )}
              {isPickingOk && (
                <button 
                  onClick={() => handleAction('start')}
                  className="flex-1 bg-amber-500 text-white h-20 rounded-[2rem] font-black text-lg shadow-xl shadow-amber-100 hover:scale-[1.02] transition-transform flex flex-col items-center justify-center leading-tight"
                >
                  <PlayCircle className="mb-1" />
                  <span>INICIAR IMPRESIÓN</span>
                  <span className="text-[10px] opacity-70">MARCAR INICIO TALLER (K/L)</span>
                </button>
              )}
              {isEnProceso && (
                <button 
                  onClick={() => handleAction('finish')}
                  className="flex-1 bg-emerald-600 text-white h-20 rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-100 hover:scale-[1.02] transition-transform flex flex-col items-center justify-center leading-tight"
                >
                  <CheckCircle2 className="mb-1" />
                  <span>LISTO IMPRESOR</span>
                  <span className="text-[10px] opacity-70">MARCAR RETIRO DE TALLER (F)</span>
                </button>
              )}
              {isListoImpresor && (
                <button 
                  onClick={() => handleAction('ready_taller')}
                  className="flex-1 bg-blue-600 text-white h-20 rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] transition-transform flex flex-col items-center justify-center leading-tight"
                >
                  <ClipboardCheck className="mb-1" />
                  <span>LISTO TALLER</span>
                  <span className="text-[10px] opacity-70">CONTROL DE CALIDAD FINAL</span>
                </button>
              )}
              {isListoTaller && (
                <div className="flex-1 bg-slate-100 text-slate-400 h-20 rounded-[2rem] font-black text-lg flex items-center justify-center border border-slate-200">
                  <CheckCircle2 size={24} className="mr-3" /> PEDIDO COMPLETADO
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Secundario para Comentarios */}
        {showComentarioModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
               <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                 <MessageSquare className="text-indigo-600" /> Reporte Control de Calidad
               </h3>
               <textarea 
                 value={comentario}
                 onChange={(e) => setComentario(e.target.value)}
                 className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                 placeholder="Ej: Unidades totales OK, impresión nítida y empaque revisado..."
               />
               <div className="flex gap-3 mt-6">
                 <button onClick={() => setShowComentarioModal(false)} className="flex-1 p-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50">CANCELAR</button>
                 <button 
                   onClick={() => handleAction('ready_taller')}
                   className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-indigo-100"
                 >GUARDAR Y CERRAR</button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const YuteWorkshopMode = () => {
  const { data, updatePedidoStatus } = useData();
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [isUpdating, setIsUpdating] = useState(null);

  // V9.0: Memoria de selección diferenciada
  const [selectedPrinter, setSelectedPrinter] = useState(() => localStorage.getItem('yute_operario_impresion') || '');
  const [selectedPicker, setSelectedPicker] = useState(() => localStorage.getItem('yute_operario_picking') || '');
  const [nombreManual, setNombreManual] = useState('');

  // Listas de personal solicitadas por Daniel
  const STAFF_PICKING = ["Miguel Cardozo", "Otro"].sort((a, b) => a === "Otro" ? 1 : b === "Otro" ? -1 : a.localeCompare(b));
  const STAFF_IMPRESION = ["Gabriel Acevedo", "Dillan Hernández", "Ricardo Hernández", "Miguel Palominos", "Otro"].sort((a, b) => a === "Otro" ? 1 : b === "Otro" ? -1 : a.localeCompare(b));

  useEffect(() => {
    localStorage.setItem('yute_operario_picking', selectedPicker);
  }, [selectedPicker]);

  useEffect(() => {
    localStorage.setItem('yute_operario_impresion', selectedPrinter);
  }, [selectedPrinter]);

  const pedidosYute = useMemo(() => {
    return data.filter(p => {
       const taller = String(p.taller || '').toLowerCase();
       return taller.includes('yute') && (p.estado_produccion || '').toLowerCase() !== 'entregado';
    });
  }, [data]);

  const handleUpdateAction = async (pedido, action, operarioNombre, comentario = '') => {
    const id = pedido.pedido_id || pedido.id;
    setIsUpdating(id);
    const ahora = new Date().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    let nextStatus = '';
    let cells = {};

    // V9.0: Determinar quién está operando según la acción
    const isPrintingAction = action === 'start' || action === 'finish';
    let finalName = isPrintingAction ? selectedPrinter : selectedPicker;
    if (finalName === 'Otro') finalName = nombreManual;

    if (!finalName) {
      alert("Por favor selecciona o escribe tu nombre antes de continuar.");
      setIsUpdating(null);
      return;
    }

    switch(action) {
      case 'picking':
        nextStatus = 'Asignado';
        cells = { 'J': ahora, 'AJ': finalName };
        break;
      case 'start':
        nextStatus = 'En Proceso';
        cells = { 'K': true, 'L': ahora, 'AH': finalName };
        break;
      case 'finish':
        nextStatus = 'Listo Impresor';
        // V11: Si se saltaron el "Iniciar", aseguramos que K, L y AH tengan datos.
        cells = { 
          'F': ahora, 
          'K': true, 
          'L': pedido.fecha_vb || ahora, 
          'AH': pedido.impresor || finalName 
        };
        break;
      case 'ready_taller':
        nextStatus = 'Listo Taller';
        cells = { 'AI': comentario, 'AJ': finalName };
        break;
      default: return;
    }

    const success = await updatePedidoStatus(id, nextStatus, { cells });
    if (!success) {
      alert("Falla en la sincronización. Intenta de nuevo.");
    } else {
      setSelectedPedido(null);
    }
    setIsUpdating(null);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header Especializado Yute V9.0 */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 tracking-tighter">
            <Factory className="text-indigo-400" />
            Control Yute Impresiones
            <span className="bg-indigo-600 text-[10px] px-2 py-0.5 rounded-md align-middle m-2">V9.0</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-md border border-emerald-500/30">
              {pedidosYute.length} Pedidos Visibles
            </span>
          </h1>
          <p className="text-slate-400 text-sm font-bold mt-1 uppercase tracking-widest">Trazabilidad de Planta • Filtros de Personal</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          {/* Selector Picking */}
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 flex-1 min-w-[200px]">
             <User size={16} className="text-indigo-400" />
             <div className="flex-1">
               <p className="text-[9px] font-black text-slate-500 uppercase">OPERARIO (PICKING/QA)</p>
               <select 
                 value={selectedPicker}
                 onChange={(e) => {
                   setSelectedPicker(e.target.value);
                   if (e.target.value !== 'Otro') setNombreManual('');
                 }}
                 className="w-full bg-transparent font-bold text-white text-xs outline-none cursor-pointer"
               >
                 <option value="" className="text-slate-900">SELECCIONAR...</option>
                 {STAFF_PICKING.map(o => <option key={o} value={o} className="text-slate-900">{o.toUpperCase()}</option>)}
               </select>
             </div>
          </div>

          {/* Selector Impresión */}
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 flex-1 min-w-[200px]">
             <User size={16} className="text-amber-400" />
             <div className="flex-1">
               <p className="text-[9px] font-black text-slate-500 uppercase">IMPRESOR</p>
               <select 
                 value={selectedPrinter}
                 onChange={(e) => {
                   setSelectedPrinter(e.target.value);
                   if (e.target.value !== 'Otro') setNombreManual('');
                 }}
                 className="w-full bg-transparent font-bold text-white text-xs outline-none cursor-pointer"
               >
                 <option value="" className="text-slate-900">SELECCIONAR...</option>
                 {STAFF_IMPRESION.map(o => <option key={o} value={o} className="text-slate-900">{o.toUpperCase()}</option>)}
               </select>
             </div>
          </div>

          {/* Input Manual "Otro" */}
          {(selectedPicker === 'Otro' || selectedPrinter === 'Otro') && (
            <div className="flex items-center gap-3 bg-indigo-500/20 px-4 py-2 rounded-2xl border border-indigo-500/30 flex-1 min-w-[200px] animate-in zoom-in duration-300">
               <div className="flex-1">
                 <p className="text-[9px] font-black text-indigo-400 uppercase">ESPECIFICAR NOMBRE</p>
                 <input 
                   type="text" 
                   value={nombreManual}
                   onChange={(e) => setNombreManual(e.target.value)}
                   placeholder="Escriba aquí..."
                   className="w-full bg-transparent font-bold text-white text-xs outline-none placeholder:text-indigo-300/50"
                 />
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
          <WorkshopCalendar 
            pedidos={pedidosYute} 
            taller={{ nombre: 'Yute Impresiones' }}
            onPedidoClick={(p) => setSelectedPedido(p)}
          />
      </div>

      {selectedPedido && (
        <YutePedidoModal 
          pedido={selectedPedido}
          operario={((selectedPedido.estado_produccion || '').toLowerCase().includes('proceso') || (selectedPedido.estado_produccion || '').toLowerCase().includes('asignado')) ? selectedPrinter : selectedPicker}
          onClose={() => setSelectedPedido(null)}
          isUpdating={isUpdating}
          onUpdateAction={handleUpdateAction}
        />
      )}
    </div>
  );
};

export default YuteWorkshopMode;
