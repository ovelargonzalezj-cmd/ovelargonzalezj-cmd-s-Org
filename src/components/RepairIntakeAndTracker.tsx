import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Laptop,
  Search,
  Send,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
} from '../firebase';
import {
  clampStr,
  COMMON_ISSUES,
  DEVICE_CATEGORIES,
  formatPyg,
  formatTimestampPy,
  generateSafeId,
  generateTrackingCode,
  getStatusLabel,
  STATUS_PIPELINE,
  type AIEstimateResult,
  type DeviceCategory,
  type InvoiceRecord,
  type OrderTimelineEvent,
  type PublicTracking,
  type PushNotificationRecord,
  type ServiceOrder,
} from '../types';

interface RepairIntakeAndTrackerProps {
  user: User | null;
  initialSubTab?: 'solicitar' | 'seguimiento';
  prefillDescription?: string;
  onOpenPaymentModal: (order: ServiceOrder, invoice: InvoiceRecord | null) => void;
  onEmitPush: (payload: {
    trackingCode: string;
    orderId: string;
    ownerUid: string;
    status: string;
    title: string;
    body: string;
    estimatedHours: number;
  }) => Promise<void>;
  onSubscribeTrackingCode: (code: string) => void;
  pushPermission: NotificationPermission | 'unsupported';
  onRequestPushPermission: () => Promise<void>;
  notifications: PushNotificationRecord[];
}

