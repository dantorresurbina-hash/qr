import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// V6.14: Listener global para capturar fallos de carga de archivos tras un nuevo despliegue
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Error de pre-carga detectado (posible nuevo deploy). Recargando...', event);
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
