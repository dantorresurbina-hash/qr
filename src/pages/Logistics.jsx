import React, { useState } from 'react';
import { Filter, Truck, PackageCheck, AlertOctagon, CheckCircle2, MessageCircle, Check, FileText } from 'lucide-react';
import { useData, getLocalYMD } from '../context/DataContext';
import LogisticsMap from '../components/LogisticsMap';
import LabelGenerator from '../components/LabelGenerator';
import StatusBadge from '../components/StatusBadge';
import { Tag } from 'lucide-react';
import DirectInbound from '../components/DirectInbound';

const Logistics = () => {
  const [filter, setFilter] = useState('hoy'); // todos, hoy, manana, semana, vencidos
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'inbound'
  const [copiedKey, setCopiedKey] = useState(null);
  const [selectedLabelPedido, setSelectedLabelPedido] = useState(null);
  const { data: mockConsolidatedData, isLoading, updatePedidoStatus } = useData();

  // No bloqueamos toda la pantalla si ya hay datos previos (Evita parpadeos y desmonte de sub-componentes)
  const isInitialLoading = isLoading && mockConsolidatedData.length === 0;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Sincronizando rutas de logística...</p>
      </div>
    );
  }

  const getFilteredData = () => {
    const todayStr = getLocalYMD();
    const man = new Date(); man.setDate(man.getDate() + 1);
    const manStr = getLocalYMD(man);
    const prox = new Date(); prox.setDate(prox.getDate() + 7);
    const proxStr = getLocalYMD(prox);

    const isFinalizado = (p) => {
      const estado = String(p.estado_produccion || p.estado || '').toLowerCase();
      return estado.includes('entregado') || estado.includes('retirado') || estado.includes('finalizado');
    };

    const baseData = mockConsolidatedData.filter(p => (!p.fecha_retiro_real || p.fecha_retiro_real === todayStr) && !isFinalizado(p));

    let filtered = [];
    switch (filter) {
      case 'hoy':
        filtered = baseData.filter(p => p.fecha_retiro_ideal === todayStr && !p.fecha_retiro_real); break;
      case 'manana':
        filtered = baseData.filter(p => p.fecha_retiro_ideal === manStr && !p.fecha_retiro_real); break;
      case 'semana':
        filtered = baseData.filter(p => {
          if(!p.fecha_retiro_ideal || p.fecha_retiro_real) return false;
          return p.fecha_retiro_ideal >= todayStr && p.fecha_retiro_ideal <= proxStr;
        }); break;
      case 'vencidos':
        filtered = baseData.filter(p => {
          if(!p.fecha_retiro_ideal || p.fecha_retiro_real) return false;
          return p.fecha_retiro_ideal < todayStr;
        }); break;
      default:
        filtered = baseData;
    }

    // Ordenar por fecha ideal
    return filtered.sort((a,b) => (a.fecha_retiro_ideal || '').localeCompare(b.fecha_retiro_ideal || ''));
  };

  const data = getFilteredData();

  // Obtener talleres únicos del filtro actual para el mapa
  const activeTalleresForMap = [...new Set(data.map(p => p.taller).filter(Boolean))];

  // AGRUPACIÓN: Día -> Taller -> Pedidos
  const groupedData = data.reduce((acc, pedido) => {
    const fecha = pedido.fecha_retiro_ideal || 'Sin Fecha';
    if (!acc[fecha]) acc[fecha] = {};
    
    const taller = pedido.taller || 'Sin Taller Asignado';
    if (!acc[fecha][taller]) acc[fecha][taller] = [];
    
    acc[fecha][taller].push(pedido);
    return acc;
  }, {});


  const handleCopyWsp = (fecha, taller, pedidos) => {
    let msg = `Hola equipo de *${taller}*, ¿cómo están? 👋\n`;
    msg += `Quería consultar si los siguientes pedidos estarán listos para retiro el ${fecha}:\n\n`;
    
    pedidos.forEach(p => {
      const sup = p.superficie ? ` - ${p.superficie}` : '';
      msg += `🔹 *Pedido #${p.pedido_id}* (${p.nombre_proyecto}${sup})\n`;
    });
    
    msg += `\nQuedamos atentos a su confirmación para coordinar la logística. ¡Muchas gracias!`;
    
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedKey(`${fecha}-${taller}`);
      setTimeout(() => setCopiedKey(null), 2500);
    }).catch(err => {
      console.error('Error al copiar al portapapeles: ', err);
      // Fallback
      alert("No se pudo copiar automáticamente. Puedes intentar conceder permisos al portapapeles.");
    });
  };

  const todayStr = getLocalYMD();

  const handlePrintLabel = (pedido) => {
    setSelectedLabelPedido(pedido);
  };

  const finalizeLabeling = async (pedidoId) => {
    if (updatePedidoStatus) {
      await updatePedidoStatus(pedidoId, 'Etiquetado');
    }
    setSelectedLabelPedido(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Logística & Retiros</h1>
            <p className="text-slate-500">{viewMode === 'list' ? 'Gestión de despachos organizados por Calendario' : 'Ingesta de Pedidos Directos'}</p>
          </div>
          {viewMode === 'list' ? (
            <button 
              onClick={() => setViewMode('inbound')}
              className="flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4 mr-2" /> Ingestar PDFs
            </button>
          ) : (
            <button 
              onClick={() => setViewMode('list')}
              className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg shadow-sm hover:bg-slate-300 transition-colors whitespace-nowrap"
            >
              Volver a Rutas
            </button>
          )}
        </div>
        
        {viewMode === 'list' && (
          <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto">
            <button onClick={() => setFilter('todos')} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filter === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Todos Activos</button>
            <button onClick={() => setFilter('hoy')} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center ${filter === 'hoy' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Hoy</button>
            <button onClick={() => setFilter('manana')} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center ${filter === 'manana' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Mañana</button>
            <button onClick={() => setFilter('semana')} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filter === 'semana' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Esta Semana</button>
            <button onClick={() => setFilter('vencidos')} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center ${filter === 'vencidos' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100 w-full md:w-auto'}`}><AlertOctagon className="w-4 h-4 mr-1.5" /> Vencidos</button>
          </div>
        )}
      </div>

      {viewMode === 'inbound' ? (
        <DirectInbound />
      ) : (
        <>
          {/* MAPA LOGÍSTICO V2.0 */}
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <LogisticsMap activeTalleres={activeTalleresForMap} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center text-slate-800 font-semibold">
            <Truck className="w-5 h-5 mr-2 text-slate-500" />
            Ruta de Retiros ({data.length} pedidos)
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {Object.keys(groupedData).length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <div className="flex flex-col items-center justify-center">
                <Truck className="w-10 h-10 text-slate-300 mb-3" />
                <p className="font-medium text-slate-900">Sin despachos pendientes</p>
                <p className="text-sm mt-1">No hay pedidos que coincidan con los filtros seleccionados.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {Object.entries(groupedData).map(([fecha, talleres]) => {
                const isPasado = fecha < todayStr;
                const isHoy = fecha === todayStr;
                
                return (
                  <div key={fecha} className="border-b border-slate-200 last:border-b-0">
                    {/* Header Día */}
                    <div className={`px-6 py-3 font-semibold text-sm sticky left-0 border-y ${
                      isHoy ? 'bg-indigo-50 text-indigo-800 border-indigo-100' : 
                      isPasado ? 'bg-red-50 text-red-800 border-red-100' : 
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {isHoy ? 'HOY - ' : ''} {fecha}
                    </div>

                    {/* Contenido por Taller */}
                    {Object.entries(talleres).map(([taller, pedidos]) => (
                      <div key={`${fecha}-${taller}`} className="pl-6 border-b border-slate-100 last:border-b-0">
                        {/* Header Taller */}
                        <div className="flex items-center justify-between px-4 py-2 bg-white sticky left-0 border-l-4 border-slate-300">
                          <div className="flex items-center text-sm font-medium text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-2 flex-shrink-0"></span>
                            {taller} <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">{pedidos.length}</span>
                          </div>
                          
                          <button 
                            onClick={(_) => handleCopyWsp(fecha, taller, pedidos)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors
                              ${copiedKey === `${fecha}-${taller}` 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                              }`}
                          >
                            {copiedKey === `${fecha}-${taller}` ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Mensaje WSP</span>
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Tabla de Pedidos del Taller en este Día */}
                        <div className="pl-8 overflow-x-auto pb-4 pt-2">
                           <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                <th className="px-4 py-2 font-semibold w-24">N° Pedido</th>
                                <th className="px-4 py-2 font-semibold">Proyecto</th>
                                <th className="px-4 py-2 font-semibold">Método</th>
                                <th className="px-4 py-2 font-semibold">Estado Producción</th>
                                <th className="px-4 py-2 font-semibold">Logística</th>
                                <th className="px-4 py-2 font-semibold">Comentarios KAM</th>
                                <th className="px-4 py-2 font-semibold text-center w-24">Acción</th>
                                <th className="px-4 py-2 font-semibold text-center w-20">Etiqueta</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {pedidos.map(pedido => (
                                <tr key={pedido._row_key} className="hover:bg-slate-50/80 transition-colors text-sm">
                                  <td className="px-4 py-3 font-medium text-slate-900">{pedido.pedido_id}</td>
                                  <td className="px-4 py-3">
                                    <div className="text-slate-800 font-medium truncate max-w-[180px]" title={pedido.nombre_proyecto}>
                                      {pedido.nombre_proyecto}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{pedido.superficie}</div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{pedido.metodo_entrega}</td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={pedido.estado_produccion} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={pedido.estado_logistico} />
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">
                                    <div className="max-w-[200px] truncate" title={pedido.comentario_kam}>
                                      {pedido.comentario_kam || '-'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {!pedido.fecha_retiro_real ? (
                                       <button 
                                         onClick={() => updatePedidoStatus && updatePedidoStatus(pedido.pedido_id, 'Retirado')}
                                         className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-transparent hover:border-indigo-100" 
                                         title="Marcar como retirado"
                                       >
                                         <PackageCheck className="w-4 h-4" />
                                       </button>
                                    ) : (
                                       <span className="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Retirado</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button 
                                      onClick={() => handlePrintLabel(pedido)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-transparent hover:border-blue-100"
                                      title="Generar Etiqueta Zebra"
                                    >
                                      <Tag className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                           </table>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* MODAL GENERADOR DE ETIQUETAS */}
      {selectedLabelPedido && (
        <LabelGenerator 
          pedidos={selectedLabelPedido} 
          onClose={() => finalizeLabeling(selectedLabelPedido.pedido_id)} 
        />
      )}
    </div>
  );
};

export default Logistics;
