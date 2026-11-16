import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { deleteCalcHistory } from '../../lib/pricingData';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Sheet } from '../../components/ui/Sheet';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FilterChip } from '../Reports/ReportShell';
import { fmt, errMsg } from '../../lib/format';
import { COST_BASIS_LABELS, ROUNDING_STEPS } from '../../types';
import type { CalcHistory, CostBasis } from '../../types';

// ============================================================
// تاریخچه محاسبات — جزئیات فرمول هر محاسبه + مقایسه دو محاسبه
// نتایج ذخیره‌شده با تغییر الگو/کانال/قیمت خرید تغییر نمی‌کنند
// ============================================================

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CalcHistoryPage() {
  const [productId, setProductId] = useState('all');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];

  const items = useLiveQuery(
    async () => {
      const all = await db.calcHistory.toArray();
      all.sort((a, b) => b.createdAt - a.createdAt);
      return all;
    },
    []
  ) ?? [];

  const filtered = items.filter((h) => productId === 'all' || h.productId === productId);
  const detail = detailId ? items.find((h) => h.id === detailId) ?? null : null;
  const compareItems = [...compareIds]
    .map((id) => items.find((h) => h.id === id))
    .filter((h): h is CalcHistory => !!h)
    .sort((a, b) => a.createdAt - b.createdAt);

  const variantName = (id: string) => {
    const v = variants.find((x) => x.id === id);
    return products.find((p) => p.id === v?.productId)?.name ?? '—';
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCalcHistory(deleteId);
      setCompareIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
    } catch (e) {
      setError(errMsg(e));
    }
    setDeleteId(null);
  };

  return (
    <div className="pb-24">
      <TopBar
        title="تاریخچه محاسبات"
        subtitle="نتایج ذخیره‌شده با اسنپ‌شات کامل پارامترها"
        onBack={() => window.history.back()}
        showTheme
      />

      <div className="px-5 pt-3 flex flex-col gap-2.5">
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <Select
            label="کالا"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={[
              { value: 'all', label: 'همه کالاها' },
              ...products.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <div className="flex gap-1.5">
            <FilterChip active={!compareMode} onClick={() => { setCompareMode(false); setCompareIds(new Set()); }}>
              مشاهده
            </FilterChip>
            <FilterChip active={compareMode} onClick={() => setCompareMode(true)}>
              مقایسه محاسبات
            </FilterChip>
          </div>
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>
        )}

        {/* حالت مقایسه */}
        {compareMode && compareItems.length >= 2 && (
          <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card overflow-hidden">
            <div className="overflow-x-auto" style={{ overscrollBehavior: 'contain' }}>
              <table className="w-full text-right [border-collapse:separate] [border-spacing:0]" style={{ minWidth: 620 }}>
                <thead>
                  <tr className="bg-surface-light-2 dark:bg-surface-dark-2">
                    {['شاخص', ...compareItems.map((_, i) => `محاسبهٔ ${i + 1}`)].map((h) => (
                      <th key={h} className="sticky top-0 px-2 py-2 text-[9px] font-bold text-muted-light dark:text-muted-dark whitespace-nowrap border-b border-black/5 dark:border-cream/10 bg-surface-light-2 dark:bg-surface-dark-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'کالا', get: (h: CalcHistory) => variantName(h.variantId) },
                    { label: 'تاریخ', get: (h: CalcHistory) => formatDate(h.createdAt) },
                    { label: 'الگو', get: (h: CalcHistory) => h.templateName },
                    { label: 'کانال', get: (h: CalcHistory) => h.channelName ?? '—' },
                    { label: 'مبنای هزینه', get: (h: CalcHistory) => COST_BASIS_LABELS[h.params.costBasis as CostBasis] },
                    { label: 'بهای تمام‌شده', get: (h: CalcHistory) => fmt(h.params.costValue) },
                    { label: 'تعداد', get: (h: CalcHistory) => fmt(h.params.quantity) },
                    { label: 'تخفیف فروشنده', get: (h: CalcHistory) => `${h.params.sellerDiscountPercent}٪` },
                    { label: 'تخفیف پلتفرم', get: (h: CalcHistory) => `${h.params.platformDiscountPercent}٪` },
                    { label: 'تخفیف مشترک', get: (h: CalcHistory) => `${h.params.jointDiscountPercent}٪ (سهم فروشنده ${h.params.jointSellerSharePercent}٪)` },
                    { label: 'قیمت پایهٔ پیشنهادی', get: (h: CalcHistory) => fmt(h.basePrice) },
                    { label: 'پرداختی مشتری', get: (h: CalcHistory) => fmt(h.result.customerPaidTotal) },
                    { label: 'دریافتی خالص', get: (h: CalcHistory) => fmt(h.result.sellerNetTotal) },
                    { label: 'هزینه‌های فروش', get: (h: CalcHistory) => fmt(h.result.feesTotal) },
                    { label: 'سود خالص', get: (h: CalcHistory) => fmt(h.result.profitTotal) },
                    { label: 'حاشیهٔ سود', get: (h: CalcHistory) => `${Math.round(h.result.marginPercent * 100) / 100}٪` },
                    { label: 'نقطهٔ سربه‌سر / واحد', get: (h: CalcHistory) => fmt(h.result.breakevenCustomerPaidUnit) },
                  ].map((row, ri) => (
                    <tr key={ri} className="border-b border-black/5 dark:border-cream/10 last:border-b-0">
                      <td className="px-2 py-2 text-[10px] font-bold text-ink dark:text-cream whitespace-nowrap">{row.label}</td>
                      {compareItems.map((h) => (
                        <td key={h.id} className="px-2 py-2 text-[10px] text-ink dark:text-cream tabular-nums whitespace-nowrap">
                          {row.get(h)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {compareMode && compareItems.length === 1 && (
          <div className="bg-orange-soft border border-orange/20 rounded-card p-3 text-[10.5px] text-orange font-semibold text-center">
            برای مقایسه، حداقل دو محاسبه را انتخاب کنید
          </div>
        )}

        {/* لیست */}
        {!compareMode && filtered.length === 0 && (
          <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
            محاسبهٔ ذخیره‌شده‌ای یافت نشد — از ماشین‌حساب قیمت‌گذاری «ذخیره محاسبه» را بزنید
          </div>
        )}

        {filtered.map((h) => {
          const selected = compareIds.has(h.id);
          return (
            <div
              key={h.id}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card"
            >
              <div className="flex items-center gap-2">
                {compareMode && (
                  <button
                    onClick={() => {
                      const next = new Set(compareIds);
                      if (next.has(h.id)) next.delete(h.id);
                      else if (next.size < 4) next.add(h.id);
                      setCompareIds(next);
                    }}
                    className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border-[1.5px] ${
                      selected ? 'bg-orange border-orange text-white' : 'border-black/20 dark:border-cream/25'
                    }`}
                    aria-label="انتخاب برای مقایسه"
                  >
                    {selected && <Icon name="check" size={12} />}
                  </button>
                )}
                <button
                  onClick={() => !compareMode && setDetailId(h.id)}
                  className="flex-1 min-w-0 text-right"
                >
                  <div className="text-[12px] font-bold text-ink dark:text-cream truncate flex items-center gap-1.5 flex-wrap">
                    {variantName(h.variantId)}
                    <Badge variant="orange" size="sm">{h.templateName}</Badge>
                    {h.channelName && <Badge variant="muted" size="sm">{h.channelName}</Badge>}
                  </div>
                  <div className="text-[9.5px] text-muted-light dark:text-muted-dark mt-1 flex flex-wrap gap-x-2">
                    <span>{formatDate(h.createdAt)}</span>
                    <span>•</span>
                    <span>مبنا: {COST_BASIS_LABELS[h.params.costBasis as CostBasis]}</span>
                    <span>•</span>
                    <span>قیمت پایه: {fmt(h.basePrice)}</span>
                    <span>•</span>
                    <span>حاشیه: {Math.round(h.result.marginPercent * 100) / 100}٪</span>
                  </div>
                </button>
                <button
                  onClick={() => setDeleteId(h.id)}
                  className="w-8 h-8 rounded-btn text-red-600 flex items-center justify-center flex-shrink-0"
                  aria-label="حذف محاسبه"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* جزئیات فرمول */}
      <Sheet
        open={detail !== null}
        onClose={() => setDetailId(null)}
        title="جزئیات محاسبهٔ ذخیره‌شده"
        maxHeight="88%"
      >
        {detail && (
          <div className="px-4 flex flex-col gap-1.5 pb-4">
            <div className="bg-orange-soft border border-orange/20 rounded-btn p-2.5 text-[10px] text-orange leading-relaxed">
              این محاسبه به‌صورت اسنپ‌شات ذخیره شده است — تغییر قیمت خرید، مبنای قیمت‌گذاری، الگو یا هزینه‌ها
              نتایج این محاسبه را تغییر نمی‌دهد.
            </div>
            <DetailSection title="اطلاعات کلی">
              <KV k="کالا" v={variantName(detail.variantId)} />
              <KV k="تاریخ" v={formatDate(detail.createdAt)} />
              <KV k="الگو" v={detail.templateName} />
              <KV k="کانال" v={detail.channelName ?? '—'} />
              <KV k="تعداد" v={fmt(detail.params.quantity)} />
              <KV k="گام گرد کردن" v={detail.params.roundingStep ? fmt(detail.params.roundingStep) : 'بدون گرد کردن'} />
            </DetailSection>
            <DetailSection title="بهای تمام‌شده">
              <KV k="مبنا" v={COST_BASIS_LABELS[detail.params.costBasis as CostBasis]} />
              <KV k="بهای واحد" v={`${fmt(detail.params.costValue)} ریال`} />
              <KV k="جمع بهای تمام‌شده" v={`${fmt(detail.result.cogsTotal)} ریال`} />
            </DetailSection>
            <DetailSection title="قیمت پایه و تخفیف‌ها">
              <KV k="قیمت پایهٔ پیشنهادی (واحد)" v={`${fmt(detail.result.basePrice)} ریال`} />
              <KV k="مقدار پس از گرد کردن" v={detail.result.roundedBasePrice !== null ? `${fmt(detail.result.roundedBasePrice)} ریال` : '—'} />
              <KV k="جمع قیمت پایه" v={`${fmt(detail.result.baseTotal)} ریال`} />
              <KV k="تخفیف فروشنده" v={`${detail.params.sellerDiscountPercent}٪ = ${fmt(detail.result.sellerDiscountTotal)} ریال`} />
              <KV k="تخفیف پلتفرم" v={`${detail.params.platformDiscountPercent}٪ = ${fmt(detail.result.platformDiscountTotal)} ریال`} />
              <KV k="تخفیف مشترک" v={`${detail.params.jointDiscountPercent}٪ = ${fmt(detail.result.jointDiscountTotal)} ریال`} />
              <KV k="سهم فروشنده از مشترک" v={`${detail.params.jointSellerSharePercent}٪ = ${fmt(detail.result.jointSellerShareAmount)} ریال`} />
              <KV k="سهم پلتفرم از مشترک" v={`${fmt(detail.result.jointPlatformShareAmount)} ریال`} />
            </DetailSection>
            <DetailSection title="هزینه‌های فروش">
              {detail.params.fees.length === 0 && <KV k="—" v="هزینه‌ای تعریف نشده بود" />}
              {detail.params.fees.map((f, i) => (
                <KV
                  key={i}
                  k={`• ${f.title} (${f.source === 'template' ? 'الگو' : 'کانال'})`}
                  v={f.calcType === 'percent' ? `${f.value}٪ از ${f.basis === 'before_discount' ? 'مبلغ قبل از تخفیف' : 'مبلغ پس از تخفیف'}` : `${fmt(f.value)} ریال / واحد`}
                />
              ))}
              <KV k="جمع هزینه‌های فروش" v={`${fmt(detail.result.feesTotal)} ریال`} />
            </DetailSection>
            <DetailSection title="نتیجه">
              <KV k="پرداختی مشتری" v={`${fmt(detail.result.customerPaidTotal)} ریال`} />
              <KV k="سهم تأمین‌شدهٔ پلتفرم" v={`${fmt(detail.result.platformFundedTotal)} ریال`} />
              <KV k="دریافتی خالص فروشنده" v={`${fmt(detail.result.sellerNetTotal)} ریال`} />
              <KV k="سود خالص" v={`${fmt(detail.result.profitTotal)} ریال`} />
              <KV k="حاشیهٔ سود" v={`${Math.round(detail.result.marginPercent * 100) / 100}٪`} />
              <KV k="نقطهٔ سربه‌سر (پرداختی مشتری / واحد)" v={`${fmt(detail.result.breakevenCustomerPaidUnit)} ریال`} />
            </DetailSection>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="حذف محاسبهٔ ذخیره‌شده؟"
        message="این محاسبه از تاریخچه حذف می‌شود. اثر دیگری روی داده‌ها ندارد."
        confirmText="حذف"
        variant="danger"
      />
    </div>
  );

  function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn p-2.5">
        <div className="text-[10.5px] font-bold text-orange mb-1.5">{title}</div>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    );
  }

  function KV({ k, v }: { k: string; v: string }) {
    return (
      <div className="flex justify-between gap-2 text-[10px]">
        <span className="text-muted-light dark:text-muted-dark flex-1 min-w-0">{k}</span>
        <span className="font-bold text-ink dark:text-cream whitespace-nowrap">{v}</span>
      </div>
    );
  }
}
