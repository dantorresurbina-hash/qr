import React, { useContext, useEffect, useState } from 'react';
import { DataContext, cleanId } from '../context/DataContext';
import { CheckCircle2, Factory, Package, ArrowRight, Loader2, AlertTriangle, Sparkles, ShieldCheck, ShieldAlert, PlayCircle, MessageSquare, ClipboardCheck, User, X, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import CryptoJS from 'crypto-js';
import { SECURITY_CONFIG } from '../config/security';

const CLIENT_SALT = SECURITY_CONFIG.CLIENT_SALT;

const QuickUpdate = ({ pedidoId }) => {
  const { data, updatePedidoStatus, isLoading, SCRIPT_URL, syncQueueStatus } = useContext(DataContext);
  
  // Parámetros de Seguridad QR
  const queryParams = new URLSearchParams(window.location.search);
  const bNum = queryParams.get('b');
  const bTotal = queryParams.get('t');
  const signature = queryParams.get('sig');

  const [pedido, setPedido] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isAuthentic, setIsAuthentic] = useState(null);
  const [operario, setOperario] = useState(() => localStorage.getItem('yute_operario_picking') || '');
  const [impresor, setImpresor] = useState(() => localStorage.getItem('yute_operario_impresion') || '');
  const [nombreManual, setNombreManual] = useState('');
  const [showComentarioModal, setShowComentarioModal] = useState(false);
  const [comentario, setComentario] = useState('');

  // Listas de personal solicitadas por Daniel
  const STAFF_PICKING = ["Miguel Cardozo", "Otro"].sort((a, b) => a === "Otro" ? 1 : b === "Otro" ? -1 : a.localeCompare(b));
  const STAFF_IMPRESION = ["Gabriel Acevedo", "Dillan Hernández", "Ricardo Hernández", "Miguel Palominos", "Otro"].sort((a, b) => a === "Otro" ? 1 : b === "Otro" ? -1 : a.localeCompare(b));

  // Función de validación
  const verifyAuthenticity = () => {
    if (!signature || !bNum || !bTotal) return false;
    const cid = cleanId(pedidoId);
    const dataToVerify = `${cid}-${bNum}-${bTotal}`;
    const expectedSig = CryptoJS.HmacSHA256(dataToVerify, CLIENT_SALT).toString(CryptoJS.enc.Hex).substring(0, 10);
    return expectedSig === signature;
  };

  useEffect(() => {
    if (signature) {
      const valid = verifyAuthenticity();
      setIsAuthentic(valid);
      
      // V8.0: Reportar fraude si la firma es inválida
      if (!valid && pedidoId) {
        console.warn("Firma QR inválida detectada. Reportando...");
        fetch(`${SCRIPT_URL}?action=updateStatus&pedidoId=${pedidoId}&reason=FRAUDE_QR&sig=${signature}`);
      }
    }
  }, [pedidoId, signature, bNum, bTotal]);

  useEffect(() => {
    const fetchQuickPedido = async () => {
      // 1. Intentar encontrar en la data global si ya existe
      if (data.length > 0) {
        const found = data.find(p => cleanId(p.pedido_id || p.id) === cleanId(pedidoId));
        if (found) {
          setPedido(found);
          return;
        }
      }

      // 2. Si no ha cargado la data global, o no está ahí, hacer fetch INDIVIDUAL (Ultra rápido)
      try {
        const cleanId = String(pedidoId).replace(/#/g, '').trim();
        
        if (!cleanId || cleanId === 'undefined') {
          setError('ID de pedido inválido. Por favor escanea el QR nuevamente.');
          return;
        }

        const response = await fetch(`${SCRIPT_URL}?pedidoId=${cleanId}&t=${Date.now()}`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          redirect: 'follow'
        });
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          setPedido(result.data[0]);
        } else if (!isLoading) {
          setError(`No se encontró el pedido #${cleanId} en el sistema.`);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
        if (!isLoading) setError(`Error de red: ${err.message || 'Error desconocido'}. Revisa tu conexión.`);
      }
    };

    fetchQuickPedido();
  }, [data, pedidoId, isLoading]);

  const handleUpdate = async (newStatus, extraData = {}) => {
    const isPrintingStep = newStatus === 'En Proceso' || newStatus === 'Listo Impresor';
    const isPickingStep = newStatus === 'Asignado' || newStatus === 'Listo Taller';
    
    let nombreFinal = isPrintingStep ? impresor : operario;
    if (nombreFinal === 'Otro') nombreFinal = nombreManual;

    if (isYute && !nombreFinal) {
      alert("Por favor selecciona o escribe tu nombre antes de continuar.");
      return;
    }

    setUpdating(true);
    try {
      const actualId = pedido.pedido_id || pedido.id || pedidoId;
      
      // Preparar data de operario para el backend
      const finalExtraData = { ...extraData };
      if (isPrintingStep) finalExtraData.impresor = nombreFinal;
      if (isPickingStep) finalExtraData.operario = nombreFinal;

      const successStatus = await updatePedidoStatus(actualId, newStatus, finalExtraData);
      
      if (successStatus) {
        setSuccess(true);
        const targetNorm = String(actualId).replace(/#/g, '').trim();
        const updated = (data || []).find(p => String(p.pedido_id || p.id).replace(/#/g, '').trim() === targetNorm);
        if (updated) setPedido({...updated, estado_produccion: newStatus, ...extraData});
        else setPedido(prev => ({...prev, estado_produccion: newStatus, ...extraData}));
      } else {
        setError('Error al actualizar: No se pudo conectar con el servidor.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    } finally {
      setUpdating(false);
    }
  };

  const handleYuteAction = async (actionType) => {
    const ahora = new Date().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    let nextStatus = '';
    let cells = {};
    
    // V9.0: Determinar quién está operando según la acción
    const isPrintingAction = actionType === 'start' || actionType === 'finish';
    const currentName = isPrintingAction ? impresor : operario;
    const finalName = currentName === 'Otro' ? nombreManual : currentName;

    if (!finalName) {
      alert("Por favor selecciona o escribe tu nombre.");
      return;
    }

    switch(actionType) {
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
        cells = { 
          'F': ahora,
          'K': true,
          'L': pedido.fecha_vb || ahora,
          'AH': pedido.impresor || finalName
        }; 
        break;
      case 'ready_taller':
        if (!showComentarioModal && actionType === 'ready_taller') {
          setShowComentarioModal(true);
          return;
        }
        nextStatus = 'Listo Taller';
        cells = { 'AI': comentario, 'AJ': finalName }; // Daniel pidió Miguel/Otro para el final también
        setShowComentarioModal(false);
        break;
      default: return;
    }

    await handleUpdate(nextStatus, { cells });
  };

  if (isLoading && !pedido) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="relative mb-6">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold mb-2">Sincronizando...</h2>
        <p className="text-slate-400 text-sm max-w-[200px] mx-auto">Conectando con la Control Tower en tiempo real</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Ops! algo salió mal</h1>
        <p className="text-slate-400 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 px-6 py-2 rounded-lg font-bold"
        >
          REINTENTAR
        </button>
      </div>
    );
  }

  if (!pedido) return null;

  const isYute = String(pedido.taller || '').toLowerCase().includes('yute');
  const estado = String(pedido.estado_produccion || '').toLowerCase();
  
  const isPicking = estado.includes('etiquetado') || estado === '' || estado.includes('pendiente');
  const isPickingOk = estado.includes('asignado');
  const isEnProceso = estado.includes('proceso');
  const isListoImpresor = estado.includes('impresor');
  const isListoTaller = estado.includes('taller') || estado.includes('terminado');

  const getTallerLabel = (taller) => {
    if (!taller) return 'N/A';
    if (taller.toLowerCase() === 'yute impresiones') return 'Yute Impresiones';
    return taller.charAt(0).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
      {/* Banner de Sincronización Offline */}
      {syncQueueStatus > 0 && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center justify-between animate-pulse">
           <div className="flex items-center gap-2">
             <RefreshCw size={14} className="text-amber-500 animate-spin" />
             <span className="text-[10px] font-black uppercase tracking-tight text-amber-500">
               {syncQueueStatus} CAMBIOS PENDIENTES DE SINCRONIZACIÓN
             </span>
           </div>
           <span className="text-[10px] text-amber-500/70 font-bold uppercase italic">Modo Offline</span>
        </div>
      )}

      {/* Header Ficha */}
      <div className="bg-slate-800 rounded-2xl p-6 mb-4 border border-slate-700 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Ficha del Pedido
          </span>
          <span className="text-slate-500 text-sm font-mono">#{pedidoId}</span>
        </div>

        {/* Banner de Autenticidad Criptográfica */}
        {signature && (
          <div className={`mb-4 p-3 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 duration-500 ${
            isAuthentic 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {isAuthentic ? <ShieldCheck size={20} /> : <ShieldAlert size={20} className="animate-pulse" />}
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                {isAuthentic ? 'Etiqueta Original Verificada' : 'Alerta de Seguridad'}
              </p>
              <p className="text-xs opacity-80">
                {isAuthentic 
                  ? `Firma: ${signature} • Bulto ${bNum}/${bTotal}` 
                  : 'Esta etiqueta no contiene una firma criptográfica válida de Yute Impresiones.'}
              </p>
            </div>
            {isAuthentic && <div className="text-[10px] bg-emerald-500 text-slate-900 font-bold px-2 py-0.5 rounded">HMAC-OK</div>}
          </div>
        )}
        
        <h1 className="text-2xl font-bold mb-1 leading-tight">{pedido.nombre_proyecto || pedido.proyecto || 'Proyecto sin nombre'}</h1>
        <p className="text-slate-400 text-sm mb-4">{pedido.sku || 'SKU no especificado'}</p>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
          <div>
            <p className="text-slate-500 text-xs uppercase font-bold mb-1">Unidades</p>
            <p className="text-xl font-mono text-blue-400">{pedido.unidades || 0}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase font-bold mb-1">Taller</p>
            <p className="text-xl font-bold text-slate-200">{getTallerLabel(pedido.taller)}</p>
          </div>
        </div>
      </div>

      {/* Resumen de Trazabilidad Yute */}
      {isYute && (
        <div className="bg-slate-800 rounded-2xl p-6 mb-6 border border-slate-700 shadow-xl">
           <p className="text-slate-500 text-[10px] uppercase font-black mb-4 flex items-center gap-2">
             <ClipboardCheck size={14} className="text-indigo-400" /> HISTORIAL DE PROCESO
           </p>
           <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500 font-bold uppercase">PICKING / ENTREGA:</span>
                 <div className="text-right">
                    <span className="block text-slate-200">{pedido.fecha_envio_taller_diseno || '---'}</span>
                    <span className="block text-[10px] text-slate-500 font-black">{pedido.operario_picking || 'SIN REGISTRO'}</span>
                 </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500 font-bold uppercase">INICIO / VB:</span>
                 <div className="text-right">
                    <span className="block text-slate-200">{pedido.fecha_vb || '---'}</span>
                    <span className="block text-[10px] text-indigo-400 font-black">
                      {pedido.vb ? '✅' : '❌'} {pedido.impresor}
                    </span>
                 </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500 font-bold uppercase">RETIRO TALLER:</span>
                 <span className="text-slate-200">{pedido.fecha_retiro_real || '---'}</span>
              </div>
           </div>
        </div>
      )}

      {/* Selector de Operario (Solo Yute) */}
      {isYute && !success && (
        <div className="bg-slate-800 rounded-2xl p-6 mb-6 border border-indigo-500/30 shadow-xl shadow-indigo-900/20">
          <p className="text-slate-500 text-xs uppercase font-bold mb-3 flex items-center gap-2">
            <User size={14} className="text-indigo-400" /> 
            {isPicking || isListoImpresor ? 'Identificación Operario (Picking/Calidad)' : 'Identificación Impresor'}
          </p>
          
          <div className="space-y-3">
            <select 
              value={isPicking || isListoImpresor ? operario : impresor}
              onChange={(e) => {
                const val = e.target.value;
                if (isPicking || isListoImpresor) {
                    setOperario(val);
                    localStorage.setItem('yute_operario_picking', val);
                } else {
                    setImpresor(val);
                    localStorage.setItem('yute_operario_impresion', val);
                }
                if (val !== 'Otro') setNombreManual('');
              }}
              className="w-full bg-slate-900 text-white px-4 py-4 rounded-xl font-bold border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">¿QUIÉN ERES?</option>
              {(isPicking || isListoImpresor ? STAFF_PICKING : STAFF_IMPRESION).map(o => (
                <option key={o} value={o}>{o.toUpperCase()}</option>
              ))}
            </select>

            {((isPicking || isListoImpresor ? operario : impresor) === 'Otro') && (
              <input 
                type="text"
                placeholder="ESCRIBE TU NOMBRE AQUÍ..."
                value={nombreManual}
                onChange={(e) => setNombreManual(e.target.value)}
                className="w-full bg-slate-900 text-white px-4 py-4 rounded-xl font-bold border border-indigo-500/50 outline-none focus:ring-2 focus:ring-indigo-500 animate-in slide-in-from-top-1"
              />
            )}
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col items-center">
        <p className="text-slate-500 text-xs uppercase font-bold mb-3 text-center tracking-widest">Estado Actual del Pedido</p>
        <StatusBadge 
          status={pedido.estado_produccion || 'Pendiente'} 
          className="scale-125 py-1 px-4 shadow-lg shadow-blue-500/10"
        />
      </div>

      {/* Botones de Acción */}
      <div className="space-y-4">
        {success ? (
          <div className="bg-green-500/20 border border-green-500/50 rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-400">¡Actualizado con éxito!</h2>
            <p className="text-slate-400 mt-2">La Control Tower ya refleja este cambio.</p>
            <button 
              onClick={() => setSuccess(false)}
              className="mt-6 text-xs text-slate-500 font-bold uppercase tracking-widest hover:text-white transition-colors"
            >
              Realizar otro cambio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {isYute ? (
              <>
                {isPicking && (
                  <button onClick={() => handleYuteAction('picking')} disabled={updating}
                    className="w-full py-6 bg-indigo-600 rounded-2xl font-black text-lg flex flex-col items-center justify-center leading-tight shadow-lg shadow-indigo-900/40 active:scale-95 transition-all">
                    {updating ? <Loader2 className="animate-spin" /> : <Package className="mb-1" />}
                    COMPLETAR PICKING
                    <span className="text-[10px] opacity-70">REGISTRAR ENTREGA (J/AJ)</span>
                  </button>
                )}
                {isPickingOk && (
                  <button onClick={() => handleYuteAction('start')} disabled={updating}
                    className="w-full py-6 bg-amber-500 rounded-2xl font-black text-lg flex flex-col items-center justify-center leading-tight shadow-lg shadow-amber-900/40 active:scale-95 transition-all">
                    {updating ? <Loader2 className="animate-spin" /> : <PlayCircle className="mb-1" />}
                    INICIAR IMPRESIÓN
                    <span className="text-[10px] opacity-70">REGISTRAR INICIO (L/AH)</span>
                  </button>
                )}
                {isEnProceso && (
                  <button onClick={() => handleYuteAction('finish')} disabled={updating}
                    className="w-full py-6 bg-emerald-600 rounded-2xl font-black text-lg flex flex-col items-center justify-center leading-tight shadow-lg shadow-emerald-900/40 active:scale-95 transition-all">
                    {updating ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="mb-1" />}
                    LISTO IMPRESOR
                    <span className="text-[10px] opacity-70">REGISTRAR RETIRO (F)</span>
                  </button>
                )}
                {isListoImpresor && (
                  <button onClick={() => handleYuteAction('ready_taller')} disabled={updating}
                    className="w-full py-6 bg-blue-600 rounded-2xl font-black text-lg flex flex-col items-center justify-center leading-tight shadow-lg shadow-blue-900/40 active:scale-95 transition-all">
                    {updating ? <Loader2 className="animate-spin" /> : <ClipboardCheck className="mb-1" />}
                    LISTO TALLER
                    <span className="text-[10px] opacity-70">CONTROL CALIDAD (AI)</span>
                  </button>
                )}
                {isListoTaller && (
                  <div className="w-full py-8 bg-slate-800 border border-slate-700 rounded-2xl text-center text-slate-500 font-bold">
                    PASOS COMPLETADOS ✅
                  </div>
                )}
              </>
            ) : (
              <>
                <button 
                  disabled={updating || pedido.estado_produccion === 'En Proceso'}
                  onClick={() => handleUpdate('En Proceso')}
                  className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                    pedido.estado_produccion === 'En Proceso' 
                    ? 'bg-slate-700 text-slate-500 opacity-50' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 active:scale-95 shadow-lg shadow-blue-900/40'
                  }`}
                >
                  {updating ? <Loader2 className="animate-spin" /> : <Factory />}
                  INICIAR PRODUCCIÓN
                </button>

                <button 
                  disabled={updating || pedido.estado_produccion === 'Listo Taller'}
                  onClick={() => handleUpdate('Listo Taller')}
                  className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                    pedido.estado_produccion === 'Listo Taller' 
                    ? 'bg-slate-700 text-slate-500 opacity-50' 
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-700 active:scale-95 shadow-lg shadow-emerald-900/40'
                  }`}
                >
                  {updating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  LISTO PARA RETIRO
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal Secundario para Comentarios Móvil */}
      {showComentarioModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-300">
             <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
               <MessageSquare className="text-indigo-600" /> Reporte Control de Calidad
             </h3>
             <textarea 
               value={comentario}
               onChange={(e) => setComentario(e.target.value)}
               className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
               placeholder="Ej: Unidades totales OK, impresión nítida y empaque revisado..."
             />
             <div className="flex gap-3 mt-6">
               <button onClick={() => setShowComentarioModal(false)} className="flex-1 p-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50">CANCELAR</button>
               <button 
                 onClick={() => handleYuteAction('ready_taller')}
                 className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-indigo-100"
               >GUARDAR</button>
             </div>
          </div>
        </div>
      )}

      <p className="text-center text-slate-600 text-[10px] mt-12 uppercase tracking-tighter">
        Control Tower Mobile • Trazabilidad QR • Daniel Torres Urbina
      </p>
    </div>
  );
};

export default QuickUpdate;
