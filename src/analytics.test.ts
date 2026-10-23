import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { changePercent, forecastStocks, sparkline, summarizeDay, topArticles } from './analytics.ts';
import type { WbOrder, WbSale, WbStock } from './wb/types.ts';

const order = (date: string, article: string, price: number, isCancel = false, nmId = 1): WbOrder => ({
  date: `${date}T12:00:00`,
  lastChangeDate: `${date}T12:00:00`,
  supplierArticle: article,
  nmId,
  subject: 'Пледы',
  brand: 'Тест',
  priceWithDisc: price,
  isCancel,
  srid: `${date}-${article}-${price}`
});

const sale = (date: string, saleID: string, forPay: number): WbSale => ({
  date: `${date}T15:00:00`,
  lastChangeDate: `${date}T15:00:00`,
  supplierArticle: 'A',
  nmId: 1,
  subject: 'Пледы',
  priceWithDisc: Math.abs(forPay),
  forPay,
  saleID,
  srid: saleID
});

describe('summarizeDay', () => {
  it('считает заказы без отмен, выкупы, возвраты и сумму к перечислению', () => {
    const orders = [order('2026-10-22', 'A', 1000), order('2026-10-22', 'B', 500, true), order('2026-10-21', 'A', 900)];
    const sales = [sale('2026-10-22', 'S1', 760), sale('2026-10-22', 'S2', 760), sale('2026-10-22', 'R1', -760)];
    assert.deepEqual(summarizeDay(orders, sales, '2026-10-22'), {
      day: '2026-10-22',
      ordersCount: 1,
      ordersSum: 1000,
      cancels: 1,
      salesCount: 2,
      returnsCount: 1,
      forPay: 760
    });
  });
});

describe('topArticles', () => {
  it('сортирует товары по выручке за выбранные дни', () => {
    const orders = [
      order('2026-10-22', 'A', 500),
      order('2026-10-22', 'B', 2000),
      order('2026-10-22', 'A', 500),
      order('2026-10-20', 'C', 9000)
    ];
    assert.deepEqual(
      topArticles(orders, ['2026-10-22'], 5).map((t) => [t.article, t.count, t.sum]),
      [
        ['B', 1, 2000],
        ['A', 2, 1000]
      ]
    );
  });
});

describe('forecastStocks', () => {
  it('считает, на сколько дней хватит остатка, и ставит самые срочные первыми', () => {
    const stocks: WbStock[] = [
      { vendorCode: 'SLOW', nmId: 1, subjectName: 'Пледы', brand: 'Т', warehouses: [{ warehouseName: 'Коледино', quantity: 30 }] },
      { vendorCode: 'FAST', nmId: 2, subjectName: 'Пледы', brand: 'Т', warehouses: [{ warehouseName: 'Коледино', quantity: 6 }, { warehouseName: 'Казань', quantity: 4 }] },
      { vendorCode: 'NONE', nmId: 3, subjectName: 'Пледы', brand: 'Т', warehouses: [] }
    ];
    const days = ['2026-10-21', '2026-10-22'];
    const orders = [
      order('2026-10-21', 'SLOW', 1, false, 1),
      ...Array.from({ length: 10 }, () => order('2026-10-22', 'FAST', 1, false, 2))
    ];
    const forecast = forecastStocks(stocks, orders, days);
    assert.deepEqual(
      forecast.map((f) => [f.article, f.quantity, f.daysLeft]),
      [
        ['FAST', 10, 2],
        ['SLOW', 30, 60],
        ['NONE', 0, Infinity]
      ]
    );
  });
});

describe('helpers', () => {
  it('рисует мини-график и считает изменение', () => {
    assert.equal(sparkline([0, 7, 14]), '▁▅█');
    assert.equal(sparkline([3, 3]), '▄▄');
    assert.equal(changePercent(110, 100), 10);
    assert.equal(changePercent(5, 0), null);
  });
});
