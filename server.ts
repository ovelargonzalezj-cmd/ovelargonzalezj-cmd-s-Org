import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SUPPORT_SYSTEM_INSTRUCTION = `Eres el Asistente Técnico Virtual exclusivo de AsunciónTech, un centro profesional de soporte técnico y micro-soldadura ubicado en Paraguay.

REGLAS ESTRICTAS DE ALCANCE (NO NEGOCIABLES):
1. Responde ÚNICA Y EXCLUSIVAMENTE sobre:
   - Servicios técnicos que ofrece AsunciónTech (reparación de notebooks, PCs de escritorio, smartphones, tablets y consolas; micro-soldadura de placas; cambio de pantallas, baterías, teclados y puertos de carga; limpieza térmica; recuperación de datos; instalación y optimización de sistemas).
   - Diagnóstico orientativo de fallas comunes en equipos y consejos seguros mientras el cliente trae su equipo.
   - Facilitar datos de contacto y ubicación en Paraguay.
   - Calcular automáticamente un presupuesto estimado en Guaraníes (Gs.) y el tiempo estimado en horas según el modelo de equipo y el problema descrito.
2. Si el usuario pregunta cualquier tema ajeno (política, cocina, programación general, chistes, tareas escolares, historia, etc.), rechaza amablemente en 1 oración y redirige exclusivamente a consultas de soporte técnico, presupuestos de reparación o contacto con el laboratorio.
3. Responde siempre en español claro, profesional, cercano al público de Paraguay (usando "Gs." para Guaraníes) y de forma concisa y estructurada.

DATOS OFICIALES DEL LOCAL EN PARAGUAY:
- Nombre: AsunciónTech — Laboratorio de Soporte Técnico
- Dirección: Av. Mariscal López 2450 c/ Choferes del Chaco, Barrio Villa Morra, Asunción, Paraguay
- Horarios: Lunes a Viernes de 08:30 a 18:30 hs · Sábados de 09:00 a 13:00 hs
- WhatsApp directo: +595 981 450 820 (https://wa.me/595981450820)
- Teléfono fijo: (021) 614 890
- Correo: soporte@asunciontech.com.py
- Garantía: 90 días por escrito en todas las reparaciones y repuestos.
- Formas de pago desde casa: Tarjeta de crédito/débito, transferencia bancaria SIPAP 24/7 y billeteras electrónicas (Tigo Money / Personal Pay), con factura legal automática.

TABLA DE REFERENCIA PARA PRESUPUESTOS ESTIMADOS EN PARAGUAY (Gs. y horas):
- Diagnóstico electrónico profesional: Sin costo al aprobar la reparación (Gs. 80.000 si no se realiza). Tiempo: 1 a 2 horas.
- Mantenimiento preventivo y cambio de pasta térmica (Notebook/PC/Consola): Gs. 180.000 a Gs. 280.000. Tiempo: 2 a 3 horas.
- Formateo, respaldo de datos e instalación de sistema operativo/drivers: Gs. 180.000 a Gs. 250.000. Tiempo: 2 a 4 horas.
- Cambio de batería (Smartphone / Notebook): Gs. 220.000 a Gs. 580.000 según modelo. Tiempo: 2 a 4 horas.
- Cambio de pin/puerto de carga USB-C / Lightning: Gs. 190.000 a Gs. 340.000. Tiempo: 3 a 5 horas.
- Cambio de pantalla (Smartphone gama media/alta o Notebook): Gs. 380.000 a Gs. 1.650.000 según modelo (ej. OLED/Retina). Tiempo: 3 a 8 horas.
- Reparación de placa madre / micro-soldadura / equipo mojado: Gs. 420.000 a Gs. 950.000. Tiempo: 12 a 48 horas.
- Recuperación de datos (SSD/HDD): Gs. 350.000 a Gs. 850.000. Tiempo: 6 a 24 horas.

Cuando el cliente mencione un equipo y una falla, entrega siempre:
1) Posible causa técnica frecuente,
2) Presupuesto estimado en Guaraníes (rango realista),
3) Tiempo estimado en horas,
4) Invitación directa a registrar su orden en la sección "Solicitar Reparación" o escribir al WhatsApp +595 981 450 820.`;

interface ClientMeta {
  trackingCodes: Set<string>;
  ownerUid?: string;
  watchAll?: boolean;
}

interface PushEventPayload {
  type: string;
  trackingCode: string;
  orderId: string;
  ownerUid?: string;
  status: string;
  title: string;
  body: string;
  estimatedHours: number;
  timestamp: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Map<WebSocket, ClientMeta>();
  const recentPushEvents: PushEventPayload[] = [];

