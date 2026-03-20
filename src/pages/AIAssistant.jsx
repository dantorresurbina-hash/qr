import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { useData, getLocalYMD, parseNumber } from '../context/DataContext';
import { designKnowledge } from '../data/knowledgeBase';

const getContextualQuestions = (tab) => {
  const common = [
    "¿Qué talleres tienen capacidad disponible?",
    "¿Hay riesgo de saturación la próxima semana?"
  ];

  switch (tab) {
    case 'capacity':
      return [
        ...common,
        "¿Quién tiene más espacio para 3000 imp?",
        "¿Cómo ha evolucionado el Health Score de Pintapack?"
      ];
    case 'logistics':
      return [
        "¿Qué pedidos están listos para retiro hoy?",
        "¿Cuál es el taller más cercano a la planta?",
        "¿Hay transportes pendientes de confirmación?"
      ];
    case 'conflicts':
      return [
        "¿Por qué está atrasado el pedido #5543?",
        "¿Qué taller tiene más pedidos críticos?",
        "¿Cómo afectará el atraso de DOVE a la entrega?"
      ];
    default:
      return [
        ...common,
        "¿Cuáles son los pedidos críticos o atrasados?",
        "¿Puede Pintapack tomar 5000 impresiones urgentes?"
      ];
  }
};

