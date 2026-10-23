// Поля ответов API Wildberries, которые использует бот (полный список — в документации dev.wildberries.ru).
// Даты приходят без часового пояса, по московскому времени: "2026-10-22T18:08:31".

/** Строка отчёта «Заказы»: 1 строка = 1 единица товара */
export type WbOrder = {
  date: string;
  lastChangeDate: string;
  supplierArticle: string;
  nmId: number;
  subject: string;
  brand: string;
  /** Цена со скидкой продавца */
  priceWithDisc: number;
  isCancel: boolean;
  srid: string;
};

/** Строка отчёта «Продажи»: продажа (saleID начинается с S) или возврат (с R) */
export type WbSale = {
  date: string;
  lastChangeDate: string;
  supplierArticle: string;
  nmId: number;
  subject: string;
  /** Сколько WB перечислит продавцу */
  forPay: number;
  priceWithDisc: number;
  saleID: string;
  srid: string;
};

/** Строка отчёта об остатках на складах WB (группировка по артикулу WB) */
export type WbStock = {
  vendorCode: string;
  nmId: number;
  subjectName: string;
  brand: string;
  warehouses: { warehouseName: string; quantity: number }[];
};

/** Источник данных: настоящий API или демо-данные */
export interface WbSource {
  readonly mode: 'api' | 'demo';
  /** Заказы с датой заказа не раньше dateFrom (YYYY-MM-DD) */
  orders(dateFrom: string): Promise<WbOrder[]>;
  /** Продажи и возвраты с датой не раньше dateFrom */
  sales(dateFrom: string): Promise<WbSale[]>;
  stocks(): Promise<WbStock[]>;
}
