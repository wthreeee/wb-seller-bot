export const config = {
  botToken: process.env.BOT_TOKEN?.trim() || null,
  /** Токен API продавца WB с доступом к «Статистике» и «Аналитике». Без него — демо-данные */
  wbToken: process.env.WB_TOKEN?.trim() || null,
  /** Кто может пользоваться ботом и получает ежедневный отчёт */
  adminIds: (process.env.ADMIN_IDS ?? '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0),
  /** Время ежедневного отчёта, по Москве */
  reportTime: process.env.REPORT_TIME ?? '09:00',
  /** Предупреждать, если остатка хватит меньше чем на столько дней */
  lowStockDays: Number(process.env.LOW_STOCK_DAYS ?? 7),
  telegramProxy: process.env.TELEGRAM_PROXY?.trim() || null
};

// Даты в API WB — по Москве, считаем в том же часовом поясе
process.env.TZ = 'Europe/Moscow';
