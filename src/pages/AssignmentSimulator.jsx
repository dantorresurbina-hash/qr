import React, { useState } from 'react';
import { Settings2, Calculator, ArrowRight, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { useData, parseNumber } from '../context/DataContext';

const AssignmentSimulator = () => {
  const { data: mockConsolidatedData, talleres, isLoading } = useData();
  const getTalleres = () => talleres;

  const [form, setForm] = useState({
    sku: '',
    unidades: '',
    coloresTiro: '',
    coloresRetiro: '',
    superficie: 'Algodón',
    fechaDeseada: '',
    sugerenciaTaller: ''
  });

  const [resultado, setResultado] = useState(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Iniciando simulador de derivación cruzada...</p>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value});
  };

  const calcularImpresiones = () => {
    // Cálculo super simplificado para el demo (uds * (tiro + retiro)/2) asumiendo formatos simples
    const tiro = parseInt(form.coloresTiro) || 0;
    const retiro = parseInt(form.coloresRetiro) || 0;
    const uds = parseInt(form.unidades) || 0;
    const factorColor = Math.max(1, (tiro + retiro) / 2);
    return Math.floor(uds * factorColor);
  };

  const simular = (e) => {
    e.preventDefault();
    const impresionesCalculadas = calcularImpresiones();
    const talleres = getTalleres();
    const currentActivos = mockConsolidatedData.filter(p => !p.fecha_retiro_real);

    // Mapear talleres e inyectar métricas actuales
    let talleresScore = talleres.map(t =>{
      const impresionesActivas = currentActivos.filter(p=>p.taller === t.nombre).reduce((acc, p)=> acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
      const capacidadDisponible = t.capacidad_semanal_impresiones - impresionesActivas;
      const capacidadResultante = capacidadDisponible - impresionesCalculadas;
      const pctUsadoFuturo = ((impresionesActivas + impresionesCalculadas) / t.capacidad_semanal_impresiones) * 100;
      
      const atrasoPromedio = currentActivos.filter(p=>p.taller===t.nombre && p.dias_retraso>0).length;

      let score = 100; // Base score
      
      // Penaliza por sobre capacidad
      if(pctUsadoFuturo > 85) score -= 40;
      if(pctUsadoFuturo > 100) score -= 100;

      // Penaliza por historial de atrasos recientes
      score -= (atrasoPromedio * 5);

      // Bonifica si es el sugerido
      if(form.sugerenciaTaller === t.nombre) score += 15;

      return {
        ...t,
        capacidadResultante: Math.max(0, capacidadResultante),
        pctUsadoFuturo,
        score,
        retrasoFactor: atrasoPromedio
      };
    });

    talleresScore.sort((a,b) => b.score - a.score);
    
    setResultado({
      recomendado: talleresScore[0],
      alternativos: talleresScore.slice(1),
      impresionesEstimadas: impresionesCalculadas
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Simulador de Asignación</h1>
        <p className="text-slate-500">Calcula la capacidad de la red y encuentra el mejor taller para tu próximo proyecto.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center">
            <Settings2 className="w-5 h-5 text-slate-500 mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">Parámetros del Proyecto</h2>
          </div>
          
          <form onSubmit={simular} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Proyecto</label>
                <input required type="text" name="sku" onChange={handleChange} className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" placeholder="Ej. AF-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidades <span className="text-red-500">*</span></label>
                <input required type="number" name="unidades" onChange={handleChange} className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" placeholder="5000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Colores Tiro <span className="text-red-500">*</span></label>
                <input required type="number" name="coloresTiro" onChange={handleChange} min="1" max="8" className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" placeholder="4" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Colores Retiro</label>
                <input type="number" name="coloresRetiro" onChange={handleChange} min="0" max="8" className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Superficie</label>
                 <select name="superficie" onChange={handleChange} className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none">
                   <option value="Algodón">Algodón</option>
                   <option value="Lona">Lona</option>
                   <option value="TNT">TNT</option>
                   <option value="Kraft">Kraft</option>
                   <option value="Sintético">Sintético</option>
                   <option value="Papel Couché">Papel Couché</option>
                   <option value="Cartulina">Cartulina</option>
                   <option value="Vinilo">Vinilo</option>
                   <option value="Tela PVC">Tela PVC</option>
                 </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Retiro Deseada <span className="text-red-500">*</span></label>
                <input required type="date" name="fechaDeseada" onChange={handleChange} className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sugerencia de Pre-prensa / Diseño (Opcional)</label>
              <select name="sugerenciaTaller" onChange={handleChange} className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none">
                <option value="">Sin preferencia</option>
                {getTalleres().map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>

            <div className="pt-4">
              <button type="submit" className="w-full bg-slate-800 text-white font-medium py-2.5 rounded-lg flex items-center justify-center hover:bg-slate-700 transition shadow-sm">
                <Calculator className="w-5 h-5 mr-2 -ml-1" /> Simular Carga y Configurar
              </button>
            </div>
          </form>
        </div>

        {/* Resultados */}
        <div className="bg-slate-50 rounded-xl border border-slate-200">
           {resultado ? (
             <div className="h-full flex flex-col p-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-bold text-slate-800">Análisis de Viabilidad</h3>
                 <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                   {resultado.impresionesEstimadas.toLocaleString('es-CL')} impresiones est.
                 </span>
               </div>
               
               {/* Taller Principal */}
               <div className="bg-white border-2 border-green-400 rounded-lg p-5 shadow-sm relative overflow-hidden mb-6">
                 <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
                   Recomendado
                 </div>
                 <div className="flex items-start">
                   <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center mr-3 mt-1 shrink-0">
                     <CheckCircle2 className="w-6 h-6" />
                   </div>
                   <div>
                     <h4 className="text-lg font-bold text-slate-800">{resultado.recomendado.nombre}</h4>
                     
                     <div className="mt-3 space-y-2 text-sm">
                       <div className="flex justify-between items-center text-slate-600">
                         <span>Carga estimada post-asignación:</span>
                         <span className={`font-semibold ${resultado.recomendado.pctUsadoFuturo > 85 ? 'text-amber-600' : 'text-green-600'}`}>
                           {resultado.recomendado.pctUsadoFuturo.toFixed(1)}%
                         </span>
                       </div>
                       
                       <p className="text-slate-500 text-xs mt-3 leading-relaxed">
                         {resultado.recomendado.nombre} tiene disponibilidad para este proyecto. {resultado.recomendado.retrasoFactor === 0 ? 'No presenta historial de atrasos recientes activo.' : 'Tiene algunos pedidos atrasados pero mantiene capacidad productiva.'}
                       </p>
                     </div>
                   </div>
                 </div>
                 <button className="w-full mt-4 bg-green-50 text-green-700 border border-green-200 font-medium py-2 text-sm rounded hover:bg-green-100 transition">
                   Derivar a este Taller
                 </button>
               </div>

               {/* Alternativas */}
               <div>
                 <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Talleres Alternativos</h4>
                 <div className="space-y-3">
                   {resultado.alternativos.map(alt => (
                     <div key={alt.id} className={`bg-white border p-3 rounded-lg flex justify-between items-center ${
                       alt.pctUsadoFuturo > 100 ? 'border-red-200' : 'border-slate-200'
                     }`}>
                       <div className="flex items-center">
                         <Building2 className="w-4 h-4 text-slate-400 mr-2" />
                         <div>
                           <p className="text-sm font-medium text-slate-700">{alt.nombre}</p>
                           <p className="text-xs text-slate-500">Carga resultante: {alt.pctUsadoFuturo.toFixed(1)}%</p>
                         </div>
                       </div>
                       {alt.pctUsadoFuturo > 100 ? (
                         <div className="text-red-500 flex items-center text-xs font-medium bg-red-50 px-2 py-1 rounded">
                           <AlertTriangle className="w-3 h-3 mr-1" /> Saturado
                         </div>
                       ) : (
                         <button className="p-1 px-3 text-xs bg-slate-100 text-slate-600 font-medium rounded hover:bg-slate-200 transition">
                           Forzar Asignación
                         </button>
                       )}
                     </div>
                   ))}
                 </div>
               </div>

             </div>
           ) : (
             <div className="flex flex-col items-center justify-center p-12 h-full text-center">
               <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                 <Calculator className="w-8 h-8 text-slate-400" />
               </div>
               <h3 className="text-lg font-semibold text-slate-800 mb-1">Esperando Parámetros</h3>
               <p className="text-sm text-slate-500 max-w-sm">
                 Completa el formulario de la izquierda con los datos técnicos del proyecto para calcular la carga equivalente (impresiones/tiempo) y obtener sugerencias de asignación basadas en el estado real de la torre de control.
               </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentSimulator;
