import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { SHOP_INFO } from '../types';

interface HeroAndServicesProps {
  onStartRepair: () => void;
  onGoToTracking: () => void;
  onOpenAssistant: () => void;
}

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-300 p-6 ${className}`}
      >
        <Wrench className="w-8 h-8 mb-2 text-slate-400" />
        <span className="text-sm font-medium text-center">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export const HeroAndServices: React.FC<HeroAndServicesProps> = ({
  onStartRepair,
  onGoToTracking,
  onOpenAssistant,
}) => {
  return (
    <div id="top">
      {/* 1. Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-center"
            >
              <p className="text-xs sm:text-sm font-medium text-slate-500 mb-4 tracking-normal">
                Villa Morra, Asunción · Diagnóstico electrónico en el día · Garantía escrita de 90 días
              </p>

              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.08] mb-6"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance' }}
              >
                Soporte técnico de precisión con seguimiento en tiempo real.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                Reparamos notebooks, smartphones, PCs de escritorio y consolas en Paraguay.
                Calcula tu presupuesto estimado al instante, recibe notificaciones push de cada
                avance y abona desde tu hogar con factura electrónica automática.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onStartRepair}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1D4ED8]"
                >
                  Diagnosticar y Cotizar Equipo
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onGoToTracking}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm sm:text-base font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded-lg bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Seguir orden existente
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                <a
                  href={SHOP_INFO.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-[#1D4ED8] transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#15803D]" />
                  WhatsApp {SHOP_INFO.whatsappDisplay}
                </a>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <a
                  href={SHOP_INFO.phoneHref}
                  className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-[#1D4ED8] transition-colors"
                >
                  <Phone className="w-4 h-4 text-slate-500" />
                  {SHOP_INFO.phoneDisplay}
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 relative rounded-xl overflow-hidden border border-slate-200 min-h-[300px] lg:min-h-[440px]"
            >
              <ImageWithFallback
                src="/src/assets/images/hero_tech_lab_1794665132554.jpg"
                alt="Laboratorio de micro-soldadura y soporte técnico AsunciónTech en Paraguay"
                fallbackTitle="Laboratorio AsunciónTech — Villa Morra"
                className="w-full h-full lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-xs font-medium text-slate-200 mb-1">
                  Laboratorio Certificado ESD · Asunción, Paraguay
                </p>
                <p className="text-base font-display font-semibold">
                  Microscopía de precisión y diagnóstico eléctrico sin costo al aprobar reparación
                </p>
              </div>
            </motion.div>
          </div>

          {/* 4-column quantitative proof strip directly below hero split */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-slate-900">
                2 a 6 h
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Tiempo promedio en pantallas, baterías y mantenimiento
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-slate-900">
                90 días
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Garantía escrita en mano de obra y repuestos instalados
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-slate-900">
                +4.800
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Equipos entregados en Asunción y Gran Asunción desde 2019
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-slate-900">
                100%
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Seguimiento en vivo por código y alertas push directas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Capabilities Bento Grid */}
      <section id="servicios" className="py-16 lg:py-20 bg-[#F8FAFC] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[#1D4ED8] mb-2">
                Propuestas de valor y especialidades
              </p>
              <h2
                className="font-display font-bold tracking-tight text-slate-900 text-2xl sm:text-4xl"
                style={{ textWrap: 'balance' }}
              >
                Ingeniería aplicada para recuperar tu equipo sin demoras ni sorpresas.
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Consultar presupuesto con IA
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Marquee Card 1 */}
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.3 }}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 h-full">
                <div className="p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-3">
                      01 · Micro-soldadura y Notebooks
                    </p>
                    <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                      Placas madre, corto en fuente y recuperación de equipos mojados
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Diagnóstico con cámara térmica y osciloscopio para MacBook, ThinkPad,
                      Dell XPS y notebooks gamer sin cambiar la placa completa.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                    <span>Desde Gs. 350.000</span>
                    <span>12 – 48 horas</span>
                  </div>
                </div>
                <div className="min-h-[220px] sm:min-h-full bg-slate-100">
                  <ImageWithFallback
                    src="/src/assets/images/service_laptop_board_1794665134057.jpg"
                    alt="Diagnóstico de placa madre de notebook"
                    fallbackTitle="Diagnóstico de Placas Madre"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </motion.article>

            {/* Card 2 */}
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div className="h-48 bg-slate-100">
                <ImageWithFallback
                  src="/src/assets/images/service_mobile_repair_1794665133904.jpg"
                  alt="Reemplazo de pantalla OLED y batería de smartphone"
                  fallbackTitle="Pantallas y Baterías Móviles"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    02 · Smartphones y Tablets
                  </p>
                  <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
                    Pantallas OLED, baterías certificadas y pines USB-C en el día
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Repuestos originales y calidad OEM para iPhone, Samsung Galaxy, Xiaomi y iPad
                    con sellado hermético de fábrica.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                  <span>Desde Gs. 220.000</span>
                  <span>2 – 6 horas</span>
                </div>
              </div>
            </motion.article>

            {/* Card 3 */}
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  03 · Térmica y Optimización
                </p>
                <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
                  Limpieza ultrasónica, pasta térmica de alto rendimiento y upgrade NVMe
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Eliminamos el estrangulamiento térmico en notebooks corporativas, PCs y PlayStation 5
                  con insumos Kryonaut y clonación sin pérdida de archivos.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                <span>Desde Gs. 180.000</span>
                <span>2 – 3 horas</span>
              </div>
            </motion.article>

            {/* Card 4 */}
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  04 · Transparencia y Notificaciones Push
                </p>
                <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
                  Seguimiento en vivo por código y alertas instantáneas en tu dispositivo
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Observa en todo momento quién atiende tu equipo, qué etapa cursa y cuántas horas
                  faltan para el retiro en nuestra sucursal.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-medium text-[#15803D]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Actualizaciones push en tiempo real</span>
              </div>
            </motion.article>

            {/* Card 5 */}
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="lg:col-span-4 bg-slate-900 text-white border border-slate-800 rounded-xl p-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-300 mb-2">
                  05 · Pago en Línea y Factura Legal
                </p>
                <h3 className="font-display font-bold text-lg text-white mb-2">
                  Abona desde casa y descarga tu factura con IVA 10% al instante
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Aceptamos tarjetas de crédito/débito, transferencias SIPAP 24/7 y billeteras
                  electrónicas paraguayas con emisión automática de comprobante.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onStartRepair}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Iniciar solicitud ahora
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* 3. Physical Location in Paraguay & Direct Contact */}
      <section id="contacto" className="py-16 lg:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 rounded-xl overflow-hidden border border-slate-200 min-h-[280px] lg:min-h-[380px] relative">
              <ImageWithFallback
                src="/src/assets/images/local_asuncion_front_1794665133875.jpg"
                alt="Local físico de AsunciónTech en Villa Morra, Asunción, Paraguay"
                fallbackTitle="Sucursal Villa Morra — Asunción, Paraguay"
                className="w-full h-full lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-xs font-medium text-slate-200">
                  Recepción con estacionamiento propio para clientes
                </p>
                <p className="text-lg font-display font-semibold mt-0.5">
                  {SHOP_INFO.address} · {SHOP_INFO.neighborhood}
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 sm:p-8">
              <div>
                <p className="text-sm font-medium text-[#1D4ED8] mb-2">
                  Ubicación física en Paraguay y contacto directo
                </p>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 mb-6">
                  Visítanos en Villa Morra o escríbenos al instante.
                </h2>

                <dl className="space-y-5 text-sm">
                  <div className="flex items-start gap-3.5">
                    <MapPin className="w-5 h-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                    <div>
                      <dt className="font-semibold text-slate-900">Dirección del Local</dt>
                      <dd className="text-slate-600 mt-0.5">
                        {SHOP_INFO.address}
                        <br />
                        {SHOP_INFO.neighborhood}
                      </dd>
                      <a
                        href={SHOP_INFO.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline mt-1.5"
                      >
                        Abrir ubicación en Google Maps
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <MessageCircle className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
                    <div>
                      <dt className="font-semibold text-slate-900">WhatsApp Técnico Directo</dt>
                      <dd className="text-slate-600 mt-0.5 font-mono tabular-nums">
                        {SHOP_INFO.whatsappDisplay}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <Phone className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                    <div>
                      <dt className="font-semibold text-slate-900">Teléfono de Recepción</dt>
                      <dd className="text-slate-600 mt-0.5 font-mono tabular-nums">
                        {SHOP_INFO.phoneDisplay} · {SHOP_INFO.email}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <Clock className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                    <div>
                      <dt className="font-semibold text-slate-900">Horarios de Atención</dt>
                      <dd className="text-slate-600 mt-0.5">
                        {SHOP_INFO.hoursWeekday}
                        <br />
                        {SHOP_INFO.hoursSaturday}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                <a
                  href={SHOP_INFO.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  Escribir por WhatsApp
                </a>
                <a
                  href={SHOP_INFO.phoneHref}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Phone className="w-4 h-4" />
                  Llamar al Local
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
