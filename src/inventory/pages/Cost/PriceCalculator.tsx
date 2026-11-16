import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../lib/db';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Select } from '../../components/ui/Select';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { errMsg, fmt } from '../../lib/format';
import {
  calcScenarioAtBasePrice,
  fullCalc,
  paramsFromTemplate,
  resolveAllCostBases,
  scenarioTable,
  type CostBasisValue,
  type FeeLine,
  type PricingParams,
} from '../../lib/pricing';
import {
  defaultTemplateForProduct,
  getRoundingStep,
  registerSalePrice,
  saveCalcHistory,
} from '../../lib/pricingData';
import { COST_BASIS_LABELS, FEE_BASIS_LABELS } from '../../types';
import type { CostBasis, SalesChannel } from '../../types';

// ============================================================
// ماشین‌حساب قیمت‌گذاری
// - مبنای بهای تمام‌شده با هشدار صریح (بدون جایگزینی خودکار)
// - قیمت پایهٔ پیشنهادی = قیمت قبل از تخفیف
// - سناریوهای تخفیف فروشنده/پلتفرم/مشترک با سهم قابل تنظیم
// - جزئیات کامل اجزای محاسبه (شفافیت فرمول)
// ============================================================

function Money({ value, unit = 'ریال' }: { value: number; unit?: string }) {
  return (
    <span className="font-bold tabular-nums">
      {fmt(Math.round(value * 100) / 100)}{' '}
      <small className="text-[9px] font-medium text-muted-light dark:text-muted-dark">{unit}</small>
    </span>
  );
}

function Percent({ value }: { value: number }) {
  const rounded = Math.round(value * 100) / 100;
  const tone =
    rounded > 0
      ? 'text-green-700 dark:text-green-400'
      : rounded < 0
        ? 'text-red-600'
        : 'text-ink dark:text-cream';
  return <span className={`font-bold tabular-nums ${tone}`}>{rounded}٪</span>;
}

