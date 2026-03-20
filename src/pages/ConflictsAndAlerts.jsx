import React from 'react';
import { TriangleAlert, AlertCircle, FileWarning, Clock, MessageSquareWarning } from 'lucide-react';
import { useData, getLocalYMD } from '../context/DataContext';
import StatusBadge from '../components/StatusBadge';

const ConflictsAndAlerts = () => {
  const { data: mockConsolidatedData, talleres, isLoading } = useData();
  const getTalleres = () => talleres;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Analizando conflictos operativos en vivo...</p>
      </div>
    );
  }

  const today = getLocalYMD();
  const nextTwoDays = new Date(Date.now() + 172800000).toISOString().split('T')[0];

  // Algoritmo de detección de conflictos
  const detectConflicts = () => {
    const alerts = [];

    mockConsolidatedData.forEach(pedido => {
      // Regla 1: Vencido sin retiro
      if (pedido.fecha_retiro_ideal < today && !pedido.fecha_retiro_real) {
        alerts.push({
          id: `${pedido._row_key || pedido.pedido_id}-1`,
          pedido: pedido.pedido_id,
          taller: pedido.taller,
          tipo: 'Vencido',
          nivel: 'Critico',
          mensaje: `Retiro vencido el ${pedido.fecha_retiro_ideal}. Sin fecha de retiro real.`,
          icon: Clock,
          responsable: 'Logística'
        });
      }

      // Regla 2: Sin VB y retiro próximo (hoy o mañ o pasado)
      if (!pedido.vb_cliente && pedido.fecha_retiro_ideal <= nextTwoDays && !pedido.fecha_retiro_real) {
        alerts.push({
          id: `${pedido._row_key || pedido.pedido_id}-2`,
          pedido: pedido.pedido_id,
          taller: pedido.taller,
          tipo: 'Falta VB',
          nivel: 'Alto',
          mensaje: `Retiro programado para ${pedido.fecha_retiro_ideal} pero cliente aún no da VB.`,
          icon: FileWarning,
          responsable: 'KAM'
        });
      }

      // 3. Inconsistencia Estado Logistico vs Producción
      if (pedido.estado_produccion === 'Terminado' && String(pedido.estado_logistico || '').includes('Esperando Taller')) {
        alerts.push({
          id: `C3-${pedido._row_key || pedido.pedido_id}`,
          pedido: pedido.pedido_id,
          taller: pedido.taller,
          tipo: 'Descoordinación',
          nivel: 'Medio',
          mensaje: `Taller marca terminado pero Logística estado es: ${pedido.estado_logistico}.`,
          icon: AlertCircle,
          responsable: 'Operaciones'
        });
      }

      // 5. KAM Reporta Problema Urgente
      if (pedido.comentario_kam && (String(pedido.comentario_kam || '').toLowerCase().includes('urgente') || String(pedido.comentario_kam || '').toLowerCase().includes('no responde')) && !pedido.fecha_retiro_real) {
         alerts.push({
          id: `C5-${pedido._row_key || pedido.pedido_id}`,
          pedido: pedido.pedido_id,
          taller: pedido.taller,
          tipo: 'Alerta KAM',
          nivel: 'Alto',
          mensaje: `Comentario pendiente: "${pedido.comentario_kam}"`,
          icon: MessageSquareWarning,
          responsable: 'Jefe Operaciones'
        });
      }
    });

    // Validar capacidad de talleres (Regla 5)
    // Usamos el código de CapacityAnalytics simplificado
    const talleres = getTalleres();
    talleres.forEach(taller => {
      const pedidosTaller = mockConsolidatedData.filter(p => !p.fecha_retiro_real && p.taller === taller.nombre);
      const impresiones = pedidosTaller.reduce((acc, p) => acc + p.impresiones, 0);
      const saturacion = (impresiones / taller.capacidad_semanal_impresiones) * 100;

      if (saturacion > 85) {
         alerts.push({
          id: `taller-${taller.id}`,
          pedido: 'MÚLTIPLES',
          taller: taller.nombre,
          tipo: 'Saturación',
          nivel: 'Critico',
          mensaje: `Taller al ${saturacion.toFixed(0)}% de capacidad. Riesgo de cuellos de botella.`,
          icon: TriangleAlert,
          responsable: 'Derivación'
        });
      }
    });

    // Ordenar: Críticos primero, Alto después, etc.
    const order = { 'Critico': 1, 'Alto': 2, 'Medio': 3 };
    return alerts.sort((a, b) => order[a.nivel] - order[b.nivel]);
  };

  const conflictos = detectConflicts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Conflictos Operativos</h1>
        <p className="text-slate-500">Detección automática de inconsistencias, retrasos y cuellos de botella.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mr-4">
            <TriangleAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-red-800 font-bold text-lg">{conflictos.filter(c => c.nivel === 'Critico').length}</p>
            <p className="text-red-600 text-sm font-medium">Alertas Críticas</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mr-4">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-amber-800 font-bold text-lg">{conflictos.filter(c => c.nivel === 'Alto').length}</p>
            <p className="text-amber-600 text-sm font-medium">Alertas de nivel Alto</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-4">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-blue-800 font-bold text-lg">{conflictos.filter(c => c.nivel === 'Medio').length}</p>
            <p className="text-blue-600 text-sm font-medium">Coordinaciones Menores</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">Panel de Resolución ({conflictos.length})</h2>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-700">Resolver Seleccionados</button>
        </div>
        <div className="p-0">
          <ul className="divide-y divide-slate-100">
            {conflictos.map((conflicto) => {
              const Icon = conflicto.icon;
              return (
                <li key={conflicto.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row gap-4 sm:items-start">
                  <div className="flex-shrink-0 mt-1">
                    <Icon className={`w-6 h-6 ${
                      conflicto.nivel === 'Critico' ? 'text-red-500' : 
                      conflicto.nivel === 'Alto' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{conflicto.pedido}</span>
                      <span className="text-slate-400 text-sm">•</span>
                      <span className="text-slate-600 text-sm font-medium">{conflicto.taller}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        conflicto.nivel === 'Critico' ? 'bg-red-100 text-red-800' : 
                        conflicto.nivel === 'Alto' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {conflicto.nivel}
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm">{conflicto.mensaje}</p>
                    <div className="flex gap-4 mt-3 mt-sm-2 text-xs">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block font-medium">Asignar a: {conflicto.responsable}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2 self-start mt-2 sm:mt-0">
                    <button className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded hover:bg-slate-50 transition">Ver Detalle</button>
                    <button className="px-3 py-1.5 bg-accent text-white text-sm font-medium rounded hover:bg-accent/90 transition shadow-sm">Notificar</button>
                  </div>
                </li>
              );
            })}
            
            {conflictos.length === 0 && (
              <li className="p-8 text-center text-slate-500">
                <p className="font-medium text-slate-800">Sin conflictos</p>
                <p className="text-sm mt-1">El algoritmo no ha detectado inconsistencias ni alertas operativas.</p>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ConflictsAndAlerts;
