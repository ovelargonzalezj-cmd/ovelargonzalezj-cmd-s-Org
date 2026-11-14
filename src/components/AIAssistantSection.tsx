import React, { useRef, useState } from 'react';
import { ArrowRight, Bot, MessageCircle, Phone, Send, User } from 'lucide-react';
import { SHOP_INFO } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AIAssistantSectionProps {
  onTransferToIntake: (summaryText: string) => void;
}

const SUGGESTED_QUESTIONS = [
  '¿Cuánto cuesta cambiar la pantalla de un iPhone 14 y cuántas horas tarda?',
  'Mi notebook Lenovo se apaga por calor, ¿qué problema tiene y cuál es el presupuesto?',
  '¿Dónde queda el local en Paraguay y cuál es el WhatsApp directo?',
  'Se derramó agua sobre mi MacBook Air M2, ¿qué debo hacer ahora?',
];

export const AIAssistantSection: React.FC<AIAssistantSectionProps> = ({
  onTransferToIntake,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hola, soy el Asistente Técnico de AsunciónTech. Respondo exclusivamente consultas sobre nuestros servicios de reparación, fallas frecuentes de equipos, datos de contacto en Paraguay y cálculo automático de presupuestos estimados en Guaraníes. ¿Qué equipo necesitas revisar hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setErrorText('');
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);

    try {
      const response = await fetch('/api/ai/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error || 'No se pudo obtener respuesta del asistente técnico.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.reply!,
        },
      ]);
    } catch (err) {
      setErrorText(
        err instanceof Error
          ? err.message
          : 'Error de conexión con el asistente técnico.'
      );
    } finally {
      setLoading(false);
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 60);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <section id="asistente-ia" className="py-16 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Context & Quick Prompts */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-sm font-medium text-[#1D4ED8] mb-2">
                Asistente IA exclusivo de soporte técnico
              </p>
              <h2
                className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Resuelve dudas técnicas y calcula un presupuesto estimado en segundos.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
                Indica la marca, modelo de tu equipo y la falla que presenta. Nuestro asistente
                responde únicamente sobre soporte técnico, te guía con las fallas comunes, facilita
                el contacto directo y calcula el costo aproximado en Guaraníes.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                Consultas frecuentes para probar:
              </p>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendMessage(q)}
                    className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
              <a
                href={SHOP_INFO.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp {SHOP_INFO.whatsappDisplay}
              </a>
              <a
                href={SHOP_INFO.phoneHref}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors whitespace-nowrap"
              >
                <Phone className="w-4 h-4" />
                Llamar {SHOP_INFO.phoneDisplay}
              </a>
            </div>
          </div>

          {/* Right Chat Viewport */}
          <div className="lg:col-span-7 bg-[#F8FAFC] border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[540px]">
            <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Especialista Virtual AsunciónTech
                  </h3>
                  <p className="text-xs text-slate-500">
                    Diagnóstico orientativo · Presupuestos en Gs. · Contacto Paraguay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onTransferToIntake(
                    messages
                      .filter((m) => m.role === 'user')
                      .map((m) => m.text)
                      .slice(-1)[0] ?? ''
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Crear Orden
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === 'user'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-slate-200 text-[#1D4ED8]'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
                    Analizando falla y calculando presupuesto en Guaraníes...
                  </div>
                </div>
              )}

              {errorText && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  {errorText}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2.5"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej. Tengo una Dell Inspiron 15 que no carga, ¿cuánto cuesta?"
                className="flex-1 px-3.5 py-2.5 text-sm bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Consultar</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
