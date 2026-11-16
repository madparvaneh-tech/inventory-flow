import Big from 'big.js';
import { db } from './db';
import type {
  CalcBreakdownSnapshot,
  CalcTemplate,
  CostBasis,
  FeeBasis,
  FeeCalcType,
  FeeConfig,
  PricingParamsSnapshot,
  SalesChannel,
} from '../types';

// ============================================================
// موتور قیمت‌گذاری — تمام محاسبات مالی با big.js (دقت اعشاری دقیق)
// میانگین موزون = روش ارزش‌گذاری موجودی است؛ مبنای قیمت‌گذاری
// می‌تواند میانگین موزون / آخرین قیمت خرید / قیمت جایگزینی باشد.
// قیمت پیشنهادی سیستم همیشه «قیمت پایه قبل از تخفیف» است.
// ============================================================

// گرد کردن فقط در نقاط تعریف‌شده انجام می‌شود؛ اعداد داخلی دست‌نخورده می‌مانند
export function applyRounding(value: number, step: number): number {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

const B = (n: number | string) => new Big(n);
const toNum = (b: Big) => b.toNumber();

// ---------- پارامترهای ورودی موتور ----------
export interface PricingParams {
  quantity: number;
  costValue: number; // بهای تمام‌شدهٔ واحد (ریال)
  sellerDiscountPercent: number;
  platformDiscountPercent: number;
  jointDiscountPercent: number;
  jointSellerSharePercent: number; // ۰..۱۰۰
  targetMarginPercent: number;
  fees: Array<FeeConfig & { source: 'template' | 'channel' }>;
  roundingStep: number;
}

export interface FeeLine {
  title: string;
  source: 'template' | 'channel';
  calcType: FeeCalcType;
  basis: FeeBasis;
  value: number; // درصد یا مبلغ ثابت (ورودی)
  amount: number; // مبلغ نهایی برای کل مقدار (ریال)
}

// مجموع ضرایب خطی هر هزینه نسبت به P×q (برای حل معکوس) + ثابت‌ها
interface FeeLinearTerms {
  // ضریب نسبی به P×q
  coef: Big;
  // مبالغ ثابت مستقل از P
  fixed: Big;
}

function feeTerms(
  fees: Array<Pick<FeeConfig, 'calcType' | 'value' | 'basis'>>,
  q: Big,
  dt: Big
): FeeLinearTerms {
  let coef = B(0);
  let fixed = B(0);
  for (const f of fees) {
    const r = B(f.value);
    if (f.calcType === 'percent') {
      const rate = r.div(100);
      if (f.basis === 'before_discount') {
        coef = coef.plus(rate);
      } else {
        // after_discount / customer_paid — در این مدل هر دو = P×q×(1−dt)
        coef = coef.plus(rate.mul(B(1).minus(dt)));
      }
    } else {
      if (f.basis === 'per_unit') {
        fixed = fixed.plus(r.mul(q));
      } else {
        // مبلغ ثابت کل (صرف‌نظر از مبنای مبلغی)
        fixed = fixed.plus(r);
      }
    }
  }
  return { coef, fixed };
}

// ---------- محاسبهٔ سناریو روی قیمت پایهٔ معلوم ----------
// خروجی کامل و قابل ردیابی — مبنای «شفافیت محاسبات»
export function calcScenarioAtBasePrice(
  params: PricingParams,
  basePrice: number
): { breakdown: CalcBreakdownSnapshot; feeLines: FeeLine[] } {
  const q = B(params.quantity || 1);
  const P = B(basePrice);
  const ds = B(params.sellerDiscountPercent || 0);
  const dp = B(params.platformDiscountPercent || 0);
  const dj = B(params.jointDiscountPercent || 0);
  const alpha = B(params.jointSellerSharePercent ?? 100).div(100); // سهم فروشنده از تخفیف مشترک

  const dt = ds.plus(dp).plus(dj); // مجموع نرخ تخفیف (درصد از پایه)

  const baseTotal = P.mul(q);
  const sellerDiscountTotal = baseTotal.mul(ds.div(100));
  const platformDiscountTotal = baseTotal.mul(dp.div(100));
  const jointDiscountTotal = baseTotal.mul(dj.div(100));
  const jointSellerShareAmount = jointDiscountTotal.mul(alpha);
  const jointPlatformShareAmount = jointDiscountTotal.minus(jointSellerShareAmount);

  const customerPaidTotal = baseTotal.mul(B(1).minus(dt.div(100)));
  const customerPaidUnit = q.gt(0) ? customerPaidTotal.div(q) : B(0);

  // سهم تأمین‌شده توسط پلتفرم = تخفیف پلتفرم + سهم پلتفرم از تخفیف مشترک
  const platformFundedTotal = platformDiscountTotal.plus(jointPlatformShareAmount);
  const sellerFundedTotal = sellerDiscountTotal.plus(jointSellerShareAmount);

  // دریافتی خالص فروشنده = پرداختی مشتری + سهم تأمین‌شدهٔ پلتفرم
  const sellerNetTotal = customerPaidTotal.plus(platformFundedTotal);
  const sellerNetUnit = q.gt(0) ? sellerNetTotal.div(q) : B(0);

  // هزینه‌های فروش
  const { coef, fixed } = feeTerms(params.fees, q, dt.div(100));
  const feesVariable = baseTotal.mul(coef);
  const feeLines: FeeLine[] = params.fees.map((f) => {
    let amount: Big;
    if (f.calcType === 'percent') {
      const rate = B(f.value).div(100);
      amount =
        f.basis === 'before_discount'
          ? baseTotal.mul(rate)
          : customerPaidTotal.mul(rate);
    } else if (f.basis === 'per_unit') {
      amount = B(f.value).mul(q);
    } else {
      amount = B(f.value);
    }
    return {
      title: f.title,
      source: f.source,
      calcType: f.calcType,
      basis: f.basis,
      value: f.value,
      amount: toNum(amount),
    };
  });
  const feesTotal = feesVariable.plus(fixed);

  const cogsTotal = B(params.costValue || 0).mul(q);
  const profitTotal = sellerNetTotal.minus(feesTotal).minus(cogsTotal);
  const profitUnit = q.gt(0) ? profitTotal.div(q) : B(0);

  const marginPercent =
    customerPaidTotal.gt(0)
      ? profitTotal.div(customerPaidTotal).mul(100)
      : B(0);

  // نقطه سربه‌سر — پرداختی مشتری به‌ازای هر واحد که سود صفر می‌شود
  // P_be·q·(netCoef − feeCoef) = cogs + feeFixed
  const netCoef = B(1).minus(ds.div(100)).minus(dj.div(100).mul(alpha));
  const denom = netCoef.minus(coef);
  let breakevenCustomerPaidUnit = 0;
  if (denom.gt(0) && q.gt(0)) {
    const Pbe = cogsTotal.plus(fixed).div(denom.mul(q));
    breakevenCustomerPaidUnit = toNum(Pbe.mul(B(1).minus(dt.div(100))));
  }

  const breakdown: CalcBreakdownSnapshot = {
    basePrice: toNum(P),
    baseTotal: toNum(baseTotal),
    sellerDiscountTotal: toNum(sellerDiscountTotal),
    platformDiscountTotal: toNum(platformDiscountTotal),
    jointDiscountTotal: toNum(jointDiscountTotal),
    jointSellerShareAmount: toNum(jointSellerShareAmount),
    jointPlatformShareAmount: toNum(jointPlatformShareAmount),
    customerPaidTotal: toNum(customerPaidTotal),
    customerPaidUnit: toNum(customerPaidUnit),
    platformFundedTotal: toNum(platformFundedTotal),
    sellerFundedTotal: toNum(sellerFundedTotal),
    sellerNetTotal: toNum(sellerNetTotal),
    sellerNetUnit: toNum(sellerNetUnit),
    feesTotal: toNum(feesTotal),
    cogsTotal: toNum(cogsTotal),
    profitTotal: toNum(profitTotal),
    profitUnit: toNum(profitUnit),
    marginPercent: toNum(marginPercent),
    breakevenCustomerPaidUnit,
    roundedBasePrice: null,
  };

  // گرد کردن تنظیمی فقط روی قیمت پایهٔ پیشنهادی نمایشی اعمال می‌شود
  breakdown.roundedBasePrice =
    params.roundingStep > 0 ? applyRounding(toNum(P), params.roundingStep) : null;

  return { breakdown, feeLines };
}

// ---------- حل معکوس قیمت پایه از حاشیهٔ سود هدف ----------
// همهٔ جملات خطی در P هستند → جواب بسته و دقیق
export function solveSuggestedBasePrice(
  params: PricingParams
): { ok: boolean; basePrice: number; reason: string | null } {
  const q = B(params.quantity || 1);
  const ds = B(params.sellerDiscountPercent || 0);
  const dp = B(params.platformDiscountPercent || 0);
  const dj = B(params.jointDiscountPercent || 0);
  const alpha = B(params.jointSellerSharePercent ?? 100).div(100);
  const m = B(params.targetMarginPercent || 0).div(100);
  const dt = ds.plus(dp).plus(dj).div(100);

  const cogs = B(params.costValue || 0).mul(q);
  const { coef, fixed } = feeTerms(params.fees, q, dt);

  // سود = حاشیه × پرداختی مشتری:
  // P·q·(netCoef − feeCoef − m·(1−dt)) = cogs + feeFixed
  const netCoef = B(1).minus(ds.div(100)).minus(dj.div(100).mul(alpha));
  const denom = netCoef.minus(coef).minus(m.mul(B(1).minus(dt)));

  if (denom.lte(0)) {
    return {
      ok: false,
      basePrice: 0,
      reason:
        'با این ترکیب تخفیف‌ها، هزینه‌ها و حاشیهٔ هدف، قیمت‌گذاری ممکن نیست (نرخ تخفیف/هزینه از حاشیهٔ هدف بیشتر است). تخفیف‌ها، هزینه‌ها یا حاشیهٔ هدف را کاهش دهید.',
    };
  }
  if (q.lte(0)) {
    return { ok: false, basePrice: 0, reason: 'تعداد باید بزرگتر از صفر باشد' };
  }

  const P = cogs.plus(fixed).div(denom.mul(q));
  const price = toNum(P);
  if (!isFinite(price) || price <= 0) {
    return {
      ok: false,
      basePrice: 0,
      reason: 'قیمت محاسبه‌شده معتبر نیست — بهای تمام‌شده و پارامترها را بررسی کنید',
    };
  }
  return { ok: true, basePrice: price, reason: null };
}

// ---------- محاسبهٔ کامل: حل + سناریو ----------
export function fullCalc(params: PricingParams): {
  ok: boolean;
  reason: string | null;
  breakdown: CalcBreakdownSnapshot | null;
  feeLines: FeeLine[];
} {
  const solved = solveSuggestedBasePrice(params);
  if (!solved.ok) {
    return { ok: false, reason: solved.reason, breakdown: null, feeLines: [] };
  }
  const { breakdown, feeLines } = calcScenarioAtBasePrice(params, solved.basePrice);
  return { ok: true, reason: null, breakdown, feeLines };
}

// ============================================================
// مبانی بهای تمام‌شده
// ============================================================

export interface CostBasisValue {
  basis: CostBasis;
  value: number;
  available: boolean;
  warning: string | null;
}

// میانگین موزون سراسری شرکت — از موتور موجودی
async function avgCostOf(variantId: string): Promise<number> {
  const list = await db.inventory.where('variantId').equals(variantId).toArray();
  const healthy = list.filter((i) => i.status === 'healthy' && i.quantity > 0);
  const totalQty = healthy.reduce((s, i) => s + i.quantity, 0);
  if (totalQty === 0) {
    const any = list.find((i) => i.averageCost > 0);
    return any?.averageCost ?? 0;
  }
  const totalValue = healthy.reduce((s, i) => s + i.quantity * i.averageCost, 0);
  return totalValue / totalQty;
}

// آخرین قیمت خرید = بهای موثر آخرین رسید تأییدشده (شامل سهم هزینه‌های توزیع‌شده)
export async function lastPurchaseCost(variantId: string): Promise<number> {
  const receipts = await db.documents
    .where('type')
    .equals('receipt')
    .filter((d) => d.status === 'confirmed')
    .toArray();
  receipts.sort(
    (a, b) => (b.confirmedAt ?? b.dateEpoch) - (a.confirmedAt ?? a.dateEpoch)
  );
  for (const r of receipts) {
    const lines = await db.documentLines.where('documentId').equals(r.id).toArray();
    const line = lines.find((l) => l.variantId === variantId);
    if (line) {
      return line.effectiveCost && line.effectiveCost > 0
        ? line.effectiveCost
        : line.unitCost;
    }
  }
  return 0;
}

// هر سه مبنای یک تنوع — برای نمایش مقایسه‌ای و هشدارها
export async function resolveAllCostBases(variantId: string): Promise<CostBasisValue[]> {
  const variant = await db.variants.get(variantId);
  const avg = await avgCostOf(variantId);
  const last = await lastPurchaseCost(variantId);
  const replacement = variant?.replacementPrice ?? 0;

  return [
    {
      basis: 'avg',
      value: avg,
      available: avg > 0,
      warning: avg > 0 ? null : 'میانگین موزونی محاسبه نشده — ابتدا رسید تأییدشده ثبت کنید',
    },
    {
      basis: 'last_purchase',
      value: last,
      available: last > 0,
      warning: last > 0 ? null : 'هیچ رسید تأییدشده‌ای برای این کالا ثبت نشده است',
    },
    {
      basis: 'replacement',
      value: replacement,
      available: replacement > 0,
      warning: replacement > 0 ? null : 'قیمت جایگزینی این کالا ثبت نشده — در فرم کالا تکمیل کنید',
    },
  ];
}

export async function resolveCostValue(
  variantId: string,
  basis: CostBasis
): Promise<CostBasisValue> {
  const all = await resolveAllCostBases(variantId);
  return all.find((b) => b.basis === basis)!;
}

// مبنای موثر محاسبه — اگر مبنای انتخابی در دسترس نباشد خطای صریح می‌دهیم
// (هیچ مقدار جایگزین به‌صورت خودکار انتخاب نمی‌شود)
export async function assertCostValue(
  variantId: string,
  basis: CostBasis
): Promise<number> {
  const b = await resolveCostValue(variantId, basis);
  if (!b.available) {
    throw new Error(b.warning ?? 'مبنای بهای تمام‌شده در دسترس نیست');
  }
  return b.value;
}

// ============================================================
// ساخت پارامترها از الگو + کانال
// ============================================================

export function paramsFromTemplate(
  template: CalcTemplate,
  channel: SalesChannel | null,
  quantity: number,
  costValue: number,
  roundingStep: number,
  overrides?: Partial<
    Pick<
      PricingParams,
      | 'sellerDiscountPercent'
      | 'platformDiscountPercent'
      | 'jointDiscountPercent'
      | 'jointSellerSharePercent'
      | 'targetMarginPercent'
    >
  >
): PricingParams {
  return {
    quantity,
    costValue,
    sellerDiscountPercent: overrides?.sellerDiscountPercent ?? template.sellerDiscountPercent,
    platformDiscountPercent: overrides?.platformDiscountPercent ?? template.platformDiscountPercent,
    jointDiscountPercent: overrides?.jointDiscountPercent ?? template.jointDiscountPercent,
    jointSellerSharePercent: overrides?.jointSellerSharePercent ?? template.jointSellerSharePercent,
    targetMarginPercent: overrides?.targetMarginPercent ?? template.targetMarginPercent,
    fees: [
      ...template.fees.map((f) => ({ ...f, source: 'template' as const })),
      ...(channel?.fees ?? []).map((f) => ({ ...f, source: 'channel' as const })),
    ],
    roundingStep,
  };
}

export function paramsSnapshot(
  p: PricingParams,
  costBasis: CostBasis
): PricingParamsSnapshot {
  return {
    quantity: p.quantity,
    costBasis,
    costValue: p.costValue,
    sellerDiscountPercent: p.sellerDiscountPercent,
    platformDiscountPercent: p.platformDiscountPercent,
    jointDiscountPercent: p.jointDiscountPercent,
    jointSellerSharePercent: p.jointSellerSharePercent,
    targetMarginPercent: p.targetMarginPercent,
    fees: p.fees,
    roundingStep: p.roundingStep,
  };
}

// سناریوهای مقایسه‌ای تخفیف — خروجی جدول سناریوها
export type DiscountScenarioKey = 'none' | 'seller' | 'platform' | 'joint';

export const DISCOUNT_SCENARIOS: Array<{
  key: DiscountScenarioKey;
  label: string;
}> = [
  { key: 'none', label: 'بدون تخفیف' },
  { key: 'seller', label: 'تخفیف فروشنده' },
  { key: 'platform', label: 'تخفیف پلتفرم' },
  { key: 'joint', label: 'تخفیف مشترک' },
];

export function scenarioParams(params: PricingParams, key: DiscountScenarioKey): PricingParams {
  switch (key) {
    case 'none':
      return {
        ...params,
        sellerDiscountPercent: 0,
        platformDiscountPercent: 0,
        jointDiscountPercent: 0,
        targetMarginPercent: 0,
      };
    case 'seller':
      return {
        ...params,
        platformDiscountPercent: 0,
        jointDiscountPercent: 0,
        targetMarginPercent: 0,
      };
    case 'platform':
      return {
        ...params,
        sellerDiscountPercent: 0,
        jointDiscountPercent: 0,
        targetMarginPercent: 0,
      };
    case 'joint':
      return {
        ...params,
        sellerDiscountPercent: 0,
        platformDiscountPercent: 0,
        targetMarginPercent: 0,
      };
  }
}

// قیمت پایهٔ مرجع برای سناریوها = قیمت پایهٔ حل‌شدهٔ سناریوی اصلی (بدون حاشیهٔ هدف؟)
// برای مقایسهٔ منصفانه، قیمت پایهٔ سناریوی اصلی (شامل سود هدف) روی همه اعمال می‌شود
export function scenarioTable(
  params: PricingParams,
  referenceBasePrice: number
): Array<{ key: DiscountScenarioKey; label: string; breakdown: CalcBreakdownSnapshot }> {
  return DISCOUNT_SCENARIOS.map(({ key, label }) => {
    const sp = scenarioParams(params, key);
    const { breakdown } = calcScenarioAtBasePrice(sp, referenceBasePrice);
    return { key, label, breakdown };
  });
}

// برآورد هزینه‌های فروش یک فروش واقعی با تنظیمات فعلی کانال
// (برای گزارش‌های سود — بدون تخفیف؛ قیمت ثبت‌شده مبنای قبل از تخفیف فرض می‌شود)
export function estimateSaleFees(
  fees: FeeConfig[],
  unitPrice: number,
  quantity: number
): number {
  const { breakdown } = calcScenarioAtBasePrice(
    {
      quantity,
      costValue: 0,
      sellerDiscountPercent: 0,
      platformDiscountPercent: 0,
      jointDiscountPercent: 0,
      jointSellerSharePercent: 0,
      targetMarginPercent: 0,
      fees: fees.map((f) => ({ ...f, source: 'channel' as const })),
      roundingStep: 0,
    },
    unitPrice
  );
  return breakdown.feesTotal;
}

// نقطه سربه‌سر بر پایهٔ قیمت پایه (بدون تخفیف):
// قیمتی که سود صفر شود با در نظر گرفتن اثر هزینه‌های وابسته به قیمت
export function breakevenBasePrice(
  fees: FeeConfig[],
  costValue: number,
  quantity: number
): number {
  const q = B(quantity || 1);
  const dt = B(0);
  const { coef, fixed } = feeTerms(fees, q, dt);
  const denom = B(1).minus(coef);
  if (denom.lte(0)) return Infinity;
  const cogs = B(costValue || 0).mul(q);
  return toNum(cogs.plus(fixed).div(denom.mul(q)));
}
