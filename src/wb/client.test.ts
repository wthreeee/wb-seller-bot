import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { msUntil } from '../scheduler.ts';
import { WbApiError, createWbClient } from './client.ts';

/** Подменяет fetch: отвечает по совпадению части URL и записывает запросы */
function fakeFetch(routes: [string, unknown, number?][]) {
  const calls: { url: string; auth: string | null }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, auth: new Headers(init?.headers).get('Authorization') });
    const route = routes.find(([part]) => url.includes(part));
    if (!route) throw new Error(`Неожиданный запрос ${url}`);
    return new Response(JSON.stringify(route[1]), { status: route[2] ?? 200 });
  }) as typeof fetch;
  return { calls, impl };
}

describe('клиент WB API', () => {
  it('запрашивает заказы с токеном и оставляет только заказы с нужной даты', async () => {
    const api = fakeFetch([
      [
        '/supplier/orders',
        [
          { date: '2026-10-21T10:00:00', lastChangeDate: '2026-10-22T08:00:00', nmId: 1 },
          { date: '2026-10-22T11:00:00', lastChangeDate: '2026-10-22T11:00:00', nmId: 2 }
        ]
      ]
    ]);
    const client = createWbClient({ token: 'secret', fetchImpl: api.impl });

    const orders = await client.orders('2026-10-22');

    assert.deepEqual(orders.map((o) => o.nmId), [2]);
    assert.equal(api.calls[0].auth, 'secret');
    assert.match(api.calls[0].url, /statistics-api\.wildberries\.ru\/api\/v1\/supplier\/orders\?dateFrom=2026-10-22&flag=0/);
  });

  it('кэширует ответ, чтобы не упираться в лимит 1 запрос в минуту', async () => {
    const api = fakeFetch([['/supplier/sales', []]]);
    const client = createWbClient({ token: 't', fetchImpl: api.impl });
    await client.sales('2026-10-22');
    await client.sales('2026-10-22');
    assert.equal(api.calls.length, 1);
  });

  it('получает остатки в три шага: задание, статус, скачивание', async () => {
    const api = fakeFetch([
      ['/status', { data: { status: 'done' } }],
      ['/download', [{ vendorCode: 'A', nmId: 1, warehouses: [{ warehouseName: 'Коледино', quantity: 5 }] }]],
      ['/warehouse_remains?', { data: { taskId: 'task-1' } }]
    ]);
    const client = createWbClient({ token: 't', fetchImpl: api.impl, pollIntervalMs: 0 });

    const stocks = await client.stocks();

    assert.equal(stocks[0].vendorCode, 'A');
    assert.deepEqual(
      api.calls.map((c) => new URL(c.url).pathname),
      [
        '/api/v1/warehouse_remains',
        '/api/v1/warehouse_remains/tasks/task-1/status',
        '/api/v1/warehouse_remains/tasks/task-1/download'
      ]
    );
  });

  it('переводит ошибки WB в понятные сообщения', async () => {
    const api = fakeFetch([['/supplier/orders', { title: 'unauthorized' }, 401]]);
    const client = createWbClient({ token: 'bad', fetchImpl: api.impl });
    await assert.rejects(client.orders('2026-10-22'), (e) => e instanceof WbApiError && /Токен WB/.test(e.message));
  });
});

describe('расписание', () => {
  it('считает время до ближайшего отчёта', () => {
    process.env.TZ = 'Europe/Moscow';
    const at = (h: number, m: number) => new Date(2026, 9, 23, h, m).getTime();
    assert.equal(msUntil('09:00', at(8, 30)), 30 * 60 * 1000);
    assert.equal(msUntil('09:00', at(9, 0)), 24 * 60 * 60 * 1000);
  });
});
