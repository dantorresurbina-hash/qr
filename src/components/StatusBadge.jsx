import React from 'react';

/**
 * Paleta de colores profesional para estados de Producción y Logística
 */
const STATUS_MAP = {
  // Producción
  'pendiente': 'bg-slate-100 text-slate-600 border-slate-200',
  'asignado': 'bg-slate-100 text-slate-600 border-slate-200',
  'pasar correo': 'bg-orange-100 text-orange-700 border-orange-200',
  'correo enviado': 'bg-sky-100 text-sky-700 border-sky-200',
  'vb cliente': 'bg-purple-100 text-purple-700 border-purple-200',
  'en proceso': 'bg-blue-100 text-blue-700 border-blue-200',
  'etiquetado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'terminado': 'bg-green-100 text-green-700 border-green-200',
  'atrasado': 'bg-red-100 text-red-700 border-red-200',
  'anulado': 'bg-slate-800 text-slate-100 border-slate-900',
  
  // Logística
  'en preparación': 'bg-amber-100 text-amber-700 border-amber-200',
  'listo para retiro': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'retirado': 'bg-green-100 text-green-700 border-green-200',
  'en tránsito': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'entregado': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'no iniciado': 'bg-slate-50 text-slate-400 border-slate-100',
};

const StatusBadge = ({ status, type = 'production', className = '' }) => {
  if (!status) return null;
  
  const normalizedStatus = status.toLowerCase().trim();
  const colorClass = STATUS_MAP[normalizedStatus] || 'bg-slate-100 text-slate-600 border-slate-200';
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${colorClass} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
