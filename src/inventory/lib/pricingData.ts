import { db } from './db';
import { uid } from './ids';
import type {
  CalcHistory,
  CalcTemplate,
  FeeConfig,
  SalesChannel,
  TemplateProduct,
} from '../types';

// ============================================================
// لایهٔ دادهٔ ماژول قیمت‌گذاری — CRUD با اعتبارسنجی و گارد وابستگی
// ============================================================

// ---------- تنظیمات ----------
export const ROUNDING_SETTING_KEY = 'priceRounding';

export async function getRoundingStep(): Promise<number> {
  const row = await db.appSettings.get(ROUNDING_SETTING_KEY);
  const n = row ? parseInt(row.value, 10) : 0;
  return isNaN(n) ? 0 : n;
}

export async function setRoundingStep(step: number): Promise<void> {
  await db.appSettings.put({ key: ROUNDING_SETTING_KEY, value: String(step) });
}

// ---------- کانال‌های فروش ----------
export async function saveChannel(input: {
  id?: string;
  name: string;
  isActive: boolean;
  fees: FeeConfig[];
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('نام کانال فروش الزامی است');
  // اعتبارسنجی هزینه‌ها
  for (const f of input.fees) {
    if (!f.title.trim()) throw new Error('عنوان همهٔ هزینه‌ها الزامی است');
    if (f.calcType === 'percent' && (f.value < 0 || f.value > 100)) {
      throw new Error('مقدار هزینهٔ درصدی باید بین ۰ تا ۱۰۰ باشد');
    }
    if (f.calcType === 'fixed' && f.value < 0) {
      throw new Error('مبلغ هزینهٔ ثابت نمی‌تواند منفی باشد');
    }
    if (f.calcType === 'fixed' && f.basis !== 'per_unit') {
      // مبلغ ثابت فقط به‌ازای هر واحد یا کل معنا دارد — مبنا را per_unit می‌کنیم اگر خالی باشد
      f.basis = 'per_unit';
    }
  }

  const all = await db.salesChannels.toArray();
  if (all.some((c) => c.name === name && c.id !== input.id)) {
    throw new Error('کانالی با این نام قبلاً ثبت شده است');
  }

  if (input.id) {
    await db.salesChannels.update(input.id, {
      name,
      isActive: input.isActive,
      fees: input.fees,
    });
    return input.id;
  }
  const id = uid();
  await db.salesChannels.add({
    id,
    name,
    isActive: input.isActive,
    fees: input.fees,
    createdAt: Date.now(),
  });
  return id;
}

export async function deleteChannel(id: string): Promise<void> {
  const usedInDocs = await db.documents
    .filter((d) => d.channelId === id)
    .count();
  if (usedInDocs > 0) {
    throw new Error('این کانال در حواله‌های فروش استفاده شده و قابل حذف نیست');
  }
  const usedInHistory = await db.calcHistory
    .filter((h) => h.channelId === id)
    .count();
  if (usedInHistory > 0) {
    throw new Error('این کانال در محاسبات ذخیره‌شده استفاده شده و قابل حذف نیست');
  }
  await db.salesChannels.delete(id);
}

// ---------- الگوهای محاسباتی ----------
export async function saveTemplate(input: {
  id?: string;
  name: string;
  costBasis: CalcTemplate['costBasis'];
  targetMarginPercent: number;
  sellerDiscountPercent: number;
  platformDiscountPercent: number;
  jointDiscountPercent: number;
  jointSellerSharePercent: number;
  fees: FeeConfig[];
  isDefault: boolean;
  isActive: boolean;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('نام الگو الزامی است');
  if (input.targetMarginPercent < 0 || input.targetMarginPercent >= 100) {
    throw new Error('حاشیهٔ سود هدف باید بین ۰ تا ۱۰۰ درصد باشد');
  }
  for (const d of [
    input.sellerDiscountPercent,
    input.platformDiscountPercent,
    input.jointDiscountPercent,
  ]) {
    if (d < 0 || d > 100) throw new Error('نرخ تخفیف باید بین ۰ تا ۱۰۰ درصد باشد');
  }
  if (input.sellerDiscountPercent + input.platformDiscountPercent + input.jointDiscountPercent > 100) {
    throw new Error('جمع نرخ تخفیف‌ها نمی‌تواند از ۱۰۰ درصد بیشتر باشد');
  }
  if (input.jointSellerSharePercent < 0 || input.jointSellerSharePercent > 100) {
    throw new Error('سهم فروشنده از تخفیف مشترک باید بین ۰ تا ۱۰۰ باشد');
  }
  for (const f of input.fees) {
    if (!f.title.trim()) throw new Error('عنوان همهٔ هزینه‌ها الزامی است');
    if (f.calcType === 'percent' && (f.value < 0 || f.value > 100)) {
      throw new Error('مقدار هزینهٔ درصدی باید بین ۰ تا ۱۰۰ باشد');
    }
    if (f.calcType === 'fixed' && f.value < 0) {
      throw new Error('مبلغ هزینهٔ ثابت نمی‌تواند منفی باشد');
    }
    if (f.calcType === 'fixed' && f.basis !== 'per_unit') {
      f.basis = 'per_unit';
    }
  }

  const all = await db.calcTemplates.toArray();
  if (all.some((t) => t.name === name && t.id !== input.id)) {
    throw new Error('الگویی با این نام قبلاً ثبت شده است');
  }

  return await db.transaction('rw', db.calcTemplates, async () => {
    let id = input.id;
    const ts = Date.now();
    if (id) {
      await db.calcTemplates.update(id, {
        name,
        costBasis: input.costBasis,
        targetMarginPercent: input.targetMarginPercent,
        sellerDiscountPercent: input.sellerDiscountPercent,
        platformDiscountPercent: input.platformDiscountPercent,
        jointDiscountPercent: input.jointDiscountPercent,
        jointSellerSharePercent: input.jointSellerSharePercent,
        fees: input.fees,
        isDefault: input.isDefault,
        isActive: input.isActive,
        updatedAt: ts,
      });
    } else {
      id = uid();
      await db.calcTemplates.add({
        id,
        name,
        costBasis: input.costBasis,
        targetMarginPercent: input.targetMarginPercent,
        sellerDiscountPercent: input.sellerDiscountPercent,
        platformDiscountPercent: input.platformDiscountPercent,
        jointDiscountPercent: input.jointDiscountPercent,
        jointSellerSharePercent: input.jointSellerSharePercent,
        fees: input.fees,
        isDefault: input.isDefault,
        isActive: input.isActive,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    // فقط یک الگوی پیش‌فرض سراسری
    if (input.isDefault) {
      const others = await db.calcTemplates.filter((t) => t.id !== id && t.isDefault).toArray();
      for (const t of others) {
        await db.calcTemplates.update(t.id, { isDefault: false });
      }
    }
    return id;
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  const usedInHistory = await db.calcHistory
    .filter((h) => h.templateId === id)
    .count();
  if (usedInHistory > 0) {
    // سوابق محاسبات قبلی باید حفظ شوند — الگو فقط غیرفعال می‌شود
    throw new Error(
      'این الگو در محاسبات ذخیره‌شده استفاده شده و قابل حذف نیست (می‌توانید آن را غیرفعال کنید)'
    );
  }
  await db.transaction('rw', db.calcTemplates, db.templateProducts, async () => {
    await db.templateProducts.where('templateId').equals(id).delete();
    await db.calcTemplates.delete(id);
  });
}

// ---------- اتصال الگو به کالاها ----------
export async function assignTemplateProducts(
  templateId: string,
  productIds: string[]
): Promise<void> {
  await db.transaction('rw', db.templateProducts, async () => {
    await db.templateProducts.where('templateId').equals(templateId).delete();
    const rows: TemplateProduct[] = productIds.map((productId) => ({
      id: `${templateId}__${productId}`,
      templateId,
      productId,
    }));
    await db.templateProducts.bulkAdd(rows);
  });
}

export async function productsOfTemplate(templateId: string): Promise<string[]> {
  const rows = await db.templateProducts.where('templateId').equals(templateId).toArray();
  return rows.map((r) => r.productId);
}

export async function templatesOfProduct(productId: string): Promise<CalcTemplate[]> {
  const links = await db.templateProducts.where('productId').equals(productId).toArray();
  const ids = links.map((l) => l.templateId);
  const all = await db.calcTemplates.toArray();
  return all.filter((t) => ids.includes(t.id));
}

// الگوی پیش‌فرض برای یک کالا: اول الگوی متصل پیش‌فرض، سپس هر الگوی متصل، سپس الگوی سراسری پیش‌فرض
export async function defaultTemplateForProduct(productId: string): Promise<CalcTemplate | null> {
  const connected = await templatesOfProduct(productId);
  const active = connected.filter((t) => t.isActive);
  if (active.length > 0) {
    return active.find((t) => t.isDefault) ?? active[0];
  }
  const all = await db.calcTemplates.toArray();
  const globalDefault = all.find((t) => t.isDefault && t.isActive);
  return globalDefault ?? all.find((t) => t.isActive) ?? null;
}

// ---------- تاریخچهٔ محاسبات ----------
export async function saveCalcHistory(
  input: Omit<CalcHistory, 'id' | 'createdAt'>
): Promise<string> {
  const id = uid();
  await db.calcHistory.add({ ...input, id, createdAt: Date.now() });
  return id;
}

export async function deleteCalcHistory(id: string): Promise<void> {
  await db.calcHistory.delete(id);
}

// ---------- ثبت قیمت فروش کالا ----------
export async function registerSalePrice(
  variantId: string,
  newPrice: number,
  source: 'manual' | 'calc',
  calcId: string | null
): Promise<void> {
  if (newPrice < 0) throw new Error('قیمت نمی‌تواند منفی باشد');
  const variant = await db.variants.get(variantId);
  if (!variant) throw new Error('کالا یافت نشد');
  const oldPrice = variant.salePrice ?? 0;
  if (oldPrice === newPrice) return; // بدون تغییر — ثبت در تاریخچه لازم نیست
  await db.transaction('rw', db.variants, db.priceLog, async () => {
    await db.variants.update(variantId, { salePrice: newPrice });
    await db.priceLog.add({
      id: uid(),
      variantId,
      oldPrice,
      newPrice,
      source,
      calcId,
      createdAt: Date.now(),
    });
  });
}

// ---------- ثبت قیمت جایگزینی ----------
export async function registerReplacementPrice(
  variantId: string,
  price: number
): Promise<void> {
  if (price < 0) throw new Error('قیمت جایگزینی نمی‌تواند منفی باشد');
  await db.variants.update(variantId, { replacementPrice: price });
}
