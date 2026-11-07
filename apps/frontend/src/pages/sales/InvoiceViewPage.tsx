import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Download, XCircle } from "lucide-react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/Button";
import { salesService } from "@/services/salesService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";

const statusLabel: Record<string, string> = {
  CONFIRMED: "سارية",
  CANCELLED: "ملغاة",
};

export default function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => salesService.getById(id!),
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => salesService.cancel(id!),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  useEffect(() => {
    if (!invoice) return;
    const payload = JSON.stringify({
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.totalAmount,
      date: invoice.date,
    });
    QRCode.toDataURL(payload, { margin: 1, width: 140 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [invoice]);

  async function exportAsPng() {
    if (!printRef.current || !invoice) return;
    const canvas = await html2canvas(printRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `${invoice.invoiceNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (isLoading || !invoice) {
    return <p className="text-sm text-gray-400">جاري التحميل...</p>;
  }

  const isCash = invoice.remainingAmount <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => navigate("/sales")}>
          العودة إلى المبيعات
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> طباعة
          </Button>
          <Button type="button" variant="secondary" onClick={() => void exportAsPng()}>
            <Download size={16} /> تصدير PNG
          </Button>
          {invoice.status === "CONFIRMED" && (
            <Button
              type="button"
              variant="danger"
              isLoading={cancelMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `هل تريد إلغاء الفاتورة "${invoice.invoiceNumber}"؟\n\nسيتم إرجاع الكميات المباعة إلى المخزون، ولن تُحتسب هذه الفاتورة ضمن المبيعات أو الديون بعد الآن.`,
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

      <div id="printable-invoice" ref={printRef} className="card mx-auto w-full max-w-lg">
        <div className="flex flex-col gap-4 p-2" dir="rtl">
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">{invoice.storeName}</h1>
            {invoice.storePhone && <p className="text-xs text-gray-500">{invoice.storePhone}</p>}
            {invoice.storeAddress && <p className="text-xs text-gray-500">{invoice.storeAddress}</p>}
          </div>

          <div className="flex items-start justify-between border-y border-dashed border-gray-200 py-3 text-sm">
            <div>
              <p className="text-gray-500">رقم الفاتورة</p>
              <p className="font-bold">{invoice.invoiceNumber}</p>
              <p className="mt-2 text-gray-500">التاريخ والوقت</p>
              <p className="font-bold">
                {new Date(invoice.date).toLocaleString("ar-EG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="mt-2 text-gray-500">الزبون</p>
              <p className="font-bold">{invoice.customerName ?? "—"}</p>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" width={100} height={100} />}
          </div>

          {invoice.status === "CANCELLED" && (
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
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-1.5">{item.productName ?? item.productId}</td>
                  <td className="py-1.5 text-center">{item.quantity}</td>
                  <td className="py-1.5 text-center">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                  <td className="py-1.5 text-left">{formatCurrency(item.totalPrice, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col gap-1 border-t border-dashed border-gray-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">الإجمالي</span>
              <span className="font-bold">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المبلغ المدفوع</span>
              <span className="font-bold text-success">
                {formatCurrency(invoice.paidAmount, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المبلغ المتبقي</span>
              <span className={`font-bold ${invoice.remainingAmount > 0 ? "text-warning" : "text-success"}`}>
                {formatCurrency(invoice.remainingAmount, invoice.currency)}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-100 pt-1">
              <span className="text-gray-500">نوع العملية</span>
              <span className={`font-bold ${isCash ? "text-success" : "text-warning"}`}>
                {isCash ? "نقدي" : "دين (كامل أو جزئي)"}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>حالة الفاتورة</span>
              <span>{statusLabel[invoice.status] ?? invoice.status}</span>
            </div>
          </div>

          {invoice.notes && <p className="text-xs text-gray-500">ملاحظات: {invoice.notes}</p>}

          <p className="text-center text-xs text-gray-400">إشعار: هذه فاتورة غير رسمية للمتابعة الداخلية</p>
        </div>
      </div>

      <p className="no-print text-center text-xs text-gray-400">
        <Link to="/sales" className="text-primary-600 hover:underline">
          الرجوع لقائمة الفواتير
        </Link>
      </p>
    </div>
  );
}
