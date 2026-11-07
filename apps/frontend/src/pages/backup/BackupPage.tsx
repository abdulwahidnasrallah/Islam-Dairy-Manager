import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, ShieldAlert, DatabaseBackup } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { backupService } from "@/services/backupService";
import { ApiClientError } from "@/services/apiClient";
import type { BackupFile } from "@idm/shared-types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

export default function BackupPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => backupService.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => backupService.create(),
    onSuccess: () => {
      setMessage("تم إنشاء نسخة احتياطية جديدة بنجاح.");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع"),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => backupService.remove(filename),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (filename: string) => backupService.restore(filename),
    onSuccess: (result) => {
      setError(null);
      setMessage(
        `تمت الاستعادة بنجاح (تم أخذ نسخة أمان تلقائية قبل الاستعادة باسم "${result.safetyBackupFilename}"). ` +
          "الرجاء إعادة تشغيل التطبيق الآن.",
      );
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع"),
  });

  const columns: TableColumn<BackupFile>[] = [
    { header: "اسم الملف", render: (b) => b.filename },
    { header: "الحجم", render: (b) => formatSize(b.sizeBytes) },
    { header: "تاريخ الإنشاء", render: (b) => new Date(b.createdAt).toLocaleString("ar-EG") },
    {
      header: "",
      render: (b) => (
        <div className="flex gap-3">
          <a
            href={backupService.downloadUrl(b.filename)}
            className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
          >
            <Download size={14} /> تنزيل
          </a>
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-warning hover:underline disabled:opacity-50"
            disabled={restoreMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  `هل أنت متأكد من استعادة النسخة "${b.filename}"؟\n\nسيتم استبدال كل البيانات الحالية بهذه النسخة. سيُؤخذ نسخة أمان من الوضع الحالي تلقائياً قبل ذلك.`,
                )
              ) {
                restoreMutation.mutate(b.filename);
              }
            }}
          >
            <ShieldAlert size={14} /> استعادة
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-danger hover:underline disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`هل تريد حذف النسخة الاحتياطية "${b.filename}"؟`)) {
                deleteMutation.mutate(b.filename);
              }
            }}
          >
            <Trash2 size={14} /> حذف
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">النسخ الاحتياطي والاستعادة</h1>
          <p className="text-sm text-gray-500">
            نسخة احتياطية = ملف قاعدة البيانات كاملاً، محفوظ محلياً في مجلد "backups" بجانب قاعدة البيانات
          </p>
        </div>
        <Button type="button" onClick={() => createMutation.mutate()} isLoading={createMutation.isPending}>
          <DatabaseBackup size={16} /> إنشاء نسخة احتياطية الآن
        </Button>
      </div>

      {typeof window !== "undefined" && window.idm && (
        <button
          type="button"
          className="w-fit text-xs text-primary-600 hover:underline"
          onClick={() => void window.idm?.openBackupsFolder()}
        >
          فتح مجلد النسخ الاحتياطية في مستكشف الملفات
        </button>
      )}

      {message && (
        <Card className="border border-success/30 bg-success/5">
          <p className="text-sm text-success">{message}</p>
        </Card>
      )}
      {error && (
        <Card className="border border-danger/30 bg-danger/5">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={backups}
        keyExtractor={(b) => b.filename}
        isLoading={isLoading}
        emptyMessage="لا توجد نسخ احتياطية بعد — اضغط على «إنشاء نسخة احتياطية الآن»"
      />

      <p className="text-xs text-gray-400">
        يُنصَح بإنشاء نسخة احتياطية بشكل دوري (أسبوعياً على الأقل) وحفظ نسخة منها خارج الجهاز (قرص خارجي أو
        سحابة) وليس فقط في مجلد "backups" المحلي.
      </p>
    </div>
  );
}
