import React, { useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  CheckCircle2,
  CreditCard,
  Download,
  Landmark,
  Lock,
  Printer,
  Smartphone,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  formatPyg,
  generateSafeId,
  SHOP_INFO,
  type InvoiceRecord,
  type PaymentMethod,
  type ServiceOrder,
} from '../types';

interface PaymentAndInvoiceModalProps {
  order: ServiceOrder | null;
  existingInvoice: InvoiceRecord | null;
  onClose: () => void;
  onPaymentCompleted: (invoice: InvoiceRecord) => void;
  onEmitPush: (payload: {
    trackingCode: string;
    orderId: string;
    ownerUid: string;
    status: string;
    title: string;
    body: string;
    estimatedHours: number;
  }) => Promise<void>;
}

export const PaymentAndInvoiceModal: React.FC<PaymentAndInvoiceModalProps> = ({
  order,
  existingInvoice,
  onClose,
  onPaymentCompleted,
  onEmitPush,
}) => {
  const [method, setMethod] = useState<Exclude<PaymentMethod, 'pendiente'>>('tarjeta');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState(order?.customerName ?? '');
  const [sipapRef, setSipapRef] = useState('');
  const [walletPhone, setWalletPhone] = useState(order?.customerPhone ?? '');
  const [rucForInvoice, setRucForInvoice] = useState(order?.customerRuc || '44444401-7');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedInvoice, setGeneratedInvoice] = useState<InvoiceRecord | null>(existingInvoice);

  if (!order) return null;

  const activeInvoice = generatedInvoice ?? existingInvoice;

  const validatePayment = (): string | null => {
    if (method === 'tarjeta') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) {
        return 'Ingresa un número de tarjeta válido (13 a 19 dígitos).';
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
        return 'Ingresa el vencimiento en formato MM/AA.';
      }
      if (cardCvv.replace(/\D/g, '').length < 3) {
        return 'Ingresa el código de seguridad (CVV) de 3 o 4 dígitos.';
      }
      if (cardHolder.trim().length < 3) {
        return 'Ingresa el nombre del titular de la tarjeta.';
      }
    } else if (method === 'transferencia_sipap') {
      if (sipapRef.trim().length < 5) {
        return 'Ingresa el número de comprobante o referencia SIPAP.';
      }
    } else if (method === 'billetera_electronica') {
      if (walletPhone.replace(/\D/g, '').length < 9) {
        return 'Ingresa un número de celular paraguayo válido (ej. 0981 450 820).';
      }
    }
    return null;
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validatePayment();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setProcessing(true);
    try {
      const totalPyg = Math.max(10000, Math.round(order.estimatedCostPyg));
      const iva10Pyg = Math.round(totalPyg / 11);
      const subtotalGravadaPyg = totalPyg - iva10Pyg;

      const invoiceId = generateSafeId('inv');
      const randomSeq = String(Math.floor(100000 + Math.random() * 899999));
      const invoiceNumber = `001-001-${randomSeq}`;
      const authCode = `PY${Math.floor(100000 + Math.random() * 899999)}`;
      const notifId = generateSafeId('notif');

      const invoiceData: Omit<InvoiceRecord, 'issuedAt'> & { issuedAt: ReturnType<typeof serverTimestamp> } = {
        invoiceId,
        invoiceNumber,
        timbrado: SHOP_INFO.timbrado,
        orderId: order.orderId,
        trackingCode: order.trackingCode,
        ownerUid: order.ownerUid,
        customerName: order.customerName.slice(0, 100),
        customerRuc: (rucForInvoice.trim() || 'Sin RUC / Consumidor Final').slice(0, 25),
        customerEmail: order.customerEmail.slice(0, 120),
        deviceModel: order.deviceModel.slice(0, 120),
        concept: `Servicio técnico y reparación (${order.deviceModel}): ${order.selectedIssues.join(', ')}`.slice(0, 300),
        subtotalGravadaPyg,
        iva10Pyg,
        totalPyg,
        paymentMethod: method,
        authorizationCode: authCode,
        issuedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.update(doc(db, 'serviceOrders', order.orderId), {
        paymentStatus: 'pagado',
        paymentMethod: method,
        invoiceNumber,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'publicTracking', order.trackingCode), {
        paymentStatus: 'pagado',
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'invoices', invoiceId), invoiceData);
      batch.set(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        ownerUid: order.ownerUid,
        orderId: order.orderId,
        trackingCode: order.trackingCode,
        title: `Pago confirmado · ${order.trackingCode}`,
        body: `Factura ${invoiceNumber} emitida por ${formatPyg(totalPyg)}.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `serviceOrders/${order.orderId}`);
      }

      const finalInvoice: InvoiceRecord = {
        ...invoiceData,
        issuedAt: null,
      };
      setGeneratedInvoice(finalInvoice);
      onPaymentCompleted(finalInvoice);

      await onEmitPush({
        trackingCode: order.trackingCode,
        orderId: order.orderId,
        ownerUid: order.ownerUid,
        status: order.status,
        title: `Pago confirmado · ${order.trackingCode}`,
        body: `Se generó automáticamente la Factura N° ${invoiceNumber} por ${formatPyg(totalPyg)}.`,
        estimatedHours: order.estimatedHours,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No pudimos procesar el pago en línea. Verifica tu conexión e intenta nuevamente.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadInvoice = (inv: InvoiceRecord) => {
    const content = `========================================================
${SHOP_INFO.legalName}
RUC: ${SHOP_INFO.ruc} | Timbrado N°: ${SHOP_INFO.timbrado}
${SHOP_INFO.address} - ${SHOP_INFO.neighborhood}
Tel: ${SHOP_INFO.phoneDisplay} | WhatsApp: ${SHOP_INFO.whatsappDisplay}
========================================================
FACTURA CONTADO ELECTRÓNICA N°: ${inv.invoiceNumber}
Código de Autorización: ${inv.authorizationCode}
Orden de Servicio: ${inv.trackingCode}
--------------------------------------------------------
Cliente: ${inv.customerName}
RUC / C.I.: ${inv.customerRuc}
Correo: ${inv.customerEmail}
Equipo: ${inv.deviceModel}
--------------------------------------------------------
Concepto:
${inv.concept}

Gravada 10%: ${formatPyg(inv.subtotalGravadaPyg)}
Liquidación IVA (10%): ${formatPyg(inv.iva10Pyg)}
TOTAL ABONADO: ${formatPyg(inv.totalPyg)}
Método de Pago: ${inv.paymentMethod.replace('_', ' ').toUpperCase()}
========================================================
Garantía escrita de 90 días sobre repuestos y mano de obra.
Gracias por confiar en AsunciónTech Paraguay.`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Factura-${inv.invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between no-print">
          <div>
            <p className="text-xs font-mono text-slate-500">
              Orden {order.trackingCode} · {order.deviceModel}
            </p>
            <h3 className="font-display font-bold text-lg text-slate-900">
              {activeInvoice ? 'Factura Digital Generada' : 'Pago Seguro desde Casa'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeInvoice ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-900 text-sm no-print">
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
              <span>
                Transacción aprobada con código <strong className="font-mono">{activeInvoice.authorizationCode}</strong>. Tu factura fue generada y guardada automáticamente.
              </span>
            </div>

            <div
              id="printable-invoice"
              className="border border-slate-300 rounded-lg p-6 bg-white text-slate-900 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <h4 className="font-display font-bold text-xl text-slate-900">
                    {SHOP_INFO.legalName}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {SHOP_INFO.address} · {SHOP_INFO.neighborhood}
                  </p>
                  <p className="text-xs text-slate-600 font-mono">
                    Tel: {SHOP_INFO.phoneDisplay} · WhatsApp: {SHOP_INFO.whatsappDisplay}
                  </p>
                </div>
                <div className="sm:text-right font-mono text-xs space-y-1">
                  <p className="font-semibold text-slate-900">RUC: {SHOP_INFO.ruc}</p>
                  <p className="text-slate-600">Timbrado N°: {activeInvoice.timbrado}</p>
                  <p className="text-sm font-bold text-[#1D4ED8]">
                    FACTURA {activeInvoice.invoiceNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Razón Social / Cliente</p>
                  <p className="font-semibold text-slate-900 text-sm">{activeInvoice.customerName}</p>
                </div>
                <div>
                  <p className="text-slate-500">RUC / Cédula de Identidad</p>
                  <p className="font-mono font-semibold text-slate-900 text-sm">
                    {activeInvoice.customerRuc}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Orden de Servicio</p>
                  <p className="font-mono font-semibold text-slate-900">{activeInvoice.trackingCode}</p>
                </div>
                <div>
                  <p className="text-slate-500">Autorización Electrónica</p>
                  <p className="font-mono font-semibold text-slate-900">
                    {activeInvoice.authorizationCode}
                  </p>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-4">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Descripción del Servicio Técnico</span>
                  <span>Importe</span>
                </div>
                <div className="flex justify-between items-start gap-4 text-sm">
                  <span className="text-slate-800">{activeInvoice.concept}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatPyg(activeInvoice.totalPyg)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Gravada 10%</span>
                  <span className="font-mono tabular-nums">
                    {formatPyg(activeInvoice.subtotalGravadaPyg)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Liquidación IVA (10%)</span>
                  <span className="font-mono tabular-nums">{formatPyg(activeInvoice.iva10Pyg)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Pagado (Guaraníes)</span>
                  <span className="font-mono tabular-nums text-[#1D4ED8]">
                    {formatPyg(activeInvoice.totalPyg)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Documento válido como comprobante de pago en línea · Garantía técnica escrita por 90 días.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => handleDownloadInvoice(activeInvoice)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Descargar Comprobante
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePaySubmit} className="p-6 space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total a abonar por reparación</p>
                <p className="text-sm font-medium text-slate-800 mt-0.5">
                  {order.deviceModel} · {order.selectedIssues.slice(0, 2).join(', ')}
                </p>
              </div>
              <p className="font-mono tabular-nums text-xl font-bold text-slate-900">
                {formatPyg(order.estimatedCostPyg)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Selecciona tu método de pago en Paraguay
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('tarjeta')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-sm font-medium transition-colors cursor-pointer ${
                    method === 'tarjeta'
                      ? 'border-[#1D4ED8] bg-blue-50/70 text-[#1D4ED8]'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Tarjeta Bancard / Visa / MC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('transferencia_sipap')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-sm font-medium transition-colors cursor-pointer ${
                    method === 'transferencia_sipap'
                      ? 'border-[#1D4ED8] bg-blue-50/70 text-[#1D4ED8]'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Landmark className="w-4 h-4 shrink-0" />
                  <span>Transferencia SIPAP 24/7</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('billetera_electronica')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-sm font-medium transition-colors cursor-pointer ${
                    method === 'billetera_electronica'
                      ? 'border-[#1D4ED8] bg-blue-50/70 text-[#1D4ED8]'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Tigo Money / Personal Pay</span>
                </button>
              </div>
            </div>

            {method === 'tarjeta' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número de Tarjeta
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="4532 8910 2345 6789"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Vencimiento (MM/AA)
                    </label>
                    <input
                      type="text"
                      placeholder="09/29"
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">CVV</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre del Titular
                  </label>
                  <input
                    type="text"
                    placeholder="Como figura en la tarjeta"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
              </div>
            )}

            {method === 'transferencia_sipap' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-900">Datos para Transferencia SIPAP Instantánea:</p>
                  <p>Banco Itaú Paraguay · Cuenta Corriente N° <span className="font-mono">700481920</span></p>
                  <p>Alias RUC: <span className="font-mono font-semibold">{SHOP_INFO.ruc}</span> · {SHOP_INFO.legalName}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número de Comprobante SIPAP
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. SIPAP-9928174"
                    value={sipapRef}
                    onChange={(e) => setSipapRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
              </div>
            )}

            {method === 'billetera_electronica' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700">
                  Envía el monto exacto vía <strong>Tigo Money</strong> o <strong>Personal Pay</strong> a nuestra línea habilitada{' '}
                  <span className="font-mono font-semibold">{SHOP_INFO.whatsappDisplay}</span> e indica tu número emisor.
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tu Número de Billetera (09xx...)
                  </label>
                  <input
                    type="tel"
                    placeholder="0981 123 456"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                RUC o C.I. para la Factura Automática
              </label>
              <input
                type="text"
                placeholder="Ej. 4512890-3 o número de cédula"
                value={rucForInvoice}
                onChange={(e) => setRucForInvoice(e.target.value)}
                maxLength={25}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {errorMsg}
              </p>
            )}

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200">
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 text-[#15803D]" />
                Pago cifrado · Emisión instantánea de factura con IVA 10%
              </p>
              <button
                type="submit"
                disabled={processing}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {processing ? 'Procesando pago...' : `Pagar ${formatPyg(order.estimatedCostPyg)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
