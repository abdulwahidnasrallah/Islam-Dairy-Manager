import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supplierService } from "@/services/supplierService";
import { ApiClientError } from "@/services/apiClient";

export default function SupplierFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => supplierService.getProfile(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.supplier.name);
      setPhone(profile.supplier.phone ?? "");
      setAddress(profile.supplier.address ?? "");
      setNotes(profile.supplier.notes ?? "");
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      };
      return isEditMode ? supplierService.update(id!, payload) : supplierService.create(payload);
    },
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      navigate(`/suppliers/${supplier.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-bold text-gray-900">
        {isEditMode ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
      </h1>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!name.trim()) {
            setError("اسم المورد مطلوب");
            return;
          }
          mutation.mutate();
        }}
      >
        <Input label="اسم المورد" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" isLoading={mutation.isPending}>
            حفظ
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  );
}
