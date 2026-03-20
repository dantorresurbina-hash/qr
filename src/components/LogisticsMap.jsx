import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const PLANTA_CENTRAL = {
  nombre: "Planta Central / Yute Impresiones",
  direccion: "Lo Aguirre 1200, Pudahuel",
  coords: [-33.4372, -70.7850] // Coords aproximadas de Lo Aguirre, Pudahuel
};

const LogisticsMap = ({ activeTalleres = [] }) => {
  const { data } = useData();
  const [coordsCache, setCoordsCache] = useState({
    "Yute Impresiones": [-33.4372, -70.7850],
    "Romel": [-33.4542, -70.6400],
    "Lidi": [-33.4600, -70.6450]
  });

  const center = PLANTA_CENTRAL.coords;

  // Efecto para buscar direcciones nuevas
  useEffect(() => {
    const fetchCoords = async () => {
      const newCache = { ...coordsCache };
      let changed = false;

      for (const tallerName of activeTalleres) {
        if (!newCache[tallerName]) {
          // Intentar encontrar la dirección en la data de pedidos
          const sample = data.find(p => p.taller === tallerName);
          const address = sample?.direccion_taller || tallerName + ", Santiago, Chile";
          
          try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const results = await resp.json();
            if (results && results.length > 0) {
              newCache[tallerName] = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
              changed = true;
            }
          } catch (err) {
            console.error(`Error geocodificando ${tallerName}:`, err);
          }
        }
      }

      if (changed) setCoordsCache(newCache);
    };

    if (activeTalleres.length > 0) fetchCoords();
  }, [activeTalleres, data]);

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 relative z-0">
      <MapContainer 
        center={center} 
        zoom={11} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Planta Central */}
        <Marker position={PLANTA_CENTRAL.coords}>
          <Popup>
            <div className="font-bold">🏭 {PLANTA_CENTRAL.nombre}</div>
            <div className="text-xs text-slate-500">{PLANTA_CENTRAL.direccion}</div>
          </Popup>
        </Marker>

        {/* Talleres Activos */}
        {activeTalleres.map(tallerName => {
          const coords = coordsCache[tallerName];
          if (!coords) return null;

          return (
            <Marker key={tallerName} position={coords}>
              <Popup>
                <div className="font-bold text-indigo-600">📦 {tallerName}</div>
                <div className="text-xs text-slate-500">Taller Colaborador</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Línea sugerida de ruta (Simple conexión Planta -> Talleres) */}
        {activeTalleres.length > 0 && activeTalleres.map(tallerName => {
           const coords = coordsCache[tallerName];
           if (!coords) return null;
           return (
             <Polyline 
               key={`line-${tallerName}`}
               positions={[PLANTA_CENTRAL.coords, coords]} 
               color="#6366f1" 
               weight={2} 
               dashArray="5, 10"
               opacity={0.6}
             />
           );
        })}
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-sm text-[10px] text-slate-600">
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
          <span>Punto de Origen (Planta)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-indigo-600 rounded-full mr-2"></div>
          <span>Talleres con Retiros Hoy</span>
        </div>
      </div>
    </div>
  );
};

export default LogisticsMap;
