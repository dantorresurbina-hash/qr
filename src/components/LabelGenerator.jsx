import React, { useState, useEffect } from 'react';
import { useData, cleanId } from '../context/DataContext';
import { jsPDF } from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Download, X, Loader2, Package, CheckCircle, ShieldCheck } from 'lucide-react';
import CryptoJS from 'crypto-js';
import { SECURITY_CONFIG } from '../config/security';

const CLIENT_SALT = SECURITY_CONFIG.CLIENT_SALT;

const LabelGenerator = ({ pedidos, specificBulto = null, onClose, onComplete }) => {
  const { updatePedidoStatus } = useData();
  const [bultosMap, setBultosMap] = useState({});
  const [generating, setGenerating] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [editMode, setEditMode] = useState({}); // Stores local edits for manual or quick fixes

  // Función para generar firma criptográfica
  const generateSignature = (id, bulto, total) => {
    const data = `${id}-${bulto}-${total}`;
    return CryptoJS.HmacSHA256(data, CLIENT_SALT).toString(CryptoJS.enc.Hex).substring(0, 10);
  };

  // Asegurar que siempre sea un array
  const listaPedidos = Array.isArray(pedidos) ? pedidos : [pedidos];
// ... (resto de funciones de estado omitidas para brevedad, asumiendo que se mantienen)

  // Inicializar bultosMap si no está seteado
  useEffect(() => {
    const initialMap = {};
    listaPedidos.forEach(p => {
      const id = p.pedido_id || p.id;
      initialMap[id] = p.bultos || 1;
    });
    setBultosMap(initialMap);
  }, [pedidos]);

  const updateBultos = (id, delta) => {
    setBultosMap(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const getTallerLabel = (taller) => {
    if (!taller) return 'N/A';
    if (taller.toLowerCase() === 'yute impresiones') return 'YUTE IMPRESIONES';
    return taller.charAt(0).toUpperCase();
  };

  const generatePDF = async () => {
    setGenerating(true);
    
    // Tamaño 4x4 pulgadas = 101.6mm x 101.6mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [101.6, 101.6]
    });

    const w = 101.6;
    const h = 101.6;

    let pageCount = 0;
    for (let i = 0; i < listaPedidos.length; i++) {
      const p = listaPedidos[i];
      if (!p) continue;
      
      const rawId = p.pedido_id || p.id || 'S-N';
      const id = cleanId(rawId); // Siempre usar ID limpio para firma y QR
      const totalBultos = bultosMap[rawId] || 1;
      
      // Determinar qué bultos imprimir
      const bultosAIprimir = specificBulto 
        ? [specificBulto] 
        : Array.from({ length: totalBultos }, (_, idx) => idx + 1);

      for (const b of bultosAIprimir) {
        if (pageCount > 0) doc.addPage([101.6, 101.6], 'portrait');
        pageCount++;

        // Configuración de fuentes y estilos
        doc.setFont("helvetica", "bold");
        
        // Título / ID
        doc.setFontSize(10);
        doc.text(`ID PROYECTO: #${rawId}`, 5, 8); // Display raw ID
        
        // Nombre Proyecto (Más compacto)
        doc.setFontSize(16);
        const nombre = (editMode[rawId]?.nombre || p.nombre_proyecto || p.proyecto || "SIN NOMBRE").toUpperCase();
        const splitTitle = doc.splitTextToSize(nombre, w - 10);
        doc.text(splitTitle.slice(0, 2), 5, 18);

        // Línea divisoria
        doc.setLineWidth(0.5);
        doc.line(5, 28, w - 5, 28);

        // SKU y Cantidad
        doc.setFontSize(9);
        doc.text("SKU / MODELO:", 5, 35);
        doc.setFontSize(11);
        doc.text(editMode[rawId]?.sku || p.sku || "N/A", 5, 41);

        doc.setFontSize(9);
        doc.text("CANTIDAD TOTAL:", 5, 49);
        doc.setFontSize(14);
        doc.text(String(editMode[rawId]?.unidades || p.unidades || 0), 5, 57);

        // QR Code (Posición fija a la derecha) con referencia al bulto específico
        const canvas = document.getElementById(`qr-canvas-${id}-${b}`);
        if (canvas) {
          const qrUrl = canvas.toDataURL('image/png');
          doc.addImage(qrUrl, 'PNG', w - 42, 32, 36, 36);
        }

        // Firma de seguridad microscópica (Anti-duplicación)
        const sig = generateSignature(id, b, totalBultos);
        doc.setFontSize(5);
        doc.setTextColor(150);
        doc.text(`SIG: ${sig}`, w - 24, 69, { align: 'center' });
        doc.setTextColor(0);

        // Taller (Rediseñado para evitar solapamiento)
        doc.setFontSize(8);
        doc.text("TALLER:", 5, 68);
        doc.setFontSize(11);
        const tallerLabel = getTallerLabel(editMode[rawId]?.taller || p.taller);
        doc.text(tallerLabel, 5, 74);

        // NUEVO: Detalles de Impresión (Desde el correo de ANFP)
        const técnica = editMode[rawId]?.tecnica || "";
        const detalles = editMode[rawId]?.detalles || "";
        
        if (técnica || detalles) {
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text("DETALLES DE IMPRESIÓN:", 5, 82);
          doc.setTextColor(0);
          doc.setFontSize(8);
          doc.text(`${técnica}`.toUpperCase(), 5, 87);
          const splitDetalles = doc.splitTextToSize(detalles.toUpperCase(), w - 50);
          doc.text(splitDetalles.slice(0, 2), 5, 92);
        }

        // Sello visual de Seguridad (Reposicionado para evitar tapa el nombre)
        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(w - 42, 5, 36, 6, 1, 1, 'FD'); 
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text("SECURITY VERIFIED", w - 24, 9, { align: 'center' });

        // Seriación de Bultos (1/3, 2/3, etc)
        doc.setDrawColor(200);
        doc.line(w - 45, 70, w - 5, 70); // Pequeña línea para separar bultos
        
        doc.setFontSize(9);
        doc.text("BULTOS / CAJAS:", w - 42, 78);
        doc.setFontSize(16);
        doc.text(`${b} / ${totalBultos}`, w - 42, 88);

        // Footer
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setDrawColor(0);
        doc.text("CONTROL TOWER • SCAN PARA ACTUALIZAR ESTADO", w / 2, 98, { align: 'center' });
      }
    }

    // Guardar
    const baseName = listaPedidos.length === 1 
      ? `ETIQUETA_${listaPedidos[0].pedido_id || listaPedidos[0].id}`
      : `LOTE_ETIQUETAS_${listaPedidos.length}_PEDIDOS`;

    const pdfName = `${baseName}.pdf`;
    
    try {
      doc.save(pdfName);
    } catch (saveError) {
      console.error("Error directo en doc.save:", saveError);
      // Fallback: intentar guardado con nombre genérico si el anterior falló
      doc.save("etiquetas_yute.pdf");
    }
    
    setGenerating(false);
    setPrinted(true);
    
    // Notificar al padre para que maneje la persistencia de forma centralizada
    if (onComplete) {
      const dataToPersist = listaPedidos.map(p => ({
        id: p.pedido_id || p.id,
        bultos: bultosMap[p.pedido_id || p.id] || 1
      }));
      onComplete(dataToPersist);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Printer className="text-blue-400" size={20} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Impresión Zebra 4x4</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {/* Resumen de Carga */}
          <div className="mb-6 flex items-center justify-between bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg text-white">
                <Printer size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-tight">Total Etiquetas</p>
                <p className="text-xl font-black text-white">
                  {Object.values(bultosMap).reduce((a, b) => a + b, 0)} <span className="text-blue-400 text-sm font-normal">unidades (4x4)</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-xs uppercase font-bold tracking-tight">Proyectos</p>
              <p className="text-lg font-bold text-slate-300">{listaPedidos.length}</p>
            </div>
          </div>

          {/* Lista de Pedidos con Selectores Individuales */}
          <div className="max-h-[300px] overflow-y-auto space-y-3 mb-8 pr-2 custom-scrollbar">
            {listaPedidos.map((p) => {
              const id = p.pedido_id || p.id;
              const count = bultosMap[id] || 1;
              const isManual = p.isManual;
              
              if (!editMode[id]) {
                setEditMode(prev => ({
                  ...prev,
                  [id]: {
                    nombre: p.nombre_proyecto || '',
                    sku: p.sku || '',
                    unidades: p.unidades || 0,
                    taller: p.taller || 'Pintapack',
                    tecnica: '',
                    detalles: ''
                  }
                }));
              }

              return (
                <div key={id} className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 space-y-4 group hover:border-blue-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter mb-0.5">#{id}</p>
                      {isManual ? (
                        <input 
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm font-bold text-white outline-none focus:border-blue-500"
                          value={editMode[id]?.nombre || ''}
                          onChange={(e) => setEditMode(prev => ({...prev, [id]: {...prev[id], nombre: e.target.value}}))}
                          placeholder="Nombre del Proyecto"
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-100 truncate">{p.nombre_proyecto || p.proyecto}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-1 border border-slate-700">
                      <button 
                        onClick={() => updateBultos(id, -1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-400 font-bold transition-all active:scale-90"
                      >-</button>
                      <span className="w-6 text-center font-mono font-bold text-blue-400 text-sm">{count}</span>
                      <button 
                        onClick={() => updateBultos(id, 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-400 font-bold transition-all active:scale-90"
                      >+</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">SKU / Modelo</label>
                      <input 
                        type="text"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                        value={editMode[id]?.sku || ''}
                        onChange={(e) => setEditMode(prev => ({...prev, [id]: {...prev[id], sku: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Cantidad Total</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                        value={editMode[id]?.unidades || 0}
                        onChange={(e) => setEditMode(prev => ({...prev, [id]: {...prev[id], unidades: parseInt(e.target.value) || 0}}))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Taller</label>
                      <select 
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                        value={editMode[id]?.taller || 'Pintapack'}
                        onChange={(e) => setEditMode(prev => ({...prev, [id]: {...prev[id], taller: e.target.value}}))}
                      >
                        <option value="Pintapack">Pintapack</option>
                        <option value="Yute Impresiones">Yute Impresiones</option>
                        <option value="We are Spa">We are Spa</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Técnica/Color</label>
                      <input 
                        type="text"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                        placeholder="Ej: 1 Color Blanco"
                        value={editMode[id]?.tecnica || ''}
                        onChange={(e) => setEditMode(prev => ({...prev, [id]: {...prev[id], tecnica: e.target.value}}))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Ubicación / Detalles</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                      placeholder="Ej: Centrado, a 5.4cm del borde"
                      value={editMode[id]?.detalles || ''}
                      onChange={(e) => setEditMode(prev => ({...prev, [id]: {...prev[id], detalles: e.target.value}}))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Renderizar canvas ocultos para TODO el lote (necesario para jsPDF) */}
          <div className="hidden">
            {listaPedidos.map(p => {
              const rawId = p.pedido_id || p.id;
              const id = cleanId(rawId); // Cleaned ID for signature and QR value
              const totalBultos = bultosMap[rawId] || 1;
              return Array.from({ length: totalBultos }).map((_, bIdx) => {
                const bNum = bIdx + 1;
                const sig = generateSignature(id, bNum, totalBultos);
                
                // V6.18: Usar origin dinámico para asegurar que el QR apunte al dominio actual
                const baseUrl = window.location.origin;
                return (
                  <QRCodeCanvas 
                    key={`${id}-qr-${bNum}`}
                    id={`qr-canvas-${id}-${bNum}`}
                    value={`${baseUrl}/update/${id}?b=${bNum}&t=${totalBultos}&sig=${sig}`}
                    size={200}
                    level="H"
                  />
                );
              });
            })}
          </div>

          <button
            onClick={generatePDF}
            disabled={generating}
            className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
              generating 
              ? 'bg-slate-700 text-slate-500' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-xl shadow-blue-900/40 active:scale-[0.98]'
            }`}
          >
            {generating ? <Loader2 className="animate-spin text-blue-400" /> : <Download size={24} />}
            {generating ? 'GENERANDO ARCHIVOS...' : `DESCARGAR ${Object.values(bultosMap).reduce((a, b) => a + b, 0)} ETIQUETAS`}
          </button>

          {printed && (
            <div className="mt-4 flex items-center gap-2 text-emerald-400 justify-center animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle size={18} />
              <span className="text-sm font-bold tracking-tight">¡PDF Generado con éxito!</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-800/10 border-t border-slate-700/50 flex items-center gap-3">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <p className="text-xs text-slate-500 italic">
            Al imprimir, recuerda configurar tu Zebra en tamaño "4.00 x 4.00 pulg".
          </p>
        </div>
      </div>
    </div>
  );
};

export default LabelGenerator;
