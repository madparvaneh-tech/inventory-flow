import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { getDocumentWithLines } from '../../lib/documents';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { fmt } from '../../lib/format';
import { DocumentStatusBadge } from './components/DocumentStatusBadge';
import { DocumentActions } from './components/DocumentActions';
import type { CountLine, Document, FlowOperation } from '../../types';

const TYPE_LABELS: Record<FlowOperation, string> = {
  receipt: 'رسید کالا',
  issue: 'حواله کالا',
  transfer: 'انتقال بین انبارها',
  return: 'برگشت کالا',
  count: 'انبارگردانی',
  adjustment: 'اصلاح موجودی',
  'status-change': 'تغییر وضعیت',
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  sale: 'فروش / برگشت فروش',
  consumption: 'مصرف / برگشت مصرف',
  consignment: 'امانی / برگشت امانی',
  other: 'سایر',
};

const COUNT_MODE_LABELS: Record<string, string> = {
  all: 'شمارش تمام کالاها',
  selected: 'شمارش کالاهای انتخابی',
};

const OP_TYPE_LABELS: Record<FlowOperation, string> = {
  receipt: 'رسید',
  issue: 'حواله',
  transfer: 'انتقال',
  return: 'برگشت',
  count: 'انبارگردانی',
  adjustment: 'اصلاح موجودی',
  'status-change': 'تغییر وضعیت',
};

