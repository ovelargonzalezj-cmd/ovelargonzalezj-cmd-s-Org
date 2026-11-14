import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { BellRing, LogOut, MessageCircle, Phone, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from './firebase';
import { Navbar, type AppSection } from './components/Navbar';
import { HeroAndServices } from './components/HeroAndServices';
import { RepairIntakeAndTracker } from './components/RepairIntakeAndTracker';
import { AIAssistantSection } from './components/AIAssistantSection';
import { AdminDashboard } from './components/AdminDashboard';
import { PaymentAndInvoiceModal } from './components/PaymentAndInvoiceModal';
import {
  SHOP_INFO,
  type InvoiceRecord,
  type PushNotificationRecord,
  type ServiceOrder,
} from './types';

interface LivePushBanner {
  id: string;
  title: string;
  body: string;
  trackingCode: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>('inicio');
  const [trackerSubTab, setTrackerSubTab] = useState<'solicitar' | 'seguimiento'>('solicitar');
  const [prefillFromAI, setPrefillFromAI] = useState('');

  // Payment & Invoice modal state
  const [paymentOrder, setPaymentOrder] = useState<ServiceOrder | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);

  // Notifications & Push state
  const [notifications, setNotifications] = useState<PushNotificationRecord[]>([]);
  const [pushBanner, setPushBanner] = useState<LivePushBanner | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const wsRef = useRef<WebSocket | null>(null);
  const subscribedCodesRef = useRef<Set<string>>(new Set());
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  // Initialize Firebase connection check and Auth listener
  useEffect(() => {
    void testFirestoreConnection();
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  // Register Service Worker for Push Notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swRegRef.current = reg;
        })
        .catch(() => {
          // Ignore SW registration failure in restricted preview frames
        });
    }
  }, []);

  const showNativeBrowserNotification = useCallback(async (title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      if (swRegRef.current) {
        await swRegRef.current.showNotification(title, {
          body,
          tag: 'asunciontech-repair-update',
        });
      } else {
        new Notification(title, { body });
      }
    } catch {
      // Fallback safely if frame restricts native notifications
    }
  }, []);

  // Real-time Firestore listener for user's notifications
  useEffect(() => {
    if (!authReady || !user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PushNotificationRecord[] = [];
        snap.forEach((d) => list.push(d.data() as PushNotificationRecord));
        setNotifications(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Real-time WebSocket connection for instant Push Events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            trackingCodes: Array.from(subscribedCodesRef.current),
            ownerUid: user?.uid,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type?: string;
            trackingCode?: string;
            title?: string;
            body?: string;
          };
          if (data.type === 'order:updated' && data.title && data.body) {
            const bannerId = `push_${Date.now()}`;
            setPushBanner({
              id: bannerId,
              title: data.title,
              body: data.body,
              trackingCode: data.trackingCode ?? '',
            });
            void showNativeBrowserNotification(data.title, data.body);
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = () => {
        if (active) {
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };
    };

    connectWs();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [user?.uid, showNativeBrowserNotification]);

  const subscribeTrackingCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return;
      subscribedCodesRef.current.add(normalized);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'subscribe',
            trackingCode: normalized,
            ownerUid: user?.uid,
          })
        );
      }
    },
    [user?.uid]
  );

  const emitPushNotification = useCallback(
    async (payload: {
      trackingCode: string;
      orderId: string;
      ownerUid: string;
      status: string;
      title: string;
      body: string;
      estimatedHours: number;
    }) => {
      subscribeTrackingCode(payload.trackingCode);
      try {
        await fetch('/api/push/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // Non-blocking fallback
      }
    },
    [subscribeTrackingCode]
  );

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }
    const result = await Notification.requestPermission();
    setPushPermission(result);
    if (result === 'granted') {
      await showNativeBrowserNotification(
        'AsunciónTech · Alertas Activadas',
        'Recibirás notificaciones en tiempo real sobre el progreso de tu equipo.'
      );
    }
  };

  const scrollToAnchor = (anchorId?: string) => {
    if (!anchorId) return;
    setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  const handleNavigate = (section: AppSection, anchorId?: string) => {
    setActiveSection(section);
    if (anchorId === 'solicitar-reparacion') {
      setTrackerSubTab('solicitar');
    } else if (anchorId === 'portal-seguimiento') {
      setTrackerSubTab('seguimiento');
    }
    scrollToAnchor(anchorId);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
        <Navbar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          unreadNotifications={unreadCount}
        />

        {/* Quiet Auth Strip when signed in */}
        {user && (
          <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 sm:px-6 lg:px-8 no-print">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <span className="truncate">
                Sesión activa: <strong className="text-white">{user.displayName || user.email}</strong>{' '}
                <span className="text-slate-400">({user.email})</span>
              </span>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">
          <HeroAndServices
            onStartRepair={() => {
              setTrackerSubTab('solicitar');
              setActiveSection('seguimiento');
              scrollToAnchor('portal-seguimiento');
            }}
            onGoToTracking={() => {
              setTrackerSubTab('seguimiento');
              setActiveSection('seguimiento');
              scrollToAnchor('portal-seguimiento');
            }}
            onOpenAssistant={() => {
              setActiveSection('asistente');
              scrollToAnchor('asistente-ia');
            }}
          />

          <RepairIntakeAndTracker
            user={user}
            initialSubTab={trackerSubTab}
            prefillDescription={prefillFromAI}
            onOpenPaymentModal={(order, inv) => {
              setPaymentOrder(order);
              setPaymentInvoice(inv);
            }}
            onEmitPush={emitPushNotification}
            onSubscribeTrackingCode={subscribeTrackingCode}
            pushPermission={pushPermission}
            onRequestPushPermission={handleRequestPushPermission}
            notifications={notifications}
          />

          <AIAssistantSection
            onTransferToIntake={(summaryText) => {
              setPrefillFromAI(summaryText);
              setTrackerSubTab('solicitar');
              setActiveSection('seguimiento');
              scrollToAnchor('portal-seguimiento');
            }}
          />

          <AdminDashboard
            user={user}
            onEmitPush={emitPushNotification}
            onOpenInvoice={(ord, inv) => {
              setPaymentOrder(ord);
              setPaymentInvoice(inv);
            }}
          />
        </main>

        {/* Quiet Footer */}
        <footer className="bg-slate-950 text-slate-300 py-12 border-t border-slate-800 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800">
              <div>
                <p className="font-display font-bold text-lg text-white">{SHOP_INFO.brand}</p>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  {SHOP_INFO.legalName}
                  <br />
                  RUC: <span className="font-mono">{SHOP_INFO.ruc}</span> · Timbrado:{' '}
                  <span className="font-mono">{SHOP_INFO.timbrado}</span>
                </p>
              </div>

              <div className="text-sm space-y-1.5">
                <p className="font-semibold text-white">Local en Paraguay</p>
                <p className="text-slate-400">{SHOP_INFO.address}</p>
                <p className="text-slate-400">{SHOP_INFO.neighborhood}</p>
                <p className="text-slate-400">
                  {SHOP_INFO.hoursWeekday} · {SHOP_INFO.hoursSaturday}
                </p>
              </div>

              <div className="text-sm space-y-2">
                <p className="font-semibold text-white">Atención Directa</p>
                <div className="flex flex-col gap-1.5">
                  <a
                    href={SHOP_INFO.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp {SHOP_INFO.whatsappDisplay}
                  </a>
                  <a
                    href={SHOP_INFO.phoneHref}
                    className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
                  >
                    <Phone className="w-4 h-4" />
                    Teléfono {SHOP_INFO.phoneDisplay}
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <p>© {new Date().getFullYear()} {SHOP_INFO.brand}. Todos los derechos reservados.</p>
              {!user && (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Acceso Clientes y Personal Técnico
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* Live WebSocket Push Toast Banner */}
        {pushBanner && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-4 shadow-lg no-print">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <BellRing className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">{pushBanner.title}</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{pushBanner.body}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar notificación"
                onClick={() => setPushBanner(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Payment & Automatic Digital Invoice Modal */}
        <PaymentAndInvoiceModal
          order={paymentOrder}
          existingInvoice={paymentInvoice}
          onClose={() => {
            setPaymentOrder(null);
            setPaymentInvoice(null);
          }}
          onPaymentCompleted={(inv) => {
            setPaymentInvoice(inv);
          }}
          onEmitPush={emitPushNotification}
        />
      </div>
    </MotionConfig>
  );
}
