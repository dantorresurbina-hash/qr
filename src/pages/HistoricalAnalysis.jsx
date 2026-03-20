import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Calendar, Download, FileText, ChevronRight, Filter, TrendingUp, Clock, Package, Zap 
} from 'lucide-react';
import { useData, getLocalYMD } from '../context/DataContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

const HistoricalAnalysis = () => {
  const { data: mockConsolidatedData, isLoading } = useData();
  const [dateRange, setDateRange] = useState({
    start: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().split('T')[0];
    })(),
    end: new Date().toISOString().split('T')[0]
  });
  const [fastMode, setFastMode] = useState(false);

  // Chile Holidays 2025-2026 (simplified)
  const FERIADOS_CHILE = [
    // 2025
    '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21', '2025-06-29',
    '2025-07-16', '2025-08-15', '2025-09-18', '2025-09-19', '2025-10-12', '2025-10-31',
    '2025-11-01', '2025-12-08', '2025-12-25',
    // 2026
    '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-29',
    '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31',
    '2026-11-01', '2026-12-08', '2026-12-25'
  ];

  const businessDaysInclusive = (s, e) => {
    let start = new Date(s);
    start.setHours(0,0,0,0);
    const end = new Date(e);
    end.setHours(0,0,0,0);

    if (end < start) return 0;

    let biz = 0;
    let current = new Date(start);
    while (current <= end) {
      const wd = current.getDay();
      const ymd = current.toISOString().split('T')[0];
      if (wd !== 0 && wd !== 6 && !FERIADOS_CHILE.includes(ymd)) {
        biz++;
      }
      current.setDate(current.getDate() + 1);
    }
    return biz;
  };

  const calculateDelay = (ideal, real) => {
    if (!ideal || !real) return null;
    const dIdeal = new Date(ideal);
    const dReal = new Date(real);
    
    if (dReal <= dIdeal) return 0;

    // Start counting from Day+1 of ideal
    const start = new Date(ideal);
    start.setDate(start.getDate() + 1);
    
    return businessDaysInclusive(start, real);
  };

  const parseSafeDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    // Suprimir time slash/dash confusion
    const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
    if (parts.length === 3) {
      // Si el primer tramo tiene 4 digitos es YYYY-MM-DD
      if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
      // Si el ultimo tramo tiene 4 digitos es DD/MM/YYYY
      if (parts[2].length === 4) return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
  };

  const reportData = useMemo(() => {
    if (isLoading || !mockConsolidatedData) return null;

    const start = parseSafeDate(dateRange.start);
    const end = parseSafeDate(dateRange.end);
    if (end) end.setHours(23, 59, 59, 999); // Incluir todo el día final

    const processed = mockConsolidatedData.filter(p => {
      if (String(p.estado || '').toLowerCase().includes('anulado')) return false;

      const ideal = parseSafeDate(p.fecha_retiro_ideal);
      const real = parseSafeDate(p.fecha_retiro_real);
      const clave = real || ideal;

      if (!clave || isNaN(clave.getTime())) return false;
      return clave >= start && clave <= end;
    }).map(p => {
      const ideal = parseSafeDate(p.fecha_retiro_ideal);
      const real = parseSafeDate(p.fecha_retiro_real);
      const delay = calculateDelay(ideal, real);
      const isExpress = String(p.nombre_proyecto || '').toLowerCase().includes('express');
      
      let impAdj = p.impresiones || 0;
      if (String(p.taller || '').toLowerCase().includes('we are')) {
        impAdj = p.unidades || 0;
      }

      const dateObj = real || ideal;
      const mKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      return {
        ...p,
        delay,
        impAdj,
        isExpress,
        month: mKey
      };
    });

    // Summary
    const totalTrabajos = processed.length;
    const totalImpresiones = processed.reduce((acc, p) => acc + p.impAdj, 0);
    const totalExpress = processed.filter(p => p.isExpress).length;
    
    const delaysArr = processed.filter(p => p.delay !== null).map(p => p.delay);
    const avgDelay = delaysArr.length > 0 ? (delaysArr.reduce((a, b) => a + b, 0) / delaysArr.length).toFixed(1) : 0;
    
    // Percentiles
    const sortedDelays = [...delaysArr].sort((a, b) => a - b);
    const getPercentile = (p) => {
      if (sortedDelays.length === 0) return 0;
      const index = Math.ceil((p / 100) * sortedDelays.length) - 1;
      return sortedDelays[Math.max(0, index)];
    };

    // Group by month for chart
    const byMonth = processed.reduce((acc, p) => {
      const mKey = p.month;
      if (!acc[mKey]) acc[mKey] = { month: mKey, jobs: 0, imps: 0, sumDelay: 0, countDelay: 0 };
      acc[mKey].jobs++;
      acc[mKey].imps += p.impAdj;
      if (p.delay !== null) {
        acc[mKey].sumDelay += p.delay;
        acc[mKey].countDelay++;
      }
      return acc;
    }, {});

    const monthlyData = Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        avgDelay: m.countDelay > 0 ? parseFloat((m.sumDelay / m.countDelay).toFixed(1)) : 0
      }));

    const workshopPerf = processed.reduce((acc, p) => {
      const name = p.taller || 'Sin Taller';
      if (!acc[name]) acc[name] = { name, total: 0, sumDelay: 0, countDelay: 0, sumEarly: 0, countEarly: 0, imps: 0 };
      
      acc[name].total++;
      acc[name].imps += p.impAdj;
      
      const ideal = parseSafeDate(p.fecha_retiro_ideal);
      const real = parseSafeDate(p.fecha_retiro_real);
      
      if (ideal && real) {
        if (real > ideal) {
          acc[name].sumDelay += calculateDelay(ideal, real);
          acc[name].countDelay++;
        } else if (real < ideal) {
          // Días de adelanto (hábiles)
          const early = businessDaysInclusive(real, ideal) - 1; 
          acc[name].sumEarly += Math.max(0, early);
          acc[name].countEarly++;
        }
      }
      return acc;
    }, {});

    const workshopPerfData = Object.values(workshopPerf).map(w => ({
      ...w,
      avgDelay: w.countDelay > 0 ? parseFloat((w.sumDelay / w.countDelay).toFixed(1)) : 0,
      avgEarly: w.countEarly > 0 ? parseFloat((w.sumEarly / w.countEarly).toFixed(1)) : 0
    })).sort((a,b) => b.imps - a.imps);

    const workshopData = workshopPerfData.slice(0, 8);

    // Top Atrasos
    const topDelays = processed
      .filter(p => p.delay !== null)
      .sort((a, b) => b.delay - a.delay)
      .slice(0, 10);

    console.log('Historical Analysis Debug:', { 
      totalProcessed: processed.length, 
      monthlyPoints: monthlyData.length,
      workshopPoints: workshopData.length 
    });

    return {
      totalTrabajos,
      totalImpresiones,
      totalExpress,
      avgDelay,
      p90: getPercentile(90),
      p95: getPercentile(95),
      monthlyData,
      workshopData,
      workshopPerfData,
      topDelays,
      processedData: processed
    };
  }, [mockConsolidatedData, isLoading, dateRange]);

  const exportCSV = () => {
    if (!reportData || reportData.processedData?.length === 0) {
      alert("No hay datos para exportar en el rango seleccionado.");
      return;
    }

    const headers = [
      "ID Pedido", "Proyecto", "Taller", "Familia", "Impresiones", 
      "Fecha Ideal", "Fecha Real", "Atraso (Hábiles)", "Estado"
    ];

    const rows = reportData.processedData.map(p => [
      p.pedido_id,
      p.nombre_proyecto,
      p.taller,
      p.familia,
      p.impAdj,
      p.fecha_retiro_ideal,
      p.fecha_retiro_real,
      p.delay,
      p.estado
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `informe_historico_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Alternative Custom SVG Charts ---
  const SimpleBarChart = ({ data, xKey, yKey, color = "#6366f1", gradientId = "barGradient" }) => {
    if (!data || data.length === 0) return null;
    const maxVal = Math.max(...data.map(d => d[yKey] || 0), 1);
    const height = 200;
    const width = 450;
    const barWidth = (width / data.length) * 0.7;
    const gap = (width / data.length) * 0.3;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line key={v} x1="0" y1={(height - 40) * (1 - v) + 20} x2={width} y2={(height - 40) * (1 - v) + 20} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const val = d[yKey] || 0;
          const barHeight = (val / maxVal) * (height - 40);
          const x = i * (barWidth + gap) + gap/2;
          const y = height - barHeight - 20;
          return (
            <g key={i} className="group cursor-default">
              <rect 
                x={x} 
                y={y} 
                width={barWidth} 
                height={barHeight} 
                fill={`url(#${gradientId})`} 
                rx="4"
                className="transition-all duration-300 group-hover:brightness-110 group-hover:filter group-hover:drop-shadow-sm"
              />
              <text x={x + barWidth/2} y={height - 5} textAnchor="middle" fontSize="10" fill="#94a3b8" className="font-medium">{d[xKey]}</text>
              <text x={x + barWidth/2} y={y - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155" className="opacity-0 group-hover:opacity-100 transition-opacity">{val}d</text>
            </g>
          );
        })}
        <line x1="0" y1={height - 20} x2={width} y2={height - 20} stroke="#cbd5e1" strokeWidth="1.5" />
      </svg>
    );
  };

  const SimpleHorizontalBarChart = ({ data, xKey, yKey, color = "#10b981", gradientId = "horizGradient" }) => {
    if (!data || data.length === 0) return null;
    const maxVal = Math.max(...data.map(d => d[yKey] || 0), 1);
    const width = 400;
    const rowHeight = 32;
    const height = data.length * rowHeight;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const val = d[yKey] || 0;
          const barWidth = (val / maxVal) * (width - 140);
          const y = i * rowHeight;
          return (
            <g key={i} className="group cursor-default">
              <text x="0" y={y + 20} fontSize="11" fill="#64748b" className="font-semibold">{d[xKey].substring(0, 15)}</text>
              <rect 
                x="110" 
                y={y + 6} 
                width={barWidth} 
                height={20} 
                fill={`url(#${gradientId})`} 
                rx="4"
                className="transition-all duration-300 group-hover:brightness-110"
              />
              <text x={110 + barWidth + 8} y={y + 20} fontSize="11" fontWeight="800" fill="#1e293b">{val.toLocaleString()}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Procesando informe histórico...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Informe Histórico – Rango (V7+)</h1>
          <p className="text-slate-500">Análisis operativo y de performance basado en rango de fechas.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg p-1.5 flex items-center shadow-sm hover:border-indigo-200 transition-colors">
            <Calendar className="w-4 h-4 text-slate-400 mx-2" />
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
              className="text-sm outline-none bg-transparent"
            />
            <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
              className="text-sm outline-none bg-transparent"
            />
          </div>
          <button 
            onClick={exportCSV} 
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Impresiones (Ajust.)</p>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Package className="w-4 h-4 text-indigo-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{reportData.totalImpresiones.toLocaleString('es-CL')}</p>
              <p className="text-xs text-slate-400 mt-1">{reportData.totalTrabajos} proyectos totales</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-amber-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Demora Promedio</p>
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{reportData.avgDelay} d</p>
              <p className="text-xs text-slate-400 mt-1">Días hábiles (Ideal a Real)</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-red-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Percentil 95</p>
                <div className="p-2 bg-red-50 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{reportData.p95} d</p>
              <p className="text-xs text-slate-400 mt-1">En los peores escenarios</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-yellow-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Pedidos Express</p>
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Zap className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{reportData.totalExpress}</p>
              <p className="text-xs text-slate-400 mt-1">{reportData.totalTrabajos > 0 ? Math.round((reportData.totalExpress/reportData.totalTrabajos)*100) : 0}% de la carga habitual</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alternative Chart 1 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Tendencia Mensual de Demora</h3>
              <div className="h-64 w-full flex items-center justify-center">
                {reportData.monthlyData.length > 0 ? (
                  <SimpleBarChart data={reportData.monthlyData} xKey="month" yKey="avgDelay" color="#6366f1" />
                ) : (
                  <div className="text-slate-400 italic text-sm">Sin datos para tendencia mes a mes.</div>
                )}
              </div>
            </div>

            {/* Alternative Chart 2 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Carga por Taller (Top 8 Impresiones)</h3>
              <div className="h-64 w-full flex items-start justify-center pt-4">
                {reportData.workshopData.length > 0 ? (
                  <SimpleHorizontalBarChart data={reportData.workshopData} xKey="name" yKey="imps" color="#10b981" />
                ) : (
                  <div className="text-slate-400 italic text-sm">Sin datos de carga por taller.</div>
                )}
              </div>
            </div>
          </div>

          {/* Performance by Workshop Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 italic">Performance Detallada por Taller</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Taller</th>
                    <th className="px-6 py-3 text-center">Proyectos</th>
                    <th className="px-6 py-3 text-center">Atraso Prom.</th>
                    <th className="px-6 py-3 text-center">Entrega Temp. Prom.</th>
                    <th className="px-6 py-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {reportData.workshopPerfData.map((w, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{w.name}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{w.total}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-bold ${w.avgDelay > 1 ? 'text-red-500' : 'text-slate-600'}`}>
                          {w.avgDelay} d
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-emerald-600">
                          {w.avgEarly} d
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {w.avgDelay < 0.5 ? (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">EXCELENTE</span>
                        ) : w.avgDelay < 1.5 ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">REGULAR</span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">CRÍTICO</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Delays Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Top 10 Proyectos con Mayor Atraso</h3>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-semibold uppercase">Puntos de Falla</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <tr>
                    <th className="px-6 py-3">ID / Proyecto</th>
                    <th className="px-6 py-3">Taller</th>
                    <th className="px-6 py-3">F. Ideal</th>
                    <th className="px-6 py-3">F. Real</th>
                    <th className="px-6 py-3 text-right">Atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.topDelays.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">#{p.pedido_id}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{p.nombre_proyecto}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{p.taller}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{p.fecha_retiro_ideal}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{p.fecha_retiro_real}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-block px-2 py-1 bg-red-50 text-red-600 rounded text-sm font-bold">
                          +{p.delay} d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HistoricalAnalysis;
