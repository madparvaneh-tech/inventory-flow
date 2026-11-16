import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { getDocumentWithLines } from '../../lib/documents';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { fmt } from '../../lib/format';
import { DocumentStatusBadge } from './components/DocumentStatusBadge';
import { DocumentActions } from './components/DocumentActions';
import type { FlowOperation, Warehouse, Store } from '../../types';

const TYPE_LABELS: Record<FlowOperation, string> = {
  receipt: 'رسید کالا',
  issue: 'حواله کالا',
  transfer: 'انتقال بین انبارها',
  return: 'برگشت کالا',
  count: 'انبارگردانی',
  adjustment: 'اصلاح موجودی',
  'status-change': 'تغییر وضعیت',
};

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useLiveQuery(async () => {
    if (!id) return null;
    return await getDocumentWithLines(id);
  }, [id, refreshKey]);

  const meta = useLiveQuery(async () => {
    if (!data) return null;
    const stores = await db.stores.toArray();
    const warehouses = await db.warehouses.toArray();
    const variants = await db.variants.toArray();
    const products = await db.products.toArray();
    return { stores, warehouses, variants, products };
  }, [data]);

  if (!data) {
    return (
      <div className="pb-24">
        <TopBar title="سند" onBack={() => navigate(-1)} showTheme />
        <div className="p-5 text-center text-[12px] text-muted-light dark:text-muted-dark">
          سند یافت نشد
        </div>
      </div>
    );
  }

  const { doc, lines } = data;
  const store = meta?.stores.find((s) => s.id === doc.storeId);
  const srcWh = meta?.warehouses.find((w) => w.id === doc.sourceWarehouseId);
  const dstWh = meta?.warehouses.find((w) => w.id === doc.destinationWarehouseId);

  const getVariantInfo = (variantId: string) => {
    const v = meta?.variants.find((x) => x.id === variantId);
    const p = v ? meta?.products.find((x) => x.id === v.productId) : undefined;
    return { variant: v, product: p };
  };

  return (
    <div className="pb-32">
      <TopBar
        title={`${TYPE_LABELS[doc.type]} #${doc.number}`}
        subtitle={doc.dateJalali}
        onBack={() => navigate(-1)}
        showTheme
        rightSlot={<DocumentStatusBadge status={doc.status} />}
      />

      <div className="px-5 pt-3">
        {/* هشدار برگشت/ابطال */}
        {doc.status === 'reversed' && (
          <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-card p-3 flex items-center gap-2">
            <Icon name="warning" size={16} className="text-red-600 flex-shrink-0" />
            <div className="text-[11px] text-red-600 font-semibold">
              این سند ابطال شده و اثر آن روی موجودی خنثی شده است
            </div>
          </div>
        )}

        {/* سربرگ */}
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-4 mb-3">
          <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
            <Icon name="note" size={12} />
            اطلاعات سند
          </div>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-[11.5px]">
            <InfoRow label="شماره" value={`#${doc.number}`} />
            <InfoRow label="تاریخ" value={doc.dateJalali} />
            <InfoRow label="فروشگاه" value={store?.name ?? '—'} />
            {srcWh && <InfoRow label="انبار مبدأ" value={srcWh.name} />}
            {dstWh && <InfoRow label="انبار مقصد" value={dstWh.name} />}
            {doc.supplier && <InfoRow label="تامین‌کننده" value={doc.supplier} />}
            {doc.recipient && <InfoRow label="تحویل‌گیرنده" value={doc.recipient} />}
            {doc.referenceNumber && <InfoRow label="شماره مرجع" value={doc.referenceNumber} />}
            {doc.issueType && <InfoRow label="نوع خروج" value={doc.issueType} />}
          </div>
          {doc.note && (
            <div className="mt-3 pt-3 border-t border-black/5 dark:border-cream/10">
              <div className="text-[10px] text-muted-light dark:text-muted-dark font-semibold mb-1">
                توضیحات
              </div>
              <div className="text-[11.5px] text-ink dark:text-cream">{doc.note}</div>
            </div>
          )}
        </div>

        {/* اقلام */}
        <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
          <Icon name="box" size={13} className="text-orange" />
          اقلام ({lines.length})
        </div>
        <div className="flex flex-col gap-2 mb-3">
          {lines.map((line) => {
            const { variant, product } = getVariantInfo(line.variantId);
            return (
              <div
                key={line.id}
                className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card"
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                    <Icon name="box" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold text-ink dark:text-cream truncate">
                      {product?.name ?? 'کالا'}
                    </div>
                    <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                      {variant?.sku ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10">
                  <MiniStat label="تعداد" value={fmt(line.quantity)} />
                  <MiniStat label="قیمت واحد" value={fmt(line.unitCost)} />
                  <MiniStat label="جمع" value={fmt(line.lineTotal)} highlight />
                </div>
              </div>
            );
          })}
        </div>

        {/* جمع‌بندی */}
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-4">
          <SummaryRow label="جمع اقلام" value={fmt(doc.totalAmount - doc.shippingCost + doc.discountTotal)} />
          {doc.discountTotal > 0 && <SummaryRow label="تخفیف" value={fmt(doc.discountTotal)} negative />}
          {doc.shippingCost > 0 && <SummaryRow label="هزینه حمل" value={fmt(doc.shippingCost)} />}
          <div className="h-px bg-black/5 dark:bg-cream/10 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-[12.5px] font-bold text-ink dark:text-cream">مبلغ نهایی</span>
            <span className="text-[15px] font-extrabold text-orange">
              {fmt(doc.totalAmount)} <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">تومان</small>
            </span>
          </div>
        </div>
      </div>

      <DocumentActions doc={doc} onChanged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-semibold">{label}</div>
      <div className="text-[11.5px] font-bold text-ink dark:text-cream mt-0.5 truncate">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold">{label}</div>
      <div className={`text-[11.5px] font-bold mt-0.5 ${highlight ? 'text-orange' : 'text-ink dark:text-cream'}`}>
        {value}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-[11px] text-muted-light dark:text-muted-dark font-medium">{label}</span>
      <span className={`text-[11.5px] font-bold ${negative ? 'text-red-600' : 'text-ink dark:text-cream'}`}>
        {negative ? '− ' : ''}{value}
      </span>
    </div>
  );
}