import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { dataCleanupService } from "@/services/dataCleanupService";
import { ApiClientError } from "@/services/apiClient";
import type { DataCleanupResult } from "@idm/shared-types";

const DELETED_ENTITIES_LABEL = [
  "الزبائن والموردين",
  "المنتجات والمخزون وحركاته",
  "شراء الحليب والإنتاج",
  "الفواتير وأصنافها",
  "المصاريف وحركات الصندوق",
  "الديون والدفعات",
  "إغلاقات الأيام السابقة",
  "محادثات المساعد الذكي",
  "ترقيم الفواتير (يبدأ من جديد)",
];

/** Every query key across the app whose data becomes stale after a full operational-data wipe. */
const QUERY_KEYS_TO_REFRESH = [
  "dashboard-summary",
  "customers",
  "suppliers",
  "products",
  "inventory",
  "inventory-movements",
  "sales",
  "invoice",
  "reports",
  "cash-register",
  "expenses",
  "daily-closing-history",
  "assistant-conversations",
  "assistant-conversation",
  "smart-search",
];

export function DataCleanupSection() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DataCleanupResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => dataCleanupService.cleanupOperationalData(confirmationText, password),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      setIsModalOpen(false);
      setConfirmationText("");
      setPassword("");
      for (const key of QUERY_KEYS_TO_REFRESH) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const canConfirm = confirmationText === "DELETE" && password.length > 0;

  function closeModal() {
    if (mutation.isPending) return;
    setIsModalOpen(false);
    setConfirmationText("");
    setPassword("");
    setError(null);
  }

  return (
    <Card className="border border-danger/30">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-gray-700">
        <Trash2 size={16} className="text-danger" /> إدارة بيانات التطبيق
      </h3>
      <p className="mb-4 text-xs text-gray-500">
        استخدم هذا القسم فقط عند الانتهاء من التجربة والاستعداد لبدء العمل ببيانات حقيقية.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3">
        <p className="text-sm text-gray-700">
          🧹 <strong>تنظيف بيانات التشغيل</strong> يحذف كل بيانات المبيعات والمخزون والموردين
          والزبائن والمصاريف والديون التجريبية نهائياً، ويُبقي على حسابات المستخدمين وصلاحياتهم
          وإعدادات المتجر كما هي — حتى تستطيع تسجيل الدخول والمتابعة مباشرة ببيانات حقيقية.
        </p>
        <Button
          type="button"
          variant="danger"
          className="w-fit"
          onClick={() => {
            setResult(null);
            setIsModalOpen(true);
          }}
        >
          <Trash2 size={16} /> تنظيف بيانات التشغيل
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="text-sm font-bold text-success">
            تم تنظيف بيانات التشغيل بنجاح. التطبيق جاهز لإدخال البيانات الحقيقية.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-3">
            {Object.entries(result.deletedCounts).map(([table, count]) => (
              <li key={table}>
                {table}: {count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-danger" />
                <h3 className="text-base font-bold text-gray-900">تأكيد تنظيف بيانات التشغيل</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-2 text-sm text-danger">
              هذه العملية <strong>لا يمكن التراجع عنها</strong>. سيتم حذف كل البيانات التالية
              نهائياً من قاعدة البيانات:
            </p>
            <ul className="mb-3 list-inside list-disc text-xs text-gray-600">
              {DELETED_ENTITIES_LABEL.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <p className="mb-4 text-xs text-gray-500">
              لن يتأثر: المستخدمون، الأدوار، الصلاحيات، وإعدادات المتجر — ستبقى قادراً على تسجيل
              الدخول فوراً بعد العملية.
            </p>

            <div className="flex flex-col gap-3">
              <Input
                label='اكتب "DELETE" بالحروف الكبيرة للتأكيد'
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
              <Input
                label="كلمة مرورك الحالية"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={mutation.isPending}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!canConfirm}
                isLoading={mutation.isPending}
                onClick={() => {
                  setError(null);
                  mutation.mutate();
                }}
              >
                تأكيد الحذف النهائي
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
