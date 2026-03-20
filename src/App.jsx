import React, { useState, lazy, Suspense } from 'react';
import DashboardLayout from './components/layout/DashboardLayout';
import { DataProvider, useData } from './context/DataContext';
import ErrorBoundary from './components/ErrorBoundary';

// Carga perezosa (Lazy Loading) de páginas para mejorar escalabilidad y velocidad de carga inicial
const ControlTower = lazy(() => import('./pages/ControlTower'));
const CapacityAnalytics = lazy(() => import('./pages/CapacityAnalytics'));
const Logistics = lazy(() => import('./pages/Logistics'));
const ConflictsAndAlerts = lazy(() => import('./pages/ConflictsAndAlerts'));
const AssignmentSimulator = lazy(() => import('./pages/AssignmentSimulator'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const HistoricalAnalysis = lazy(() => import('./pages/HistoricalAnalysis'));
const TVMode = lazy(() => import('./pages/TVMode'));
const Labeling = lazy(() => import('./pages/Labeling'));
const QuickUpdate = lazy(() => import('./pages/QuickUpdate'));
const WorkshopMode = lazy(() => import('./pages/WorkshopMode'));
const YuteWorkshopMode = lazy(() => import('./pages/YuteWorkshopMode'));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
    <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin mb-4"></div>
    <p className="text-sm font-medium animate-pulse">Cargando módulo...</p>
  </div>
);

// Mapeo centralizado de permisos de rol para App y Sidebar
const PERMISSIONS = {
  tower: ['kam', 'admin'],
  capacity: ['admin'],
  logistics: ['admin'],
  labeling: ['admin'],
  conflicts: ['admin'],
  simulator: ['admin'],
  workshop: ['admin'],
  yute: ['admin'],
  ai: ['kam', 'admin'],
  historical: ['admin'],
  tv: ['admin']
};

function App() {
  const [activeTab, setActiveTab] = useState('tower');

  // Guardar el último tab para contexto de IA
  React.useEffect(() => {
    if (activeTab !== 'ai') {
      window.lastTab = activeTab;
    }
  }, [activeTab]);

  // Lógica de enrutamiento simple para escaneo QR (Fuera del Provider si no usa data)
  // V6.18: Enrutador Universal - Detecta /update/ de forma infalible
  const currentHref = window.location.href;
  if (currentHref.toLowerCase().includes('/update/')) {
    // Extraer el ID de la URL original (preservando mayúsculas) usando regex
    const match = currentHref.match(/\/update\/([^\/\?]+)/i);
    const rawId = match ? match[1] : null;
    const pedidoId = rawId ? decodeURIComponent(rawId).replace(/#/g, '').trim() : null;
    
    if (pedidoId && pedidoId !== 'undefined') {
      return (
        <ErrorBoundary>
          <DataProvider>
            <Suspense fallback={<LoadingFallback />}>
              <div className="min-h-screen bg-slate-900">
                <QuickUpdate pedidoId={pedidoId} />
              </div>
            </Suspense>
          </DataProvider>
        </ErrorBoundary>
      );
    }
  }

  // Componente interno que consume el DataContext
  const AppContent = () => {
    const { userRole } = useData();

    // Validar si el rol actual puede ver el tab activo
    const isAllowed = PERMISSIONS[activeTab]?.includes(userRole);

    const renderSelectedTab = () => {
      // Fallback de seguridad: Si no tiene permiso, lo mandamos a Control Tower
      const tabToRender = isAllowed ? activeTab : 'tower';

      switch (tabToRender) {
        case 'tower': return <ControlTower />;
        case 'capacity': return <CapacityAnalytics />;
        case 'logistics': return <Logistics />;
        case 'labeling': return <Labeling />;
        case 'conflicts': return <ConflictsAndAlerts />;
        case 'simulator': return <AssignmentSimulator />;
        case 'workshop': return <WorkshopMode />;
        case 'yute': return <YuteWorkshopMode />;
        case 'ai': return <AIAssistant contextTab={window.lastTab || 'tower'} />;
        case 'historical': return <HistoricalAnalysis />;
        default: return <ControlTower />;
      }
    };

    // Caso especial para Modo TV (Pantalla Completa)
    if (activeTab === 'tv' && userRole === 'admin') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <TVMode />
          <button 
            onClick={() => setActiveTab('tower')}
            className="fixed bottom-4 right-4 bg-slate-800/50 hover:bg-slate-800 text-white/50 hover:text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm transition-all z-[9999] border border-white/10"
          >
            SALIR MODO TV
          </button>
        </Suspense>
      );
    }

    return (
      <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <Suspense fallback={<LoadingFallback />}>
          {renderSelectedTab()}
        </Suspense>
      </DashboardLayout>
    );
  };

  return (
    <ErrorBoundary>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </ErrorBoundary>
  );
}

export default App;
