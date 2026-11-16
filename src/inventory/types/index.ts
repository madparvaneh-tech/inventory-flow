export type FlowType = 'IN' | 'OUT' | 'TRANSFER';
export type DocumentStatus = 'draft' | 'confirmed' | 'reversed';
export type FlowOperation =
  | 'receipt'
  | 'issue'
  | 'transfer'
  | 'return'
  | 'count'
  | 'adjustment'
  | 'status-change';

export type StockStatus = 'healthy' | 'defective' | 'in-transit';

// نوع اصلاح موجودی
export type AdjustmentDirection = 'increase' | 'decrease';

// نوع شمارش انبارگردانی
export type CountMode = 'all' | 'selected';

export interface Store {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  storeId: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  type: 'count' | 'weight' | 'volume' | 'length' | 'area' | 'other';
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  mainUnitId: string;
  subUnitId: string | null;
  conversionFactor: number;
  minStock: number;
  reorderPoint: number;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  isActive: boolean;
  // قیمت فروش ثبت‌شدهٔ فعلی (ریال) — با «قیمت پایهٔ پیشنهادی» متفاوت است
  salePrice: number | null;
  // قیمت جایگزینی — مبنای مستقل قیمت‌گذاری (ریال)
  replacementPrice: number | null;
}

export interface Barcode {
  id: string;
  variantId: string;
  code: string;
}

export interface Inventory {
  id: string;
  variantId: string;
  warehouseId: string;
  status: StockStatus;
  quantity: number;
  averageCost: number;
  lastMovementAt: number;
}

export interface Document {
  id: string;
  number: string;
  type: FlowOperation;
  status: DocumentStatus;
  storeId: string;
  // انبار مبدأ — در اسناد تک‌انباری (انبارگردانی/اصلاح) همان «انبار» سند است
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  dateJalali: string;
  dateEpoch: number;
  referenceDocId: string | null;
  note: string | null;
  supplier: string | null;
  referenceNumber: string | null;
  recipient: string | null;
  // نوع خروج (حواله) یا نوع برگشت (سند برگشت)
  issueType: string | null;
  // کانال فروش — فقط حوالهٔ فروش (اختیاری)
  channelId: string | null;
  shippingCost: number;
  otherExpenses: number;
  discountTotal: number;
  totalAmount: number;
  // مخصوص اصلاح موجودی
  adjustmentDirection: AdjustmentDirection | null;
  adjustmentReason: string | null;
  // مخصوص انبارگردانی
  countMode: CountMode | null;
  createdAt: number;
  confirmedAt: number | null;
  reversedAt: number | null;
}

export interface DocumentLine {
  id: string;
  documentId: string;
  variantId: string;
  quantity: number;
  unitId: string;
  unitCost: number;
  discount: number;
  lineTotal: number;
  stockStatus: StockStatus;
  note: string | null;
  // بهای موثر ثبت‌شده در لحظه تأیید (برای گزارش‌ها و ممیزی) — در پیش‌نویس null
  effectiveCost?: number | null;
  // موجودی قبل و بعد از اصلاح (فقط اسناد اصلاح موجودی)
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  // قیمت فروش واحد ثبت‌شده (فقط حوالهٔ فروش — اختیاری، ریال)
  salePrice?: number | null;
}

// ردیف شمارش انبارگردانی — مبنای سیستمی در لحظه ایجاد ثبت و ثابت می‌شود
// مقادیر null یعنی «شمارش نشده»؛ صفر یعنی «شمارش صفر»
export interface CountLine {
  id: string;
  documentId: string;
  variantId: string;
  unitId: string;
  systemHealthy: number;
  countedHealthy: number | null;
  systemDefective: number;
  countedDefective: number | null;
  note: string | null;
}

// علت‌های اصلاح موجودی (پیش‌فرض + دلایل اضافه‌شده توسط کاربر)
export interface AdjustmentReason {
  id: string;
  name: string;
}

// ============================================================
// ماژول بهای تمام‌شده و قیمت‌گذاری
// ============================================================

// مبنای بهای تمام‌شده برای قیمت‌گذاری (مفهوم جدا از روش ارزش‌گذاری موجودی)
export type CostBasis = 'avg' | 'last_purchase' | 'replacement';

// نوع محاسبهٔ هزینهٔ فروش
export type FeeCalcType = 'percent' | 'fixed';

// مبنای محاسبهٔ هزینه
// percent: درصدی از مبلغ قبل از تخفیف / بعد از تخفیف / پرداختی مشتری
// fixed: مبلغ ثابت — فقط مبنای «per_unit» معنا دارد (مبلغ به‌ازای هر واحد)
export type FeeBasis = 'before_discount' | 'after_discount' | 'customer_paid' | 'per_unit';

