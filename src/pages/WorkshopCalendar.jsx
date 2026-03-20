import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlignJustify, LayoutGrid, CalendarDays, AlertTriangle } from 'lucide-react';
import { parseNumber, getLocalYMD, formatDateDisplay } from '../context/DataContext';

const FERIADOS_CHILE = {
  "2025-01-01": "Año Nuevo",
  "2025-04-18": "Viernes Santo",
  "2025-04-19": "Sábado Santo",
  "2025-05-01": "Día del Trabajo",
  "2025-05-21": "Día de las Glorias Navales",
  "2025-06-20": "Día Nacional de los Pueblos Indígenas",
  "2025-06-29": "San Pedro y San Pablo",
  "2025-07-16": "Día de la Virgen del Carmen",
  "2025-08-15": "Asunción de la Virgen",
  "2025-09-18": "Independencia Nacional",
  "2025-09-19": "Día de las Glorias del Ejército",
  "2025-10-12": "Encuentro de Dos Mundos",
  "2025-10-31": "Día de las Iglesias Evangélicas",
  "2025-11-01": "Día de Todos los Santos",
  "2025-12-08": "Inmaculada Concepción",
  "2025-12-25": "Navidad",
  "2026-01-01": "Año Nuevo"
};

const WorkshopCalendar = ({ pedidos, taller, onPedidoClick }) => {
  const [calendarMode, setCalendarMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());



  const goPrev = () => {
    const d = new Date(currentDate);
    if (calendarMode === 'day') d.setDate(d.getDate() - 1);
    else if (calendarMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (calendarMode === 'day') d.setDate(d.getDate() + 1);
    else if (calendarMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const getTitle = () => {
    if (calendarMode === 'day') return currentDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    if (calendarMode === 'month') return currentDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const friday = new Date(new Date(monday).setDate(monday.getDate() + 4));
    return `Semana del ${monday.getDate()} al ${friday.getDate()} de ${monday.toLocaleDateString('es-CL', { month: 'long' })}`;
  };

  const Card = ({ pedido }) => {
    const estado = String(pedido.estado_produccion || '').toLowerCase();
    const isListo = estado.includes('listo') || estado.includes('terminado');
    const isProceso = estado.includes('proceso') || estado.includes('taller');
    
    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          if (onPedidoClick) onPedidoClick(pedido);
        }}
        className={`p-2 rounded-lg mb-2 border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 z-30 ${
          isListo ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 
          isProceso ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex justify-between text-[9px] font-bold opacity-70 mb-1">
          <span>#{pedido.pedido_id}</span>
          <span>{(parseNumber(pedido.impresiones) || parseNumber(pedido.unidades)).toLocaleString()} imp.</span>
        </div>
        <div className="text-[11px] font-black leading-tight truncate uppercase">{pedido.nombre_proyecto}</div>
        <div className="text-[9px] mt-1 font-bold opacity-60">{pedido.estado_produccion || 'PENDIENTE'}</div>
      </div>
    );
  };

  const renderDaily = () => {
    const ymd = getLocalYMD(currentDate);
    const delDia = pedidos.filter(p => getLocalYMD(p.fecha_retiro_ideal) === ymd);
    const feriado = FERIADOS_CHILE[ymd];

    const totalImpresiones = delDia.reduce((sum, p) => sum + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);

    return (
      <div className={`p-4 rounded-2xl border h-full ${feriado ? 'bg-fuchsia-50 border-fuchsia-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h3 className="font-black text-slate-700 uppercase tracking-tighter text-xl">Programación del Día</h3>
            {feriado && <span className="text-[10px] bg-fuchsia-500 text-white px-2 py-0.5 rounded-full font-bold inline-block mt-1">🎉 {feriado}</span>}
          </div>
          
          {!feriado && delDia.length > 0 && (
            <div className="flex gap-4">
              <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase block">Proyectos</span>
                <span className="text-sm font-black text-indigo-600">{delDia.length}</span>
              </div>
              <div className="bg-indigo-600 px-4 py-2 rounded-2xl shadow-md">
                <span className="text-[9px] font-black text-indigo-100 uppercase block">Total Impresiones</span>
                <span className="text-sm font-black text-white">{totalImpresiones.toLocaleString('es-CL')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {delDia.map((p, i) => <Card key={`${p._row_key || p.pedido_id}-${i}`} pedido={p} />)}
          {delDia.length === 0 && <p className="text-xs text-slate-400 italic">Sin programación para hoy.</p>}
        </div>
      </div>
    );
  };

  const renderWeekly = () => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    
    const days = [0,1,2,3,4].map(idx => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + idx);
      return date;
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 h-full min-h-[500px]">
        {days.map(dia => {
          const ymd = getLocalYMD(dia);
          const isToday = ymd === getLocalYMD(new Date());
          const feriado = FERIADOS_CHILE[ymd];
          const delDia = pedidos.filter(p => getLocalYMD(p.fecha_retiro_ideal) === ymd);
          const totalImp = delDia.reduce((sum, p) => sum + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);

          return (
            <div key={ymd} className={`flex flex-col rounded-2xl border ${isToday ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className={`p-3 text-center border-b ${isToday ? 'bg-indigo-100' : 'bg-white'}`}>
                <div className="text-[10px] uppercase font-black text-slate-400">{dia.toLocaleDateString('es-CL', { weekday: 'short' })}</div>
                <div className="text-lg font-black text-slate-700">{dia.getDate()}</div>
                {!feriado && delDia.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1 rounded">{totalImp.toLocaleString('es-CL')} imp.</span>
                    <span className="text-[8px] font-bold text-slate-400">{delDia.length} proj.</span>
                  </div>
                )}
              </div>
              <div className="p-2 flex-1 overflow-y-auto">
                {feriado ? <div className="text-center p-4 text-fuchsia-500 font-bold text-xs">🎉 {feriado}</div> : delDia.map((p, i) => <Card key={`${p._row_key || p.pedido_id}-${i}`} pedido={p} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthly = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const grid = [];

    for (let i = 1; i <= days; i++) {
      const d = new Date(y, m, i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ymd = getLocalYMD(d);
      const isToday = ymd === getLocalYMD(new Date());
      const feriado = FERIADOS_CHILE[ymd];
      const delDia = pedidos.filter(p => getLocalYMD(p.fecha_retiro_ideal) === ymd);
      const totalImp = delDia.reduce((sum, p) => sum + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);

      grid.push(
        <div 
          key={ymd} 
          onClick={() => { if(delDia.length > 0) { setCurrentDate(d); setCalendarMode('day'); } }}
          className={`h-24 p-2 border rounded-xl relative hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer ${isToday ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-white border-slate-100 shadow-sm'}`}
        >
          <span className={`text-xs font-black ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{i}</span>
          {feriado && <div className="absolute inset-0 bg-fuchsia-500/10 flex items-center justify-center text-[8px] font-bold text-fuchsia-800 text-center rounded-xl">🎉 {feriado}</div>}
          {!feriado && delDia.length > 0 && (
            <div className="mt-1 space-y-0.5">
              <div className="text-[9px] font-black text-emerald-600 truncate bg-emerald-50 px-1 rounded text-center">
                {delDia.length} ped.
              </div>
              <div className="text-[8px] font-bold text-slate-400 text-center">
                {totalImp.toLocaleString('es-CL')} imp.
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
        <div className="grid grid-cols-5 gap-2 mb-2">
          {['LUN','MAR','MIE','JUE','VIE'].map(d => <div key={d} className="text-center text-[9px] font-black text-slate-400">{d}</div>)}
        </div>
        <div className="grid grid-cols-5 gap-2">{grid}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 rounded-3xl p-4 border border-slate-100 shadow-inner">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronLeft className="w-5 h-5"/></button>
          <h2 className="text-lg font-black text-slate-700 uppercase tracking-tighter w-56 text-center">{getTitle()}</h2>
          <button onClick={goNext} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronRight className="w-5 h-5"/></button>
          <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-black ml-2 px-3 py-1 bg-white rounded-lg border shadow-sm hover:bg-indigo-600 hover:text-white transition-all">HOY</button>
        </div>

        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
          {[ ['day','Día'], ['week','Sem'], ['month','Mes'] ].map(([m,l]) => (
            <button key={m} onClick={() => setCalendarMode(m)} className={`px-4 py-1.5 text-xs font-black rounded-xl transition-all ${calendarMode === m ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}>{l}</button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-[400px]">
        {calendarMode === 'day' && renderDaily()}
        {calendarMode === 'week' && renderWeekly()}
        {calendarMode === 'month' && renderMonthly()}
      </div>
    </div>
  );
};

export default WorkshopCalendar;
