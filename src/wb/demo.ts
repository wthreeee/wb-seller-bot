import type { WbOrder, WbSale, WbSource, WbStock } from './types.ts';

/**
 * Демо-данные небольшого магазина товаров для дома — чтобы показать бота без токена WB.
 * Генератор детерминированный: при одной и той же дате цифры одинаковые.
 */

const products = [
  { article: 'PLED-200-GR', nmId: 182345671, subject: 'Пледы', price: 1890, popularity: 9, stock: 64 },
  { article: 'PLED-150-BG', nmId: 182345672, subject: 'Пледы', price: 1490, popularity: 6, stock: 18 },
  { article: 'PIL-50x70-2', nmId: 182345673, subject: 'Подушки', price: 1290, popularity: 7, stock: 120 },
  { article: 'TOWEL-SET-4', nmId: 182345674, subject: 'Полотенца', price: 990, popularity: 8, stock: 9 },
  { article: 'CANDLE-VAN', nmId: 182345675, subject: 'Свечи ароматические', price: 590, popularity: 5, stock: 210 },
  { article: 'MUG-CER-350', nmId: 182345676, subject: 'Кружки', price: 690, popularity: 4, stock: 75 },
  { article: 'BASKET-L', nmId: 182345677, subject: 'Корзины для хранения', price: 1190, popularity: 3, stock: 4 },
  { article: 'RUG-60x90', nmId: 182345678, subject: 'Коврики', price: 1590, popularity: 3, stock: 33 }
];

const BRAND = 'УютДом';
const COMMISSION = 0.24;

/** Простой детерминированный генератор случайных чисел */
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function createDemoSource(now: () => number = Date.now): WbSource {
  function generate(dateFrom: string) {
    const orders: WbOrder[] = [];
    const sales: WbSale[] = [];
    const today = new Date(now());
    const from = new Date(`${dateFrom}T00:00:00`);

    for (let d = new Date(from); d <= today; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      const random = seeded(Number(key.replace(/-/g, '')));
      // Выходные продают лучше, сегодняшний день — только прошедшие часы
      const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.3 : 1;
      const dayShare = key === dayKey(today) ? today.getHours() / 24 : 1;

      products.forEach((p, index) => {
        const count = Math.round(p.popularity * weekend * dayShare * (0.6 + random() * 0.8));
        for (let i = 0; i < count; i++) {
          const hour = String(Math.floor(random() * 24 * dayShare)).padStart(2, '0');
          const date = `${key}T${hour}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00`;
          const srid = `${key}.${index}.${i}`;
          const priceWithDisc = Math.round(p.price * (0.9 + random() * 0.15));
          const isCancel = random() < 0.06;
          orders.push({ date, lastChangeDate: date, supplierArticle: p.article, nmId: p.nmId, subject: p.subject, brand: BRAND, priceWithDisc, isCancel, srid });
          if (!isCancel && random() < 0.85) {
            const isReturn = random() < 0.04;
            sales.push({
              date,
              lastChangeDate: date,
              supplierArticle: p.article,
              nmId: p.nmId,
              subject: p.subject,
              priceWithDisc,
              forPay: Math.round(priceWithDisc * (1 - COMMISSION) * (isReturn ? -1 : 1)),
              saleID: `${isReturn ? 'R' : 'S'}${p.nmId}${i}`,
              srid
            });
          }
        }
      });
    }
    return { orders, sales };
  }

  const stocks = (): WbStock[] =>
    products.map((p) => ({
      vendorCode: p.article,
      nmId: p.nmId,
      subjectName: p.subject,
      brand: BRAND,
      warehouses: [
        { warehouseName: 'Коледино', quantity: Math.ceil(p.stock * 0.6) },
        { warehouseName: 'Казань', quantity: Math.floor(p.stock * 0.4) }
      ]
    }));

  return {
    mode: 'demo',
    orders: async (dateFrom) => generate(dateFrom).orders,
    sales: async (dateFrom) => generate(dateFrom).sales,
    stocks: async () => stocks()
  };
}
