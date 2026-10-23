import type { WbOrder, WbSale, WbSource, WbStock } from './types.ts';

const STATISTICS_API = 'https://statistics-api.wildberries.ru';
const ANALYTICS_API = 'https://seller-analytics-api.wildberries.ru';

/** Данные в статистике WB обновляются раз в 30 минут — чаще запрашивать нет смысла */
const CACHE_TTL_MS = 30 * 60 * 1000;

type Fetch = typeof fetch;

export class WbApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const errorText: Record<number, string> = {
  401: 'Токен WB не подходит. Проверьте WB_TOKEN: нужен токен с доступом к категориям «Статистика» и «Аналитика»',
  402: 'WB требует оплату доступа к API для этого метода',
  403: 'У токена WB нет доступа к этому методу',
  429: 'WB ограничил частоту запросов. Попробуйте через минуту'
};

/**
 * Клиент API Wildberries: заказы, продажи, остатки.
 * Лимит WB — 1 запрос в минуту на метод, поэтому ответы кэшируются на 30 минут.
 */
export function createWbClient(options: {
  token: string;
  fetchImpl?: Fetch;
  /** Пауза между проверками готовности отчёта об остатках */
  pollIntervalMs?: number;
  now?: () => number;
}): WbSource {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const pollInterval = options.pollIntervalMs ?? 5000;
  const cache = new Map<string, { at: number; data: unknown }>();

  async function get<T>(url: string): Promise<T> {
    const response = await fetchImpl(url, { headers: { Authorization: options.token } });
    if (!response.ok) {
      throw new WbApiError(response.status, errorText[response.status] ?? `WB API ответил ошибкой ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_TTL_MS) return hit.data as T;
    const data = await load();
    cache.set(key, { at: now(), data });
    return data;
  }

  /**
   * Отчёты «Заказы» и «Продажи» с flag=0 отдают строки, изменённые после dateFrom (до 80 000 за раз).
   * Если строк больше, продолжаем с lastChangeDate последней строки.
   */
  async function loadChanged<T extends { lastChangeDate: string; date: string }>(path: string, dateFrom: string) {
    const rows: T[] = [];
    let cursor = dateFrom;
    for (let page = 0; page < 10; page++) {
      const batch = await get<T[]>(`${STATISTICS_API}${path}?dateFrom=${encodeURIComponent(cursor)}&flag=0`);
      if (batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < 80000) break;
      cursor = batch[batch.length - 1].lastChangeDate;
    }
    // Нам нужны строки по дате самого заказа, а не по дате изменения
    return rows.filter((r) => r.date.slice(0, 10) >= dateFrom);
  }

  /** Остатки строятся отчётом в три шага: создать задание → дождаться → скачать */
  async function loadStocks(): Promise<WbStock[]> {
    const created = await get<{ data: { taskId: string } }>(
      `${ANALYTICS_API}/api/v1/warehouse_remains?groupByNm=true&groupBySa=true`
    );
    const taskId = created.data.taskId;
    for (let attempt = 0; attempt < 24; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const status = await get<{ data: { status: string } }>(
        `${ANALYTICS_API}/api/v1/warehouse_remains/tasks/${taskId}/status`
      );
      if (status.data.status === 'done') {
        return get<WbStock[]>(`${ANALYTICS_API}/api/v1/warehouse_remains/tasks/${taskId}/download`);
      }
      if (status.data.status === 'canceled' || status.data.status === 'purged') {
        throw new WbApiError(500, 'WB отменил формирование отчёта об остатках');
      }
    }
    throw new WbApiError(504, 'Отчёт об остатках формируется слишком долго. Попробуйте позже');
  }

  return {
    mode: 'api',
    orders: (dateFrom) => cached(`orders:${dateFrom}`, () => loadChanged<WbOrder>('/api/v1/supplier/orders', dateFrom)),
    sales: (dateFrom) => cached(`sales:${dateFrom}`, () => loadChanged<WbSale>('/api/v1/supplier/sales', dateFrom)),
    stocks: () => cached('stocks', loadStocks)
  };
}
