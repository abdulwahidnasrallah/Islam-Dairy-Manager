import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { supplierPaymentService } from "@/services/supplierPaymentService";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Download, XCircle } from "lucide-react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/Button";
import { purchaseInvoiceService } from "@/services/purchaseInvoiceService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";

const statusLabel: Record<string, string> = {
  CONFIRMED: "سارية",
  CANCELLED: "ملغاة",
};

const paymentStatusLabel: Record<string, string> = {
  UNPAID: "غير مدفوعة",
  PARTIAL: "مدفوعة جزئياً",
  PAID: "مدفوعة بالكامل",
};

const paymentMethodLabel: Record<string, string> = {
  CASH: "نقدي",
  BANK: "بنكي",
  OTHER: "أخرى",
};

/** Mirrors InvoiceViewPage.tsx (sales) exactly — same print/QR/PNG-export pattern, applied to a supplier purchase invoice instead of a sales invoice. */
export default function PurchaseInvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK" | "OTHER">("CASH");
  const [payError, setPayError] = useState<string | null>(null);
  // Same key on a double click / retry => the payment is recorded once.
  const payKeyRef = useRef<string>(crypto.randomUUID());

  const { data: purchaseInvoice, isLoading } = useQuery({
    queryKey: ["purchase-invoice", id],
    queryFn: () => purchaseInvoiceService.getById(id!),
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => purchaseInvoiceService.cancel(id!),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoice", id] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["supplier", purchaseInvoice?.supplierId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const payMutation = useMutation({
    mutationFn: () =>
      supplierPaymentService.create({
        supplierId: purchaseInvoice!.supplierId,
        purchaseInvoiceId: purchaseInvoice!.id,
        amount: Number(payAmount),
        date: new Date(),
        method: payMethod,
        idempotencyKey: payKeyRef.current,
      }),
    onSuccess: () => {
      payKeyRef.current = crypto.randomUUID();
      setPayAmount("");
      setPayError(null);
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoice", id] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["supplier", purchaseInvoice?.supplierId] });
      void queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => {
      setPayError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  useEffect(() => {
    if (!purchaseInvoice) return;
    const payload = JSON.stringify({
      purchaseNumber: purchaseInvoice.purchaseNumber,
      total: purchaseInvoice.totalAmount,
      date: purchaseInvoice.date,
    });
    QRCode.toDataURL(payload, { margin: 1, width: 140 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [purchaseInvoice]);

  async function exportAsPng() {
    if (!printRef.current || !purchaseInvoice) return;
    const canvas = await html2canvas(printRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `${purchaseInvoice.purchaseNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (isLoading || !purchaseInvoice) {
    return <p className="text-sm text-gray-400">جاري التحميل...</p>;
  }

  const isCash = purchaseInvoice.remainingAmount <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => navigate("/purchase-invoices")}>
          العودة إلى فواتير الشراء
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> طباعة
          </Button>
          <Button type="button" variant="secondary" onClick={() => void exportAsPng()}>
            <Download size={16} /> تصدير PNG
          </Button>
          {purchaseInvoice.status === "CONFIRMED" && (
            <Button
              type="button"
              variant="danger"
              isLoading={cancelMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `هل تريد إلغاء فاتورة الشراء "${purchaseInvoice.purchaseNumber}"؟\n\nسيتم إرجاع الكميات المشتراة من المخزون، ولن تُحتسب هذه الفاتورة ضمن رصيد المورد أو التقارير بعد الآن.`,
                  )
                ) {
                  cancelMutation.mutate();
                }
              }}
            >
              <XCircle size={16} /> إلغاء الفاتورة
            </Button>
          )}
        </div>
      </div>

      {error && <p className="no-print text-sm text-danger">{error}</p>}

      {purchaseInvoice.status === "CONFIRMED" && purchaseInvoice.remainingAmount > 0 && (
        <form
          className="no-print mx-auto flex w-full max-w-lg flex-wrap items-end gap-3 rounded border border-gray-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPayError(null);
            const value = Number(payAmount);
            if (!payAmount || value <= 0) {
              setPayError("أدخل مبلغاً صحيحاً");
              return;
            }
            if (value > purchaseInvoice.remainingAmount) {
              setPayError(
                `المبلغ أكبر من المتبقي على الفاتورة (${formatCurrency(purchaseInvoice.remainingAmount, purchaseInvoice.currency)})`,
              );
              return;
            }
            if (payMutation.isPending) return;
            payMutation.mutate();
          }}
        >
          <Input
            label={`تسجيل دفعة (المتبقي ${formatCurrency(purchaseInvoice.remainingAmount, purchaseInvoice.currency)})`}
            type="number"
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="w-40"
          />
          <select
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
          >
            <option value="CASH">نقدي</option>
            <option value="BANK">بنكي</option>
            <option value="OTHER">أخرى</option>
          </select>
          <Button type="submit" isLoading={payMutation.isPending}>
            تسجيل الدفعة
          </Button>
          {payError && <p className="w-full text-sm text-danger">{payError}</p>}
        </form>
      )}

      <div id="printable-invoice" ref={printRef} className="card mx-auto w-full max-w-lg">
        <div className="flex flex-col gap-4 p-2" dir="rtl">
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">{purchaseInvoice.storeName}</h1>
            {purchaseInvoice.storePhone && (
              <p className="text-xs text-gray-500">{purchaseInvoice.storePhone}</p>
            )}
            {purchaseInvoice.storeAddress && (
              <p className="text-xs text-gray-500">{purchaseInvoice.storeAddress}</p>
            )}
          </div>

          <div className="flex items-start justify-between border-y border-dashed border-gray-200 py-3 text-sm">
            <div>
              <p className="text-gray-500">رقم فاتورة الشراء</p>
              <p className="font-bold">{purchaseInvoice.purchaseNumber}</p>
              <p className="mt-2 text-gray-500">التاريخ والوقت</p>
              <p className="font-bold">
                {new Date(purchaseInvoice.date).toLocaleString("ar-EG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="mt-2 text-gray-500">المورد</p>
              <p className="font-bold">{purchaseInvoice.supplierName ?? "—"}</p>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" width={100} height={100} />}
          </div>

          {purchaseInvoice.status === "CANCELLED" && (
            <p className="rounded bg-danger/10 py-1 text-center text-sm font-bold text-danger">
              فاتورة ملغاة
            </p>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1 text-right">المنتج</th>
                <th className="py-1 text-center">الكمية</th>
                <th className="py-1 text-center">السعر</th>
                <th className="py-1 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {purchaseInvoice.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-1.5">{item.productName ?? item.productId}</td>
                  <td className="py-1.5 text-center">{item.quantity}</td>
                  <td className="py-1.5 text-center">
                    {formatCurrency(item.unitPrice, purchaseInvoice.currency)}
                  </td>
                  <td className="py-1.5 text-left">
                    {formatCurrency(item.totalPrice, purchaseInvoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col gap-1 border-t border-dashed border-gray-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">الإجمالي</span>
              <span className="font-bold">
                {formatCurrency(purchaseInvoice.totalAmount, purchaseInvoice.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المبلغ المدفوع</span>
              <span className="font-bold text-success">
                {formatCurrency(purchaseInvoice.paidAmount, purchaseInvoice.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المبلغ المتبقي</span>
              <span
                className={`font-bold ${purchaseInvoice.remainingAmount > 0 ? "text-warning" : "text-success"}`}
              >
                {formatCurrency(purchaseInvoice.remainingAmount, purchaseInvoice.currency)}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-100 pt-1">
              <span className="text-gray-500">طريقة الدفع</span>
              <span className="font-bold">
                {paymentMethodLabel[purchaseInvoice.paymentMethod] ?? purchaseInvoice.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">نوع العملية</span>
              <span className={`font-bold ${isCash ? "text-success" : "text-warning"}`}>
                {isCash ? "نقدي" : "دين (كامل أو جزئي)"}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>حالة الفاتورة</span>
              <span>{statusLabel[purchaseInvoice.status] ?? purchaseInvoice.status}</span>
            </div>
            {purchaseInvoice.status === "CONFIRMED" && (
              <div className="flex justify-between">
                <span className="text-gray-500">حالة السداد</span>
                <span className="font-bold">
                  {paymentStatusLabel[purchaseInvoice.paymentStatus] ?? purchaseInvoice.paymentStatus}
                </span>
              </div>
            )}
          </div>

          {purchaseInvoice.payments && purchaseInvoice.payments.length > 0 && (
            <div className="border-t border-dashed border-gray-200 pt-3 text-sm">
              <p className="mb-1 text-gray-500">الدفعات اللاحقة على الفاتورة</p>
              {purchaseInvoice.payments.map((pay) => (
                <div key={pay.id} className="flex justify-between">
                  <span>{new Date(pay.date).toLocaleDateString("ar-EG")}</span>
                  <span className="font-bold">{formatCurrency(pay.amount, purchaseInvoice.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {purchaseInvoice.notes && (
            <p className="text-xs text-gray-500">ملاحظات: {purchaseInvoice.notes}</p>
          )}

          <p className="text-center text-xs text-gray-400">إشعار: هذه فاتورة غير رسمية للمتابعة الداخلية</p>
        </div>
      </div>

      <p className="no-print text-center text-xs text-gray-400">
        <Link to="/purchase-invoices" className="text-primary-600 hover:underline">
          الرجوع لقائمة فواتير الشراء
        </Link>
      </p>
    </div>
  );
}