const OP_ICONS: Record<FlowOperation, 'plus' | 'minus' | 'flow' | 'edit' | 'list' | 'refresh'> = {
  receipt: 'plus',
  issue: 'minus',
  transfer: 'flow',
  return: 'refresh',
  count: 'list',
  adjustment: 'edit',
  'status-change': 'edit',
};

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const hadDataRef = useRef(false);

  const data = useLiveQuery(async () => {
    if (!id) return null;
    return await getDocumentWithLines(id);
  }, [id, refreshKey]);

  // اگر سند حذف شود، به مرکز سوابق برگرد
  useEffect(() => {
    if (data) hadDataRef.current = true;
  }, [data]);
  useEffect(() => {
    if (hadDataRef.current && data === null) {
      navigate('/records', { replace: true });
    }
  }, [data, navigate]);

  const meta = useLiveQuery(async () => {
    if (!data) return null;
    const [stores, warehouses, variants, products, units, channels] = await Promise.all([
      db.stores.toArray(),
      db.warehouses.toArray(),
      db.variants.toArray(),
      db.products.toArray(),
      db.units.toArray(),
      db.salesChannels.toArray(),
    ]);
    return { stores, warehouses, variants, products, units, channels };
  }, [data]);

  // ردیف‌های شمارش (فقط سند انبارگردانی)
  const countLines = useLiveQuery(async () => {
    if (!data || data.doc.type !== 'count') return [];
    return await db.countLines.where('documentId').equals(data.doc.id).toArray();
  }, [data?.doc.id, data?.doc.type, refreshKey]) ?? [];

  // اسناد وابسته (زنجیره) و سند مرجع
  const chain = useLiveQuery(async () => {
    if (!data) return null;
    const dependents = await db.documents
      .where('referenceDocId')
      .equals(data.doc.id)
      .toArray();
    const refDoc = data.doc.referenceDocId
      ? (await db.documents.get(data.doc.referenceDocId)) ?? null
      : null;
    return { dependents: dependents.sort((a, b) => a.dateEpoch - b.dateEpoch), refDoc };
  }, [data?.doc.id, data?.doc.referenceDocId, refreshKey]) ?? null;

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
  const isCount = doc.type === 'count';

  const getVariantInfo = (variantId: string) => {
    const v = meta?.variants.find((x) => x.id === variantId);
    const p = v ? meta?.products.find((x) => x.id === v.productId) : undefined;
    return { variant: v, product: p };
  };

  const unitName = (unitId: string) => meta?.units.find((u) => u.id === unitId)?.name ?? '';

  // جمع‌بندی نتیجه انبارگردانی از ردیف‌های شمارش
  const countedCount = countLines.filter(
    (l) => l.countedHealthy !== null || l.countedDefective !== null
  ).length;
  const varianceCount = countLines.filter(
    (l) =>
      (l.countedHealthy !== null && l.countedHealthy !== l.systemHealthy) ||
      (l.countedDefective !== null && l.countedDefective !== l.systemDefective)
  ).length;
  const countIncrease = countLines.reduce((s, l) => {
    let add = 0;
    if (l.countedHealthy !== null && l.countedHealthy > l.systemHealthy)
      add += l.countedHealthy - l.systemHealthy;
    if (l.countedDefective !== null && l.countedDefective > l.systemDefective)
      add += l.countedDefective - l.systemDefective;
    return s + add;
  }, 0);
  const countDecrease = countLines.reduce((s, l) => {
    let sub = 0;
    if (l.countedHealthy !== null && l.countedHealthy < l.systemHealthy)
      sub += l.systemHealthy - l.countedHealthy;
    if (l.countedDefective !== null && l.countedDefective < l.systemDefective)
      sub += l.systemDefective - l.countedDefective;
    return s + sub;
  }, 0);
  // ارزش اختلاف = جمع مبلغ اسناد اصلاح متصل (تأییدشده)
  const countAdjustValue = (chain?.dependents ?? [])
    .filter((d) => d.type === 'adjustment' && d.status === 'confirmed')
    .reduce((s, d) => s + d.totalAmount, 0);
  const relatedAdjustments = (chain?.dependents ?? []).filter((d) => d.type === 'adjustment');
  const isCountLinkedAdjustment = doc.type === 'adjustment' && !!chain?.refDoc && chain.refDoc.type === 'count';

  return (
    // ستون با حداقل ارتفاع کامل — نوار اقدام با sticky همیشه ثابت پایین می‌ماند
    <div className="min-h-full flex flex-col">
      <TopBar
        title={`${TYPE_LABELS[doc.type]} #${doc.number}`}
        subtitle={doc.dateJalali}
        onBack={() => navigate(-1)}
        showTheme
        rightSlot={<DocumentStatusBadge status={doc.status} />}
      />

      <div className="px-5 pt-3 flex-1">
        {/* هشدار برگشت/ابطال */}
        {doc.status === 'reversed' && (
          <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-card p-3 flex items-center gap-2">
            <Icon name="warning" size={16} className="text-red-600 flex-shrink-0" />
            <div className="text-[11px] text-red-600 font-semibold">
              این سند ابطال شده و اثر آن روی موجودی خنثی شده است
            </div>
          </div>
        )}

        {/* هشدار سند اصلاح متصل به انبارگردانی */}
        {isCountLinkedAdjustment && doc.status === 'confirmed' && (
          <div className="mb-3 bg-orange-soft border border-orange/20 rounded-card p-3 flex items-center gap-2">
            <Icon name="link" size={16} className="text-orange flex-shrink-0" />
            <div className="text-[11px] text-orange font-semibold">
              این سند اصلاح متصل به انبارگردانی است و فقط از طریق برگشت سند انبارگردانی قابل ابطال است
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
            {isCount && <InfoRow label="انبار" value={srcWh?.name ?? '—'} />}
            {isCount && <InfoRow label="حالت شمارش" value={COUNT_MODE_LABELS[doc.countMode ?? 'all'] ?? '—'} />}
            {!isCount && srcWh && <InfoRow label={doc.type === 'adjustment' ? 'انبار' : 'انبار مبدأ'} value={srcWh.name} />}
            {dstWh && <InfoRow label="انبار مقصد" value={dstWh.name} />}
            {doc.supplier && <InfoRow label="تامین‌کننده" value={doc.supplier} />}
            {doc.recipient && <InfoRow label="تحویل‌گیرنده" value={doc.recipient} />}
            {doc.referenceNumber && <InfoRow label="شماره مرجع" value={doc.referenceNumber} />}
            {doc.type === 'issue' && doc.issueType && (
              <InfoRow label="نوع خروج" value={ISSUE_TYPE_LABELS[doc.issueType] ?? doc.issueType} />
            )}
            {doc.type === 'issue' && doc.channelId && (
              <InfoRow
                label="کانال فروش"
                value={meta?.channels.find((c) => c.id === doc.channelId)?.name ?? '—'}
              />
            )}
            {doc.type === 'return' && doc.issueType && (
              <InfoRow label="نوع برگشت" value={ISSUE_TYPE_LABELS[doc.issueType] ?? doc.issueType} />
            )}
            {doc.type === 'adjustment' && (
              <>
                <InfoRow
                  label="نوع اصلاح"
                  value={doc.adjustmentDirection === 'decrease' ? 'کاهش موجودی' : 'افزایش موجودی'}
                />
                <InfoRow label="علت اصلاح" value={doc.adjustmentReason ?? '—'} />
              </>
            )}
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

        {/* سند مرجع */}
        {chain?.refDoc && (
          <button
            onClick={() => navigate(`/records/${chain.refDoc!.id}`)}
            className="w-full mb-3 bg-orange-soft border border-orange/20 rounded-card p-3 flex items-center gap-2.5 text-right transition-all active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-btn bg-orange text-white flex items-center justify-center flex-shrink-0">
              <Icon name={OP_ICONS[chain.refDoc.type]} size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-ink dark:text-cream">
                سند مرجع: {TYPE_LABELS[chain.refDoc.type]} #{chain.refDoc.number}
              </div>
              <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                {chain.refDoc.dateJalali}
              </div>
            </div>
            <DocumentStatusBadge status={chain.refDoc.status} />
            <Icon name="chevron-left" size={14} className="text-orange flex-shrink-0" />
          </button>
        )}

        {/* اقلام اسناد عادی */}
        {!isCount && (
          <>
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
                        <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{variant?.sku ?? '—'}</span>
                          {(doc.type === 'return' || doc.type === 'adjustment' || doc.type === 'issue') && (
                            <Badge variant={line.stockStatus === 'defective' ? 'danger' : 'success'} size="sm">
                              {line.stockStatus === 'defective' ? 'معیوب' : 'سالم'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`grid gap-2 mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 ${line.salePrice ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      <MiniStat label="تعداد" value={fmt(line.quantity)} />
                      <MiniStat label="بهای واحد" value={fmt(line.effectiveCost ?? line.unitCost)} />
                      {line.salePrice ? (
                        <MiniStat label="قیمت فروش" value={fmt(line.salePrice)} />
                      ) : null}
                      <MiniStat label="جمع" value={fmt(line.lineTotal)} highlight />
                    </div>
                    {line.salePrice ? (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-black/5 dark:border-cream/10">
                        <MiniStat
                          label="سود ناخالص ردیف"
                          value={fmt(line.quantity * line.salePrice - line.quantity * (line.effectiveCost ?? line.unitCost))}
                        />
                        <MiniStat
                          label="جمع فروش ردیف"
                          value={fmt(line.quantity * line.salePrice)}
                          highlight
                        />
                      </div>
                    ) : null}
                    {(line.balanceBefore !== null || line.balanceAfter !== null) && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-black/5 dark:border-cream/10">
                        <MiniStat label="موجودی قبل" value={fmt(line.balanceBefore ?? 0)} />
                        <MiniStat label="موجودی بعد" value={fmt(line.balanceAfter ?? 0)} highlight />
                      </div>
                    )}
                    {line.note && (
                      <div className="mt-2 text-[10px] text-muted-light dark:text-muted-dark">
                        توضیح: {line.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* جمع‌بندی */}
            <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-4">
              <SummaryRow
                label="جمع اقلام"
                value={fmt(
                  doc.totalAmount - (doc.shippingCost || 0) - (doc.otherExpenses || 0) + doc.discountTotal
                )}
              />
              {doc.discountTotal > 0 && <SummaryRow label="تخفیف" value={fmt(doc.discountTotal)} negative />}
              {doc.shippingCost > 0 && <SummaryRow label="هزینه حمل" value={fmt(doc.shippingCost)} />}
              {(doc.otherExpenses || 0) > 0 && <SummaryRow label="سایر هزینه‌ها" value={fmt(doc.otherExpenses)} />}
              <div className="h-px bg-black/5 dark:bg-cream/10 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] font-bold text-ink dark:text-cream">مبلغ نهایی</span>
                <span className="text-[15px] font-extrabold text-orange">
                  {fmt(doc.totalAmount)} <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">ریال</small>
                </span>
              </div>
            </div>
          </>
        )}

        {/* ردیف‌های انبارگردانی */}
        {isCount && (
          <>
            <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
              <Icon name="box" size={13} className="text-orange" />
              ردیف‌های شمارش ({countLines.length})
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {countLines.map((line: CountLine) => {
                const { variant, product } = getVariantInfo(line.variantId);
                const diffH = line.countedHealthy === null ? null : line.countedHealthy - line.systemHealthy;
                const diffD = line.countedDefective === null ? null : line.countedDefective - line.systemDefective;
                const diffCell = (diff: number | null) => (
                  <span
                    className={
                      diff === null
                        ? 'text-muted-light dark:text-muted-dark'
                        : diff === 0
                          ? 'text-green-700 dark:text-green-400'
                          : diff > 0
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-red-600'
                    }
                  >
                    {diff === null ? '—' : diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                  </span>
                );
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
                          {line.unitId ? ` • ${unitName(line.unitId)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10">
                      <MiniStat label="سیستمی سالم" value={fmt(line.systemHealthy)} />
                      <MiniStat label="شمارش سالم" value={line.countedHealthy === null ? '—' : fmt(line.countedHealthy)} />
                      <MiniStat label="اختلاف سالم" valueNode={diffCell(diffH)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      <MiniStat label="سیستمی معیوب" value={fmt(line.systemDefective)} />
                      <MiniStat label="شمارش معیوب" value={line.countedDefective === null ? '—' : fmt(line.countedDefective)} />
                      <MiniStat label="اختلاف معیوب" valueNode={diffCell(diffD)} />
                    </div>
                    {line.note && (
                      <div className="mt-2 text-[10px] text-muted-light dark:text-muted-dark">
                        توضیح: {line.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* نتیجه انبارگردانی */}
            <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-4">
              <div className="text-[11px] font-bold text-orange mb-2.5 flex items-center gap-1">
                <Icon name="chart" size={12} />
                نتیجه انبارگردانی
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniStatBox label="اقلام شمارش‌شده" value={`${countedCount} از ${countLines.length}`} />
                <MiniStatBox label="دارای مغایرت" value={fmt(varianceCount)} />
                <MiniStatBox label="جمع افزایش" value={`+${fmt(countIncrease)}`} tone="up" />
                <MiniStatBox label="جمع کاهش" value={`−${fmt(countDecrease)}`} tone="down" />
              </div>
              {doc.status === 'confirmed' && (
                <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 flex justify-between items-center">
                  <span className="text-[10.5px] text-muted-light dark:text-muted-dark font-medium">
                    ارزش مالی اختلاف اعمال‌شده
                  </span>
                  <span className="text-[12px] font-extrabold text-orange">{fmt(countAdjustValue)} ریال</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* اسناد اصلاح متصل (انبارگردانی) */}
        {isCount && relatedAdjustments.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
              <Icon name="link" size={13} className="text-orange" />
              سند اصلاح موجودی مرتبط
            </div>
            <div className="flex flex-col gap-2">
              {relatedAdjustments.map((d: Document) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/records/${d.id}`)}
                  className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 flex items-center gap-2.5 text-right w-full transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                    <Icon name="edit" size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-ink dark:text-cream">
                      اصلاح {d.adjustmentDirection === 'decrease' ? 'کاهشی' : 'افزایشی'} #{d.number}
                    </div>
                    <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                      علت: {d.adjustmentReason ?? '—'}
                    </div>
                  </div>
                  <DocumentStatusBadge status={d.status} />
                  <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* زنجیره اسناد */}
        {chain && (chain.refDoc || chain.dependents.length > 0) && (
          <div className="mt-3">
            <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
              <Icon name="link" size={13} className="text-orange" />
              زنجیره اسناد
            </div>
            <div className="flex flex-col gap-1.5">
              {chain.dependents.map((d) => (
                <DependentRow
                  key={d.id}
                  doc={d}
                  onClick={() => navigate(`/records/${d.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <DocumentActions doc={doc} onChanged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );

  function DependentRow({
    doc: d,
    onClick,
  }: {
    doc: Document;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn px-3 py-2 flex items-center gap-2 text-right w-full transition-all active:scale-[0.98]"
      >
        <div className="w-7 h-7 rounded-btn bg-black/5 dark:bg-cream/10 text-ink dark:text-cream flex items-center justify-center flex-shrink-0">
          <Icon name={OP_ICONS[d.type]} size={13} />
        </div>
        <span className="flex-1 text-[11.5px] font-bold text-ink dark:text-cream truncate">
          {OP_TYPE_LABELS[d.type]} #{d.number}
        </span>
        <DocumentStatusBadge status={d.status} />
        <Icon name="chevron-left" size={13} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
      </button>
    );
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-semibold">{label}</div>
      <div className="text-[11.5px] font-bold text-ink dark:text-cream mt-0.5 truncate">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueNode,
  highlight,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold">{label}</div>
      <div className={`text-[11.5px] font-bold mt-0.5 ${highlight ? 'text-orange' : 'text-ink dark:text-cream'}`}>
        {valueNode ?? value}
      </div>
    </div>
  );
}

function MiniStatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  const toneClass =
    tone === 'up'
      ? 'text-green-700 dark:text-green-400 bg-green-500/10'
      : tone === 'down'
        ? 'text-red-600 bg-red-500/10'
        : 'text-ink dark:text-cream bg-surface-light-2 dark:bg-surface-dark-2';
  return (
    <div className={`rounded-btn p-2.5 text-center ${toneClass}`}>
      <div className="text-[9.5px] text-muted-light dark:text-muted-dark">{label}</div>
      <div className="text-[13px] font-extrabold mt-0.5">{value}</div>
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