  wss.on('connection', (ws) => {
    clients.set(ws, { trackingCodes: new Set<string>(), watchAll: false });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          trackingCode?: string;
          trackingCodes?: string[];
          ownerUid?: string;
          watchAll?: boolean;
        };
        const meta = clients.get(ws);
        if (!meta) return;

        if (msg.type === 'subscribe') {
          if (typeof msg.trackingCode === 'string' && msg.trackingCode.trim()) {
            meta.trackingCodes.add(msg.trackingCode.trim().toUpperCase());
          }
          if (Array.isArray(msg.trackingCodes)) {
            for (const code of msg.trackingCodes) {
              if (typeof code === 'string' && code.trim()) {
                meta.trackingCodes.add(code.trim().toUpperCase());
              }
            }
          }
          if (typeof msg.ownerUid === 'string' && msg.ownerUid.trim()) {
            meta.ownerUid = msg.ownerUid.trim();
          }
          if (typeof msg.watchAll === 'boolean') {
            meta.watchAll = msg.watchAll;
          }
          ws.send(JSON.stringify({ type: 'subscribed', count: meta.trackingCodes.size }));
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  function broadcastPushEvent(payload: PushEventPayload) {
    recentPushEvents.unshift(payload);
    if (recentPushEvents.length > 50) {
      recentPushEvents.pop();
    }

    const serialized = JSON.stringify(payload);
    for (const [socket, meta] of clients.entries()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const matchesCode = meta.trackingCodes.has(payload.trackingCode.toUpperCase());
      const matchesOwner = Boolean(meta.ownerUid && payload.ownerUid && meta.ownerUid === payload.ownerUid);
      if (meta.watchAll || matchesCode || matchesOwner) {
        socket.send(serialized);
      }
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, connectedClients: clients.size });
  });

  app.post('/api/push/notify', (req, res) => {
    const body = req.body as Partial<PushEventPayload>;
    if (!body.trackingCode || !body.status || !body.title || !body.body) {
      res.status(400).json({ error: 'Faltan campos obligatorios para emitir la notificación push.' });
      return;
    }

    const event: PushEventPayload = {
      type: 'order:updated',
      trackingCode: String(body.trackingCode).toUpperCase(),
      orderId: String(body.orderId ?? ''),
      ownerUid: body.ownerUid ? String(body.ownerUid) : undefined,
      status: String(body.status),
      title: String(body.title),
      body: String(body.body),
      estimatedHours: typeof body.estimatedHours === 'number' ? body.estimatedHours : 4,
      timestamp: new Date().toISOString(),
    };

    broadcastPushEvent(event);
    res.json({ ok: true, delivered: true, event });
  });

  app.post('/api/ai/support', async (req, res) => {
    try {
      const { messages } = req.body as {
        messages?: Array<{ role: 'user' | 'model'; text: string }>;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Se requiere al menos un mensaje para consultar al asistente técnico.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'La clave de Gemini API no está configurada en el servidor.',
        });
        return;
      }

      const history = messages.slice(-10).map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text).slice(0, 1500) }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: history,
        config: {
          systemInstruction: SUPPORT_SYSTEM_INSTRUCTION,
        },
      });

      const reply = response.text?.trim() || 'No pude generar una respuesta en este momento. Puedes contactarnos por WhatsApp al +595 981 450 820.';
      res.json({ reply });
    } catch (error) {
      console.error('Error in /api/ai/support:', error);
      res.status(500).json({
        error: 'Ocurrió un error al consultar el asistente de soporte técnico. Intenta nuevamente.',
      });
    }
  });

  app.post('/api/ai/estimate', async (req, res) => {
    try {
      const { deviceCategory, deviceModel, problemDescription, selectedIssues } = req.body as {
        deviceCategory?: string;
        deviceModel?: string;
        problemDescription?: string;
        selectedIssues?: string[];
      };

      if (!deviceModel || !problemDescription) {
        res.status(400).json({ error: 'Indica el modelo del equipo y la descripción del problema.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'La clave de Gemini API no está configurada en el servidor.',
        });
        return;
      }

      const prompt = `Calcula un presupuesto técnico realista para el mercado de Asunción, Paraguay (en Guaraníes PYG) y el tiempo estimado de reparación en horas.
Categoría del equipo: ${deviceCategory || 'otro'}
Modelo exacto: ${deviceModel}
Fallas seleccionadas: ${(selectedIssues || []).join(', ') || 'No especificadas'}
Descripción del cliente: ${problemDescription}

Responde exclusivamente con el JSON estructurado requerido. Los precios deben ser múltiplos de 10.000 Gs. realistas en Paraguay.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: SUPPORT_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimatedCostPyg: {
                type: Type.INTEGER,
                description: 'Costo estimado central en Guaraníes (PYG), múltiplo de 10000.',
              },
              minCostPyg: {
                type: Type.INTEGER,
                description: 'Costo mínimo estimado en Guaraníes (PYG).',
              },
              maxCostPyg: {
                type: Type.INTEGER,
                description: 'Costo máximo estimado en Guaraníes (PYG).',
              },
              estimatedHours: {
                type: Type.INTEGER,
                description: 'Tiempo estimado de reparación en horas según la complejidad del problema (entre 1 y 72).',
              },
              recommendedService: {
                type: Type.STRING,
                description: 'Nombre corto del servicio técnico recomendado en español.',
              },
              diagnosisSummary: {
                type: Type.STRING,
                description: 'Explicación técnica concisa en español (máximo 240 caracteres) sobre la causa probable y solución.',
              },
              partsLikelyNeeded: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de hasta 4 repuestos o insumos probables.',
              },
              urgencyLevel: {
                type: Type.STRING,
                description: 'Nivel de urgencia: baja, media o alta.',
              },
            },
            required: [
              'estimatedCostPyg',
              'minCostPyg',
              'maxCostPyg',
              'estimatedHours',
              'recommendedService',
              'diagnosisSummary',
              'partsLikelyNeeded',
              'urgencyLevel',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson);
      res.json({ estimate: parsed });
    } catch (error) {
      console.error('Error in /api/ai/estimate:', error);
      res.status(500).json({
        error: 'No se pudo calcular el presupuesto automático con IA en este momento.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AsunciónTech server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
