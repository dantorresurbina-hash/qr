import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  Tag, 
  Search, 
  Filter, 
  CheckCircle, 
  Printer, 
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import LabelGenerator from '../components/LabelGenerator';
import StatusBadge from '../components/StatusBadge';

const Labeling = () => {
  const { data, updatePedidoStatus, updatePedidoStatusBulk, isLoading, syncQueueStatus } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [specificBulto, setSpecificBulto] = useState(null);

  // Filtrar pedidos que típicamente requieren etiquetas (Producción activa)
  const filteredData = useMemo(() => {
    return data.filter(p => {
      const matchesSearch = 
        String(p.pedido_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.nombre_proyecto || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const status = String(p.estado_produccion || '').toLowerCase();
      const matchesStatus = statusFilter === 'all' || status === statusFilter.toLowerCase();
      
      // Mostrar solo pedidos activos (no anulados, no terminados logísticamente si aplica)
      return matchesSearch && matchesStatus && status !== 'anulado';
    });
  }, [data, searchTerm, statusFilter]);

  const toggleSelect = (rowKey) => {
    setSelectedIds(prev => 
      prev.includes(rowKey) ? prev.filter(i => i !== rowKey) : [...prev, rowKey]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(p => p._row_key || p.pedido_id || p.id));
    }
  };

  const selectedPedidos = useMemo(() => {
    return data.filter(p => selectedIds.includes(p._row_key || p.pedido_id || p.id));
  }, [data, selectedIds]);

  const handleBulkComplete = async (pedidosParaActualizar) => {
    // Cerrar modal primero para liberar UI
    setIsLabelModalOpen(false);
    setSpecificBulto(null);
    
    // V8.0: Actualización en masa ultra-rápida
    const updates = pedidosParaActualizar.map(item => ({
      pedidoId: item.id,
      estado: 'Etiquetado',
      extraData: { bultos: item.bultos }
    }));

    await updatePedidoStatusBulk(updates);
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Cargando pedidos para etiquetado...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="text-blue-500" /> Centro de Etiquetado QR
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Impresión masiva de etiquetas Zebra 4x4 y trazabilidad QR.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {syncQueueStatus > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 font-bold text-xs animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              <span>{syncQueueStatus} PENDIENTES</span>
            </div>
          )}
          {selectedIds.length > 0 && (
            <button
              onClick={() => setIsLabelModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              <Printer size={18} />
              IMPRIMIR SELECCIONADOS ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por N° Pedido o Proyecto..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="Pasar correo">Pasar correo</option>
            <option value="Correo enviado">Correo enviado</option>
            <option value="VB Cliente">VB Cliente</option>
            <option value="Etiquetado">Etiquetado</option>
            <option value="En Proceso">En Proceso</option>
          </select>
        </div>
      </div>

      {/* Tabla de pedidos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-4">ID / Proyecto</th>
                <th className="px-6 py-4">Taller</th>
                <th className="px-6 py-4 text-center">Bultos</th>
                <th className="px-6 py-4">Estado Producción</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                {filteredData.map(p => {
                  const itemKey = p._row_key || p.pedido_id || p.id;
                  return (
                    <tr 
                      key={itemKey} 
                      className={`hover:bg-blue-50/30 transition-colors ${selectedIds.includes(itemKey) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(itemKey)}
                          onChange={() => toggleSelect(itemKey)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">#{cleanId(p.pedido_id || p.id)}</span>
                      <span className="text-slate-500 text-xs truncate max-w-[200px]" title={p.nombre_proyecto}>
                        {p.nombre_proyecto}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {p.taller || <span className="text-slate-300 italic">No asignado</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-blue-600">{p.bultos || 1}</span>
                      <span className="text-[10px] text-slate-400 uppercase">Total</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={p.estado_produccion} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <select 
                          className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer px-1"
                          onClick={(e) => e.stopPropagation()}
                          id={`bulto-select-${itemKey}`}
                          defaultValue="1"
                        >
                          {Array.from({ length: p.bultos || 1 }).map((_, i) => (
                            <option key={i+1} value={i+1}>Bulto {i+1}</option>
                          ))}
                        </select>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const bNum = parseInt(document.getElementById(`bulto-select-${itemKey}`).value);
                            setSelectedIds([itemKey]);
                            setSpecificBulto(bNum);
                            setIsLabelModalOpen(true);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-white rounded-md transition-colors shadow-sm"
                          title="Re-imprimir este bulto"
                        >
                          <Tag size={14} />
                        </button>
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIds([itemKey]);
                          setSpecificBulto(null);
                          setIsLabelModalOpen(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Imprimir lote completo"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <AlertCircle size={40} className="mb-2 opacity-20" />
                      <p>No se encontraron pedidos con los filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLabelModalOpen && (
        <LabelGenerator 
          pedidos={selectedPedidos}
          specificBulto={specificBulto}
          onClose={() => {
            setIsLabelModalOpen(false);
            setSpecificBulto(null);
            if (selectedIds.length === 1) setSelectedIds([]);
          }}
          onComplete={handleBulkComplete}
        />
      )}
    </div>
  );
};

export default Labeling;
