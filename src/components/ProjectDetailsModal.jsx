import React from 'react';
import { X, FileText, Maximize2, Factory, RefreshCw, Palette, Info, Calendar as CalendarIcon, PlayCircle, CheckCircle2 } from 'lucide-react';
import { parseNumber } from '../context/DataContext';

// Utilidad para mapear nombres de colores y códigos Pantone a HEX
const getColorHex = (text) => {
  if (!text) return null;
  const clean = String(text).toLowerCase().trim();
  
  const colorMap = {
    'rojo': '#ef4444',
    'azul': '#3b82f6',
    'verde': '#22c55e',
    'amarillo': '#eab308',
    'negro': '#1e293b',
    'blanco': '#f8fafc',
    'gris': '#94a3b8',
    'naranja': '#f97316',
    'morado': '#a855f7',
    'purpura': '#a855f7',
    'rosado': '#ec4899',
    'rosa': '#ec4899',
    'cafe': '#78350f',
    'marron': '#78350f',
    'celeste': '#0ea5e9',
    'turquesa': '#14b8a6',
    'cian': '#06b6d4',
    'magenta': '#d946ef',
    'oro': '#fbbf24',
    'plata': '#cbd5e1',
    'pantone yellow': '#fedd00',
    'pantone orange 021': '#ff6d00',
    'pantone warm red': '#f9423a',
    'pantone rhodamine red': '#e10098',
    'pantone process blue': '#0085ca',
    'pantone green': '#00ab84',
    'pantone black': '#2c2c2c',
  };

  for (const [key, hex] of Object.entries(colorMap)) {
    if (clean.includes(key)) return hex;
  }
  return null;
};

const ColorSwatch = ({ text }) => {
  const hex = getColorHex(text);
  if (!hex) return null;
  return (
    <div 
      className="w-3 h-3 rounded-full border border-slate-200 shadow-inner inline-block"
      style={{ backgroundColor: hex }}
      title={text}
    />
  );
};