// یک هزینهٔ فروش (در الگو یا کانال)
export interface FeeConfig {
  id: string;
  title: string;
  calcType: FeeCalcType;
  // درصدی: مقدار ۰ تا ۱۰۰ | ثابت: مبلغ ریالی
  value: number;
  basis: FeeBasis;
}

// کانال فروش — هزینه‌ها به‌صورت آرایه روی خود کانال نگهداری می‌شود
export interface SalesChannel {
  id: string;
  name: string;
  isActive: boolean;
  fees: FeeConfig[];
  createdAt: number;
}

// الگوی محاسباتی قیمت‌گذاری
export interface CalcTemplate {
  id: string;
  name: string;
  // مبنای بهای تمام‌شده برای قیمت‌گذاری
  costBasis: CostBasis;
  // سود هدف — درصد حاشیه سود (سود ÷ مبلغ پرداختی مشتری)
  targetMarginPercent: number;
  // تخفیف‌ها — همه درصدی از قیمت پایه
  sellerDiscountPercent: number;
  platformDiscountPercent: number;
  jointDiscountPercent: number;
  // سهم فروشنده از تخفیف مشترک (۰ تا ۱۰۰) — بقیه سهم پلتفرم
  jointSellerSharePercent: number;
  // هزینه‌های فروش سطح الگو
  fees: FeeConfig[];
  // الگوی پیش‌فرض سراسری (فقط یک مورد)
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// اتصال چند‌به‌چند الگو ↔ کالا
export interface TemplateProduct {
  // `${templateId}__${productId}`
  id: string;
  templateId: string;
  productId: string;
}

// پارام‌های ذخیره‌شدهٔ یک محاسبه (اسنپ‌شات — با تغییر الگو/کانال تغییر نمی‌کند)
export interface PricingParamsSnapshot {
  quantity: number;
  costBasis: CostBasis;
  costValue: number;
  sellerDiscountPercent: number;
  platformDiscountPercent: number;
  jointDiscountPercent: number;
  jointSellerSharePercent: number;
  targetMarginPercent: number;
  fees: Array<FeeConfig & { source: 'template' | 'channel' }>;
  roundingStep: number;
}

// خروجی breakdown موتور قیمت‌گذاری — قابل ذخیره در JSON
export interface CalcBreakdownSnapshot {
  basePrice: number;
  baseTotal: number;
  sellerDiscountTotal: number;
  platformDiscountTotal: number;
  jointDiscountTotal: number;
  jointSellerShareAmount: number;
  jointPlatformShareAmount: number;
  customerPaidTotal: number;
  customerPaidUnit: number;
  platformFundedTotal: number;
  sellerFundedTotal: number;
  sellerNetTotal: number;
  sellerNetUnit: number;
  feesTotal: number;
  cogsTotal: number;
  profitTotal: number;
  profitUnit: number;
  marginPercent: number;
  breakevenCustomerPaidUnit: number;
  roundedBasePrice: number | null;
}

// سابقهٔ محاسبهٔ ذخیره‌شده
export interface CalcHistory {
  id: string;
  variantId: string;
  productId: string;
  templateId: string | null;
  templateName: string;
  channelId: string | null;
  channelName: string | null;
  params: PricingParamsSnapshot;
  result: CalcBreakdownSnapshot;
  // قیمت پایهٔ پیشنهادی نهایی (قبل از تخفیف، بعد از گرد کردن تنظیمی)
  basePrice: number;
  note: string | null;
  createdAt: number;
}

// تاریخچهٔ قیمت ثبت‌شدهٔ کالا
export interface PriceLog {
  id: string;
  variantId: string;
  oldPrice: number;
  newPrice: number;
  source: 'manual' | 'calc';
  calcId: string | null;
  createdAt: number;
}

// تنظیمات برنامه (کلید/مقدار) — فعلاً گام گرد کردن قیمت
export interface AppSetting {
  key: string;
  value: string;
}

// گام‌های گرد کردن قیمت
export const ROUNDING_STEPS = [0, 100, 500, 1000, 5000, 10000] as const;
export type RoundingStep = (typeof ROUNDING_STEPS)[number];

export const COST_BASIS_LABELS: Record<CostBasis, string> = {
  avg: 'میانگین موزون',
  last_purchase: 'آخرین قیمت خرید',
  replacement: 'قیمت جایگزینی',
};

export const FEE_BASIS_LABELS: Record<FeeBasis, string> = {
  before_discount: 'مبلغ قبل از تخفیف',
  after_discount: 'مبلغ بعد از تخفیف',
  customer_paid: 'مبلغ پرداختی مشتری',
  per_unit: 'به‌ازای هر واحد',
};
