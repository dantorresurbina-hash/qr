import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { useData } from '../context/DataContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Función para extraer texto respetando (aproximadamente) las líneas
const extractText = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = -1;
    let pageText = '';
    content.items.forEach((item) => {
      // Y-coord is transform[5]
      if (lastY !== item.transform[5] && lastY !== -1) {
        pageText += '\n';
      }
      pageText += item.str.trim() + ' ';
      lastY = item.transform[5];
    });
    fullText += pageText + '\n';
  }
  return fullText;
};const DirectInbound = () => {
  const [files, setFiles] = useState({ manifiesto: null, etiquetas: null, pedidos: null });
  const [parsedData, setParsedData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileDrop = (type, e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
       setFiles(prev => ({ ...prev, [type]: droppedFile }));
    }
  };

  const processManifiesto = async () => {
    if (!files.manifiesto) {
      setError("El PDF de Manifiesto es indispensable para este flujo.");
      return;
    }
    setIsParsing(true);
    setError(null);

    try {
      const manifiestoText = await extractText(files.manifiesto);
      const etiquetasText = files.etiquetas ? await extractText(files.etiquetas) : '';
      const pedidosText = files.pedidos ? await extractText(files.pedidos) : '';

      // 1. EXTRAER DEL MANIFIESTO (Corazón del sistema)
      const dataMap = {};
      const lines = manifiestoText.split('\n');
      
      // Buscar el número de manifiesto con doble respaldo
      // 1. Intentar en el texto del PDF (Aceptando alfanuméricos tipo RWGLXYAT)
      const contentMatch = manifiestoText.match(/(?:Manifiesto|N°|Nro|Folio|Code)\s?[:°.-]?\s*([A-Z\d]{4,})/i);
      
      // 2. Intentar en el nombre del archivo (Aislamos lo que venga después de 'Manifiesto_')
      const fileName = files.manifiesto.name || '';
      const nameMatch = fileName.match(/(?:Manifiesto_|Manifiesto\s*)([A-Z\d]+)/i) || fileName.match(/([A-Z\d]{5,})/);
      
      const numManifiesto = contentMatch ? contentMatch[1].toUpperCase() : (nameMatch ? nameMatch[1].toUpperCase() : 'S/M');

      lines.forEach(line => {
        // Buscamos el ID del pedido (ej: 109252)
        const idMatch = line.match(/(109\d{3,})/);
         if (idMatch) {
            const id = idMatch[1];
            
            // 1. Extraer Folio de Documento (FV, BE, BL seguido de números)
            const docMatch = line.match(/(?:FV|BE|BL)\s?\d+/i);
            const documento = docMatch ? docMatch[0].toUpperCase() : '';

            // 2. Extraer Courier
            let courier = 'NORMAL';
            const low = line.toLowerCase();
            if (low.includes('starken')) courier = 'Starken';
            else if (low.includes('blue')) courier = 'Bluexpress';
            else if (low.includes('99 m')) courier = '99 Minutos';
            else if (low.includes('click')) courier = 'Clickex';
            else if (low.includes('dhl')) courier = 'DHL';
            else if (low.includes('retiro en tienda') || low.includes('retira')) courier = 'Retiro en Tienda';

            // 3. Limpiar Cliente de forma ULTRA-AGRESIVA
            let cliente = line;
            if (id) cliente = cliente.replace(new RegExp(id, 'g'), ' ');
            if (documento) cliente = cliente.replace(new RegExp(documento, 'gi'), ' ');
            
            cliente = cliente
              .replace(/#\d+\s*/g, ' ') // Quitar correlativos #1, #2...
              .replace(/^\d+\s+/, ' ') // Quitar números iniciales
              .replace(/(starken|bluexpress|clickex|99 minutos|dhl|chile|rm|santiago|retiro en tienda|retira|sucursal|normal|envio a domicilio|manifiesto|folio|rut)/gi, ' ')
              .replace(/[A-Z]{2,}\d+[A-Z\d]*/g, ' ') // Quitar códigos alfanuméricos (ej: JALBV0UWMSI)
              .replace(/\d{8,}/g, ' ') // Trackings numéricos largos
              .replace(/\s+/g, ' ') // Limpiar espacios
              .trim();

            dataMap[id] = {
              pedId: id,
              cliente: cliente || 'S/N',
              documento: documento,
              courier: courier,
              manifiesto: numManifiesto,
              cajas: 1, // Default por manifiesto
              sku: 'POR DEFINIR',
              unidades: 1,
              fecha: new Date().toLocaleDateString('es-CL')
            };
         }
      });

      // 2. ENRIQUECER CON ETIQUETAS (Opcional - para bultos exactos)
      if (etiquetasText) {
         Object.keys(dataMap).forEach(id => {
            const pos = etiquetasText.indexOf(id);
            if (pos !== -1) {
               const area = etiquetasText.substring(pos, pos + 200);
               const bMatch = area.match(/(\d+)\s*(?:\/|de)\s*(\d+)/i) || area.match(/BULTO:\s*(\d+)/i);
               if (bMatch) {
                  dataMap[id].cajas = parseInt(bMatch[2] || bMatch[1], 10);
               }
            }
         });
      }

      // 3. ENRIQUECER CON PEDIDOS (Opcional - para SKUs y Unidades reales)
      if (pedidosText) {
          // Buscamos bloques que empiecen con "Pedido #" o simplemente "Pedido" o "ID:"
          const blocks = pedidosText.split(/(?:Pedido\s*#|Orden\s*de\s*Venta\s*#|ID:)/i);
          
          blocks.forEach(block => {
             // Buscar un ID de 6 dígitos (tus 109...) en cualquier parte del inicio del bloque
             const idMatch = block.match(/(109\d{3,})/);
             if (idMatch && dataMap[idMatch[1]]) {
                const id = idMatch[1];
                
                // 1. Buscar SKU (Heurística: Alfanumérico largo al inicio de línea o después de correlativo)
                const skuMatch = block.match(/(?:#\d+|SKU:)\s*([A-Z0-9.\-_]{4,}\s+[^|\n]{5,})/i) || 
                                 block.match(/^([A-Z0-9]{4,}\s+[A-Z\s]{4,})/m);
                
                if (skuMatch) {
                   dataMap[id].sku = skuMatch[1].replace(/\s+/g, ' ').trim();
                }
                
                // 2. Buscar Unidades (Heurística: "X unidades", "Cant: X", o número grande al final)
                const unitsMatch = block.match(/(?:unidades|cantidad|cant|cant\.)\s*[:°]?\s*(\d+)/i) || 
                                   block.match(/\s+([1-9]\d{1,4})\s*$/m); // Un número de 2 a 5 dígitos al final de una línea
                
                if (unitsMatch) {
                   dataMap[id].unidades = parseInt(unitsMatch[1], 10);
                }
             }
          });
      }

      setParsedData(Object.values(dataMap));

    } catch (err) {
      console.error(err);
      setError("Error analizando el Manifiesto. Verifica que el archivo sea correcto.");
    } finally {
      setIsParsing(false);
    }
  };

  const { uploadDirectOrders } = useData();

  const reset = () => {
    setFiles({ manifiesto: null, etiquetas: null, pedidos: null });
    setParsedData(null);
    setError(null);
  };

  const [uploadResult, setUploadResult] = useState(null); // { success, inserted }
  const [showSuccess, setShowSuccess] = useState(false);

  if (showSuccess && uploadResult) {
    const isDuplicate = uploadResult.inserted === 0;
    
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 text-center max-w-2xl mx-auto animate-in zoom-in duration-300">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDuplicate ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {isDuplicate ? <AlertTriangle className="w-12 h-12" /> : <CheckCircle2 className="w-12 h-12" />}
        </div>
        
        <h2 className="text-2xl font-black text-slate-800 mb-2">
           {isDuplicate ? 'Carga ya Existente' : '¡Exportación Exitosa!'}
        </h2>
        
        <p className="text-slate-500 mb-8">
          {isDuplicate 
            ? 'Todos los pedidos de este manifiesto ya habían sido ingresados previamente. No se agregaron filas nuevas para evitar duplicidades.'
            : `Se han registrado exitosamente ${uploadResult.inserted} pedidos nuevos en la pestaña "Sin Impresión".`}
        </p>

        <button onClick={() => { setShowSuccess(false); reset(); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800">
          Entendido
        </button>
      </div>
    );
  }

  if (parsedData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2" />
              Cruce desde Manifiesto ({parsedData.length} Pedidos)
            </h2>
            <p className="text-[11px] text-slate-500">Revisa que ID, Cliente y Courier coincidan.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
               setIsParsing(true);
               uploadDirectOrders(parsedData).then(res => {
                  if (res.success) {
                    setUploadResult(res);
                    setShowSuccess(true);
                  } else {
                    alert("Error al subir: " + (res.error || "Error desconocido"));
                  }
               }).catch(err => {
                  alert("Error crítico de red: " + err.message);
               }).finally(() => setIsParsing(false));
            }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm flex items-center transition-all active:scale-95">
              <UploadCloud className="w-4 h-4 mr-2" /> 
              {isParsing ? 'Subiendo...' : 'Confirmar y Subir'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3 text-center">Cajas</th>
                <th className="px-4 py-3">SKU Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parsedData.map(p => (
                <tr key={p.pedId} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-bold text-slate-900">#{p.pedId}</td>
                  <td className="px-4 py-2 text-slate-600 font-mono text-[10px]">{p.documento || '-'}</td>
                  <td className="px-4 py-2 text-slate-700 font-medium">{p.cliente}</td>
                  <td className="px-4 py-2 text-[10px]">
                     <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold border border-blue-100 uppercase">{p.courier}</span>
                  </td>
                  <td className="px-4 py-2 text-center font-bold text-slate-800">{p.cajas}</td>
                  <td className="px-4 py-2 text-slate-500 italic">{p.sku}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-4xl mx-auto">
      <div className="px-8 py-6 border-b border-slate-200 bg-slate-900 text-white">
        <h2 className="text-xl font-bold flex items-center">
          <UploadCloud className="w-6 h-6 mr-3 text-emerald-400" />
          Ingesta Express por Manifiesto
        </h2>
        <p className="text-slate-400 text-xs mt-1">Sube el PDF de Manifiesto para mapear la carga del día.</p>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Principal */}
           <div 
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => handleFileDrop('manifiesto', e)}
             className={`col-span-1 md:col-span-2 border-4 border-dashed rounded-3xl p-10 flex flex-col items-center text-center transition-all
               ${files.manifiesto ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-accent bg-white'}
             `}
           >
              <FileText className={`w-16 h-16 mb-4 ${files.manifiesto ? 'text-emerald-500' : 'text-slate-300'}`} />
              <h3 className="text-lg font-bold text-slate-800">1. Sube el Manifiesto (Requerido)</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-sm">Este archivo define qué pedidos se cargarán hoy al sistema.</p>
              {files.manifiesto ? (
                 <p className="bg-emerald-500 text-white px-4 py-1 rounded-full text-xs font-bold">{files.manifiesto.name}</p>
              ) : (
                <label className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold cursor-pointer hover:bg-slate-800 shadow-md">
                   Seleccionar Manifiesto
                   <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileDrop('manifiesto', e)} />
                </label>
              )}
           </div>

           {/* Opcionales */}
           <div 
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => handleFileDrop('etiquetas', e)}
             className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center text-center 
                ${files.etiquetas ? 'border-purple-400 bg-purple-50' : 'border-slate-100 bg-slate-50/50'}
             `}
           >
              <CheckCircle2 className={`w-8 h-8 mb-2 ${files.etiquetas ? 'text-purple-500' : 'text-slate-300'}`} />
              <p className="text-xs font-bold text-slate-700">Etiquetas (Opcional)</p>
              <p className="text-[10px] text-slate-400 mb-4">Para contar bultos exactos</p>
              <label className="text-[10px] font-bold text-slate-600 border border-slate-300 px-3 py-1 rounded-md cursor-pointer hover:bg-white">
                 {files.etiquetas ? files.etiquetas.name : 'Sube Etiquetas'}
                 <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileDrop('etiquetas', e)} />
              </label>
           </div>

           <div 
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => handleFileDrop('pedidos', e)}
             className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center text-center 
                ${files.pedidos ? 'border-blue-400 bg-blue-50' : 'border-slate-100 bg-slate-50/50'}
             `}
           >
              <FileText className={`w-8 h-8 mb-2 ${files.pedidos ? 'text-blue-500' : 'text-slate-300'}`} />
              <p className="text-xs font-bold text-slate-700">Factura/Pedidos (Opcional)</p>
              <p className="text-[10px] text-slate-400 mb-4">Para obtener SKUs y Unidades</p>
              <label className="text-[10px] font-bold text-slate-600 border border-slate-300 px-3 py-1 rounded-md cursor-pointer hover:bg-white">
                 {files.pedidos ? files.pedidos.name : 'Sube Factura'}
                 <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileDrop('pedidos', e)} />
              </label>
           </div>
        </div>

        <div className="mt-10 flex justify-center">
           <button 
             onClick={processManifiesto}
             disabled={isParsing || !files.manifiesto}
             className={`px-12 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all transform
               ${!files.manifiesto || isParsing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:scale-105 hover:bg-emerald-600'}
             `}
           >
              {isParsing ? 'Analizando Manifiesto...' : '¡PROCESAR CARGA!'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default DirectInbound;