const ProjectDetailsModal = ({ pedido, onClose, onUpdateStatus, isUpdating, showActions = false }) => {
  if (!pedido) return null;

  const getColumnaLocal = (estadoRaw) => {
    const estado = String(estadoRaw || '').toLowerCase().trim();
    if (estado.includes('entregado')) return 'ENTREGADO';
    if (estado.includes('terminado') || estado.includes('listo') || estado.includes('retiro')) return 'TERMINADO';
    if (estado.includes('proceso') || estado.includes('impreso') || estado.includes('imprimiendo') || estado.includes('taller')) return 'EN_PROCESO';
    return 'PENDIENTE';
  };

  const col = getColumnaLocal(pedido.estado_produccion);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
        
        {/* Header - Matching Mockup */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">#{pedido.pedido_id}</span>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                   col === 'TERMINADO' ? 'bg-emerald-400 text-emerald-900' : 
                   col === 'EN_PROCESO' ? 'bg-blue-400 text-blue-900' : 'bg-white/30 text-white'
                }`}>
                  {pedido.estado_produccion || 'PENDIENTE'}
                </span>
              </div>
              <h2 className="text-3xl font-black leading-tight tracking-tighter uppercase">{pedido.nombre_proyecto}</h2>
              <p className="text-indigo-100 text-sm font-bold mt-1 opacity-80">Especificaciones Técnicas V6.8</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/20 rounded-full transition-all hover:rotate-90">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
          
          {/* Metrics Level 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-black tracking-widest">SKU</span>
              </div>
              <span className="text-sm font-black text-slate-700 truncate block">{pedido.sku || '--'}</span>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-black tracking-widest">Cantidad</span>
              </div>
              <span className="text-sm font-black text-slate-700">{parseNumber(pedido.unidades).toLocaleString('es-CL')} ud.</span>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Factory className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-black tracking-widest">Superficie</span>
              </div>
              <span className="text-sm font-black text-slate-700 truncate block">{pedido.superficie || pedido.familia || '--'}</span>
            </div>
            <div className="bg-indigo-600 p-4 rounded-3xl shadow-lg shadow-indigo-100">
              <div className="flex items-center gap-2 mb-2 text-indigo-200">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-black tracking-widest">Total Imp.</span>
              </div>
              <span className="text-sm font-black text-white">{(parseNumber(pedido.impresiones) || parseNumber(pedido.unidades)).toLocaleString('es-CL')}</span>
            </div>
          </div>

          {/* Metrics Level 2 - Specs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Cara A (Tiro) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                <div className="w-4 h-1 rounded-full bg-indigo-600"></div> Cara A (Tiro)
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Formato / Tamaño</span>
                    <p className="text-xs text-slate-700 font-black">{pedido.formato_t || pedido.formato_diseno || pedido.fam_a || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Dimensiones</span>
                    <p className="text-xs text-slate-700 font-black">{pedido.dim_t || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">N° Colores</span>
                    <p className="text-xs text-slate-700 font-black">{pedido.num_colores_t || pedido.colores_tiro || pedido.col_a || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Pantone/Color</span>
                    <div className="flex items-center gap-2">
                      <ColorSwatch text={pedido.pantone_t} />
                      <p className="text-xs text-indigo-600 font-black">{pedido.pantone_t || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cara B (Retiro) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                <div className="w-4 h-1 rounded-full bg-slate-300"></div> Cara B (Retiro)
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Tamaño</span>
                    <p className="text-xs text-slate-700 font-black">{pedido.tamano_r || pedido.fam_b || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Dimensiones</span>
                    <p className="text-xs text-slate-700 font-black">{pedido.dim_r || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">N° Colores</span>
                    <p className="text-xs text-slate-700 font-black">{pedido.num_colores_r || pedido.colores_retiro || pedido.col_b || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Pantone/Color</span>
                    <div className="flex items-center gap-2">
                      <ColorSwatch text={pedido.pantone_r} />
                      <p className="text-xs text-slate-400 font-black">{pedido.pantone_r || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2 mb-3 text-indigo-500">
                 <Palette className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Posicionamiento</span>
               </div>
               <p className="text-xs text-slate-600 font-bold leading-relaxed">{pedido.posicionamiento || 'No especificado'}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2 mb-3 text-amber-500">
                 <Info className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Info Adicional</span>
               </div>
               <p className="text-xs text-slate-500 italic leading-relaxed">{pedido.info_adicional || 'Sin observaciones adicionales.'}</p>
            </div>
          </div>

          {/* Footer - Entrega y Enlace Drive */}
          <div className="flex flex-col sm:flex-row gap-4">
             {pedido.archivos && (
               <button 
                 onClick={() => window.open(pedido.archivos, '_blank')}
                 className="flex-1 bg-blue-600 p-4 rounded-3xl flex items-center justify-between group hover:bg-black transition-all shadow-lg shadow-blue-100"
               >
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 grid place-items-center text-white">
                      <Maximize2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-black text-blue-100 uppercase tracking-widest">Archivos</span>
                      <span className="text-xs font-black text-white">Open Production Files</span>
                    </div>
                 </div>
                 <Maximize2 className="w-5 h-5 text-white opacity-40 group-hover:opacity-100" />
               </button>
             )}
             
             <div className="flex-1 bg-slate-800 p-4 rounded-3xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 grid place-items-center text-white">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrega Taller</span>
                  <span className="text-xs font-black text-white">{pedido.fecha_entrega_taller_diseno || pedido.fecha_retiro_ideal || 'PENDIENTE'}</span>
                </div>
             </div>
          </div>

          {/* Conditional Actions for Workshop Mode */}
          {showActions && (
            <div className="pt-8">
              {col === 'PENDIENTE' && (
                <button 
                  disabled={isUpdating === pedido.pedido_id}
                  onClick={() => onUpdateStatus(pedido, 'En Proceso')}
                  className="w-full bg-indigo-600 text-white hover:bg-black h-16 rounded-[2rem] text-sm font-black flex items-center justify-center transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                >
                  {isUpdating === pedido.pedido_id ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><PlayCircle className="w-6 h-6 mr-3" /> INICIAR PRODUCCIÓN</>}
                </button>
              )}
              {col === 'EN_PROCESO' && (
                <button 
                  disabled={isUpdating === pedido.pedido_id}
                  onClick={() => onUpdateStatus(pedido, 'Terminado')}
                  className="w-full bg-emerald-600 text-white hover:bg-black h-16 rounded-[2rem] text-sm font-black flex items-center justify-center transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
                >
                  {isUpdating === pedido.pedido_id ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6 mr-3" /> MARCAR COMO LISTO</>}
                </button>
              )}
              {col === 'TERMINADO' && (
                <div className="w-full bg-slate-100 text-slate-400 h-16 rounded-[2rem] text-sm font-black flex items-center justify-center border border-slate-200">
                  <CheckCircle2 className="w-6 h-6 mr-3" /> LISTO PARA RETIRO
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailsModal;