export function PriceCalculator() {
  const [searchParams] = useSearchParams();
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const channels = useLiveQuery(
    () => db.salesChannels.filter((c) => c.isActive).toArray(),
    []
  ) ?? [];

  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [basisOverride, setBasisOverride] = useState<CostBasis | null>(null);
  const [costBases, setCostBases] = useState<CostBasisValue[]>([]);
  const [roundingStep, setRoundingStep] = useState(0);

  // what-if پارامترها
  const [sellerDisc, setSellerDisc] = useState(0);
  const [platformDisc, setPlatformDisc] = useState(0);
  const [jointDisc, setJointDisc] = useState(0);
  const [jointShare, setJointShare] = useState(50);
  const [targetMargin, setTargetMargin] = useState(20);
  const [dirty, setDirty] = useState(false);

  const [savingCalc, setSavingCalc] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // پیش‌فرض‌ها
  useEffect(() => {
    getRoundingStep().then(setRoundingStep).catch(() => {});
  }, []);

  // پیش‌فرض کالا از query param
  useEffect(() => {
    const p = searchParams.get('product');
    if (p && products.some((x) => x.id === p)) setProductId(p);
     
  }, [searchParams, products.length > 0]);

  // انتخاب خودکار تنوع و الگو
  useEffect(() => {
    if (!productId) {
      setVariantId('');
      return;
    }
    const vs = variants.filter((v) => v.productId === productId && v.isActive);
    if (!vs.some((v) => v.id === variantId)) {
      setVariantId(vs[0]?.id ?? '');
    }
     
  }, [productId, variants]);

  useEffect(() => {
    if (!productId) return;
    defaultTemplateForProduct(productId).then((t) => {
      if (t) setTemplateId(t.id);
    });
     
  }, [productId]);

  // مبانی بهای تمام‌شده
  useEffect(() => {
    if (!variantId) {
      setCostBases([]);
      return;
    }
    let cancelled = false;
    resolveAllCostBases(variantId).then((list) => {
      if (!cancelled) setCostBases(list);
    });
    return () => {
      cancelled = true;
    };
  }, [variantId]);

  // همگام‌سازی what-if با الگو وقتی الگو عوض می‌شود
  const template = templates.find((t) => t.id === templateId) ?? null;
  useEffect(() => {
    if (template && !dirty) {
      setSellerDisc(template.sellerDiscountPercent);
      setPlatformDisc(template.platformDiscountPercent);
      setJointDisc(template.jointDiscountPercent);
      setJointShare(template.jointSellerSharePercent);
      setTargetMargin(template.targetMarginPercent);
    }
     
  }, [templateId]);

  const channel: SalesChannel | null = channels.find((c) => c.id === channelId) ?? null;
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const product = products.find((p) => p.id === productId) ?? null;

  const activeBasis: CostBasis = basisOverride ?? template?.costBasis ?? 'avg';
  const basisValue = costBases.find((b) => b.basis === activeBasis) ?? null;

  const params: PricingParams | null = useMemo(() => {
    if (!template || !basisValue || basisValue.value <= 0) return null;
    return paramsFromTemplate(
      template,
      channel,
      Math.max(1, quantity),
      basisValue.value,
      roundingStep,
      {
        sellerDiscountPercent: sellerDisc,
        platformDiscountPercent: platformDisc,
        jointDiscountPercent: jointDisc,
        jointSellerSharePercent: jointShare,
        targetMarginPercent: targetMargin,
      }
    );
     
  }, [
    template,
    channel,
    quantity,
    basisValue?.value,
    roundingStep,
    sellerDisc,
    platformDisc,
    jointDisc,
    jointShare,
    targetMargin,
  ]);

  const calc = useMemo(() => {
    if (!params) return null;
    return fullCalc(params);
  }, [params]);

  const scenarios = useMemo(() => {
    if (!params || !calc?.ok || !calc.breakdown) return [];
    return scenarioTable(params, calc.breakdown.basePrice);
  }, [params, calc]);

  const handleSaveCalc = async () => {
    if (!calc?.ok || !calc.breakdown || !params || !variant || !template) return;
    setSavingCalc(true);
    setError(null);
    try {
      await saveCalcHistory({
        variantId: variant.id,
        productId,
        templateId: template.id,
        templateName: template.name,
        channelId: channel?.id ?? null,
        channelName: channel?.name ?? null,
        params: {
          ...params,
          costBasis: activeBasis,
        },
        result: calc.breakdown,
        basePrice: calc.breakdown.roundedBasePrice ?? calc.breakdown.basePrice,
        note: null,
      });
      setSavedMsg('محاسبه در تاریخچه ذخیره شد');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSavingCalc(false);
    }
  };

  const handleRegisterPrice = async () => {
    if (!calc?.ok || !calc.breakdown || !variant) return;
    setError(null);
    try {
      const price = calc.breakdown.roundedBasePrice ?? calc.breakdown.basePrice;
      await registerSalePrice(variant.id, price, 'calc', null);
      setRegisterOpen(false);
      setSavedMsg(
        `قیمت فروش «${product?.name ?? 'کالا'}» به ${fmt(price)} ریال ثبت شد`
      );
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (e) {
      setError(errMsg(e));
      setRegisterOpen(false);
    }
  };

  const productVariants = variants.filter((v) => v.productId === productId && v.isActive);
  const b = calc?.breakdown ?? null;
  const feeLines: FeeLine[] = calc?.feeLines ?? [];

  return (
    <div className="pb-24">
      <TopBar
        title="ماشین‌حساب قیمت‌گذاری"
        subtitle="قیمت پایه، تخفیف‌ها، سود و سربه‌سر"
        onBack={() => window.history.back()}
        showTheme
      />

      <div className="px-5 pt-3 flex flex-col gap-3">
        {/* پیام موفقیت */}
        {savedMsg && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-card p-3 flex items-center gap-2">
            <Icon name="check" size={16} className="text-green-700 dark:text-green-400 flex-shrink-0" />
            <div className="text-[11px] text-green-700 dark:text-green-400 font-semibold">{savedMsg}</div>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-card p-3 flex items-center gap-2">
            <Icon name="warning" size={16} className="text-red-600 flex-shrink-0" />
            <div className="text-[11px] text-red-600 font-semibold">{error}</div>
          </div>
        )}

        {/* انتخاب کالا */}
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div className="text-[11px] font-bold text-orange flex items-center gap-1">
            <Icon name="box" size={12} />
            کالا و تنظیمات
          </div>
          <Select
            label="کالا"
            required
            leadingIcon={<Icon name="box" size={14} />}
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setBasisOverride(null);
            }}
            placeholder="انتخاب کنید"
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
          {productVariants.length > 1 && (
            <Select
              label="تنوع"
              required
              value={variantId}
              onChange={(e) => {
                setVariantId(e.target.value);
                setBasisOverride(null);
              }}
              options={productVariants.map((v) => ({ value: v.id, label: v.name }))}
            />
          )}
          <div className="grid grid-cols-3 gap-1.5">
            <Select
              label="الگو"
              required
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setDirty(false);
                setBasisOverride(null);
              }}
              placeholder="انتخاب کنید"
              options={templates.map((t) => ({
                value: t.id,
                label: `${t.name}${t.isDefault ? ' (پیش‌فرض)' : ''}`,
              }))}
            />
            <Select
              label="کانال فروش"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="بدون کانال"
              options={[
                { value: '', label: 'بدون کانال' },
                ...channels.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <div>
              <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
                تعداد
              </div>
              <MoneyInput value={quantity} onChange={(v) => setQuantity(Math.max(1, v))} allowDecimals ariaLabel="تعداد" />
            </div>
          </div>
        </div>

        {/* مبانی بهای تمام‌شده */}
        {variantId && (
          <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
            <div className="text-[11px] font-bold text-orange flex items-center gap-1">
              <Icon name="money" size={12} />
              مبنای بهای تمام‌شده
            </div>
            {costBases.map((cb) => (
              <button
                key={cb.basis}
                onClick={() => cb.available && setBasisOverride(cb.basis)}
                disabled={!cb.available}
                className={`rounded-btn p-2.5 text-right border transition-all ${
                  cb.basis === activeBasis
                    ? 'bg-orange-soft border-orange/40'
                    : 'bg-surface-light-2 dark:bg-surface-dark-2 border-black/5 dark:border-cream/10'
                } ${!cb.available ? 'opacity-60' : 'active:scale-[0.98]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink dark:text-cream">
                    {COST_BASIS_LABELS[cb.basis]}
                    {cb.basis === (template?.costBasis ?? 'avg') && (
                      <span className="text-[9px] text-orange font-semibold"> • الگو</span>
                    )}
                    {cb.basis === basisOverride && basisOverride !== template?.costBasis && (
                      <span className="text-[9px] text-orange font-semibold"> • انتخابی</span>
                    )}
                  </span>
                  {cb.available ? (
                    <Money value={cb.value} />
                  ) : (
                    <span className="text-[10px] text-red-600 font-semibold">در دسترس نیست</span>
                  )}
                </div>
                {cb.warning && (
                  <div className="text-[9.5px] text-red-600 mt-1 flex items-center gap-1">
                    <Icon name="warning" size={11} />
                    {cb.warning}
                  </div>
                )}
              </button>
            ))}
            {basisOverride && basisOverride !== template?.costBasis && (
              <button
                onClick={() => setBasisOverride(null)}
                className="text-[10px] text-orange font-bold text-right flex items-center gap-1"
              >
                <Icon name="refresh" size={11} />
                بازگشت به مبنای الگو
              </button>
            )}
          </div>
        )}

        {/* پارامترهای سناریو (what-if) */}
        {template && (
          <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-orange flex items-center gap-1">
                <Icon name="edit" size={12} />
                سناریو (تحلیل چه‌اگر)
              </div>
              {dirty && (
                <button
                  onClick={() => {
                    setSellerDisc(template.sellerDiscountPercent);
                    setPlatformDisc(template.platformDiscountPercent);
                    setJointDisc(template.jointDiscountPercent);
                    setJointShare(template.jointSellerSharePercent);
                    setTargetMargin(template.targetMarginPercent);
                    setDirty(false);
                  }}
                  className="text-[10px] font-bold text-orange flex items-center gap-1"
                >
                  <Icon name="refresh" size={11} />
                  بازگشت به الگو
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">تخفیف فروشنده (٪)</div>
                <MoneyInput value={sellerDisc} onChange={(v) => { setSellerDisc(v); setDirty(true); }} allowDecimals ariaLabel="تخفیف فروشنده" />
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">تخفیف پلتفرم (٪)</div>
                <MoneyInput value={platformDisc} onChange={(v) => { setPlatformDisc(v); setDirty(true); }} allowDecimals ariaLabel="تخفیف پلتفرم" />
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">تخفیف مشترک (٪)</div>
                <MoneyInput value={jointDisc} onChange={(v) => { setJointDisc(v); setDirty(true); }} allowDecimals ariaLabel="تخفیف مشترک" />
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">سهم فروشنده از مشترک (٪)</div>
                <MoneyInput value={jointShare} onChange={(v) => { setJointShare(v); setDirty(true); }} allowDecimals ariaLabel="سهم فروشنده" />
              </div>
            </div>
            <div>
              <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">حاشیهٔ سود هدف (٪)</div>
              <MoneyInput value={targetMargin} onChange={(v) => { setTargetMargin(v); setDirty(true); }} allowDecimals ariaLabel="حاشیه سود هدف" />
            </div>
            <div className="text-[9.5px] text-muted-light dark:text-muted-dark px-1 leading-relaxed">
              هر تخفیف درصدی از قیمت پایه است؛ در تخفیف مشترک، سهم فروشنده قابل تنظیم است و بقیه سهم پلتفرم می‌شود.
            </div>
          </div>
        )}

        {/* نتیجه */}
        {!template && (
          <div className="bg-orange-soft border border-orange/20 rounded-card p-3 text-[11px] text-orange font-semibold text-center">
            برای محاسبه، ابتدا کالا و الگو را انتخاب کنید
          </div>
        )}

        {template && basisValue && !basisValue.available && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-card p-3 text-[11px] text-red-600 font-semibold flex items-start gap-2">
            <Icon name="warning" size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              مبنای انتخابی الگو ({COST_BASIS_LABELS[activeBasis]}) در دسترس نیست: {basisValue.warning}
              می‌توانید اطلاعات را تکمیل کنید یا از کارت‌های بالا مبنای دیگری انتخاب کنید.
            </span>
          </div>
        )}

        {calc && !calc.ok && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-card p-3 text-[11px] text-red-600 font-semibold flex items-start gap-2">
            <Icon name="warning" size={14} className="flex-shrink-0 mt-0.5" />
            <span>{calc.reason}</span>
          </div>
        )}

        {calc?.ok && b && (
          <>
            {/* قیمت پایهٔ پیشنهادی */}
            <div className="bg-gradient-to-l from-orange to-[#c24815] rounded-card p-4 text-white shadow-[0_6px_20px_rgba(217,84,30,0.35)]">
              <div className="text-[10px] font-semibold opacity-80">قیمت پایهٔ پیشنهادی (قبل از تخفیف) — برای {fmt(quantity)} واحد</div>
              <div className="text-[22px] font-extrabold mt-1 tabular-nums">
                {fmt(b.roundedBasePrice ?? b.basePrice)}
                <small className="text-[11px] font-medium opacity-80"> ریال / واحد</small>
              </div>
              {b.roundedBasePrice !== null && b.roundedBasePrice !== b.basePrice && (
                <div className="text-[9.5px] opacity-80 mt-1 tabular-nums">
                  مقدار دقیق موتور: {fmt(b.basePrice)} ریال (گرد شده به نزدیک‌ترین {fmt(roundingStep)})
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-white/20 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[9px] opacity-75">پرداختی مشتری / واحد</div>
                  <div className="text-[11px] font-bold tabular-nums">{fmt(b.customerPaidUnit)}</div>
                </div>
                <div>
                  <div className="text-[9px] opacity-75">سود / واحد</div>
                  <div className="text-[11px] font-bold tabular-nums">{fmt(b.profitUnit)}</div>
                </div>
                <div>
                  <div className="text-[9px] opacity-75">حاشیهٔ سود</div>
                  <div className="text-[11px] font-bold tabular-nums">{b.marginPercent}٪</div>
                </div>
              </div>
            </div>

            {/* اکشن‌ها */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveCalc}
                disabled={savingCalc}
                className="py-2.5 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[11.5px] font-bold text-ink dark:text-cream flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Icon name="doc" size={14} className="text-orange" />
                ذخیره محاسبه
              </button>
              <button
                onClick={() => setRegisterOpen(true)}
                className="py-2.5 rounded-btn bg-orange text-white text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Icon name="tag" size={14} />
                ثبت قیمت فروش
              </button>
            </div>

            {/* جدول سناریوهای تخفیف */}
            {scenarios.length > 0 && (
              <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card overflow-hidden">
                <div className="px-3 pt-3 pb-2 text-[11px] font-bold text-ink dark:text-cream flex items-center gap-1">
                  <Icon name="compare" size={13} className="text-orange" />
                  سناریوهای تخفیف (بر مبنای قیمت پایهٔ پیشنهادی)
                </div>
                <div className="overflow-x-auto" style={{ overscrollBehavior: 'contain' }}>
                  <table className="w-full text-right [border-collapse:separate] [border-spacing:0]" style={{ minWidth: 560 }}>
                    <thead>
                      <tr className="bg-surface-light-2 dark:bg-surface-dark-2">
                        {['سناریو', 'پرداختی مشتری', 'سهم فروشنده', 'سهم پلتفرم', 'دریافتی خالص', 'هزینه‌ها', 'سود', 'حاشیه'].map((h) => (
                          <th key={h} className="sticky top-0 px-2 py-2 text-[9px] font-bold text-muted-light dark:text-muted-dark whitespace-nowrap border-b border-black/5 dark:border-cream/10 bg-surface-light-2 dark:bg-surface-dark-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s) => (
                        <tr key={s.key} className="border-b border-black/5 dark:border-cream/10 last:border-b-0">
                          <td className="px-2 py-2 text-[10px] font-bold text-ink dark:text-cream whitespace-nowrap">{s.label}</td>
                          <td className="px-2 py-2 text-[10px] text-ink dark:text-cream tabular-nums whitespace-nowrap">{fmt(s.breakdown.customerPaidTotal)}</td>
                          <td className="px-2 py-2 text-[10px] text-red-600 tabular-nums whitespace-nowrap">−{fmt(s.breakdown.sellerFundedTotal)}</td>
                          <td className="px-2 py-2 text-[10px] text-orange tabular-nums whitespace-nowrap">{fmt(s.breakdown.platformFundedTotal)}</td>
                          <td className="px-2 py-2 text-[10px] text-ink dark:text-cream tabular-nums whitespace-nowrap">{fmt(s.breakdown.sellerNetTotal)}</td>
                          <td className="px-2 py-2 text-[10px] text-ink dark:text-cream tabular-nums whitespace-nowrap">{fmt(s.breakdown.feesTotal)}</td>
                          <td className={`px-2 py-2 text-[10px] tabular-nums whitespace-nowrap ${s.breakdown.profitTotal >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                            {fmt(s.breakdown.profitTotal)}
                          </td>
                          <td className="px-2 py-2 text-[10px] tabular-nums whitespace-nowrap text-ink dark:text-cream">
                            {Math.round(s.breakdown.marginPercent * 100) / 100}٪
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 text-[9.5px] text-muted-light dark:text-muted-dark border-t border-black/5 dark:border-cream/10">
                  سهم فروشنده از تخفیف فروشنده کامل + سهم تنظیمی از تخفیف مشترک • سهم پلتفرم هرگز صفر فرض نمی‌شود
                </div>
              </div>
            )}

            {/* اجزای محاسبه — شفافیت کامل */}
            <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-1.5">
              <div className="text-[11px] font-bold text-ink dark:text-cream flex items-center gap-1 mb-1">
                <Icon name="list" size={13} className="text-orange" />
                اجزای محاسبه (برای {fmt(quantity)} واحد)
              </div>
              <Row label="مبنای بهای تمام‌شده" value={COST_BASIS_LABELS[activeBasis]} />
              <Row label="بهای تمام‌شدهٔ واحد" valueNode={<Money value={params?.costValue ?? 0} />} />
              <Row label="جمع بهای تمام‌شده" valueNode={<Money value={b.cogsTotal} />} />
              <div className="h-px bg-black/5 dark:bg-cream/10 my-1" />
              <Row label="قیمت پایه (واحد)" valueNode={<Money value={b.basePrice} />} />
              <Row label="جمع قیمت پایه" valueNode={<Money value={b.baseTotal} />} />
              <div className="h-px bg-black/5 dark:bg-cream/10 my-1" />
              <Row label="تخفیف فروشنده" valueNode={<Percent value={-b.sellerDiscountTotal} />} negative />
              <Row label="تخفیف پلتفرم (تأمین پلتفرم)" valueNode={<Money value={b.platformDiscountTotal} />} />
              <Row label="تخفیف مشترک" valueNode={<Money value={b.jointDiscountTotal} />} />
              <Row label="سهم فروشنده از مشترک" valueNode={<Money value={b.jointSellerShareAmount} />} />
              <Row label="سهم پلتفرم از مشترک" valueNode={<Money value={b.jointPlatformShareAmount} />} />
              <div className="h-px bg-black/5 dark:bg-cream/10 my-1" />
              <Row label="مبلغ پرداختی مشتری" valueNode={<Money value={b.customerPaidTotal} />} highlight />
              <Row label="سهم تأمین‌شده توسط پلتفرم" valueNode={<Money value={b.platformFundedTotal} />} />
              <Row label="دریافتی خالص فروشنده" valueNode={<Money value={b.sellerNetTotal} />} highlight />
              <div className="h-px bg-black/5 dark:bg-cream/10 my-1" />
              <Row label="هزینه‌های فروش (الگو + کانال)" valueNode={<Money value={b.feesTotal} />} />
              {feeLines.map((f, i) => (
                <Row
                  key={i}
                  label={`• ${f.title || 'هزینه'} (${f.source === 'template' ? 'الگو' : 'کانال'} — ${f.calcType === 'percent' ? `${f.value}٪ از ${FEE_BASIS_LABELS[f.basis]}` : `${fmt(f.value)} ریال / واحد`})`}
                  valueNode={<Money value={f.amount} />}
                  small
                />
              ))}
              {feeLines.length === 0 && <Row label="• هزینه‌ای تعریف نشده" value="۰" small />}
              <div className="h-px bg-black/5 dark:bg-cream/10 my-1" />
              <Row label="سود خالص" valueNode={<Percent value={b.profitTotal} />} highlight />
              <Row label="حاشیهٔ سود (سود ÷ پرداختی مشتری)" valueNode={<Percent value={b.marginPercent} />} />
              <Row label="نقطهٔ سربه‌سر (پرداختی مشتری / واحد)" valueNode={<Money value={b.breakevenCustomerPaidUnit} />} />
            </div>

            {/* فرمول‌ها */}
            <div className="bg-orange-soft border border-orange/20 rounded-card p-3">
              <div className="text-[10px] font-semibold text-orange leading-relaxed">
                فرمول‌ها: دریافتی خالص = پرداختی مشتری + سهم پلتفرم • سود خالص = دریافتی خالص − هزینه‌های فروش − بهای تمام‌شده •
                حاشیهٔ سود = سود ÷ پرداختی مشتری • قیمت پایه از حل معکوس خطی حاشیهٔ هدف به‌دست می‌آید.
              </div>
            </div>
          </>
        )}
      </div>

      {/* تأیید ثبت قیمت */}
      <ConfirmDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onConfirm={handleRegisterPrice}
        title="ثبت قیمت فروش؟"
        message={`قیمت فروش «${product?.name ?? ''}» به ${fmt(calc?.breakdown ? (calc.breakdown.roundedBasePrice ?? calc.breakdown.basePrice) : 0)} ریال ثبت می‌شود. قیمت قبلی در تاریخچهٔ قیمت‌ها نگه داشته می‌شود.`}
        confirmText="ثبت قیمت"
        loading={false}
      />
    </div>
  );

  function Row({
    label,
    value,
    valueNode,
    highlight,
    negative,
    small,
  }: {
    label: string;
    value?: string;
    valueNode?: React.ReactNode;
    highlight?: boolean;
    negative?: boolean;
    small?: boolean;
  }) {
    return (
      <div className="flex justify-between items-center gap-2">
        <span className={`${small ? 'text-[9.5px]' : 'text-[10.5px]'} text-muted-light dark:text-muted-dark font-medium flex-1 min-w-0 truncate`}>
          {label}
        </span>
        <span className={`${small ? 'text-[10px]' : 'text-[11px]'} ${highlight ? 'text-orange font-extrabold' : negative ? 'text-red-600' : 'text-ink dark:text-cream font-bold'}`}>
          {valueNode ?? value}
        </span>
      </div>
    );
  }
}
