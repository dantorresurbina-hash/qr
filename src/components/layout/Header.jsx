import React from 'react';
import { Bell, Search, Menu, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useData } from '../../context/DataContext';

const Header = ({ toggleSidebar }) => {
  const { isLoading, lastSync, fetchData, turboSpeed } = useData();

  return (
    <header className="h-16 bg-white border-b border-dash-border flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
      <div className="flex items-center flex-1">
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-700"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="max-w-md w-full relative hidden sm:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-accent focus:border-accent sm:text-sm transition-colors"
            placeholder="Buscar pedido, SKU o taller..."
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <button 
          onClick={fetchData}
          disabled={isLoading}
          translate="no"
          className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> 
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" /> 
              <span>{turboSpeed ? `${turboSpeed}s` : 'Al día'}</span>
            </>
          )}
        </button>

        <button className="p-1.5 text-slate-400 hover:text-slate-600 relative rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-status-red ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
};

export default Header;
