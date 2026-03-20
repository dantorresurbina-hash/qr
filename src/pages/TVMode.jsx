import React, { useState, useEffect } from 'react';
import { useData, getLocalYMD } from '../context/DataContext';
import { AlertCircle, Truck, Package, Clock, TrendingUp, Monitor, CheckCircle } from 'lucide-react';

const TVMode = () => {
  const { data: mockConsolidatedData, isLoading, lastSync } = useData();
  const [view, setView] = useState('critical'); // 'critical', 'logistics', 'summary'
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotación automática de vistas (cada 15 segundos)
  useEffect(() => {
    const rotator = setInterval(() => {
      setView(v => {
        if (v === 'critical') return 'logistics';
        if (v === 'logistics') return 'summary';
        return 'critical';
      });
    }, 15000);
    return () => clearInterval(rotator);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-2xl font-bold animate-pulse">CARGANDO MONITOR DE PLANTA...</p>
        </div>
      </div>
    );
  }

  const todayStr = getLocalYMD();
  const isFinalizado = (p) => {
    const estado = String(p.estado_produccion || '').toLowerCase();
    return estado.includes('entregado') || estado.includes('retirado') || estado.includes('finalizado') || estado.includes('listo taller');
  };

  const criticalOrders = mockConsolidatedData
    .filter(p => !p.fecha_retiro_real && p.fecha_retiro_ideal < todayStr && !isFinalizado(p))
    .sort((a, b) => (a.fecha_retiro_ideal || '').localeCompare(b.fecha_retiro_ideal || ''))
    .slice(0, 8);

  const logisticsToday = mockConsolidatedData
    .filter(p => p.fecha_retiro_ideal === todayStr && !p.fecha_retiro_real && !isFinalizado(p))
    .slice(0, 8);

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 font-sans p-8 overflow-hidden flex flex-col">
      {/* Header Fijo */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-6 mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
              Control Tower <span className="text-indigo-400">Planta</span>
            </h1>
            <p className="text-slate-500 text-lg font-bold flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-ping"></span>
              Sincronizado: {lastSync?.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-6xl font-black tabular-nums text-white bg-slate-900 px-6 py-2 rounded-2xl border border-slate-800 border-b-4 border-b-indigo-500 shadow-xl">
            {time}
          </p>
          <p className="text-xl font-bold text-slate-400 mt-2 uppercase tracking-widest">{new Intl.DateTimeFormat('es-CL', { dateStyle: 'full' }).format(new Date())}</p>
        </div>
      </div>

      {/* Cuerpo Principal Dinámico */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* VISTA: PEDIDOS CRÍTICOS */}
        {view === 'critical' && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-12 duration-1000">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-red-500 p-3 rounded-full animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-5xl font-black text-red-500 uppercase tracking-tight">🚨 Pedidos Críticos (Atraso)</h2>
            </div>
            
            <div className="flex-1 grid grid-cols-1 gap-4">
              {criticalOrders.length > 0 ? (
                criticalOrders.map((p) => (
                  <div key={p.pedido_id} className="bg-slate-900/50 border-l-[12px] border-red-600 rounded-2xl p-6 flex justify-between items-center shadow-lg hover:bg-slate-900 transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-6xl font-black text-white">#{p.pedido_id}</span>
                        <span className="bg-red-900/50 text-red-400 text-2xl font-black px-4 py-1 rounded-full border border-red-500/30 uppercase">
                          {p.dias_retraso} DÍAS ATRASO
                        </span>
                      </div>
                      <h3 className="text-3xl font-bold text-slate-300 truncate max-w-[800px]">{p.nombre_proyecto}</h3>
                    </div>
                    <div className="text-right pl-8">
                      <p className="text-2xl text-slate-500 font-bold uppercase tracking-widest">Taller</p>
                      <p className="text-5xl font-black text-indigo-400">{p.taller}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full border-4 border-dashed border-slate-800 rounded-3xl opacity-50">
                  <CheckCircle className="w-32 h-32 text-green-500 mb-6" />
                  <p className="text-5xl font-black text-slate-500 tracking-tighter uppercase">Sin pedidos críticos pendientes</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA: LOGÍSTICA DE HOY */}
        {view === 'logistics' && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-12 duration-1000">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-amber-500 p-3 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-5xl font-black text-amber-500 uppercase tracking-tight">🚚 Retiros para Hoy ({todayStr.split('-').reverse().join('/')})</h2>
            </div>
            
            <div className="flex-1 grid grid-cols-2 gap-6">
              {logisticsToday.length > 0 ? (
                logisticsToday.map((p) => (
                  <div key={p.pedido_id} className="bg-slate-900/50 border-t-[8px] border-amber-500 rounded-2xl p-6 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-4xl font-black text-white">#{p.pedido_id}</span>
                      <span className="bg-slate-800 px-3 py-1 rounded text-xl font-bold text-slate-400 uppercase tracking-widest">{p.taller}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-300 line-clamp-2 h-16">{p.nombre_proyecto}</h3>
                    <div className="mt-4 flex justify-between items-end border-t border-slate-800 pt-4">
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Impresiones</p>
                        <p className="text-3xl font-black text-indigo-400">{(p.impresiones || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Estado</p>
                        <p className="text-xl font-bold text-amber-500 uppercase">{p.estado_produccion}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 flex flex-col items-center justify-center h-full border-4 border-dashed border-slate-800 rounded-3xl opacity-50">
                   <p className="text-5xl font-black text-slate-500 tracking-tighter uppercase">No hay más retiros para hoy</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA: RESUMEN DE RED */}
        {view === 'summary' && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-12 duration-1000">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-indigo-500 p-3 rounded-full shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-5xl font-black text-indigo-500 uppercase tracking-tight">📊 Resumen Operativo de Red</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-8 flex-1">
              <div className="col-span-1 flex flex-col gap-6">
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex-1 flex flex-col justify-center">
                  <p className="text-2xl font-bold text-slate-500 uppercase tracking-widest mb-2">Pedidos Activos</p>
                  <p className="text-9xl font-black text-white">{mockConsolidatedData.filter(p=>!p.fecha_retiro_real).length}</p>
                </div>
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex-1 flex flex-col justify-center">
                  <p className="text-2xl font-bold text-slate-500 uppercase tracking-widest mb-2">Impresiones Pend.</p>
                  <p className="text-7xl font-black text-indigo-400">
                    {mockConsolidatedData.filter(p=>!p.fecha_retiro_real).reduce((acc,p)=>acc+p.impresiones, 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="col-span-2 bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col">
                <h3 className="text-3xl font-black text-slate-300 mb-6 uppercase tracking-tight border-b border-slate-800 pb-4">Salud de Talleres</h3>
                <div className="flex-1 space-y-6">
                  {['Yute Impresiones', 'Lidi', 'Pintapack', 'Ideamania'].map(tallerName => {
                    const pedidosTaller = mockConsolidatedData.filter(p=>!p.fecha_retiro_real && p.taller === tallerName);
                    const atrasoTotal = pedidosTaller.reduce((acc, p) => acc + (p.dias_retraso > 0 ? p.dias_retraso : 0), 0);
                    const count = pedidosTaller.length;

                    return (
                      <div key={tallerName} className="flex items-center justify-between group">
                        <span className="text-4xl font-black text-slate-400 group-hover:text-white transition-colors">{tallerName}</span>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                             <p className="text-4xl font-black text-white">{count}</p>
                             <p className="text-xs text-slate-500 uppercase font-bold">Pedidos</p>
                          </div>
                          <div className={`w-32 py-2 rounded-xl text-center border-2 ${atrasoTotal > 0 ? 'bg-red-900/30 border-red-500 text-red-500' : 'bg-green-900/30 border-green-500 text-green-500'}`}>
                            <span className="text-3xl font-black italic">{atrasoTotal > 0 ? `! ${atrasoTotal}` : 'OK'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer / Info Fija */}
      <div className="mt-8 border-t border-slate-800 pt-6 flex justify-between items-center shrink-0">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <div className={`w-4 h-4 rounded-full ${view === 'critical' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-slate-700'}`}></div>
            <span className={`text-xl font-black ${view === 'critical' ? 'text-white' : 'text-slate-600'}`}>CRÍTICOS</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <div className={`w-4 h-4 rounded-full ${view === 'logistics' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-slate-700'}`}></div>
            <span className={`text-xl font-black ${view === 'logistics' ? 'text-white' : 'text-slate-600'}`}>LOGÍSTICA</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <div className={`w-4 h-4 rounded-full ${view === 'summary' ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'bg-slate-700'}`}></div>
            <span className={`text-xl font-black ${view === 'summary' ? 'text-white' : 'text-slate-600'}`}>RESUMEN RED</span>
          </div>
        </div>
        <p className="text-slate-600 font-black text-xl tracking-widest uppercase italic bg-slate-900/50 px-6 py-2 rounded-full">
          Google Deepmind Advanced Agentic Coding - Dashboard Operativo V10.0
        </p>
      </div>
    </div>
  );
};

export default TVMode;
