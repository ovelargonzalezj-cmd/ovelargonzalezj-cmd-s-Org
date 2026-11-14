import type { Timestamp } from 'firebase/firestore';

export type DeviceCategory = 'notebook' | 'smartphone' | 'desktop' | 'tablet' | 'consola' | 'otro';

export type RepairStatus =
  | 'recibido'
  | 'diagnostico'
  | 'en_reparacion'
  | 'control_calidad'
  | 'listo'
  | 'entregado';

export type PaymentStatus = 'pendiente' | 'pagado';
export type PaymentMethod = 'pendiente' | 'tarjeta' | 'transferencia_sipap' | 'billetera_electronica';

export interface ServiceOrder {
  orderId: string;
  trackingCode: string;
  ownerUid: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerRuc: string;
  deviceCategory: DeviceCategory;
  deviceModel: string;
  problemSummary: string;
  selectedIssues: string[];
  status: RepairStatus;
  estimatedHours: number;
  estimatedCostPyg: number;
  assignedTechnician: string;
  technicianNotes: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  invoiceNumber: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface OrderTimelineEvent {
  eventId: string;
  orderId: string;
  ownerUid: string;
  status: RepairStatus;
  message: string;
  hoursRemaining: number;
  createdBy: string;
  createdAt: Timestamp | null;
}

export interface PublicTracking {
  trackingCode: string;
  orderId: string;
  ownerUid: string;
  deviceCategory: DeviceCategory;
  deviceModel: string;
  status: RepairStatus;
  estimatedHours: number;
  estimatedCostPyg: number;
  paymentStatus: PaymentStatus;
  lastMessage: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  timbrado: string;
  orderId: string;
  trackingCode: string;
  ownerUid: string;
  customerName: string;
  customerRuc: string;
  customerEmail: string;
  deviceModel: string;
  concept: string;
  subtotalGravadaPyg: number;
  iva10Pyg: number;
  totalPyg: number;
  paymentMethod: Exclude<PaymentMethod, 'pendiente'>;
  authorizationCode: string;
  issuedAt: Timestamp | null;
}

export interface PushNotificationRecord {
  notificationId: string;
  ownerUid: string;
  orderId: string;
  trackingCode: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface CustomerRecord {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  ruc: string;
  city: string;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AIEstimateResult {
  estimatedCostPyg: number;
  minCostPyg: number;
  maxCostPyg: number;
  estimatedHours: number;
  recommendedService: string;
  diagnosisSummary: string;
  partsLikelyNeeded: string[];
  urgencyLevel: string;
}

export const SHOP_INFO = {
  brand: 'AsunciónTech',
  legalName: 'AsunciónTech Ingeniería y Soporte S.R.L.',
  ruc: '80094512-3',
  timbrado: '16849203',
  address: 'Av. Mariscal López 2450 c/ Choferes del Chaco',
  neighborhood: 'Barrio Villa Morra, Asunción, Paraguay',
  phoneDisplay: '(021) 614 890',
  phoneHref: 'tel:+59521614890',
  whatsappDisplay: '+595 981 450 820',
  whatsappHref: 'https://wa.me/595981450820?text=Hola%20Asunci%C3%B3nTech%2C%20necesito%20asistencia%20t%C3%A9cnica.',
  email: 'soporte@asunciontech.com.py',
  hoursWeekday: 'Lun a Vie: 08:30 – 18:30 hs',
  hoursSaturday: 'Sábados: 09:00 – 13:00 hs',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=-25.2917,-57.5818',
};

export const DEVICE_CATEGORIES: Array<{ id: DeviceCategory; label: string }> = [
  { id: 'notebook', label: 'Notebook / Ultrabook' },
  { id: 'smartphone', label: 'Smartphone' },
  { id: 'desktop', label: 'PC de Escritorio' },
  { id: 'tablet', label: 'Tablet / iPad' },
  { id: 'consola', label: 'Consola / Gaming' },
  { id: 'otro', label: 'Otro Equipo' },
];

export const COMMON_ISSUES: Array<{
  id: string;
  label: string;
  baseHours: number;
  baseCostPyg: number;
}> = [
  { id: 'no_enciende', label: 'No enciende o sin señal', baseHours: 16, baseCostPyg: 480000 },
  { id: 'pantalla_rota', label: 'Pantalla rota o con líneas', baseHours: 4, baseCostPyg: 590000 },
  { id: 'bateria_descarga', label: 'Batería agotada o hinchada', baseHours: 3, baseCostPyg: 310000 },
  { id: 'no_carga', label: 'Puerto de carga dañado', baseHours: 4, baseCostPyg: 240000 },
  { id: 'sobrecalentamiento', label: 'Sobrecalentamiento y ruido', baseHours: 2, baseCostPyg: 190000 },
  { id: 'liquido', label: 'Derrame de líquido / humedad', baseHours: 24, baseCostPyg: 550000 },
  { id: 'lento_sistema', label: 'Sistema lento / virus / SSD', baseHours: 3, baseCostPyg: 220000 },
  { id: 'teclado_bisagra', label: 'Teclado, bisagra o carcasa', baseHours: 5, baseCostPyg: 340000 },
];

export const STATUS_PIPELINE: Array<{
  key: RepairStatus;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    key: 'recibido',
    label: 'Equipo Recibido',
    shortLabel: 'Recibido',
    description: 'Ingreso registrado en laboratorio y etiquetado ESD.',
  },
  {
    key: 'diagnostico',
    label: 'En Diagnóstico',
    shortLabel: 'Diagnóstico',
    description: 'Pruebas electrónicas de placa, voltaje y componentes.',
  },
  {
    key: 'en_reparacion',
    label: 'En Reparación',
    shortLabel: 'Reparación',
    description: 'Intervención técnica, micro-soldadura o reemplazo de piezas.',
  },
  {
    key: 'control_calidad',
    label: 'Control de Calidad',
    shortLabel: 'Control QA',
    description: 'Pruebas de estrés térmico, carga y estabilidad final.',
  },
  {
    key: 'listo',
    label: 'Listo para Retiro',
    shortLabel: 'Listo',
    description: 'Equipo reparado y disponible en sucursal Villa Morra.',
  },
  {
    key: 'entregado',
    label: 'Entregado',
    shortLabel: 'Entregado',
    description: 'Equipo retirado con garantía escrita de 90 días.',
  },
];

export const TECHNICIANS = [
  'Por asignar',
  'Ing. Carlos Benítez (Micro-soldadura)',
  'Téc. Sofía Villalba (Apple & Móviles)',
  'Téc. Marcos Giménez (Notebooks & Gaming)',
  'Ing. Diego Ramírez (Datos & Sistemas)',
];

export function formatPyg(value: number): string {
  const safe = Math.max(0, Math.round(value || 0));
  return `Gs. ${new Intl.NumberFormat('es-PY').format(safe)}`;
}

export function formatTimestampPy(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Recién actualizado';
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts.toDate());
}

export function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `AT-${suffix}`;
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function getStatusLabel(status: RepairStatus): string {
  return STATUS_PIPELINE.find((s) => s.key === status)?.label ?? status;
}

export function clampStr(val: string, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}
