import { db } from './db';
import { uid } from './ids';
import type { Store, Warehouse, Category, Unit, Product } from '../types';

// ============================================================
// لایه مشترک CRUD اطلاعات پایه — شامل اعتبارسنجی و گاردهای حذف
// همه خطاها با پیام فارسی پرتاب می‌شوند تا در UI نمایش داده شوند
// ============================================================

// ---------- فروشگاه‌ها ----------
export async function saveStore(input: {
  id?: string;
  name: string;
  code: string;
  isActive: boolean;
}): Promise<string> {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new Error('نام فروشگاه الزامی است');
  if (!code) throw new Error('کد فروشگاه الزامی است');

  const all = await db.stores.toArray();
  if (all.some((s) => s.code.toLowerCase() === code.toLowerCase() && s.id !== input.id)) {
    throw new Error('کد فروشگاه تکراری است');
  }

  if (input.id) {
    await db.stores.update(input.id, { name, code, isActive: input.isActive });
    return input.id;
  }
  const id = uid();
  await db.stores.add({ id, name, code, isActive: input.isActive });
  return id;
}

export async function deleteStore(id: string): Promise<void> {
  const whs = await db.warehouses.where('storeId').equals(id).count();
  if (whs > 0) throw new Error('ابتدا انبارهای این فروشگاه را حذف کنید');
  const docs = await db.documents.where('storeId').equals(id).count();
  if (docs > 0) throw new Error('این فروشگاه در اسناد ثبت‌شده استفاده شده و قابل حذف نیست');
  await db.stores.delete(id);
}

// ---------- انبارها ----------
async function unsetOtherDefaults(storeId: string, exceptId: string) {
  const ws = await db.warehouses.where('storeId').equals(storeId).toArray();
  for (const w of ws) {
    if (w.id !== exceptId && w.isDefault) {
      await db.warehouses.update(w.id, { isDefault: false });
    }
  }
}

export async function saveWarehouse(input: {
  id?: string;
  storeId: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}): Promise<string> {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!input.storeId) throw new Error('فروشگاه را انتخاب کنید');
  if (!name) throw new Error('نام انبار الزامی است');
  if (!code) throw new Error('کد انبار الزامی است');

  const siblings = await db.warehouses.where('storeId').equals(input.storeId).toArray();
  if (siblings.some((w) => w.code.toLowerCase() === code.toLowerCase() && w.id !== input.id)) {
    throw new Error('کد انبار در این فروشگاه تکراری است');
  }

  return await db.transaction('rw', db.warehouses, async () => {
    let id = input.id;
    if (id) {
      await db.warehouses.update(id, {
        storeId: input.storeId,
        name,
        code,
        isDefault: input.isDefault,
        isActive: input.isActive,
      });
    } else {
      id = uid();
      await db.warehouses.add({
        id,
        storeId: input.storeId,
        name,
        code,
        isDefault: input.isDefault,
        isActive: input.isActive,
      });
    }
    if (input.isDefault) await unsetOtherDefaults(input.storeId, id);
    return id;
  });
}

export async function deleteWarehouse(id: string): Promise<void> {
  const inv = await db.inventory.where('warehouseId').equals(id).toArray();
  if (inv.some((i) => i.quantity > 0)) {
    throw new Error('این انبار دارای موجودی است و قابل حذف نیست');
  }
  const docs = await db.documents.filter(
    (d) => d.sourceWarehouseId === id || d.destinationWarehouseId === id
  ).count();
  if (docs > 0) throw new Error('این انبار در اسناد استفاده شده و قابل حذف نیست');
  // پاکسازی ردیف‌های صفر موجودی این انبار
  await db.inventory.where('warehouseId').equals(id).delete();
  await db.warehouses.delete(id);
}

// ---------- دسته‌بندی‌ها ----------
export async function saveCategory(input: {
  id?: string;
  parentId: string | null;
  name: string;
  code: string;
  isActive: boolean;
}): Promise<string> {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new Error('نام دسته الزامی است');
  if (!code) throw new Error('کد دسته الزامی است');

  const all = await db.categories.toArray();
  if (all.some((c) => c.code.toLowerCase() === code.toLowerCase() && c.id !== input.id)) {
    throw new Error('کد دسته تکراری است');
  }
  if (input.parentId && input.parentId === input.id) {
    throw new Error('دسته نمی‌تواند والد خودش باشد');
  }
  // جلوگیری از حلقه: والد نباید از نوادگان خودِ دسته باشد
  if (input.id && input.parentId) {
    let p: string | null = input.parentId;
    while (p) {
      if (p === input.id) throw new Error('انتخاب والد از نوادگان این دسته مجاز نیست');
      p = all.find((c) => c.id === p)?.parentId ?? null;
    }
  }

  if (input.id) {
    await db.categories.update(input.id, {
      parentId: input.parentId,
      name,
      code,
      isActive: input.isActive,
    });
    return input.id;
  }
  const id = uid();
  await db.categories.add({ id, parentId: input.parentId, name, code, isActive: input.isActive });
  return id;
}

