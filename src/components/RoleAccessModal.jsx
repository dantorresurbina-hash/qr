import React, { useState } from 'react';
import { Lock, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { useData } from '../context/DataContext';

const RoleAccessModal = ({ isOpen, onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const { updateRole } = useData();

  const CORRECT_PIN = "1234"; // PIN por defecto sugerido

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      updateRole('admin');
      setPin('');
      setError(false);
      onClose();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center text-slate-800 font-bold">
            <Lock className="w-5 h-5 mr-2 text-indigo-600" />
            Acceso Administrador
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-500 text-center">
            Ingresa el PIN de seguridad para desbloquear los módulos operativos (Logística, Capacidad y Simulador).
          </p>

          <div className="relative">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={4}
              className={`w-full text-center text-2xl tracking-[1em] py-3 border rounded-xl outline-none transition-all ${
                error 
                ? 'border-red-500 bg-red-50 text-red-600 animate-shake' 
                : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
              }`}
              autoFocus
            />
            {error && (
              <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-bold text-red-500 flex items-center justify-center">
                <AlertCircle className="w-3 h-3 mr-1" /> PIN INCORRECTO
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Validar Acceso</span>
          </button>
          
          <div className="text-center">
            <button 
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors"
            >
              Cancelar y volver como KAM
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleAccessModal;
