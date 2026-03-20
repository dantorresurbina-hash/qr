import React from 'react';
import { Layers, Truck, CalendarClock, AlertCircle, Zap, Activity } from 'lucide-react';
import { useData, getLocalYMD, formatDateDisplay } from '../context/DataContext';
import StatusBadge from '../components/StatusBadge';

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-lg bg-${color}-50 text-${color}-600`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center text-sm">
        <span className="font-medium text-slate-600">{trend}</span>
      </div>
    )}
  </div>
);

const ControlTower = () => {
  const { data: mockConsolidatedData, isLoading } = useData();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Sincronizando Control Tower con Google Sheets...</p>
      </div>
    );
  }

  const today = getLocalYMD();
  const tmrrwObj = new Date(); tmrrwObj.setDate(tmrrwObj.getDate() + 1);
  const tomorrow = getLocalYMD(tmrrwObj);

  // Cálculos de métricas
  const pedidosActivos = mockConsolidatedData.filter(p => {
    const estado = String(p.estado_produccion || '').toLowerCase();
    const finalizado = estado.includes('entregado') || estado.includes('retirado') || estado.includes('finalizado') || estado.includes('listo taller');
    return !p.fecha_retiro_real && !finalizado;
  });
  const retirosHoy = pedidosActivos.filter(p => p.fecha_retiro_ideal === today).length;
  const retirosManana = pedidosActivos.filter(p => p.fecha_retiro_ideal === tomorrow).length;
  
  const pedidosAtrasados = pedidosActivos.filter(
    p => p.fecha_retiro_ideal < today || p.dias_retraso > 0 || p.estado_produccion === 'Atrasado'
  ).length;

  const expressUrgentes = pedidosActivos.filter(
    p => String(p.metodo_entrega || '').toLowerCase().includes('express') || String(p.comentario_kam || '').toLowerCase().includes('urgent')
  ).length;

  // Evaluar riesgo
  const evaluarRiesgo = (pedido) => {
    if ((pedido.fecha_retiro_ideal <= today || pedido.estado_produccion === "Atrasado") && !pedido.fecha_retiro_real) return 'rojo';
    if (!pedido.vb_cliente && (pedido.fecha_retiro_ideal === tomorrow || pedido.fecha_retiro_ideal === today)) return 'amarillo';
    return 'verde';
  };

  const getRiesgoBadge = (riesgo) => {
    switch(riesgo) {
      case 'rojo': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Crítico</span>;
      case 'amarillo': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Riesgo</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Normal</span>;
    }
  };

  const pedidosCriticos = pedidosActivos.map(p => ({ ...p, riesgo: evaluarRiesgo(p) }))
    .filter(p => p.riesgo !== 'verde')
    .sort((a, b) => a.riesgo === 'rojo' ? -1 : 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Control Tower Operativa</h1>
        <div className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm font-medium flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
          Sistema En Línea
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="En Producción" value={pedidosActivos.length} icon={Layers} color="indigo" trend="Talleres Externos" />
        <StatCard title="Retiros de Hoy" value={retirosHoy} icon={Truck} color="emerald" trend="Logística a la espera" />
        <StatCard title="Retiros Mañana" value={retirosManana} icon={CalendarClock} color="blue" />
        <StatCard title="Pedidos Atrasados" value={pedidosAtrasados} icon={AlertCircle} color="red" trend="Requieren gestión" />
        <StatCard title="Urgentes/Express" value={expressUrgentes} icon={Zap} color="amber" />
        <StatCard title="Talleres Saturados" value={0} icon={Activity} color="orange" trend="Carga > 85%" />
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">Atención Crítica ({pedidosCriticos.length})</h2>
          <span className="text-sm text-slate-500 font-medium">Pedidos Atrasados o en Riesgo</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 bg-white">
                <th className="px-6 py-4 font-semibold">N° Pedido</th>
                <th className="px-6 py-4 font-semibold">Proyecto</th>
                <th className="px-6 py-4 font-semibold">Taller</th>
                <th className="px-6 py-4 font-semibold">Retiro Ideal</th>
                <th className="px-6 py-4 font-semibold">Estado Taller</th>
                <th className="px-6 py-4 font-semibold">Estado Logístico</th>
                <th className="px-6 py-4 font-semibold text-center">Nivel Riesgo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {pedidosCriticos.map((pedido) => (
                <tr key={pedido._row_key || pedido.pedido_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 border-l-4 border-l-transparent hover:border-l-accent uppercase">#{pedido.pedido_id}</td>
                  <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]" title={pedido.nombre_proyecto}>{pedido.nombre_proyecto}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{pedido.taller}</td>
                  <td className={`px-6 py-4 ${pedido.fecha_retiro_ideal <= today ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                    {formatDateDisplay(pedido.fecha_retiro_ideal)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={pedido.estado_produccion} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={pedido.estado_logistico} type="logistics" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getRiesgoBadge(pedido.riesgo)}
                  </td>
                </tr>
              ))}
              
              {pedidosCriticos.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
                        <Activity className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-slate-900">Operación Fluida</p>
                      <p className="text-sm mt-1">No se detectan pedidos críticos ni atrasados en este momento.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ControlTower;