export async function deleteCategory(id: string): Promise<void> {
  const children = await db.categories.where('parentId').equals(id).count();
  if (children > 0) throw new Error('ابتدا زیرشاخه‌های این دسته را حذف کنید');
  const products = await db.products.where('categoryId').equals(id).count();
  if (products > 0) throw new Error('این دسته در کالاها استفاده شده و قابل حذف نیست');
  await db.categories.delete(id);
}

// ---------- واحدها ----------
export async function saveUnit(input: {
  id?: string;
  name: string;
  symbol: string;
  type: Unit['type'];
}): Promise<string> {
  const name = input.name.trim();
  const symbol = input.symbol.trim();
  if (!name) throw new Error('نام واحد الزامی است');
  if (!symbol) throw new Error('نماد واحد الزامی است');

  const all = await db.units.toArray();
  if (all.some((u) => u.name === name && u.id !== input.id)) {
    throw new Error('واحدی با این نام قبلاً ثبت شده است');
  }

  if (input.id) {
    await db.units.update(input.id, { name, symbol, type: input.type });
    return input.id;
  }
  const id = uid();
  await db.units.add({ id, name, symbol, type: input.type });
  return id;
}

export async function deleteUnit(id: string): Promise<void> {
  const asMain = await db.products.where('mainUnitId').equals(id).count();
  if (asMain > 0) throw new Error('این واحد در کالاها استفاده شده و قابل حذف نیست');
  const asSub = await db.products.filter((p) => p.subUnitId === id).count();
  if (asSub > 0) throw new Error('این واحد در کالاها استفاده شده و قابل حذف نیست');
  await db.units.delete(id);
}

// ---------- کالاها ----------
export async function saveProduct(input: {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  mainUnitId: string;
  minStock: number;
  reorderPoint: number;
  isActive: boolean;
}): Promise<string> {
  const name = input.name.trim();
  const sku = input.sku.trim();
  if (!name) throw new Error('نام کالا الزامی است');
  if (!sku) throw new Error('کد کالا (SKU) الزامی است');
  if (!input.categoryId) throw new Error('دسته را انتخاب کنید');
  if (!input.mainUnitId) throw new Error('واحد اصلی را انتخاب کنید');
  if (input.minStock < 0 || input.reorderPoint < 0) {
    throw new Error('حداقل موجودی و نقطه سفارش نمی‌توانند منفی باشند');
  }

  const all = await db.products.toArray();
  if (all.some((p) => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== input.id)) {
    throw new Error('کد کالا (SKU) تکراری است');
  }

  return await db.transaction('rw', db.products, db.variants, async () => {
    if (input.id) {
      await db.products.update(input.id, {
        name,
        sku,
        categoryId: input.categoryId,
        brand: input.brand,
        model: input.model,
        description: input.description,
        mainUnitId: input.mainUnitId,
        minStock: input.minStock,
        reorderPoint: input.reorderPoint,
        isActive: input.isActive,
        updatedAt: Date.now(),
      });
      // همگام‌سازی کد تنوع‌های پیش‌فرض این کالا
      const vs = await db.variants.where('productId').equals(input.id).toArray();
      for (const v of vs) {
        if (v.sku !== sku) await db.variants.update(v.id, { sku });
      }
      return input.id;
    }

    const id = uid();
    const ts = Date.now();
    await db.products.add({
      id,
      name,
      sku,
      categoryId: input.categoryId,
      brand: input.brand,
      model: input.model,
      description: input.description,
      mainUnitId: input.mainUnitId,
      subUnitId: null,
      conversionFactor: 1,
      minStock: input.minStock,
      reorderPoint: input.reorderPoint,
      isActive: input.isActive,
      imageUrl: null,
      createdAt: ts,
      updatedAt: ts,
    });
    // هر کالای جدید یک تنوع پیش‌فرض می‌گیرد
    await db.variants.add({
      id: uid(),
      productId: id,
      name,
      sku,
      attributes: {},
      isActive: true,
      salePrice: null,
      replacementPrice: null,
    });
    return id;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const vs = await db.variants.where('productId').equals(id).toArray();
  for (const v of vs) {
    const used = await db.documentLines.where('variantId').equals(v.id).count();
    if (used > 0) {
      throw new Error('این کالا در اسناد گردش استفاده شده و قابل حذف نیست');
    }
  }
  await db.transaction('rw', db.products, db.variants, db.inventory, db.barcodes, async () => {
    for (const v of vs) {
      await db.inventory.where('variantId').equals(v.id).delete();
      await db.barcodes.where('variantId').equals(v.id).delete();
    }
    await db.variants.where('productId').equals(id).delete();
    await db.products.delete(id);
  });
}

// ---------- کمکی: نوادگان یک دسته (برای جلوگیری از حلقه در UI) ----------
export function getDescendantIds(categories: Category[], rootId: string): string[] {
  const out: string[] = [];
  const walk = (parentId: string) => {
    for (const c of categories) {
      if (c.parentId === parentId) {
        out.push(c.id);
        walk(c.id);
      }
    }
  };
  walk(rootId);
  return out;
}
