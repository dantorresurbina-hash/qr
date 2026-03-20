import { useData } from '../../context/DataContext';
import { LayoutDashboard, Truck, Activity, TriangleAlert, MessagesSquare, Settings, Menu, FileText, Monitor, Lock, Unlock, UserCircle, Tag, Cloud, CloudOff, RefreshCw, Factory, ClipboardCheck } from 'lucide-react';
import { SECURITY_CONFIG } from '../../config/security';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, openSettings }) => {
  const { userRole, updateRole, isLocalStorage, lastSync, fetchData, isLoading, error } = useData();

  const navItems = [
    { id: 'tower', label: 'Control Tower', icon: LayoutDashboard, roles: ['kam', 'admin'] },
    { id: 'capacity', label: 'Capacidad Talleres', icon: Activity, roles: ['admin'] },
    { id: 'logistics', label: 'Logística & Retiros', icon: Truck, roles: ['admin'] },
    { id: 'labeling', label: 'Etiquetado QR', icon: Tag, roles: ['admin'] },
    { id: 'conflicts', label: 'Conflictos', icon: TriangleAlert, roles: ['admin'] },
    { id: 'simulator', label: 'Simulador', icon: Settings, roles: ['admin'] },
    { id: 'workshop', label: 'Modo Taller', icon: Factory, roles: ['admin'] },
    { id: 'yute', label: 'Yute Impresiones', icon: ClipboardCheck, roles: ['admin'] },
    { id: 'ai', label: 'Consultas IA', icon: MessagesSquare, roles: ['kam', 'admin'] },
    { id: 'historical', label: 'Análisis Histórico', icon: FileText, roles: ['admin'] },
    { id: 'tv', label: 'Modo Planta', icon: Monitor, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

    const isStale = lastSync && (Date.now() - lastSync.getTime() > SECURITY_CONFIG.STALE_DATA_THRESHOLD);
    const syncStatusColor = isStale ? 'text-red-500' : (isLocalStorage ? 'text-orange-400' : 'text-green-400');
    const syncIcon = isStale ? <TriangleAlert className="w-4 h-4 text-red-500" /> : (isLocalStorage ? <CloudOff className="w-4 h-4 text-orange-400" /> : <Cloud className="w-4 h-4 text-green-400" />);

    return (
        <aside className={`bg-slate-900 text-slate-300 w-64 flex-shrink-0 flex flex-col transition-all duration-300 fixed inset-y-0 left-0 z-[70] md:relative md:inset-0 md:z-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
            <div className="w-8 h-8 rounded bg-accent grid place-items-center text-white font-bold mr-3"><span>CT</span></div>
            <span className="text-white font-heading font-semibold text-lg tracking-wide" translate="no">Control<span className="text-accent">Tower</span></span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
            <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
            <span>Módulos Operativos</span>
            {userRole === 'admin' ? (
                <button onClick={() => updateRole('kam')} className="text-green-500 hover:text-green-400 group relative">
                <Unlock className="w-3 h-3" />
                <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-slate-800 text-[8px] px-1 py-0.5 rounded border border-slate-700 whitespace-nowrap">Admin (X)</span>
                </button>
            ) : (
                <button onClick={openSettings} className="text-slate-600 hover:text-slate-400">
                <Lock className="w-3 h-3" />
                </button>
            )}
            </div>
            <nav className="space-y-1 px-2">
            {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                <button
                    key={item.id}
                    onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setIsOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    isActive 
                        ? 'bg-accent-bg text-accent' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-accent' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                </button>
                );
            })}
            </nav>
        </div>
        
        <div className="p-4 border-t border-slate-800">
            <div className={`mb-4 rounded-lg p-3 border transition-colors ${isStale ? 'bg-red-500/10 border-red-500/50' : 'bg-slate-800/50 border-slate-700/50'}`}>
            <div className="flex items-center justify-between mb-2" translate="no">
                <div className="flex items-center gap-2">
                {syncIcon}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${syncStatusColor}`}>
                    <span>{isLoading ? 'Sincronizando...' : (isStale ? 'Datos Obsoletos' : (isLocalStorage ? 'Sin Conexión' : 'Manual Sync'))}</span>
                </span>
                </div>
                <button 
                onClick={fetchData} 
                disabled={isLoading}
                title="Sincronizar ahora"
                className={`p-1.5 hover:bg-slate-700 rounded-md transition-all ${isLoading ? 'animate-spin text-accent bg-slate-700' : 'text-slate-500 hover:text-white'}`}
                >
                <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>
            <p className={`text-[10px] leading-tight ${isStale ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                {isLoading ? 'Conectando con Google...' : (isStale ? '¡Sincronización fallida!' : `Última vez: ${lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}`)}
            </p>
            </div>

            <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-medium text-white transition-colors ${userRole === 'admin' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                <UserCircle className="w-5 h-5" />
            </div>
            <div className="ml-3">
                <p className="text-sm font-medium text-white capitalize"><span>{userRole === 'admin' ? 'Daniel (Admin)' : 'KAM / Vendedor'}</span></p>
                <p className="text-xs text-slate-500"><span>{userRole === 'admin' ? 'Gestión Total' : 'Solo Consultas'}</span></p>
            </div>
            </div>
        </div>
        </aside>
    );
};

export default Sidebar;
