import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { settingsService } from "@/services/settingsService";
import { ApiClientError } from "@/services/apiClient";
import { DataCleanupSection } from "@/components/settings/DataCleanupSection";
import type { AppSettings } from "@idm/shared-types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.getAll(),
  });

  const [form, setForm] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (input: AppSettings) => settingsService.update(input),
    onSuccess: (updated) => {
      setForm(updated);
      setMessage("تم حفظ الإعدادات بنجاح");
      setError(null);
      queryClient.setQueryData(["settings"], updated);
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  if (isLoading || !form) {
    return <p className="text-sm text-gray-400">جاري التحميل...</p>;
  }

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-sm text-gray-500">إعدادات المتجر، الفواتير، والتنبيهات — تُحفظ في قاعدة البيانات</p>
      </div>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          setError(null);
          if (form) mutation.mutate(form);
        }}
      >
        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-700">بيانات المتجر</h3>
          <div className="flex flex-col gap-4">
            <Input
              label="اسم المتجر"
              value={form.STORE_NAME_AR}
              onChange={(e) => update("STORE_NAME_AR", e.target.value)}
              required
            />
            <Input
              label="رقم الهاتف"
              value={form.STORE_PHONE}
              onChange={(e) => update("STORE_PHONE", e.target.value)}
            />
            <Input
              label="العنوان"
              value={form.STORE_ADDRESS}
              onChange={(e) => update("STORE_ADDRESS", e.target.value)}
            />
            <Input
              label="العملة (رمز ISO، مثل USD أو SYP)"
              value={form.CURRENCY}
              onChange={(e) => update("CURRENCY", e.target.value.toUpperCase())}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-700">إعدادات الفواتير</h3>
          <div className="flex flex-col gap-4">
            <Input
              label="بادئة رقم الفاتورة"
              value={form.INVOICE_PREFIX}
              onChange={(e) => update("INVOICE_PREFIX", e.target.value.toUpperCase())}
              required
            />
            <p className="-mt-2 text-xs text-gray-400">
              مثال: الفاتورة القادمة ستكون بالشكل "{form.INVOICE_PREFIX || "INV"}-000001"
            </p>
            <Input
              label="ملاحظة أسفل الفاتورة"
              value={form.INVOICE_FOOTER_NOTE}
              onChange={(e) => update("INVOICE_FOOTER_NOTE", e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-700">إعدادات المخزون والتنبيهات</h3>
          <div className="flex flex-col gap-4">
            <Input
              label="حد التنبيه الافتراضي لانخفاض المخزون (لمنتج جديد)"
              type="number"
              step="0.01"
              value={String(form.DEFAULT_MIN_STOCK_ALERT)}
              onChange={(e) => update("DEFAULT_MIN_STOCK_ALERT", Number(e.target.value) || 0)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.LOW_STOCK_ALERTS_ENABLED}
                onChange={(e) => update("LOW_STOCK_ALERTS_ENABLED", e.target.checked)}
              />
              تفعيل تنبيهات انخفاض المخزون (في أعلى الصفحة)
            </label>
            <Input
              label="حد تنبيه الدين (تنبيه عند تجاوز دين زبون لهذا المبلغ)"
              type="number"
              step="0.01"
              value={String(form.DEBT_ALERT_THRESHOLD)}
              onChange={(e) => update("DEBT_ALERT_THRESHOLD", Number(e.target.value) || 0)}
            />
          </div>
        </Card>

        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div>
          <Button type="submit" isLoading={mutation.isPending}>
            حفظ الإعدادات
          </Button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900">إدارة البيانات</h2>
        <DataCleanupSection />
      </div>
    </div>
  );
}