export const RepairIntakeAndTracker: React.FC<RepairIntakeAndTrackerProps> = ({
  user,
  initialSubTab = 'solicitar',
  prefillDescription = '',
  onOpenPaymentModal,
  onEmitPush,
  onSubscribeTrackingCode,
  pushPermission,
  onRequestPushPermission,
  notifications,
}) => {
  const [subTab, setSubTab] = useState<'solicitar' | 'seguimiento'>(initialSubTab);

  // Intake Form State
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>('notebook');
  const [deviceModel, setDeviceModel] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>(['sobrecalentamiento']);
  const [problemSummary, setProblemSummary] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerRuc, setCustomerRuc] = useState('');

  // AI Estimate State
  const [estimating, setEstimating] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<AIEstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState('');

  // Order Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdCodeNotice, setCreatedCodeNotice] = useState('');

  // Tracker State
  const [lookupInput, setLookupInput] = useState('');
  const [activeLookupCode, setActiveLookupCode] = useState('');
  const [publicTrack, setPublicTrack] = useState<PublicTracking | null>(null);
  const [lookupNotFound, setLookupNotFound] = useState(false);
  const [myOrders, setMyOrders] = useState<ServiceOrder[]>([]);
  const [myInvoices, setMyInvoices] = useState<Record<string, InvoiceRecord>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (prefillDescription) {
      setProblemSummary(prefillDescription);
      setSubTab('solicitar');
    }
  }, [prefillDescription]);

  useEffect(() => {
    if (user?.displayName && !customerName) {
      setCustomerName(user.displayName);
    }
  }, [user, customerName]);

  // Real-time listener for user's own orders and invoices
  useEffect(() => {
    if (!user) {
      setMyOrders([]);
      setMyInvoices({});
      return;
    }

    const qOrders = query(
      collection(db, 'serviceOrders'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        const list: ServiceOrder[] = [];
        snap.forEach((d) => {
          list.push(d.data() as ServiceOrder);
        });
        setMyOrders(list);
        if (list.length > 0 && !selectedOrderId) {
          setSelectedOrderId(list[0].orderId);
          setActiveLookupCode(list[0].trackingCode);
          onSubscribeTrackingCode(list[0].trackingCode);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'serviceOrders');
      }
    );

    const qInvoices = query(
      collection(db, 'invoices'),
      where('ownerUid', '==', user.uid)
    );

    const unsubInvoices = onSnapshot(
      qInvoices,
      (snap) => {
        const map: Record<string, InvoiceRecord> = {};
        snap.forEach((d) => {
          const inv = d.data() as InvoiceRecord;
          map[inv.orderId] = inv;
        });
        setMyInvoices(map);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      }
    );

    return () => {
      unsubOrders();
      unsubInvoices();
    };
  }, [user, selectedOrderId, onSubscribeTrackingCode]);

  // Real-time listener for active publicTracking code
  useEffect(() => {
    if (!activeLookupCode) {
      setPublicTrack(null);
      setLookupNotFound(false);
      return;
    }

    const normalized = activeLookupCode.trim().toUpperCase();
    onSubscribeTrackingCode(normalized);

    const unsub = onSnapshot(
      doc(db, 'publicTracking', normalized),
      (snap) => {
        if (snap.exists()) {
          setPublicTrack(snap.data() as PublicTracking);
          setLookupNotFound(false);
        } else {
          setPublicTrack(null);
          setLookupNotFound(true);
        }
      },
      () => {
        setLookupNotFound(true);
      }
    );

    return () => unsub();
  }, [activeLookupCode, onSubscribeTrackingCode]);

  // Real-time listener for timeline of selected order
  useEffect(() => {
    if (!user || !selectedOrderId) {
      setTimeline([]);
      return;
    }

    const qTimeline = query(
      collection(db, 'serviceOrders', selectedOrderId, 'timeline'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      qTimeline,
      (snap) => {
        const events: OrderTimelineEvent[] = [];
        snap.forEach((d) => events.push(d.data() as OrderTimelineEvent));
        setTimeline(events);
      },
      (err) => {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `serviceOrders/${selectedOrderId}/timeline`
        );
      }
    );

    return () => unsub();
  }, [user, selectedOrderId]);

  const toggleIssue = (issueId: string) => {
    setSelectedIssues((prev) => {
      if (prev.includes(issueId)) {
        return prev.length > 1 ? prev.filter((id) => id !== issueId) : prev;
      }
      if (prev.length >= 8) return prev;
      return [...prev, issueId];
    });
  };

  const getBaselineEstimate = () => {
    const matched = COMMON_ISSUES.filter((i) => selectedIssues.includes(i.id));
    const totalHours = matched.reduce((acc, i) => acc + i.baseHours, 0) || 4;
    const totalCost = matched.reduce((acc, i) => acc + i.baseCostPyg, 0) || 280000;
    const categoryMultiplier =
      deviceCategory === 'notebook' ? 1.1 : deviceCategory === 'consola' ? 1.05 : 1;
    return {
      hours: Math.min(72, Math.max(2, Math.round(totalHours * 0.85))),
      costPyg: Math.round((totalCost * categoryMultiplier) / 10000) * 10000,
    };
  };

  const handleCalculateAIEstimate = async () => {
    setEstimateError('');
    if (deviceModel.trim().length < 2 || problemSummary.trim().length < 5) {
      setEstimateError(
        'Ingresa el modelo del equipo y describe brevemente el problema para calcular el presupuesto con IA.'
      );
      return;
    }

    setEstimating(true);
    try {
      const issueLabels = COMMON_ISSUES.filter((i) => selectedIssues.includes(i.id)).map(
        (i) => i.label
      );
      const res = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceCategory,
          deviceModel: deviceModel.trim(),
          problemDescription: problemSummary.trim(),
          selectedIssues: issueLabels,
        }),
      });
      const data = (await res.json()) as { estimate?: AIEstimateResult; error?: string };
      if (!res.ok || !data.estimate) {
        throw new Error(data.error || 'No se pudo calcular el presupuesto automático.');
      }
      setAiEstimate(data.estimate);
    } catch (err) {
      setEstimateError(
        err instanceof Error ? err.message : 'Error al calcular presupuesto con IA.'
      );
    } finally {
      setEstimating(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (deviceModel.trim().length < 2) {
      setSubmitError('Indica el modelo exacto de tu equipo.');
      return;
    }
    if (problemSummary.trim().length < 5) {
      setSubmitError('Describe el problema que presenta el equipo.');
      return;
    }
    if (customerPhone.trim().length < 6) {
      setSubmitError('Ingresa un número de WhatsApp o teléfono válido.');
      return;
    }

    setSubmitting(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        currentUser = await signInWithGoogle();
      }
      if (!currentUser.emailVerified) {
        throw new Error('Tu cuenta de Google debe tener el correo verificado.');
      }

      const baseline = getBaselineEstimate();
      const finalHours = aiEstimate?.estimatedHours ?? baseline.hours;
      const finalCostPyg = aiEstimate?.estimatedCostPyg ?? baseline.costPyg;

      const orderId = generateSafeId('ord');
      const trackingCode = generateTrackingCode();
      const eventId = generateSafeId('evt');
      const notifId = generateSafeId('notif');
      const issueLabels = COMMON_ISSUES.filter((i) => selectedIssues.includes(i.id)).map(
        (i) => i.label
      );

      const safeName = clampStr(customerName || currentUser.displayName || 'Cliente', 100);
      const safeEmail = clampStr(currentUser.email || 'cliente@asunciontech.com.py', 120);
      const safePhone = clampStr(customerPhone, 30);
      const safeRuc = clampStr(customerRuc, 25);
      const safeModel = clampStr(deviceModel, 120);
      const safeSummary = clampStr(problemSummary, 600);
      const initialMsg = `Orden ${trackingCode} registrada. Tiempo estimado inicial: ${finalHours} horas.`;

      const batch = writeBatch(db);
      batch.set(doc(db, 'serviceOrders', orderId), {
        orderId,
        trackingCode,
        ownerUid: currentUser.uid,
        customerName: safeName,
        customerEmail: safeEmail,
        customerPhone: safePhone,
        customerRuc: safeRuc,
        deviceCategory,
        deviceModel: safeModel,
        problemSummary: safeSummary,
        selectedIssues: issueLabels.length > 0 ? issueLabels : ['Diagnóstico general'],
        status: 'recibido',
        estimatedHours: finalHours,
        estimatedCostPyg: finalCostPyg,
        assignedTechnician: 'Por asignar',
        technicianNotes: aiEstimate?.diagnosisSummary
          ? clampStr(`Diagnóstico preliminar IA: ${aiEstimate.diagnosisSummary}`, 600)
          : 'Equipo ingresado para evaluación inicial en laboratorio.',
        paymentStatus: 'pendiente',
        paymentMethod: 'pendiente',
        invoiceNumber: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'serviceOrders', orderId, 'timeline', eventId), {
        eventId,
        orderId,
        ownerUid: currentUser.uid,
        status: 'recibido',
        message: clampStr(initialMsg, 300),
        hoursRemaining: finalHours,
        createdBy: 'Portal de Clientes',
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'publicTracking', trackingCode), {
        trackingCode,
        orderId,
        ownerUid: currentUser.uid,
        deviceCategory,
        deviceModel: safeModel,
        status: 'recibido',
        estimatedHours: finalHours,
        estimatedCostPyg: finalCostPyg,
        paymentStatus: 'pendiente',
        lastMessage: clampStr(initialMsg, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        ownerUid: currentUser.uid,
        orderId,
        trackingCode,
        title: `Orden registrada · ${trackingCode}`,
        body: clampStr(`${safeModel} ingresado. Tiempo estimado: ${finalHours} hs.`, 300),
        read: false,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `serviceOrders/${orderId}`);
      }

      onSubscribeTrackingCode(trackingCode);
      await onEmitPush({
        trackingCode,
        orderId,
        ownerUid: currentUser.uid,
        status: 'recibido',
        title: `Orden creada · ${trackingCode}`,
        body: `Recibimos la solicitud para ${safeModel}. Estimación: ${finalHours} hs.`,
        estimatedHours: finalHours,
      });

      setCreatedCodeNotice(trackingCode);
      setSelectedOrderId(orderId);
      setActiveLookupCode(trackingCode);
      setLookupInput(trackingCode);
      setDeviceModel('');
      setProblemSummary('');
      setAiEstimate(null);
      setSubTab('seguimiento');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo registrar la orden de servicio.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = lookupInput.trim().toUpperCase();
    if (!cleaned) return;
    setActiveLookupCode(cleaned);
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notifId}`);
    }
  };

  const selectedOrder = myOrders.find((o) => o.orderId === selectedOrderId) ?? null;
  const baselinePreview = getBaselineEstimate();
  const displayCostPyg = aiEstimate?.estimatedCostPyg ?? baselinePreview.costPyg;
  const displayHours = aiEstimate?.estimatedHours ?? baselinePreview.hours;

  const activeStatusKey = selectedOrder?.status ?? publicTrack?.status ?? 'recibido';
  const activeStageIndex = Math.max(
    0,
    STATUS_PIPELINE.findIndex((s) => s.key === activeStatusKey)
  );

  return (
    <section
      id="portal-seguimiento"
      className="py-16 lg:py-20 bg-[#F8FAFC] border-b border-slate-200"
    >
      <div id="solicitar-reparacion" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-sm font-medium text-[#1D4ED8] mb-2">
              Portal de clientes · Cotización, seguimiento y pago en línea
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-slate-900 tracking-tight">
              Registra tu equipo o sigue tu reparación en tiempo real.
            </h2>
          </div>

          {/* Interactive Segmented Control */}
          <div className="inline-flex items-center p-1 bg-slate-200/80 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setSubTab('solicitar')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'solicitar'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Solicitar Reparación
            </button>
            <button
              type="button"
              onClick={() => setSubTab('seguimiento')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'seguimiento'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Seguimiento en Vivo
            </button>
          </div>
        </div>

        {createdCodeNotice && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-emerald-950">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
              <span>
                ¡Orden creada con éxito! Tu código de seguimiento es{' '}
                <strong className="font-mono text-base">{createdCodeNotice}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCodeNotice('')}
              className="text-xs font-semibold text-emerald-800 hover:underline self-end sm:self-center cursor-pointer"
            >
              Ocultar aviso
            </button>
          </div>
        )}

        {subTab === 'solicitar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Intake Form */}
            <form
              onSubmit={handleCreateOrder}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                    Tipo de Equipo
                  </label>
                  <select
                    value={deviceCategory}
                    onChange={(e) => setDeviceCategory(e.target.value as DeviceCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  >
                    {DEVICE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                    Marca y Modelo del Equipo
                  </label>
                  <input
                    type="text"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    maxLength={120}
                    placeholder="Ej. Lenovo ThinkPad T14 / iPhone 14 Pro"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Selecciona los problemas que presenta (puedes marcar varios)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_ISSUES.map((issue) => {
                    const active = selectedIssues.includes(issue.id);
                    return (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => toggleIssue(issue.id)}
                        className={`px-3.5 py-2.5 rounded-lg border text-left text-sm transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'border-[#1D4ED8] bg-blue-50/70 text-[#1D4ED8] font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{issue.label}</span>
                        <span className="font-mono text-xs tabular-nums shrink-0 opacity-80">
                          ~{issue.baseHours}h
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-slate-900">
                    Describe detalladamente la falla o síntomas
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleCalculateAIEstimate()}
                    disabled={estimating}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {estimating ? 'Calculando con IA...' : 'Calcular Presupuesto con IA'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={problemSummary}
                  onChange={(e) => setProblemSummary(e.target.value)}
                  placeholder="Ej. Se apagó de golpe mientras cargaba, el ventilador suena fuerte o la pantalla quedó en negro."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  required
                />
              </div>

              {estimateError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2">
                  {estimateError}
                </p>
              )}

              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tu Nombre Completo
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp / Celular (Paraguay)
                  </label>
                  <input
                    type="tel"
                    maxLength={30}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0981 450 820"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    RUC o C.I. (para factura)
                  </label>
                  <input
                    type="text"
                    maxLength={25}
                    value={customerRuc}
                    onChange={(e) => setCustomerRuc(e.target.value)}
                    placeholder="Ej. 4512890-3"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  {submitError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-slate-500">
                  {user
                    ? `Conectado como ${user.email}`
                    : 'Al confirmar, iniciarás sesión con Google para proteger tu orden y factura.'}
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Registrando orden...' : 'Confirmar Orden de Servicio'}
                </button>
              </div>
            </form>

            {/* Right: Live Automatic Budget & Repair Time Preview */}
            <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">
                  {aiEstimate
                    ? 'Presupuesto calculado automáticamente con IA'
                    : 'Estimación orientativa en tiempo real'}
                </p>
                <h3 className="font-display font-bold text-xl text-slate-900">
                  Resumen de Costo y Tiempo de Entrega
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 py-5 border-y border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Presupuesto Estimado</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-[#1D4ED8]">
                    {formatPyg(displayCostPyg)}
                  </p>
                  {aiEstimate && (
                    <p className="font-mono tabular-nums text-xs text-slate-500 mt-1">
                      Rango: {formatPyg(aiEstimate.minCostPyg)} – {formatPyg(aiEstimate.maxCostPyg)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tiempo Estimado</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                    {displayHours} horas
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Según falla seleccionada</p>
                </div>
              </div>

              {aiEstimate ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      Servicio Recomendado
                    </p>
                    <p className="font-semibold text-slate-900">{aiEstimate.recommendedService}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      Análisis Técnico Preliminar
                    </p>
                    <p className="text-slate-700 leading-relaxed">{aiEstimate.diagnosisSummary}</p>
                  </div>
                  {aiEstimate.partsLikelyNeeded?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">
                        Repuestos / Insumos Probables
                      </p>
                      <ul className="space-y-1 text-slate-700">
                        {aiEstimate.partsLikelyNeeded.map((part) => (
                          <li key={part} className="flex items-center gap-2 text-xs">
                            <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{part}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Completa el modelo exacto y la descripción de la falla, luego presiona el botón
                    de cálculo con IA para obtener un diagnóstico preliminar detallado según tu
                    equipo específico.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCalculateAIEstimate()}
                    disabled={estimating}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    {estimating ? 'Calculando presupuesto...' : 'Calcular Presupuesto Automático IA'}
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p>· Diagnóstico final sin costo al aprobar la reparación.</p>
                <p>· Garantía escrita de 90 días y factura legal con IVA 10%.</p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Search by Tracking Code + Push Opt-in Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <form
                onSubmit={handleLookupSubmit}
                className="flex flex-1 items-center gap-2.5 max-w-xl"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="Ingresa tu código de seguimiento (ej. AT-7429K)"
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Buscar Orden
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-3">
                {pushPermission === 'granted' ? (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#15803D]">
                    <BellRing className="w-4 h-4" />
                    <span>Notificaciones Push activadas en este navegador</span>
                  </div>
                ) : pushPermission !== 'unsupported' ? (
                  <button
                    type="button"
                    onClick={() => void onRequestPushPermission()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    Activar Notificaciones Push en Vivo
                  </button>
                ) : null}

                {!user && (
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Ver mis órdenes y facturas
                  </button>
                )}
              </div>
            </div>

            {lookupNotFound && activeLookupCode && !selectedOrder && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-950">
                No encontramos una orden con el código <strong className="font-mono">{activeLookupCode}</strong>. Verifica los caracteres o selecciona una de tus órdenes registradas.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Active Order Live Progress */}
              <div className="lg:col-span-8 space-y-6">
                {selectedOrder || publicTrack ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                      <div>
                        <p className="text-xs font-mono text-slate-500">
                          Código {selectedOrder?.trackingCode ?? publicTrack?.trackingCode} ·{' '}
                          {selectedOrder?.deviceCategory ?? publicTrack?.deviceCategory}
                        </p>
                        <h3 className="font-display font-bold text-2xl text-slate-900 mt-1">
                          {selectedOrder?.deviceModel ?? publicTrack?.deviceModel}
                        </h3>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-xs text-slate-500">Estado Actual</p>
                        <p className="text-base font-bold text-[#1D4ED8]">
                          {getStatusLabel(activeStatusKey)}
                        </p>
                      </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-[#1D4ED8] shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500">Tiempo Estimado Restante</p>
                          <p className="font-mono tabular-nums text-base font-bold text-slate-900">
                            {activeStatusKey === 'listo' || activeStatusKey === 'entregado'
                              ? '0 horas (Finalizado)'
                              : `${selectedOrder?.estimatedHours ?? publicTrack?.estimatedHours ?? 0} horas`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Laptop className="w-5 h-5 text-slate-700 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500">Presupuesto Total</p>
                          <p className="font-mono tabular-nums text-base font-bold text-slate-900">
                            {formatPyg(
                              selectedOrder?.estimatedCostPyg ?? publicTrack?.estimatedCostPyg ?? 0
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-[#15803D] shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500">Estado de Pago</p>
                          <p className="text-base font-bold text-slate-900">
                            {(selectedOrder?.paymentStatus ?? publicTrack?.paymentStatus) === 'pagado'
                              ? 'Pagado · Facturado'
                              : 'Pendiente de pago'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Visual Pipeline Stepper */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-3">
                        Progreso de Reparación en Laboratorio
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        {STATUS_PIPELINE.map((step, idx) => {
                          const completed = idx < activeStageIndex;
                          const current = idx === activeStageIndex;
                          return (
                            <div
                              key={step.key}
                              className={`p-3 rounded-lg border text-xs transition-colors ${
                                current
                                  ? 'border-[#1D4ED8] bg-blue-50/70 text-[#1D4ED8]'
                                  : completed
                                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                                  : 'border-slate-200 bg-white text-slate-400'
                              }`}
                            >
                              <p className="font-mono text-[11px] mb-1">0{idx + 1}</p>
                              <p className="font-semibold leading-snug">{step.shortLabel}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Technician Notes & Online Payment Action */}
                    {selectedOrder && (
                      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="text-sm">
                          <p className="text-xs text-slate-500">
                            Técnico asignado: <strong className="text-slate-800">{selectedOrder.assignedTechnician}</strong>
                          </p>
                          <p className="text-slate-700 mt-1">{selectedOrder.technicianNotes}</p>
                        </div>

                        <div className="shrink-0">
                          {selectedOrder.paymentStatus === 'pendiente' ? (
                            <button
                              type="button"
                              onClick={() => onOpenPaymentModal(selectedOrder, null)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <CreditCard className="w-4 h-4" />
                              Pagar desde Casa y Facturar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenPaymentModal(
                                  selectedOrder,
                                  myInvoices[selectedOrder.orderId] ?? null
                                )
                              }
                              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#15803D] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                              Ver Factura {selectedOrder.invoiceNumber}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Real-time Timeline */}
                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="text-sm font-display font-bold text-slate-900 mb-3">
                        Bitácora de Actualizaciones en Vivo
                      </h4>
                      {timeline.length > 0 ? (
                        <ul className="space-y-3">
                          {timeline.map((evt) => (
                            <li
                              key={evt.eventId}
                              className="flex items-start justify-between gap-4 text-sm pb-3 border-b border-slate-100 last:border-none"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {getStatusLabel(evt.status)} · {evt.message}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Por {evt.createdBy} · Restante estimado:{' '}
                                  <span className="font-mono tabular-nums">
                                    {evt.hoursRemaining} h
                                  </span>
                                </p>
                              </div>
                              <span className="text-xs font-mono text-slate-500 whitespace-nowrap shrink-0">
                                {formatTimestampPy(evt.createdAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : publicTrack ? (
                        <p className="text-sm text-slate-700">
                          Última actualización: {publicTrack.lastMessage}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Esperando nuevas actualizaciones del laboratorio.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                    <Search className="w-8 h-8 text-slate-400 mx-auto" />
                    <h3 className="font-display font-bold text-lg text-slate-900">
                      Consulta el estado de tu equipo al instante
                    </h3>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      Ingresa tu código de seguimiento arriba (por ejemplo <span className="font-mono">AT-7429K</span>) o inicia sesión con Google para ver todas tus órdenes y facturas.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubTab('solicitar')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer"
                    >
                      Crear Nueva Orden de Reparación
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: User Orders & Push Notification Inbox */}
              <div className="lg:col-span-4 space-y-6">
                {user && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-bold text-base text-slate-900">
                        Mis Equipos Registrados
                      </h4>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {myOrders.length}
                      </span>
                    </div>

                    {myOrders.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aún no registraste órdenes con esta cuenta.
                      </p>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {myOrders.map((ord) => {
                          const isSelected = ord.orderId === selectedOrderId;
                          return (
                            <button
                              key={ord.orderId}
                              type="button"
                              onClick={() => {
                                setSelectedOrderId(ord.orderId);
                                setActiveLookupCode(ord.trackingCode);
                                setLookupInput(ord.trackingCode);
                              }}
                              className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#1D4ED8] bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold text-[#1D4ED8]">
                                  {ord.trackingCode}
                                </span>
                                <span className="text-xs font-medium text-slate-600">
                                  {getStatusLabel(ord.status)}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
                                {ord.deviceModel}
                              </p>
                              <p className="text-xs font-mono tabular-nums text-slate-500 mt-1">
                                {formatPyg(ord.estimatedCostPyg)} · {ord.estimatedHours} h
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-bold text-base text-slate-900">
                      Notificaciones Push
                    </h4>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {notifications.filter((n) => !n.read).length} sin leer
                    </span>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Cuando nuestro equipo actualice el estado de tu reparación, recibirás alertas aquí y en tu navegador.
                    </p>
                  ) : (
                    <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <li
                          key={n.notificationId}
                          className={`p-3 rounded-lg border text-sm ${
                            n.read
                              ? 'border-slate-200 bg-white text-slate-600'
                              : 'border-blue-200 bg-blue-50/50 text-slate-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-xs">{n.title}</p>
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => void handleMarkNotificationRead(n.notificationId)}
                                className="text-[11px] font-semibold text-[#1D4ED8] hover:underline shrink-0 cursor-pointer"
                              >
                                Marcar leída
                              </button>
                            )}
                          </div>
                          <p className="text-xs mt-1 leading-relaxed">{n.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
