import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { createDraftDocument, updateDraftDocument, confirmDraftDocument, getDocumentWithLines } from '../../../lib/documents';
import { formatJalaliString } from '../../../lib/jalali';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Icon } from '../../../components/ui/Icon';
import { DocumentFormShell } from './shared/DocumentFormShell';
import { LineItemsEditor, type EditableLine } from './shared/LineItemsEditor';

export function TransferForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [dateJalali, setDateJalali] = useState(formatJalaliString());
  const [sourceStoreId, setSourceStoreId] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destStoreId, setDestStoreId] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];
  const sourceWarehouses = useLiveQuery(() => sourceStoreId ? db.warehouses.where('storeId').equals(sourceStoreId).toArray() : Promise.resolve([]), [sourceStoreId]) ?? [];
  const destWarehouses = useLiveQuery(() => destStoreId ? db.warehouses.where('storeId').equals(destStoreId).toArray() : Promise.resolve([]), [destStoreId]) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  useEffect(() => {
    if (isEdit && id) {
      getDocumentWithLines(id).then((data) => {
        if (data) {
          setDateJalali(data.doc.dateJalali);
          setSourceStoreId(data.doc.storeId);
          setSourceWarehouseId(data.doc.sourceWarehouseId || '');
          setNote(data.doc.note || '');
          // برای مقصد، باید store را از روی warehouse پیدا کنیم
          if (data.doc.destinationWarehouseId) {
            db.warehouses.get(data.doc.destinationWarehouseId).then((w) => {
              if (w) {
                setDestStoreId(w.storeId);
                setDestWarehouseId(w.id);
              }
            });
          }
          setLines(data.lines.map((l) => ({
            tempId: l.id,
            variantId: l.variantId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            discount: l.discount,
            stockStatus: l.stockStatus,
          })));
        }
      });
    }
  }, [isEdit, id]);

  useEffect(() => {
    if (!sourceStoreId && stores.length > 0) setSourceStoreId(stores[0].id);
  }, [stores]);

  useEffect(() => {
    if (sourceWarehouses.length > 0 && !sourceWarehouseId) {
      const def = sourceWarehouses.find((w) => w.isDefault) || sourceWarehouses[0];
      setSourceWarehouseId(def.id);
    }
  }, [sourceWarehouses]);

  useEffect(() => {
    if (destWarehouses.length > 0 && !destWarehouseId) {
      const def = destWarehouses.find((w) => w.isDefault) || destWarehouses[0];
      // جلوگیری از انتخاب همان انبار
      if (def.id !== sourceWarehouseId) {
        setDestWarehouseId(def.id);
      }
    }
  }, [destWarehouses]);

  const totalAmount = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  const validate = (): string | null => {
    if (!sourceStoreId || !sourceWarehouseId) return 'انبار مبدأ را انتخاب کنید';
    if (!destStoreId || !destWarehouseId) return 'انبار مقصد را انتخاب کنید';
    if (sourceWarehouseId === destWarehouseId) return 'انبار مبدأ و مقصد نباید یکسان باشند';
    if (lines.length === 0) return 'حداقل یک کالا اضافه کنید';
    for (const l of lines) {
      if (l.quantity <= 0) return 'تعداد هر ردیف باید بزرگتر از صفر باشد';
    }
    return null;
  };

  const buildInput = () => ({
    type: 'transfer' as const,
    storeId: sourceStoreId,
    sourceWarehouseId,
    destinationWarehouseId: destWarehouseId,
    dateJalali,
    dateEpoch: new Date().getTime(),
    note: note || null,
    supplier: null,
    referenceNumber: null,
    recipient: null,
    issueType: null,
    shippingCost: 0,
    lines: lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitId: '',
      unitCost: l.unitCost,
      discount: 0,
      lineTotal: l.quantity * l.unitCost,
      stockStatus: l.stockStatus,
      note: null,
    })),
  });

  const handleSaveDraft = async () => {
    const err = validate();
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        const input = buildInput();
        await updateDraftDocument(id, { ...input, lines: input.lines });
      } else {
        await createDraftDocument(buildInput());
      }
      navigate('/records');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    const err = validate();
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      let docId = id;
      if (!isEdit) {
        const doc = await createDraftDocument(buildInput());
        docId = doc.id;
      } else {
        const input = buildInput();
        await updateDraftDocument(id, { ...input, lines: input.lines });
      }
      await confirmDraftDocument(docId!);
      navigate('/records');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DocumentFormShell
      title={isEdit ? 'ویرایش انتقال' : 'انتقال بین انبارها'}
      subtitle="جابه‌جایی کالا بین دو انبار"
      onBack={() => navigate(-1)}
      onDraft={handleSaveDraft}
      onConfirm={handleConfirm}
      saving={saving}
      error={error}
    >
      <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
        <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
          <Icon name="warehouse" size={12} />
          مبدأ
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="فروشگاه مبدأ"
            required
            value={sourceStoreId}
            onChange={(e) => { setSourceStoreId(e.target.value); setSourceWarehouseId(''); }}
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="انبار مبدأ"
            required
            value={sourceWarehouseId}
            onChange={(e) => setSourceWarehouseId(e.target.value)}
            options={sourceWarehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
        <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
          <Icon name="warehouse" size={12} />
          مقصد
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="فروشگاه مقصد"
            required
            value={destStoreId}
            onChange={(e) => { setDestStoreId(e.target.value); setDestWarehouseId(''); }}
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="انبار مقصد"
            required
            value={destWarehouseId}
            onChange={(e) => setDestWarehouseId(e.target.value)}
            options={destWarehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="تاریخ"
            required
            leadingIcon={<Icon name="calendar" size={14} />}
            value={dateJalali}
            onChange={(e) => setDateJalali(e.target.value)}
          />
          <div />
        </div>
      </div>

      <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
        <Icon name="box" size={13} className="text-orange" />
        اقلام ({lines.length})
      </div>
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        mode="transfer"
        warehouseId={sourceWarehouseId}
        variants={variants}
        products={products}
      />

      <div className="mt-3">
        <Input
          label="توضیحات"
          leadingIcon={<Icon name="note" size={14} />}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="اختیاری"
        />
      </div>

      <div className="mt-3 bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
        <div className="flex justify-between items-center">
          <span className="text-[12.5px] font-bold text-ink dark:text-cream">ارزش انتقال</span>
          <span className="text-[15px] font-extrabold text-orange">
            {totalAmount.toLocaleString('en-US')} <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">تومان</small>
          </span>
        </div>
      </div>
    </DocumentFormShell>
  );
}