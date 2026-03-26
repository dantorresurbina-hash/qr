import React, { useState, useMemo } from 'react';
import { useData, parseNumber } from '../context/DataContext';
import { Factory, PlayCircle, CheckCircle2, Calendar as CalendarIcon, RefreshCw, X, FileText, Info, Maximize2, Palette } from 'lucide-react';
import WorkshopCalendar from './WorkshopCalendar';
import ProjectDetailsModal from '../components/ProjectDetailsModal';

// Utilidad para mapear nombres de colores y códigos Pantone a HEX V6.12
const getColorHex = (text) => {
  if (!text) return null;
  const clean = String(text).toLowerCase().trim();
  
  // Mapa de colores comunes
  const colorMap = {
    'rojo': '#ef4444',
    'azul': '#3b82f6',
    'verde': '#22c55e',
    'amarillo': '#eab308',
    'negro': '#001a1a', // Un negro muy profundo
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

  // Buscar coincidencia exacta o contenida
  for (const [key, hex] of Object.entries(colorMap)) {
    if (clean.includes(key)) return hex;
  }

  // Heurística para hex directo si el usuario lo pone (ej: #ff0000)
  const hexMatch = clean.match(/#[0-9a-f]{3,6}/);
  if (hexMatch) return hexMatch[0];

  return null;
};

// Componente para mostrar el swatch de color
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

// PedidoDetailModal has been moved to src/components/ProjectDetailsModal.jsx

const WorkshopMode = () => {
  const { data, talleres, updatePedidoStatus } = useData();
  const [selectedTaller, setSelectedTaller] = useState('Yute Impresiones');
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [isUpdating, setIsUpdating] = useState(null);

  const getColumna = (estadoRaw) => {
    const estado = String(estadoRaw || '').toLowerCase().trim();
    if (estado.includes('entregado')) return 'ENTREGADO';
    if (estado.includes('terminado') || estado.includes('listo') || estado.includes('retiro')) return 'TERMINADO';
    if (estado.includes('proceso') || estado.includes('impreso') || estado.includes('imprimiendo') || estado.includes('taller')) return 'EN_PROCESO';
    return 'PENDIENTE';
  };

  const pedidosTaller = useMemo(() => {
    const target = String(selectedTaller || '').trim().toLowerCase();
    return data.filter(p => {
       const ptaller = String(p.taller || '').trim().toLowerCase();
       const matchesTaller = ptaller === target || ptaller.includes(target);
       return matchesTaller && getColumna(p.estado_produccion) !== 'ENTREGADO';
    });
  }, [data, selectedTaller]);

  const handleUpdateStatus = async (pedido, nuevoEstado) => {
    setIsUpdating(pedido.pedido_id);
    const success = await updatePedidoStatus(pedido.pedido_id, nuevoEstado);
    if (!success) {
      alert(`Error al actualizar pedido #${pedido.pedido_id}`);
    } else {
      if (selectedPedido && selectedPedido.pedido_id === pedido.pedido_id) {
        setSelectedPedido(prev => ({ ...prev, estado_produccion: nuevoEstado }));
      }
    }
    setIsUpdating(null);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tighter">
            <Factory className="w-8 h-8 text-indigo-600" />
            Control de Floor
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Gestión táctica y avance en tiempo real.</p>
        </div>
        
        <div className="flex bg-slate-50 p-1.5 rounded-3xl border border-slate-200">
          <div className="flex items-center gap-2 px-5 py-2 text-xs font-black text-indigo-700 bg-white shadow-sm border border-slate-200 rounded-2xl mr-3">
            <CalendarIcon className="w-4 h-4" /> CALENDARIO
          </div>
          {talleres.map(t => (
            <button
              key={t.nombre}
              onClick={() => setSelectedTaller(t.nombre)}
              className={`px-4 py-2 text-[10px] font-black rounded-2xl transition-all ${
                selectedTaller === t.nombre 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'text-slate-400 hover:bg-white hover:text-slate-600'
              }`}
            >
              {t.nombre.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 pb-4">
         <WorkshopCalendar 
           pedidos={pedidosTaller} 
           taller={talleres.find(t => t.nombre === selectedTaller)} 
           onPedidoClick={(p) => setSelectedPedido(p)}
         />
      </div>

      {selectedPedido && (
        <ProjectDetailsModal 
          pedido={selectedPedido} 
          onClose={() => setSelectedPedido(null)} 
          onUpdateStatus={handleUpdateStatus}
          isUpdating={isUpdating}
          showActions={true}
        />
      )}
    </div>
  );
};

export default WorkshopMode;
