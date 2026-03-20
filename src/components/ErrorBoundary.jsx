import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // V6.14: Si el error es una falla de carga de módulo (común tras deploys), recargamos automáticamente
    const errorMessage = error ? error.toString().toLowerCase() : "";
    if (
      errorMessage.includes("failed to fetch dynamically imported module") ||
      errorMessage.includes("loading chunk") ||
      errorMessage.includes("dynamic import")
    ) {
      console.warn("Falla de carga de módulo detectada. Forzando recarga de seguridad...");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
          <div className="max-w-3xl w-full bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 p-4 flex items-center">
              <span className="text-2xl mr-3">💥</span>
              <h1 className="text-xl font-bold text-red-700">El Dashboard colapsó procesando los datos</h1>
            </div>
            <div className="p-6">
              <p className="mb-4 text-slate-600">Por favor, copia este error y envíamelo para poder reparar la línea exacta que está fallando al leer tu Google Sheet:</p>
              
              <div className="bg-slate-900 rounded-lg p-4 overflow-auto">
                <code className="text-red-400 font-mono text-sm block mb-2 font-bold">
                  {this.state.error && this.state.error.toString()}
                </code>
                <pre className="text-slate-300 font-mono text-xs whitespace-pre-wrap">
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </div>

              <div className="mt-6 flex justify-end">
                 <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium">
                   Recargar Página
                 </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
