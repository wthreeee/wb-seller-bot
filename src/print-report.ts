// Печатает отчёты в консоль — чтобы проверить токен WB или посмотреть отчёт без Telegram
import { config } from './config.ts';

import { createReports } from './report.ts';
import { createWbClient } from './wb/client.ts';
import { createDemoSource } from './wb/demo.ts';

const source = config.wbToken ? createWbClient({ token: config.wbToken }) : createDemoSource();
const reports = createReports(source, { lowStockDays: config.lowStockDays });
const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const which = process.argv[2] ?? 'report';
const builders: Record<string, () => Promise<string>> = {
  report: () => reports.daily(1),
  today: () => reports.daily(0),
  stocks: () => reports.stocks(),
  top: () => reports.top()
};

if (!builders[which]) {
  console.error(`Неизвестный отчёт «${which}». Доступны: ${Object.keys(builders).join(', ')}`);
  process.exit(1);
}
console.log(plain(await builders[which]()));
