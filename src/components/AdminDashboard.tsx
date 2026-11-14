import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  BellRing,
  CheckCircle2,
  FileText,
  Lock,
  Plus,
  Search,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  db,
  handleFirestoreError,
  isUserAdmin,
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
  TECHNICIANS,
  type CustomerRecord,
  type DeviceCategory,
  type InvoiceRecord,
  type RepairStatus,
  type ServiceOrder,
} from '../types';

interface AdminDashboardProps {
  user: User | null;
  onEmitPush: (payload: {
    trackingCode: string;
    orderId: string;
    ownerUid: string;
    status: string;
    title: string;
    body: string;
    estimatedHours: number;
  }) => Promise<void>;
  onOpenInvoice: (order: ServiceOrder, invoice: InvoiceRecord) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  onEmitPush,
  onOpenInvoice,
}) => {
  const isAdmin = isUserAdmin(user);

  const [adminTab, setAdminTab] = useState<'ordenes' | 'crear' | 'clientes'>('ordenes');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'todas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected order editor
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  const [editStatus, setEditStatus] = useState<RepairStatus>('recibido');
  const [editTech, setEditTech] = useState(TECHNICIANS[0]);
  const [editHours, setEditHours] = useState<number>(4);
  const [editCost, setEditCost] = useState<number>(250000);
  const [editNotes, setEditNotes] = useState('');
  const [timelineMessage, setTimelineMessage] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState('');

  // New Order Form (Admin Desk)
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerRuc, setNewCustomerRuc] = useState('');
  const [newCategory, setNewCategory] = useState<DeviceCategory>('notebook');
  const [newModel, setNewModel] = useState('');
  const [newProblem, setNewProblem] = useState('');
  const [newTech, setNewTech] = useState(TECHNICIANS[1]);
  const [newHours, setNewHours] = useState(6);
  const [newCost, setNewCost] = useState(350000);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // New Customer Directory Form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custRuc, setCustRuc] = useState('');
  const [custCity, setCustCity] = useState('Asunción');
  const [custNotes, setCustNotes] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setOrders([]);
      setCustomers([]);
      setInvoices([]);
      return;
    }

    setLoadingData(true);

    const unsubOrders = onSnapshot(
      query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list: ServiceOrder[] = [];
        snap.forEach((d) => list.push(d.data() as ServiceOrder));
        setOrders(list);
        setLoadingData(false);
      },
      (err) => {
        setLoadingData(false);
        handleFirestoreError(err, OperationType.LIST, 'serviceOrders');
      }
    );

    const unsubCustomers = onSnapshot(
      query(collection(db, 'customers'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list: CustomerRecord[] = [];
        snap.forEach((d) => list.push(d.data() as CustomerRecord));
        setCustomers(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'customers');
      }
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), orderBy('issuedAt', 'desc')),
      (snap) => {
        const list: InvoiceRecord[] = [];
        snap.forEach((d) => list.push(d.data() as InvoiceRecord));
        setInvoices(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      }
    );

    return () => {
      unsubOrders();
      unsubCustomers();
      unsubInvoices();
    };
  }, [isAdmin]);

  const selectOrderForEdit = (ord: ServiceOrder) => {
    setActiveOrder(ord);
    setEditStatus(ord.status);
    setEditTech(ord.assignedTechnician);
    setEditHours(ord.estimatedHours);
    setEditCost(ord.estimatedCostPyg);
    setEditNotes(ord.technicianNotes);
    setTimelineMessage('');
    setAdminFeedback('');
  };

  const handleSaveOrderUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !user) return;
    setSavingOrder(true);
    setAdminFeedback('');

    try {
      const msg =
        timelineMessage.trim() ||
        `Estado actualizado a "${getStatusLabel(editStatus)}" por ${editTech}.`;
      const eventId = generateSafeId('evt');
      const notifId = generateSafeId('notif');
      const safeHours = Math.max(0, Math.min(720, Number(editHours) || 0));
      const safeCost = Math.max(0, Math.min(100000000, Math.round(Number(editCost) || 0)));

      const batch = writeBatch(db);
      batch.update(doc(db, 'serviceOrders', activeOrder.orderId), {
        status: editStatus,
        assignedTechnician: clampStr(editTech, 80),
        estimatedHours: Math.max(1, safeHours),
        estimatedCostPyg: safeCost,
        technicianNotes: clampStr(editNotes || msg, 600),
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(db, 'publicTracking', activeOrder.trackingCode), {
        status: editStatus,
        estimatedHours: safeHours,
        estimatedCostPyg: safeCost,
        lastMessage: clampStr(msg, 300),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'serviceOrders', activeOrder.orderId, 'timeline', eventId), {
        eventId,
        orderId: activeOrder.orderId,
        ownerUid: activeOrder.ownerUid,
        status: editStatus,
        message: clampStr(msg, 300),
        hoursRemaining: safeHours,
        createdBy: clampStr(editTech, 80),
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        ownerUid: activeOrder.ownerUid,
        orderId: activeOrder.orderId,
        trackingCode: activeOrder.trackingCode,
        title: `${activeOrder.trackingCode} · ${getStatusLabel(editStatus)}`,
        body: clampStr(`${msg} (Tiempo restante: ${safeHours} h)`, 300),
        read: false,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `serviceOrders/${activeOrder.orderId}`);
      }

      await onEmitPush({
        trackingCode: activeOrder.trackingCode,
        orderId: activeOrder.orderId,
        ownerUid: activeOrder.ownerUid,
        status: editStatus,
        title: `Actualización ${activeOrder.trackingCode} · ${getStatusLabel(editStatus)}`,
        body: `${msg} · Tiempo estimado: ${safeHours} h`,
        estimatedHours: safeHours,
      });

      setAdminFeedback(
        `Orden ${activeOrder.trackingCode} actualizada y notificación push enviada al cliente.`
      );
      setTimelineMessage('');
      setActiveOrder({
        ...activeOrder,
        status: editStatus,
        assignedTechnician: editTech,
        estimatedHours: safeHours,
        estimatedCostPyg: safeCost,
        technicianNotes: editNotes || msg,
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleAdminCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreatingOrder(true);
    setAdminFeedback('');

    try {
      const orderId = generateSafeId('ord');
      const trackingCode = generateTrackingCode();
      const eventId = generateSafeId('evt');
      const custId = generateSafeId('cust');

      const safeName = clampStr(newCustomerName, 100);
      const safePhone = clampStr(newCustomerPhone, 30);
      const safeEmail = clampStr(newCustomerEmail || 'recepcion@asunciontech.com.py', 120);
      const safeRuc = clampStr(newCustomerRuc, 25);
      const safeModel = clampStr(newModel, 120);
      const safeProblem = clampStr(newProblem, 600);
      const safeHours = Math.max(1, Math.min(720, Number(newHours) || 4));
      const safeCost = Math.max(0, Math.round(Number(newCost) || 0));

      const batch = writeBatch(db);

      batch.set(doc(db, 'serviceOrders', orderId), {
        orderId,
        trackingCode,
        ownerUid: user.uid,
        customerName: safeName,
        customerEmail: safeEmail,
        customerPhone: safePhone,
        customerRuc: safeRuc,
        deviceCategory: newCategory,
        deviceModel: safeModel,
        problemSummary: safeProblem,
        selectedIssues: [COMMON_ISSUES[0].label],
        status: 'recibido',
        estimatedHours: safeHours,
        estimatedCostPyg: safeCost,
        assignedTechnician: clampStr(newTech, 80),
        technicianNotes: 'Orden creada directamente en recepción por personal técnico.',
        paymentStatus: 'pendiente',
        paymentMethod: 'pendiente',
        invoiceNumber: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'serviceOrders', orderId, 'timeline', eventId), {
        eventId,
        orderId,
        ownerUid: user.uid,
        status: 'recibido',
        message: `Ingreso en mostrador Villa Morra. Asignado a ${newTech}.`,
        hoursRemaining: safeHours,
        createdBy: clampStr(newTech, 80),
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'publicTracking', trackingCode), {
        trackingCode,
        orderId,
        ownerUid: user.uid,
        deviceCategory: newCategory,
        deviceModel: safeModel,
        status: 'recibido',
        estimatedHours: safeHours,
        estimatedCostPyg: safeCost,
        paymentStatus: 'pendiente',
        lastMessage: `Ingreso en laboratorio AsunciónTech. Estimado: ${safeHours} hs.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'customers', custId), {
        customerId: custId,
        name: safeName,
        phone: safePhone,
        email: safeEmail,
        ruc: safeRuc,
        city: 'Asunción',
        notes: `Primer equipo registrado: ${safeModel} (${trackingCode})`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `serviceOrders/${orderId}`);
      }

      setAdminFeedback(
        `Orden ${trackingCode} creada y cliente ${safeName} registrado en el directorio.`
      );
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerRuc('');
      setNewModel('');
      setNewProblem('');
      setAdminTab('ordenes');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustomer(true);
    setAdminFeedback('');
    try {
      const custId = generateSafeId('cust');
      try {
        await setDoc(doc(db, 'customers', custId), {
          customerId: custId,
          name: clampStr(custName, 100),
          phone: clampStr(custPhone, 30),
          email: clampStr(custEmail, 120),
          ruc: clampStr(custRuc, 25),
          city: clampStr(custCity || 'Asunción', 60),
          notes: clampStr(custNotes, 400),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `customers/${custId}`);
      }

      setAdminFeedback(`Cliente ${custName} guardado en el directorio centralizado.`);
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCustRuc('');
      setCustNotes('');
    } finally {
      setSavingCustomer(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = statusFilter === 'todas' || ord.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ord.trackingCode.toLowerCase().includes(q) ||
      ord.deviceModel.toLowerCase().includes(q) ||
      ord.customerName.toLowerCase().includes(q) ||
      ord.customerPhone.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const activeCount = orders.filter((o) => o.status !== 'entregado').length;
  const inLabCount = orders.filter(
    (o) => o.status === 'diagnostico' || o.status === 'en_reparacion'
  ).length;
  const readyCount = orders.filter((o) => o.status === 'listo').length;
  const totalBilledPyg = invoices.reduce((sum, inv) => sum + inv.totalPyg, 0);

  return (
    <section id="panel-admin" className="py-16 lg:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-sm font-medium text-[#1D4ED8] mb-2">
              Gestión centralizada para personal técnico
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-slate-900 tracking-tight">
              Panel Administrativo de Órdenes de Servicio
            </h2>
          </div>

          {isAdmin && (
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setAdminTab('ordenes')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  adminTab === 'ordenes'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Órdenes ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('crear')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  adminTab === 'crear'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nueva Orden
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('clientes')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  adminTab === 'clientes'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clientes y Facturas
              </button>
            </div>
          )}
        </div>

        {!user ? (
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
            <Lock className="w-8 h-8 text-slate-700 mx-auto" />
            <h3 className="font-display font-bold text-xl text-slate-900">
              Acceso Exclusivo de Administración Técnica
            </h3>
            <p className="text-sm text-slate-600">
              Inicia sesión con tu cuenta autorizada (<span className="font-mono">{ADMIN_EMAIL}</span>) para crear órdenes, asignar técnicos, actualizar estados con alertas push y gestionar clientes.
            </p>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Ingresar con Cuenta Google de Administrador
            </button>
          </div>
        ) : !isAdmin ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 max-w-2xl mx-auto space-y-2 text-sm text-amber-950">
            <p className="font-bold">Acceso restringido por rol técnico</p>
            <p>
              Iniciaste sesión como <span className="font-mono">{user.email}</span>. El panel administrativo está reservado para el administrador autorizado (<span className="font-mono">{ADMIN_EMAIL}</span>). Puedes utilizar el portal de clientes arriba para cotizar, seguir reparaciones y abonar facturas.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Admin KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Órdenes Activas</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                  {activeCount}
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">En Banco de Trabajo</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-[#1D4ED8] mt-1">
                  {inLabCount}
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Listas para Retiro</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-[#15803D] mt-1">
                  {readyCount}
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Facturación Confirmada</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                  {formatPyg(totalBilledPyg)}
                </p>
              </div>
            </div>

            {adminFeedback && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-950 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                <span>{adminFeedback}</span>
              </div>
            )}

            {adminTab === 'ordenes' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Orders Table */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-200 space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por código AT-, equipo, cliente o teléfono..."
                        className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('todas')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                          statusFilter === 'todas'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Todas
                      </button>
                      {STATUS_PIPELINE.map((st) => (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => setStatusFilter(st.key)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                            statusFilter === st.key
                              ? 'bg-[#1D4ED8] text-white'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingData ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      Cargando órdenes de servicio...
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500 space-y-3">
                      <p>No hay órdenes que coincidan con el filtro actual.</p>
                      <button
                        type="button"
                        onClick={() => setAdminTab('crear')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Crear primera orden
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs text-slate-500">
                            <th className="py-2.5 px-4 font-semibold">Código</th>
                            <th className="py-2.5 px-4 font-semibold">Equipo y Cliente</th>
                            <th className="py-2.5 px-4 font-semibold">Estado</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Horas / Gs.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.map((ord) => {
                            const selected = activeOrder?.orderId === ord.orderId;
                            return (
                              <tr
                                key={ord.orderId}
                                onClick={() => selectOrderForEdit(ord)}
                                className={`cursor-pointer transition-colors ${
                                  selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1D4ED8] whitespace-nowrap">
                                  {ord.trackingCode}
                                </td>
                                <td className="py-3 px-4">
                                  <p className="font-semibold text-slate-900 truncate max-w-[200px]">
                                    {ord.deviceModel}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                    {ord.customerName} · {ord.assignedTechnician}
                                  </p>
                                </td>
                                <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                                  {getStatusLabel(ord.status)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                                  <p className="font-semibold text-slate-900">
                                    {formatPyg(ord.estimatedCostPyg)}
                                  </p>
                                  <p className="text-slate-500">{ord.estimatedHours} h</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Order Management Drawer */}
                <div className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6">
                  {activeOrder ? (
                    <form onSubmit={handleSaveOrderUpdate} className="space-y-4">
                      <div className="pb-3 border-b border-slate-200">
                        <p className="text-xs font-mono text-[#1D4ED8] font-semibold">
                          Editando {activeOrder.trackingCode}
                        </p>
                        <h3 className="font-display font-bold text-lg text-slate-900">
                          {activeOrder.deviceModel}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          Cliente: {activeOrder.customerName} ({activeOrder.customerPhone})
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Falla reportada: {activeOrder.problemSummary}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Estado de Reparación
                          </label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as RepairStatus)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          >
                            {STATUS_PIPELINE.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Técnico Asignado
                          </label>
                          <select
                            value={editTech}
                            onChange={(e) => setEditTech(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          >
                            {TECHNICIANS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Horas Estimadas Restantes
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={720}
                            value={editHours}
                            onChange={(e) => setEditHours(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Presupuesto Final (Gs.)
                          </label>
                          <input
                            type="number"
                            step={10000}
                            min={0}
                            value={editCost}
                            onChange={(e) => setEditCost(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Notas Técnicas de Laboratorio
                        </label>
                        <textarea
                          rows={2}
                          maxLength={600}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mensaje Push para el Cliente
                        </label>
                        <input
                          type="text"
                          maxLength={300}
                          value={timelineMessage}
                          onChange={(e) => setTimelineMessage(e.target.value)}
                          placeholder="Ej. Reemplazo de pantalla OLED completado, iniciando pruebas QA."
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingOrder}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                      >
                        <BellRing className="w-4 h-4" />
                        {savingOrder
                          ? 'Guardando y enviando push...'
                          : 'Guardar Cambios y Notificar Push'}
                      </button>
                    </form>
                  ) : (
                    <div className="py-12 text-center text-sm text-slate-500 space-y-2">
                      <Wrench className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="font-semibold text-slate-700">
                        Selecciona una orden del listado
                      </p>
                      <p>
                        Desde aquí podrás asignar técnicos, actualizar horas restantes, ajustar el
                        presupuesto y emitir notificaciones push al cliente.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {adminTab === 'crear' && (
              <form
                onSubmit={handleAdminCreateOrder}
                className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 sm:p-8 max-w-3xl space-y-5"
              >
                <h3 className="font-display font-bold text-xl text-slate-900">
                  Crear Orden de Servicio y Registrar Cliente
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre del Cliente
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Nombre y Apellido"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Teléfono
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={30}
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="0981 000 000"
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      maxLength={120}
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="cliente@correo.com"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      RUC / C.I.
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      value={newCustomerRuc}
                      onChange={(e) => setNewCustomerRuc(e.target.value)}
                      placeholder="4512890-3"
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Categoría
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as DeviceCategory)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {DEVICE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Modelo del Equipo
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      placeholder="Ej. ASUS ROG Strix G15"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Diagnóstico / Problema Reportado
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={600}
                    value={newProblem}
                    onChange={(e) => setNewProblem(e.target.value)}
                    placeholder="Detalle del ingreso en recepción"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Técnico Asignado
                    </label>
                    <select
                      value={newTech}
                      onChange={(e) => setNewTech(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {TECHNICIANS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Horas Estimadas
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={newHours}
                      onChange={(e) => setNewHours(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Presupuesto (Gs.)
                    </label>
                    <input
                      type="number"
                      step={10000}
                      min={0}
                      value={newCost}
                      onChange={(e) => setNewCost(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingOrder}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {creatingOrder ? 'Creando orden...' : 'Registrar Orden en Laboratorio'}
                </button>
              </form>
            )}

            {adminTab === 'clientes' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Register Customer Form */}
                <form
                  onSubmit={handleRegisterCustomer}
                  className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-[#1D4ED8]" />
                    <h3 className="font-display font-bold text-lg text-slate-900">
                      Registrar Cliente
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre / Razón Social
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Teléfono / WhatsApp
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={30}
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        RUC / C.I.
                      </label>
                      <input
                        type="text"
                        maxLength={25}
                        value={custRuc}
                        onChange={(e) => setCustRuc(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Correo
                      </label>
                      <input
                        type="email"
                        maxLength={120}
                        value={custEmail}
                        onChange={(e) => setCustEmail(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        value={custCity}
                        onChange={(e) => setCustCity(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observaciones
                    </label>
                    <input
                      type="text"
                      maxLength={400}
                      value={custNotes}
                      onChange={(e) => setCustNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingCustomer}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    {savingCustomer ? 'Guardando...' : 'Guardar en Directorio'}
                  </button>
                </form>

                {/* Customers & Invoices Lists */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        Clientes Registrados ({customers.length})
                      </h4>
                    </div>
                    {customers.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aún no hay clientes registrados en el directorio.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {customers.map((c) => (
                          <div key={c.customerId} className="py-2.5 flex justify-between gap-4 text-sm">
                            <div>
                              <p className="font-semibold text-slate-900">{c.name}</p>
                              <p className="text-xs text-slate-500">
                                {c.city} · RUC {c.ruc || 'S/D'} · {c.email || 'Sin correo'}
                              </p>
                            </div>
                            <span className="font-mono text-xs text-slate-700 shrink-0">
                              {c.phone}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-[#15803D]" />
                      Facturas Emitidas Automáticamente ({invoices.length})
                    </h4>
                    {invoices.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Las facturas electrónicas aparecerán aquí en cuanto los clientes completen
                        su pago en línea.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {invoices.map((inv) => {
                          const relatedOrder = orders.find((o) => o.orderId === inv.orderId);
                          return (
                            <div
                              key={inv.invoiceId}
                              className="py-2.5 flex items-center justify-between gap-4 text-sm"
                            >
                              <div>
                                <p className="font-mono text-xs font-bold text-[#1D4ED8]">
                                  {inv.invoiceNumber} · {inv.trackingCode}
                                </p>
                                <p className="font-semibold text-slate-900">
                                  {inv.customerName} ({inv.deviceModel})
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatTimestampPy(inv.issuedAt)}
                                </p>
                              </div>
                              <div className="text-right shrink-0 space-y-1">
                                <p className="font-mono tabular-nums font-bold text-slate-900">
                                  {formatPyg(inv.totalPyg)}
                                </p>
                                {relatedOrder && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenInvoice(relatedOrder, inv)}
                                    className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                                  >
                                    Ver Factura
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
