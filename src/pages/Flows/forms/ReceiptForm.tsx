import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import {
  createDraftDocument,
  updateDraftDocument,
  confirmDraftDocument,
  getDocumentWithLines,
} from '../../../lib/documents';
import { toJalaliString as formatJalaliString } from '../../../lib/jalali';
import { parseNum } from '../../../lib/format';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Icon } from '../../../components/ui/Icon';
import { DocumentFormShell } from './shared/DocumentFormShell';
import { LineItemsEditor, type EditableLine } from './shared/LineItemsEditor';

export function ReceiptForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [dateJalali, setDateJalali] = useState(formatJalaliString());
  const [storeId, setStoreId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useLiveQuery(async () => {
    const all = await db.stores.toArray();
    const active = all.filter((s) => s.isActive);
    return active.length > 0 ? active : all;
  }, []) ?? [];

  const warehouses = useLiveQuery(
    () => (storeId ? db.warehouses.where('storeId').equals(storeId).toArray() : Promise.resolve([])),
    [storeId]
  ) ?? [];

  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  // بارگذاری سند در حالت ویرایش
  useEffect(() => {
    if (isEdit && id) {
      getDocumentWithLines(id).then((data) => {
        if (data) {
          setDateJalali(data.doc.dateJalali);
          setStoreId(data.doc.storeId);
          setWarehouseId(data.doc.destinationWarehouseId || '');
          setSupplier(data.doc.supplier || '');
          setReferenceNumber(data.doc.referenceNumber || '');
          setNote(data.doc.note || '');
          setShippingCost(data.doc.shippingCost);
          setLines(
            data.lines.map((l) => ({
              tempId: l.id,
              variantId: l.variantId,
              quantity: l.quantity,
              unitCost: l.unitCost,
              discount: l.discount,
              stockStatus: l.stockStatus,
            }))
          );
        }
      });
    }
  }, [isEdit, id]);

  // پیش‌فرض انتخاب فروشگاه و انبار
  useEffect(() => {
    if (!storeId && stores.length > 0) {
      setStoreId(stores[0].id);
    }
  }, [stores]);

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const def = warehouses.find((w) => w.isDefault) || warehouses[0];
      setWarehouseId(def.id);
    }
  }, [warehouses]);

  const totalAmount =
    lines.reduce((s, l) => s + l.quantity * l.unitCost - l.discount, 0) + shippingCost;

  const validate = (): string | null => {
    if (!storeId) return 'فروشگاه را انتخاب کنید';
    if (!warehouseId) return 'انبار مقصد را انتخاب کنید';
    if (lines.length === 0) return 'حداقل یک کالا اضافه کنید';
    for (const l of lines) {
      if (l.quantity <= 0) return 'تعداد هر ردیف باید بزرگتر از صفر باشد';
      if (l.unitCost <= 0) return 'قیمت خرید هر ردیف الزامی است';
    }
    return null;
  };

  const buildInput = () => ({
    type: 'receipt' as const,
    storeId,
    sourceWarehouseId: null,
    destinationWarehouseId: warehouseId,
    dateJalali,
    dateEpoch: new Date().getTime(),
    note: note || null,
    supplier: supplier || null,
    referenceNumber: referenceNumber || null,
    recipient: null,
    issueType: null,
    shippingCost,
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
        navigate('/records');
      } else {
        await createDraftDocument(buildInput());
        navigate('/records');
      }
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
      title={isEdit ? 'ویرایش رسید' : 'رسید کالا'}
      subtitle="ثبت ورود کالا به انبار"
      onBack={() => navigate(-1)}
      onDraft={handleSaveDraft}
      onConfirm={handleConfirm}
      saving={saving}
      error={error}
    >
      {/* سربرگ */}
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
            placeholder="1403/08/24"
          />
          <Select
            label="فروشگاه"
            required
            leadingIcon={<Icon name="store" size={14} />}
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setWarehouseId('');
            }}
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        <div className="mt-2">
          <Select
            label="انبار مقصد"
            required
            leadingIcon={<Icon name="warehouse" size={14} />}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input
            label="تامین‌کننده"
            leadingIcon={<Icon name="user" size={14} />}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
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

      {/* اقلام */}
      <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
        <Icon name="box" size={13} className="text-orange" />
        اقلام ({lines.length})
      </div>
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        mode="in"
        warehouseId={warehouseId}
        variants={variants}
        products={products}
      />

      {/* توضیحات */}
      <div className="mt-3">
        <Input
          label="توضیحات"
          leadingIcon={<Icon name="note" size={14} />}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="اختیاری"
        />
      </div>

      {/* جمع‌بندی و هزینه‌ها */}
      <div className="mt-3 bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
        <div className="text-[11px] font-bold text-orange mb-2.5 flex items-center gap-1">
          <Icon name="money" size={12} />
          جمع‌بندی و هزینه‌ها
        </div>

        <div className="flex justify-between items-center py-1.5 border-b border-dashed border-black/5 dark:border-cream/10">
          <span className="text-[11px] text-muted-light dark:text-muted-dark font-medium">جمع اقلام</span>
          <span
            className="text-[11.5px] font-bold text-ink dark:text-cream"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {lines
              .reduce((s, l) => s + l.quantity * l.unitCost - l.discount, 0)
              .toLocaleString('en-US')}
          </span>
        </div>

        <div className="flex justify-between items-center py-1.5 border-b border-dashed border-black/5 dark:border-cream/10">
          <div className="flex flex-col">
            <span className="text-[11px] text-ink dark:text-cream font-semibold">هزینه حمل</span>
            <span className="text-[9px] text-muted-light dark:text-muted-dark mt-0.5">
              مستقیم روی این رسید
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={shippingCost || ''}
              placeholder="0"
              onChange={(e) => setShippingCost(parseNum(e.target.value))}
              className="w-24 bg-white dark:bg-surface-dark-2 border border-black/5 dark:border-cream/10 rounded-md px-2 py-1.5 outline-none text-[11px] font-bold text-ink dark:text-cream text-center focus:border-orange"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <span className="text-[9px] text-muted-light dark:text-muted-dark font-medium">تومان</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2.5">
          <span className="text-[12.5px] font-bold text-ink dark:text-cream">مبلغ نهایی</span>
          <span className="text-[15px] font-extrabold text-orange">
            {totalAmount.toLocaleString('en-US')}{' '}
            <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">تومان</small>
          </span>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 text-[9.5px] text-muted-light dark:text-muted-dark leading-relaxed flex items-start gap-1">
          <Icon name="warning" size={11} className="text-orange flex-shrink-0 mt-[1px]" />
          <span>
            هزینه‌های عمومی مشترک در بخش «هزینه‌ها» ثبت و سپس بین رسیدها تخصیص می‌یابند. تخفیف ردیف‌ها از قبل در مبلغ هر ردیف لحاظ شده است.
          </span>
        </div>
      </div>
    </DocumentFormShell>
  );
}