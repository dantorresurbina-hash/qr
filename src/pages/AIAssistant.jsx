import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Send, User, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useData, getLocalYMD, parseNumber } from '../context/DataContext';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-haiku-4-5-20251001';
const MAX_HISTORY    = 6; // turnos de conversación a mantener como contexto

const getContextualQuestions = (tab) => {
  const common = [
    '¿Qué talleres tienen capacidad disponible?',
    '¿Hay riesgo de saturación la próxima semana?',
  ];
  switch (tab) {
    case 'capacity':
      return [...common, '¿Quién tiene más espacio para 3000 imp?', '¿Cómo ha evolucionado el Health Score de Pintapack?'];
    case 'logistics':
      return ['¿Qué pedidos están listos para retiro hoy?', '¿Cuál es el taller más cercano a la planta?', '¿Hay transportes pendientes de confirmación?'];
    case 'conflicts':
      return ['¿Por qué está atrasado el pedido #5543?', '¿Qué taller tiene más pedidos críticos?', '¿Cómo afectará el atraso de DOVE a la entrega?'];
    default:
      return [...common, '¿Cuáles son los pedidos críticos o atrasados?', '¿Puede Pintapack tomar 5000 impresiones urgentes?'];
  }
};

const AIAssistant = ({ contextTab = 'tower' }) => {
  const { data, talleres, isLoading } = useData();
  const presetQuestions = getContextualQuestions(contextTab);

  const [messages, setMessages]     = useState([
    { id: 1, role: 'ai', text: '¡Hola! Soy la Control Tower AI. Estoy monitoreando en directo tus indicadores conectada a Google Sheets y tus límites de capacidad. ¿En qué te ayudo?' }
  ]);
  const [input, setInput]           = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [apiError, setApiError]     = useState(null);
  const messagesEndRef              = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // System prompt construido con datos reales de Google Sheets
  const systemPrompt = useMemo(() => {
    if (!data || !talleres) return '';

    const today     = getLocalYMD();
    const activos   = data.filter(p => !p.fecha_retiro_real);
    const atrasados = activos.filter(p => p.fecha_retiro_ideal && p.fecha_retiro_ideal < today);
    const express   = activos.filter(p =>
      String(p.metodo_entrega || '').toLowerCase().includes('express') ||
      String(p.comentario_kam || '').toLowerCase().includes('urgent')
    );

    const talleresConCarga = talleres.map(t => {
      const carga = activos
        .filter(p => p.taller === t.nombre)
        .reduce((acc, p) => acc + parseNumber(p.impresiones || p.unidades), 0);
      const pct = t.capacidad_semanal_impresiones > 0
        ? Math.round((carga / t.capacidad_semanal_impresiones) * 100)
        : 0;
      return { nombre: t.nombre, carga_pct: pct, capacidad: t.capacidad_semanal_impresiones, impresiones_actuales: carga };
    });

    const criticos = activos
      .filter(p => p.fecha_retiro_ideal && p.fecha_retiro_ideal <= today)
      .slice(0, 10)
      .map(p => ({
        pedido_id: p.pedido_id,
        proyecto: p.nombre_proyecto,
        taller: p.taller,
        estado_prod: p.estado_produccion,
        estado_log: p.estado_logistico,
        retiro_ideal: p.fecha_retiro_ideal,
      }));

    return `Eres el Asistente Operativo de Control Tower de Yute Natural.
Tu rol es responder consultas sobre el estado operativo en tiempo real basándote en los datos de Google Sheets.

DATOS OPERATIVOS ACTUALES (${today}):
- Pedidos en producción (sin retirar): ${activos.length}
- Pedidos atrasados (retiro ideal < hoy): ${atrasados.length}
- Pedidos urgentes/express: ${express.length}

TALLERES Y CAPACIDAD:
${JSON.stringify(talleresConCarga, null, 2)}

PEDIDOS CRÍTICOS ATRASADOS (máx 10):
${criticos.length > 0 ? JSON.stringify(criticos, null, 2) : 'Ninguno — operación al día.'}

INSTRUCCIONES:
- Responde SIEMPRE en español, de forma concisa y operativa (máx 150 palabras)
- Si preguntan por un pedido específico con número, dilo claramente si no está en el contexto
- Usa **negrita** para valores clave y listas con • cuando aplique
- No inventes datos que no estén en este contexto
- Si no tienes el dato, di "No tengo ese dato disponible en este momento"`;
  }, [data, talleres]);

  const handleSend = async (presetText) => {
    const textToSend = presetText || input;
    if (!textToSend.trim() || isTyping) return;

    setApiError(null);

    // Detectar si es una solicitud de gráfico comparativo (lógica local mantenida)
    const textLower = textToSend.toLowerCase();
    const isChartRequest = textLower.includes('comparar') || textLower.includes(' vs ') || textLower.includes('rendimiento');

    const newUserMsg = { id: Date.now(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Gráfico comparativo: respuesta local sin LLM
    if (isChartRequest) {
      const chartData = talleres.map(t => {
        const activos = data.filter(p => p.taller === t.nombre && !p.fecha_retiro_real);
        const imps    = activos.reduce((acc, p) => acc + parseNumber(p.impresiones || p.unidades), 0);
        const atraso  = activos.reduce((acc, p) => acc + parseNumber(p.dias_retraso), 0) / (activos.length || 1);
        return { name: t.nombre, impresiones: imps, retraso_promedio: Math.round(atraso * 10) / 10 };
      });
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'He generado un gráfico comparativo de la carga actual y el retraso promedio por taller.',
        chartData,
        chartType: 'bar',
      }]);
      setIsTyping(false);
      return;
    }

    // Llamada a Claude API
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY no configurada en variables de entorno.');

      // Construir historial (últimos MAX_HISTORY mensajes, excluyendo el inicial de bienvenida)
      const history = messages
        .slice(1)                             // omitir bienvenida
        .slice(-(MAX_HISTORY * 2))            // mantener últimos N turnos
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

      history.push({ role: 'user', content: textToSend });

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 512,
          system: systemPrompt,
          messages: history,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const aiText = result?.content?.[0]?.text || 'Sin respuesta del asistente.';

      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiText }]);
    } catch (err) {
      const errMsg = err.message || 'Error desconocido';
      setApiError(errMsg);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'No pude conectarme al asistente en este momento. Intenta de nuevo en unos segundos.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent animate-spin mb-4"></div>
        <p>Iniciando red neuronal operativa...</p>
      </div>
    );
  }

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

      {apiError && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>Error API:</strong> {apiError}</span>
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center mr-3 mt-1 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${
                msg.role === 'user'
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
                  return <div key={i} className={i !== 0 ? 'mt-3' : ''}>{line}</div>;
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
                          <Pie data={msg.chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
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
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
              disabled={isTyping}
              className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs font-medium text-slate-600 hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span>{q}</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center relative">
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
            <span className="text-[10px] text-slate-400">Powered by Claude · Datos en vivo desde Google Sheets</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
