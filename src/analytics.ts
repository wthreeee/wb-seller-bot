import type { WbOrder, WbSale, WbStock } from './wb/types.ts';

export type DaySummary = {
  day: string;
  ordersCount: number;
  ordersSum: number;
  cancels: number;
  salesCount: number;
  returnsCount: number;
  /** Сколько WB перечислит за продажи минус возвраты */
  forPay: number;
};

export type TopItem = { article: string; subject: string; count: number; sum: number };

export type StockForecast = {
  article: string;
  subject: string;
  quantity: number;
  /** Средние заказы в день за последние дни */
  perDay: number;
  /** На сколько дней хватит остатка; Infinity, если товар не заказывают */
  daysLeft: number;
};

const onDay = (day: string) => (row: { date: string }) => row.date.slice(0, 10) === day;

export function summarizeDay(orders: WbOrder[], sales: WbSale[], day: string): DaySummary {
  const dayOrders = orders.filter(onDay(day));
  const active = dayOrders.filter((o) => !o.isCancel);
  const daySales = sales.filter(onDay(day));
  return {
    day,
    ordersCount: active.length,
    ordersSum: Math.round(active.reduce((sum, o) => sum + o.priceWithDisc, 0)),
    cancels: dayOrders.length - active.length,
    salesCount: daySales.filter((s) => s.saleID.startsWith('S')).length,
    returnsCount: daySales.filter((s) => s.saleID.startsWith('R')).length,
    forPay: Math.round(daySales.reduce((sum, s) => sum + s.forPay, 0))
  };
}

/** Изменение в процентах; null, если сравнивать не с чем */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Количество заказов (без отмен) по каждому из дней */
export function ordersByDay(orders: WbOrder[], days: string[]): number[] {
  return days.map((day) => orders.filter((o) => !o.isCancel && o.date.slice(0, 10) === day).length);
}

export function topArticles(orders: WbOrder[], days: string[], limit: number): TopItem[] {
  const daySet = new Set(days);
  const byArticle = new Map<string, TopItem>();
  for (const o of orders) {
    if (o.isCancel || !daySet.has(o.date.slice(0, 10))) continue;
    const item = byArticle.get(o.supplierArticle) ?? { article: o.supplierArticle, subject: o.subject, count: 0, sum: 0 };
    item.count += 1;
    item.sum += o.priceWithDisc;
    byArticle.set(o.supplierArticle, item);
  }
  return [...byArticle.values()]
    .map((i) => ({ ...i, sum: Math.round(i.sum) }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit);
}

/** Прогноз остатков: сколько дней продержится товар при текущем темпе заказов */
export function forecastStocks(stocks: WbStock[], orders: WbOrder[], days: string[]): StockForecast[] {
  const daySet = new Set(days);
  const ordered = new Map<number, number>();
  for (const o of orders) {
    if (!o.isCancel && daySet.has(o.date.slice(0, 10))) ordered.set(o.nmId, (ordered.get(o.nmId) ?? 0) + 1);
  }
  return stocks
    .map((s) => {
      const quantity = s.warehouses.reduce((sum, w) => sum + (Number(w.quantity) || 0), 0);
      const perDay = (ordered.get(s.nmId) ?? 0) / Math.max(days.length, 1);
      return {
        article: s.vendorCode,
        subject: s.subjectName,
        quantity,
        perDay: Math.round(perDay * 10) / 10,
        daysLeft: perDay > 0 ? quantity / perDay : Infinity
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

const BARS = '▁▂▃▄▅▆▇█';

/** Мини-график из символов: ▁▃▅█ */
export function sparkline(values: number[]): string {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return BARS[3].repeat(values.length);
  return values.map((v) => BARS[Math.round(((v - min) / (max - min)) * (BARS.length - 1))]).join('');
}