const AIAssistant = ({ contextTab = 'tower' }) => {
  const { data: mockConsolidatedData, talleres, isLoading } = useData();
  const presetQuestions = getContextualQuestions(contextTab);
  const getTalleres = () => talleres;

  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: '¡Hola! Soy la Control Tower AI. Estoy monitoreando en directo tus indicadores conectada a Google Sheets y tus límites de capacidad. ¿En qué te ayudo?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const mockResponses = {
    "¿Qué talleres tienen capacidad disponible?": () => {
      const ts = talleres;
      const activos = mockConsolidatedData.filter(p => !p.fecha_retiro_real);
      const msgs = ts.map(t => {
        const imps = activos.filter(p => p.taller === t.nombre).reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
        const capPct = t.capacidad_semanal_impresiones > 0 ? (imps / t.capacidad_semanal_impresiones) * 100 : 0;

        // Cálculo rápido de Health Score para la respuesta
        const pedidosArr = activos.filter(p => p.taller === t.nombre);
        const atrasoPromedio = pedidosArr.length > 0 ? (pedidosArr.reduce((acc, p) => acc + parseNumber(p.dias_retraso), 0) / pedidosArr.length) : 0;
        let score = 100 - (capPct > 80 ? (capPct - 80) * 2 : 0) - (atrasoPromedio * 15);
        score = Math.max(0, Math.min(100, Math.round(score)));

        return `**${t.nombre}**: ${Math.max(0, 100 - capPct).toFixed(1)}% libre (Health Score: ${score}).`;
      });
      return `Analizando la red operativa, esta es la disponibilidad actual:\n\n${msgs.join('\n')}\n\nLos talleres con Score > 85 son los más recomendados para nuevas asignaciones.`;
    },
    "¿Hay riesgo de saturación la próxima semana?": () => {
      const ts = talleres;
      const activos = mockConsolidatedData.filter(p => !p.fecha_retiro_real);
      const hoy = new Date();
      const proximaSemana = new Date(); proximaSemana.setDate(hoy.getDate() + 7);
      const dosSemanas = new Date(); dosSemanas.setDate(hoy.getDate() + 14);

      let alertas = [];
      ts.forEach(t => {
        const cargaFutura = activos.filter(p => {
          const f = new Date(p.fecha_retiro_ideal);
          return f > proximaSemana && f <= dosSemanas && p.taller === t.nombre;
        }).reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);

        if (cargaFutura > (t.capacidad_semanal_impresiones * 0.8)) {
          alertas.push(`⚠️ **${t.nombre}**: Alta concentración de retiros proyectada para la semana subsiguiente (${cargaFutura.toLocaleString()} imp).`);
        }
      });

      if (alertas.length === 0) return "He analizado la carga proyectada para los próximos 14 días y no detecto riesgos inminentes de saturación. La red está equilibrada.";
      return `### Análisis de Riesgo Proyectado 🧠\n\nHe detectado los siguientes cuellos de botella en formación:\n\n${alertas.join('\n')}\n\nSe recomienda adelantar producciones o negociar fechas antes de que se confirme más carga.`;
    },
    "¿Cuáles son los pedidos críticos o atrasados?": () => {
      const todayStr = getLocalYMD();
      const atrasados = mockConsolidatedData.filter(p => !p.fecha_retiro_real && p.fecha_retiro_ideal < todayStr);
      if (atrasados.length === 0) return "Cero pedidos vencidos detectados. ¡La producción va según lo ideal!";

      const porTaller = atrasados.reduce((acc, p) => {
        acc[p.taller] = (acc[p.taller] || 0) + 1;
        return acc;
      }, {});

      const lista = Object.entries(porTaller).map(([t, count]) => `- **${t}**: ${count} ${count === 1 ? 'pedido atrasado' : 'pedidos atrasados'}`).join('\n');
      return `He detectado ${atrasados.length} pedidos fuera de plazo:\n\n${lista}\n\nLos detalles específicos están resaltados en la tabla de Conflictos.`;
    },
    "¿Puede Pintapack tomar 5000 impresiones urgentes?": () => {
      const t = talleres.find(t => t.nombre.includes('Pintapack'));
      if (!t) return "No encuentro datos de ese taller en la configuración actual.";

      const activos = mockConsolidatedData.filter(p => !p.taller === t.nombre && !p.fecha_retiro_real);
      const imps = activos.reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
      const futurePct = t.capacidad_semanal_impresiones > 0 ? ((imps + 5000) / t.capacidad_semanal_impresiones) * 100 : 100;

      if (futurePct > 85) {
        return `⛔ **Efecto de Riesgo**: Añadir 5.000 impresiones llevaría a **${t.nombre}** al **${futurePct.toFixed(1)}%** de carga. Esto impactaría negativamente en su Score de Salud.\n\nBusca un proveedor con carga < 60% en la pestaña de Capacidad.`;
      } else {
        return `✅ **Factible**: El taller **${t.nombre}** quedaría en un **${futurePct.toFixed(1)}%** de ocupación. Tienen espacio para absorber este pedido sin comprometer la red.`;
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Iniciando red neuronal operativa...</p>
      </div>
    );
  }

  const handleSend = (presetText) => {
    const textToSend = presetText || input;
    if (!textToSend.trim()) return;

    const newUserMsg = { id: Date.now(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let aiResponseText = "Comprendo. Basado en los datos de Google Sheets, recomiendo revisar el módulo de Capacidad para ver los cuellos de botella específicos.";

      const textLower = textToSend.toLowerCase();
      const pedidoMatch = textLower.match(/\b\d{5,7}\b/); // Busca números de 5 a 7 dígitos

      if (mockResponses[textToSend]) {
        aiResponseText = mockResponses[textToSend]();
      } else if (textLower.includes('comparar') || textLower.includes('vs') || textLower.includes('rendimiento')) {
        // Generar datos para gráfico de comparación
        const chartData = talleres.map(t => {
          const activos = mockConsolidatedData.filter(p => p.taller === t.nombre && !p.fecha_retiro_real);
          const imps = activos.reduce((acc, p) => acc + (parseNumber(p.impresiones) || parseNumber(p.unidades)), 0);
          const atraso = activos.reduce((acc, p) => acc + parseNumber(p.dias_retraso), 0) / (activos.length || 1);
          return { name: t.nombre, impresiones: imps, retraso_promedio: Math.round(atraso * 10) / 10 };
        });

        newUserMsg.chartData = chartData;
        newUserMsg.chartType = 'bar';
        aiResponseText = "He generado un gráfico comparativo de la carga actual y el retraso promedio por taller. Esto te permite identificar visualmente quién está más saturado.";
      } else if (pedidoMatch) {
        // V6.21: Lógica de búsqueda de pedido con normalización robusta
        const rawTargetId = pedidoMatch[0];
        const targetIdNorm = rawTargetId.replace(/#/g, '').trim();
        
        const pedido = mockConsolidatedData.find(p => {
          const pid = String(p.pedido_id || p.id || '').replace(/#/g, '').trim();
          return pid === targetIdNorm;
        });

        if (pedido) {
          const displayId = pedido.pedido_id || pedido.id || rawTargetId;
          aiResponseText = `🔍 **Información del Pedido #${displayId}**:\n\n` +
            `• **Proyecto**: ${pedido.nombre_proyecto || 'Sin nombre'}\n` +
            `• **Taller**: ${pedido.taller || 'No asignado'}\n` +
            `• **Estado Prod.**: ${pedido.estado_produccion || 'Pendiente'}\n` +
            `• **Estado Log.**: ${pedido.estado_logistico || 'No iniciado'}\n` +
            `• **Retiro Ideal**: ${pedido.fecha_retiro_ideal || 'Sin definir'}\n` +
            `• **Despacho Cliente**: ${pedido.fecha_entrega_cliente || 'Sin definir'}\n` +
            `• **Impresiones**: ${(parseNumber(pedido.impresiones) || 0).toLocaleString()}\n\n` +
            (pedido.fecha_retiro_real
              ? `✅ El pedido ya fue retirado el ${pedido.fecha_retiro_real}.`
              : `⏳ Pendiente de retiro. ${parseNumber(pedido.dias_retraso) > 0 ? `⚠️ Presenta **${pedido.dias_retraso} días de atraso**.` : 'Está dentro del plazo.'}`);
        } else {
          aiResponseText = `No encontré ningún pedido con el ID **${rawTargetId}** en los datos actuales de Sheets. Verifica si el número es correcto o si el pedido fue anulado.`;
        }
      } else if (textLower.includes('capacidad') || textLower.includes('libre') || textLower.includes('disponible')) {
        aiResponseText = mockResponses["¿Qué talleres tienen capacidad disponible?"]();
      } else if (textLower.includes('saturado') || textLower.includes('lleno') || textLower.includes('riesgo') || textLower.includes('futuro') || textLower.includes('score')) {
        aiResponseText = mockResponses["¿Hay riesgo de saturación la próxima semana?"]();
      } else if (textLower.includes('atrasados') || textLower.includes('críticos') || textLower.includes('vencidos') || textLower.includes('atraso')) {
        aiResponseText = mockResponses["¿Cuáles son los pedidos críticos o atrasados?"]();
      } else if (textLower.includes('impresiones') || textLower.includes('derivar') || textLower.includes('tomar')) {
        aiResponseText = mockResponses["¿Puede Pintapack tomar 5000 impresiones urgentes?"]();
      } else if (textLower.length > 5) {
        // Búsqueda por nombre de proyecto
        const matches = mockConsolidatedData.filter(p =>
          p.nombre_proyecto.toLowerCase().includes(textLower) ||
          (p.sku && p.sku.toLowerCase().includes(textLower))
        ).slice(0, 3);

        if (matches.length > 0) {
          const list = matches.map(p => `- **#${p.pedido_id}**: ${p.nombre_proyecto} (${p.taller})`).join('\n');
          aiResponseText = `He encontrado coincidencias para tu búsqueda:\n\n${list}\n\n¿Quieres que profundice en alguno de estos?`;
        } else {
          // Búsqueda en Base de Conocimiento (Fase 9)
          const knowledgeMatch = designKnowledge.find(k =>
            k.keywords.some(word => textLower.includes(word))
          );

          if (knowledgeMatch) {
            aiResponseText = `💡 **Información de Procesos/Diseño**:\n\n${knowledgeMatch.content}`;
          }
        }
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiResponseText }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            Asistente Operativo <Sparkles className="w-5 h-5 ml-2 text-accent" />
          </h1>
          <p className="text-slate-500">Consultas operativas cruzando los datos vivos de Sheets</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center mr-3 mt-1 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-br-sm shadow-md shadow-slate-900/10'
                  : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-sm'
                }`}>
                {msg.text.split('\n').map((line, i) => {
                  if (line.includes('**')) {
                    const parts = line.split('**');
                    return (
                      <div key={i} className={i !== 0 ? 'mt-2' : ''}>
                        {parts.map((p, idx) => idx % 2 !== 0 ? <strong key={idx}>{p}</strong> : p)}
                      </div>
                    );
                  }
                  return <div key={i} className={i !== 0 ? 'mt-3' : ''}>{line}</div>
                })}

                {msg.chartData && (
                  <div className="mt-4 h-64 w-full bg-white rounded-xl p-4 border border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in duration-500">
                    <ResponsiveContainer width="100%" height="100%">
                      {msg.chartType === 'bar' ? (
                        <BarChart data={msg.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                            itemStyle={{ color: '#60a5fa' }}
                            cursor={{ fill: '#f1f5f9' }}
                          />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          <Bar dataKey="impresiones" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Impresiones" barSize={30} />
                          <Bar dataKey="retraso_promedio" fill="#ef4444" radius={[4, 4, 0, 0]} name="Días Retraso" barSize={30} />
                        </BarChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={msg.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {msg.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center ml-3 mt-1 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center mr-3 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-5 py-4 flex space-x-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 overflow-x-auto whitespace-nowrap hidden sm:flex space-x-2">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs font-medium text-slate-600 hover:border-accent hover:text-accent transition-colors"
            >
              <span>{q}</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntale a la torre de control en vivo..."
              className="flex-1 border-slate-300 outline-none focus:ring-1 focus:ring-accent focus:border-accent border rounded-full py-3 pl-5 pr-12 text-sm shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-2 p-1.5 bg-accent hover:bg-accent/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-400">
              Versión conectada a Google Sheets.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
