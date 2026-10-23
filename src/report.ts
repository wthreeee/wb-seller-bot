import {
  changePercent,
  forecastStocks,
  ordersByDay,
  summarizeDay,
  topArticles,
  type StockForecast
} from './analytics.ts';
import type { WbSource } from './wb/types.ts';

const money = (rub: number) => `${Math.round(rub).toLocaleString('ru-RU')} ₽`;
const dateLabel = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Последние n дней, заканчивая днём end (включительно), от старых к новым */
export function lastDays(end: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1 - i))));
}

const trend = (pct: number | null) =>
  pct === null ? '' : pct === 0 ? ' · без изменений' : pct > 0 ? ` ▲ ${pct}%` : ` ▼ ${Math.abs(pct)}%`;
const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const daysLeftLabel = (s: StockForecast) =>
  s.daysLeft === Infinity ? 'не продаётся' : s.daysLeft < 1 ? 'меньше дня' : `≈ ${Math.floor(s.daysLeft)} дн.`;

export type ReportOptions = { lowStockDays: number };

export function createReports(source: WbSource, options: ReportOptions, now: () => number = Date.now) {
  const demoNote = source.mode === 'demo' ? '\n<i>Демо-данные: подключите WB_TOKEN, чтобы видеть свой магазин</i>' : '';

  /** Сводка за день: day = 0 — сегодня (на текущий момент), 1 — вчера */
  async function daily(daysAgo: 0 | 1): Promise<string> {
    const today = new Date(now());
    const days = lastDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo), 8);
    const [orders, sales, stocks] = await Promise.all([source.orders(days[0]), source.sales(days[0]), source.stocks()]);

    const day = days[7];
    const current = summarizeDay(orders, sales, day);
    const previous = summarizeDay(orders, sales, days[6]);
    const week = days.slice(1);
    const top = topArticles(orders, [day], 3);
    const low = forecastStocks(stocks, orders, week).filter((s) => s.daysLeft < options.lowStockDays);

    const title = daysAgo === 0 ? `Сегодня, на ${new Date(now()).toTimeString().slice(0, 5)}` : `Отчёт за ${dateLabel.format(new Date(`${day}T12:00:00`))}`;
    // Сегодняшний неполный день со вчерашним полным не сравниваем
    const change = daysAgo === 0 ? null : changePercent(current.ordersSum, previous.ordersSum);
    const lines = [
      `📊 <b>${title}</b>`,
      '',
      `🛒 Заказы: <b>${current.ordersCount} шт · ${money(current.ordersSum)}</b>${trend(change)}${change ? ' к предыдущему дню' : ''}`,
      `💰 Выкупы: ${current.salesCount} шт · к перечислению ${money(current.forPay)}`,
      `↩️ Возвраты: ${current.returnsCount} · отмены: ${current.cancels}`,
      // Числа, а не символы-столбики: блочные символы ▁▃▅ в Telegram Web и на части устройств отображаются криво
      `📈 Заказы за 7 дней, шт: ${ordersByDay(orders, week).join(' → ')}`
    ];

    if (top.length > 0) {
      lines.push('', '🏆 <b>Лидеры дня</b>');
      top.forEach((t, i) => lines.push(`${i + 1}. ${escape(t.article)} — ${t.count} шт · ${money(t.sum)}`));
    }
    if (low.length > 0) {
      lines.push('', `⚠️ <b>Скоро закончатся</b> (меньше ${options.lowStockDays} дней)`);
      for (const s of low.slice(0, 5)) lines.push(`• ${escape(s.article)}: ${s.quantity} шт, хватит на ${daysLeftLabel(s)}`);
    }
    return lines.join('\n') + demoNote;
  }

  async function stocks(): Promise<string> {
    const today = new Date(now());
    const week = lastDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), 7);
    const [orders, stockRows] = await Promise.all([source.orders(week[0]), source.stocks()]);
    const forecast = forecastStocks(stockRows, orders, week);
    const lines = forecast.map((s) => {
      const mark = s.daysLeft < options.lowStockDays ? '🔴' : s.daysLeft < options.lowStockDays * 2 ? '🟡' : '🟢';
      return `${mark} ${escape(s.article)} — ${s.quantity} шт · ${s.perDay}/день · ${daysLeftLabel(s)}`;
    });
    return [`📦 <b>Остатки на складах WB</b>`, '<i>Прогноз по заказам за 7 дней</i>', '', ...lines].join('\n') + demoNote;
  }

  async function top(): Promise<string> {
    const today = new Date(now());
    const week = lastDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), 7);
    const orders = await source.orders(week[0]);
    const items = topArticles(orders, week, 10);
    const lines = items.map((t, i) => `${i + 1}. ${escape(t.article)} (${escape(t.subject)}) — ${t.count} шт · ${money(t.sum)}`);
    return [`🏆 <b>Топ товаров за 7 дней</b>`, '', ...(lines.length ? lines : ['Заказов не было'])].join('\n') + demoNote;
  }

  return { daily, stocks, top };
}

export type Reports = ReturnType<typeof createReports>;
