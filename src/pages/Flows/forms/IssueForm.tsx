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

const ISSUE_TYPES = [
  { value: 'sale', label: 'فروش' },
  { value: 'consumption', label: 'مصرف' },
  { value: 'consignment', label: 'امانی' },
  { value: 'other', label: 'سایر' },
];

export function IssueForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [dateJalali, setDateJalali] = useState(formatJalaliString());
  const [storeId, setStoreId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [issueType, setIssueType] = useState('sale');
  const [recipient, setRecipient] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];
  const warehouses = useLiveQuery(() => storeId ? db.warehouses.where('storeId').equals(storeId).toArray() : Promise.resolve([]), [storeId]) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  useEffect(() => {
    if (isEdit && id) {
      getDocumentWithLines(id).then((data) => {
        if (data) {
          setDateJalali(data.doc.dateJalali);
          setStoreId(data.doc.storeId);
          setWarehouseId(data.doc.sourceWarehouseId || '');
          setIssueType(data.doc.issueType || 'sale');
          setRecipient(data.doc.recipient || '');
          setReferenceNumber(data.doc.referenceNumber || '');
          setNote(data.doc.note || '');
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
    if (!storeId && stores.length > 0) setStoreId(stores[0].id);
  }, [stores]);

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const def = warehouses.find((w) => w.isDefault) || warehouses[0];
      setWarehouseId(def.id);
    }
  }, [warehouses]);

  const totalAmount = lines.reduce((s, l) => s + l.quantity * l.unitCost - l.discount, 0);

  const validate = (): string | null => {
    if (!storeId) return 'فروشگاه را انتخاب کنید';
    if (!warehouseId) return 'انبار مبدأ را انتخاب کنید';
    if (!issueType) return 'نوع خروج را انتخاب کنید';
    if (lines.length === 0) return 'حداقل یک کالا اضافه کنید';
    for (const l of lines) {
      if (l.quantity <= 0) return 'تعداد هر ردیف باید بزرگتر از صفر باشد';
    }
    return null;
  };

  const buildInput = () => ({
    type: 'issue' as const,
    storeId,
    sourceWarehouseId: warehouseId,
    destinationWarehouseId: null,
    dateJalali,
    dateEpoch: new Date().getTime(),
    note: note || null,
    supplier: null,
    referenceNumber: referenceNumber || null,
    recipient: recipient || null,
    issueType,
    shippingCost: 0,
    lines: lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitId: '',
      unitCost: l.unitCost,
      discount: l.discount,
      lineTotal: l.quantity * l.unitCost - l.discount,
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
      title={isEdit ? 'ویرایش حواله' : 'حواله کالا'}
      subtitle="ثبت خروج کالا از انبار"
      onBack={() => navigate(-1)}
      onDraft={handleSaveDraft}
      onConfirm={handleConfirm}
      saving={saving}
      error={error}
    >
      <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
        <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
          <Icon name="note" size={12} />
          اطلاعات سند
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="تاریخ"
            required
            leadingIcon={<Icon name="calendar" size={14} />}
            value={dateJalali}
            onChange={(e) => setDateJalali(e.target.value)}
          />
          <Select
            label="فروشگاه"
            required
            leadingIcon={<Icon name="store" size={14} />}
            value={storeId}
            onChange={(e) => { setStoreId(e.target.value); setWarehouseId(''); }}
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Select
            label="انبار مبدأ"
            required
            leadingIcon={<Icon name="warehouse" size={14} />}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
          <Select
            label="نوع خروج"
            required
            leadingIcon={<Icon name="tag" size={14} />}
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            options={ISSUE_TYPES}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input
            label="تحویل‌گیرنده"
            leadingIcon={<Icon name="user" size={14} />}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="اختیاری"
          />
          <Input
            label="شماره مرجع"
            leadingIcon={<Icon name="tag" size={14} />}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="اختیاری"
          />
        </div>
      </div>

      <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
        <Icon name="box" size={13} className="text-orange" />
        اقلام ({lines.length})
      </div>
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        mode="out"
        warehouseId={warehouseId}
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
          <span className="text-[12.5px] font-bold text-ink dark:text-cream">مبلغ کل</span>
          <span className="text-[15px] font-extrabold text-orange">
            {totalAmount.toLocaleString('en-US')} <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">تومان</small>
          </span>
        </div>
      </div>
    </DocumentFormShell>
  );
}