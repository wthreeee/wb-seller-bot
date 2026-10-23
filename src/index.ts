// config.ts первым: выставляет московский часовой пояс до создания форматтеров дат
import { config } from './config.ts';

import { createBot } from './bot.ts';
import { createReports } from './report.ts';
import { everyDayAt } from './scheduler.ts';
import { createWbClient } from './wb/client.ts';
import { createDemoSource } from './wb/demo.ts';

if (!config.botToken) {
  console.error('Не задан BOT_TOKEN. Скопируйте .env.example в .env и вставьте токен от @BotFather.');
  console.error('Посмотреть отчёт без Telegram: npm run report');
  process.exit(1);
}

const source = config.wbToken ? createWbClient({ token: config.wbToken }) : createDemoSource();
const reports = createReports(source, { lowStockDays: config.lowStockDays });

const { bot, setup, sendDailyReport } = createBot({
  token: config.botToken,
  reports,
  adminIds: config.adminIds,
  reportTime: config.reportTime,
  proxyUrl: config.telegramProxy
});

await setup();
const stopSchedule = everyDayAt(config.reportTime, sendDailyReport);

void bot.start({
  onStart: (info) => {
    console.log(`Бот @${info.username} запущен`);
    console.log(source.mode === 'api' ? 'Данные: API Wildberries' : 'Данные: демо (WB_TOKEN не задан)');
    console.log(`Ежедневный отчёт в ${config.reportTime} МСК`);
    if (config.adminIds.length === 0) console.log('⚠️  ADMIN_IDS не задан — отправьте боту /myid и впишите ID');
  }
});

const shutdown = async () => {
  stopSchedule();
  await bot.stop();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
