import React, { useState, useMemo } from 'react';
import { useData, getLocalYMD, parseNumber, formatDateDisplay } from '../context/DataContext';
import { X, Save } from 'lucide-react';

const CapacityBar = ({ percentage, isProjected = false }) => {
  let color = 'bg-status-green'; // Verde < 70%
  if (percentage >= 70 && percentage <= 85) color = 'bg-status-yellow'; // Amarillo 70-85%
  if (percentage > 85) color = 'bg-status-red';   // Rojo > 85%

  return (
    <div className={`w-full bg-slate-100 rounded-full h-2.5 mt-2 relative overflow-hidden ${isProjected ? 'opacity-70' : ''}`}>
      <div 
        className={`${color} h-2.5 rounded-full transition-all duration-500 ease-out ${isProjected ? 'bg-stripes animate-pulse' : ''}`} 
        style={{ width: `${Math.min(percentage, 100)}%` }}
      ></div>
      {isProjected && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
      )}
    </div>
  );
};

const CapacityAnalytics = () => {
  const { data: mockConsolidatedData, talleres, updateTalleres, isLoading, lastSync } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState([]);
  const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month'
  const [selectedDate, setSelectedDate] = useState(getLocalYMD());
  const [selectedTaller, setSelectedTaller] = useState(null);
  const [auditTaller, setAuditTaller] = useState(null);

  // Cargar estado inicial al abrir modal
  const openModal = () => {
    setEditingCapacity(JSON.parse(JSON.stringify(talleres)));
    setIsModalOpen(true);
  };

  const handleCapacityChange = (id, newVal) => {
    const updated = editingCapacity.map(t => 
      t.id === id ? { ...t, capacidad_semanal_impresiones: Number(newVal) } : t
    );
    setEditingCapacity(updated);
  };

  const saveSettings = () => {
    updateTalleres(editingCapacity);
    setIsModalOpen(false);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setSelectedTaller(null); // Reset taller al cambiar de día
  };


  const pedidosActivos = mockConsolidatedData.filter(p => {
    const estado = String(p.estado_produccion || '').toLowerCase();
    const finalizado = estado.includes('entregado') || estado.includes('retirado') || estado.includes('finalizado') || estado.includes('listo taller');
    return !p.fecha_retiro_real && !finalizado;
  });

  // --- Lógica de Saturación (Diaria/Semanal/Mensual) ---
  const FERIADOS_CHILE_2026 = [
    '01-01', '04-03', '04-04', '05-01', '05-21', '06-29', 
    '07-16', '08-15', '09-18', '09-19', '10-12', '10-31', 
    '11-01', '12-08', '12-25'
  ];

  const isWorkDay = (dateObj) => {
    const day = dateObj.getDay();
    if (day === 0 || day === 6) return false;
    const mmDd = dateObj.toISOString().slice(5, 10);
    return !FERIADOS_CHILE_2026.includes(mmDd);
  };

  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  };

  const getPeriods = () => {
    const periods = [];
    let d = new Date();
    
    if (viewMode === 'day') {
      while (periods.length < 10) {
        if (isWorkDay(d)) {
          periods.push({
            id: getLocalYMD(d),
            label: d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0'),
            fullDate: getLocalYMD(d),
            type: 'day'
          });
        }
        d.setDate(d.getDate() + 1);
      }
    } else if (viewMode === 'week') {
      // Próximas 6 semanas
      for (let i = 0; i < 6; i++) {
        const weekNum = getWeekNumber(d);
        periods.push({
          id: `W${weekNum}-${d.getFullYear()}`,
          label: `Sem ${weekNum}`,
          week: weekNum,
          year: d.getFullYear(),
          type: 'week'
        });
        d.setDate(d.getDate() + 7);
      }
    } else if (viewMode === 'month') {
      // Próximos 3 meses
      for (let i = 0; i < 3; i++) {
        const month = d.getMonth();
        const year = d.getFullYear();
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        periods.push({
          id: `M${month + 1}-${year}`,
          label: monthNames[month],
          month: month + 1,
          year: year,
          type: 'month'
        });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return periods;
  };

  const activePeriods = getPeriods();
  
  // Si la fecha seleccionada no está en los nuevos periodos (al cambiar de modo), resetear a la primera
  if (!activePeriods.some(p => p.id === selectedDate)) {
    // Solo resetear si cambió el modo, para evitar re-renders infinitos usar un useEffect sería mejor pero 
    // aquí controlamos la lógica de saturación abajo.
  }

  const periodSaturation = useMemo(() => {
    return activePeriods.map(period => {
      let pedidosPeriodo = [];
      if (period.type === 'day') {
        pedidosPeriodo = pedidosActivos.filter(p => p.fecha_retiro_ideal === period.id);
      } else if (period.type === 'week') {
        pedidosPeriodo = pedidosActivos.filter(p => {
          if (!p.fecha_retiro_ideal) return false;
          const d = new Date(p.fecha_retiro_ideal);
          return getWeekNumber(d) === period.week && d.getFullYear() === period.year;
        });
      } else if (period.type === 'month') {
        pedidosPeriodo = pedidosActivos.filter(p => {
          if (!p.fecha_retiro_ideal) return false;
          const d = new Date(p.fecha_retiro_ideal);
          return (d.getMonth() + 1) === period.month && d.getFullYear() === period.year;
        });
      }

      const impresiones = pedidosPeriodo.reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
      const proyectos = pedidosPeriodo.length;
      
      const breakdown = {};
      pedidosPeriodo.forEach(p => {
        if (!breakdown[p.taller]) breakdown[p.taller] = { imps: 0, proy: 0, pedidos: [] };
        breakdown[p.taller].imps += (parseNumber(p.impresiones) || parseNumber(p.unidades));
        breakdown[p.taller].proy += 1;
        breakdown[p.taller].pedidos.push(p);
      });

      return { ...period, impresiones, proyectos, breakdown };
    });
  }, [activePeriods, pedidosActivos]);

  // Asegurar que selectedDate apunte a un ID válido del modo actual
  const currentSelectedId = activePeriods.some(p => p.id === selectedDate) ? selectedDate : activePeriods[0].id;
  const selectedPeriodData = periodSaturation.find(d => d.id === currentSelectedId) || periodSaturation[0];

  // Umbral ajustado por modo
  const getThreshold = () => {
    if (viewMode === 'day') return 15000;
    if (viewMode === 'week') return 75000;
    return 300000; // Mes
  };
  const MAX_IMPRESIONES = getThreshold();

  // --- Lógica de Métricas por Taller (Se mantiene igual, basada en pedidosActivos totales) ---
  const analytics = useMemo(() => {
    return talleres.map(taller => {
      const pedidosDelTaller = pedidosActivos.filter(p => p.taller === taller.nombre);
      
      const pedidosArr = pedidosDelTaller;
      const pedidos = pedidosArr.length;
      const unidades = pedidosArr.reduce((acc, p) => acc + parseNumber(p.unidades), 0);
      const impresiones = pedidosArr.reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
      
      const hoy = new Date();
      const proximaSemana = new Date(); proximaSemana.setDate(hoy.getDate() + 7);
      const retirosSemana = pedidosArr.filter(p => {
        if (!p.fecha_retiro_ideal) return false;
        const fecha = new Date(p.fecha_retiro_ideal);
        return fecha >= hoy && fecha <= proximaSemana;
      }).length;

      const pedidosConAtraso = pedidosArr.filter(p => p.dias_retraso > 0);
      const atrasoPromedio = pedidosConAtraso.length > 0
        ? (pedidosConAtraso.reduce((acc, p) => acc + p.dias_retraso, 0) / pedidosConAtraso.length).toFixed(1)
        : 0;

      const capacidadUsada = taller.capacidad_semanal_impresiones > 0 ? (impresiones / taller.capacidad_semanal_impresiones) * 100 : 0;
      const capacidadDisponible = Math.max(0, 100 - capacidadUsada);

      let healthScore = 100;
      healthScore -= (capacidadUsada > 80 ? (capacidadUsada - 80) * 2 : 0);
      healthScore -= (atrasoPromedio * 15);
      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

      // Predicción de Riesgo Futuro (Próximos 14 días)
      const dosSemanas = new Date(); dosSemanas.setDate(hoy.getDate() + 14);
      const cargaFutura = pedidosArr.filter(p => {
        const f = new Date(p.fecha_retiro_ideal);
        return f > proximaSemana && f <= dosSemanas;
      }).reduce((acc, p) => acc + (p.impresiones || 0), 0);

      const tendenciaRiesgo = cargaFutura > (taller.capacidad_semanal_impresiones * 0.8) ? 'subiendo' : 'estable';

      return {
        nombre: taller.nombre,
        capacidad_maxima: taller.capacidad_semanal_impresiones,
        pedidos,
        unidades,
        impresiones,
        retirosSemana,
        atrasoPromedio,
        healthScore,
        tendenciaRiesgo,
        porcentaje_usado: parseFloat(capacidadUsada.toFixed(1)),
        porcentaje_disponible: parseFloat(capacidadDisponible.toFixed(1))
      };
    });
  }, [talleres, pedidosActivos]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Sincronizando capacidades...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            <span>Capacidad Operativa por Taller</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500">
              <span>Métricas de carga basadas en volumen de impresiones y unidades</span>
            </p>
            {lastSync && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">
                Sincronizado: {lastSync.toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
            {['day', 'week', 'month'].map(mode => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setSelectedTaller(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === mode 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{mode === 'day' ? 'DÍA' : mode === 'week' ? 'SEMANA' : 'MES'}</span>
              </button>
            ))}
          </div>
          <button onClick={openModal} className="px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <span>Ajustar Capacidades</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN: Saturación Diaria de Retiros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>Concentración de Retiros</span> 
          <div className="flex items-center gap-2" translate="no">
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
              <span>Vista: </span>{viewMode === 'day' ? 'Próximos 10 días' : viewMode === 'week' ? 'Próximas 6 semanas' : 'Próximos 3 meses'}
            </span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {selectedPeriodData?.label}<span> Seleccionado</span>
            </span>
          </div>
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 mb-6">
          {periodSaturation.map((period, idx) => {
            const isSaturated = period.impresiones > MAX_IMPRESIONES || period.proyectos > (viewMode === 'day' ? 8 : 40);
            const isSelected = period.id === currentSelectedId;
            
            return (
              <button 
                key={idx} 
                onClick={() => handleDateClick(period.id)}
                className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all outline-none ${
                  isSelected 
                    ? 'ring-2 ring-accent border-accent ring-offset-2 scale-[1.02] bg-white' 
                    : isSaturated ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100 hover:border-slate-300'
                }`}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase">{period.label}</span>
                <span className={`text-xl font-bold mt-1 ${isSaturated ? 'text-red-600' : 'text-slate-800'}`}>
                  {period.proyectos}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">{period.proyectos === 1 ? 'Pedido' : 'Pedidos'}</span>
                <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden" title={`${period.impresiones.toLocaleString()} impresiones`}>
                  <div 
                    className={`h-full ${isSaturated ? 'bg-red-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${Math.min((period.impresiones / MAX_IMPRESIONES) * 100, 100)}%` }}
                  ></div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detalle por Taller del periodo Seleccionado */}
        {selectedPeriodData && Object.keys(selectedPeriodData.breakdown).length > 0 && (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
              Distribución de carga para {viewMode === 'day' ? 'el día' : viewMode === 'week' ? 'la' : 'el'} {selectedPeriodData.label}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(selectedPeriodData.breakdown).map(([taller, stats]) => (
                <button 
                  key={taller} 
                  onClick={() => setSelectedTaller(selectedTaller === taller ? null : taller)}
                  className={`p-3 rounded-lg shadow-sm border transition-all flex items-center justify-between text-left outline-none ${
                    selectedTaller === taller 
                      ? 'bg-indigo-600 border-indigo-700 text-white' 
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-bold ${selectedTaller === taller ? 'text-white' : 'text-slate-800'}`}>{taller}</p>
                    <p className={`text-[11px] ${selectedTaller === taller ? 'text-indigo-100' : 'text-slate-500'}`}>{stats.proy} {stats.proy === 1 ? 'pedido' : 'pedidos'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${selectedTaller === taller ? 'text-white' : 'text-indigo-600'}`}>{stats.imps.toLocaleString('es-CL')}</p>
                    <p className={`text-[10px] uppercase font-semibold ${selectedTaller === taller ? 'text-indigo-200' : 'text-slate-400'}`}>Imp.</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Tercer Nivel: Lista de Pedidos del Taller Seleccionado */}
            {selectedTaller && selectedPeriodData.breakdown[selectedTaller] && (
              <div className="mt-4 bg-white rounded-lg border border-indigo-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">
                    Pedidos específicos de {selectedTaller}
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded">
                    {selectedPeriodData.breakdown[selectedTaller].pedidos.length} items
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedPeriodData.breakdown[selectedTaller].pedidos.map(p => (
                    <div key={p._row_key || p.pedido_id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">#{p.pedido_id}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[12px] text-slate-500 truncate max-w-[200px]">{p.nombre_proyecto}</span>
                           <span className="text-[10px] text-slate-400 italic">({formatDateDisplay(p.fecha_retiro_ideal)})</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <span className="block text-xs font-bold text-slate-600">{parseNumber(p.unidades).toLocaleString('es-CL')}</span>
                          <span className="block text-[10px] text-slate-400 uppercase">Unidades</span>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <span className="block text-sm font-bold text-indigo-600">{(parseNumber(p.impresiones) || parseNumber(p.unidades)).toLocaleString('es-CL')}</span>
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Imp.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedPeriodData && Object.keys(selectedPeriodData.breakdown).length === 0 && (
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 text-center">
            <p className="text-sm text-slate-500 italic">No hay retiros programados para este periodo.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {analytics.map((taller, idx) => (
          <button 
            key={idx} 
            onClick={() => {
              setAuditTaller(taller.nombre);
            }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-left transition-all hover:border-accent hover:shadow-md outline-none group cursor-zoom-in"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{taller.nombre}</h2>
                <div className="flex items-center mt-1 space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    taller.porcentaje_usado < 70 ? 'bg-green-50 text-green-700 border-green-200' : 
                    taller.porcentaje_usado <= 85 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {taller.porcentaje_usado < 70 ? 'DISPONIBLE' : taller.porcentaje_usado <= 85 ? 'ALTA CARGA' : 'SATURADO'}
                  </span>
                  <div className="flex items-center bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Salud Operativa (Predicción)">
                    <div className={`w-2 h-2 rounded-full mr-1.5 ${
                      taller.healthScore > 85 ? 'bg-emerald-500' : taller.healthScore > 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <span className="text-[10px] font-bold text-slate-600">SCORE: {taller.healthScore}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-sm mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500"><span>Capacidad Ocupada</span></span>
                  {taller.tendenciaRiesgo === 'subiendo' && (
                    <span className="flex items-center text-[10px] font-black text-red-500 animate-bounce">
                      <TriangleAlert className="w-3 h-3 mr-0.5" /> <span>ALERTA PROYECCIÓN</span>
                    </span>
                  )}
                </div>
                <span className="font-semibold text-slate-800" translate="no">
                  <span>{taller.porcentaje_usado}</span>%
                </span>
              </div>
              <CapacityBar percentage={taller.porcentaje_usado} />
              <div className="flex justify-between text-xs mt-2 text-slate-500">
                <span>{taller.impresiones.toLocaleString('es-CL')} (usadas)</span>
                <span className="flex items-center">
                  Max: {taller.capacidad_maxima.toLocaleString('es-CL')} 
                  <span className="ml-1 opacity-60">imp/sem</span>
                </span>
              </div>
            </div>

            <hr className="border-slate-100 my-4" />

            <div className="grid grid-cols-2 gap-y-4 gap-x-6" translate="no">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold"><span>Pedidos Activos</span></p>
                <p className="text-xl font-bold text-slate-800 mt-1"><span>{taller.pedidos}</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold"><span>Uds en Prod.</span></p>
                <p className="text-xl font-bold text-slate-800 mt-1"><span>{taller.unidades.toLocaleString('es-CL')}</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold"><span>Retiros Semana</span></p>
                <p className="text-xl font-bold text-slate-800 mt-1"><span>{taller.retirosSemana}</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold"><span>Atraso Prom.</span></p>
                <p className={`text-xl font-bold mt-1 ${taller.atrasoPromedio > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                  <span>{taller.atrasoPromedio}</span> <span>días</span>
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal Ajuste Capacidades */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Ajustar Producción Semanal</h3>
                <p className="text-sm text-slate-500 mt-1">Modifica la capacidad máxima por taller para actualizar ratios.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {editingCapacity.map(t => (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="font-medium text-slate-700">{t.nombre}</div>
                  <div className="flex items-center">
                    <input 
                      type="number" 
                      value={t.capacidad_semanal_impresiones} 
                      onChange={(e) => handleCapacityChange(t.id, e.target.value)}
                      className="w-32 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none text-right"
                    />
                    <span className="text-xs text-slate-500 ml-2 w-12 text-left">imp/sem</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 mt-1 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors">
                Cancelar
              </button>
              <button onClick={saveSettings} className="px-5 py-2 cursor-pointer bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 transition-colors flex items-center shadow-sm">
                <Save className="w-4 h-4 mr-2" /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Auditoría Profunda de Pedidos Activos */}
      {auditTaller && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  Auditoría de Pedidos Activos: {auditTaller}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Listado completo de proyectos siendo considerados en las métricas actuales del taller.
                </p>
              </div>
              <button onClick={() => setAuditTaller(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition shadow-sm border border-transparent hover:border-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="px-6 py-4 font-bold">N° Pedido</th>
                    <th className="px-6 py-4 font-bold">Proyecto / Cliente</th>
                    <th className="px-6 py-4 font-bold">Fecha Retiro</th>
                    <th className="px-6 py-4 font-bold text-right">Unidades</th>
                    <th className="px-6 py-4 font-bold text-right">Impresiones</th>
                    <th className="px-6 py-4 font-bold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pedidosActivos.filter(p => p.taller === auditTaller).map(p => (
                    <tr key={p._row_key || p.pedido_id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">#{p.pedido_id}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-700">{p.nombre_proyecto}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[250px]">{p.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                        {p.fecha_retiro_ideal}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-bold text-right">
                        {parseNumber(p.unidades).toLocaleString('es-CL')}
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-600 font-black text-right">
                        {(parseNumber(p.impresiones) || parseNumber(p.unidades)).toLocaleString('es-CL')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.estado_produccion === 'Atrasado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {p.estado_produccion}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {pedidosActivos.filter(p => p.taller === auditTaller).length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                        No se encontraron pedidos activos para este taller.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500 font-medium">
              <div>Total Pedidos: <span className="text-slate-800 font-bold">{pedidosActivos.filter(p => p.taller === auditTaller).length}</span></div>
              <div className="flex gap-4">
                <span>Sumatoria Unidades: <span className="text-slate-800 font-bold">{pedidosActivos.filter(p => p.taller === auditTaller).reduce((acc, p) => acc + parseNumber(p.unidades), 0).toLocaleString('es-CL')}</span></span>
                <span>Sumatoria Impresiones: <span className="text-indigo-600 font-bold">{pedidosActivos.filter(p => p.taller === auditTaller).reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0).toLocaleString('es-CL')}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapacityAnalytics;
