import { Bot, GrammyError, InlineKeyboard, type Context } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';

import type { Reports } from './report.ts';
import { WbApiError } from './wb/client.ts';

type BotOptions = {
  token: string;
  reports: Reports;
  adminIds: number[];
  reportTime: string;
  proxyUrl: string | null;
};

const menu = () =>
  new InlineKeyboard()
    .text('📊 Вчера', 'report')
    .text('⏱ Сегодня', 'today')
    .row()
    .text('📦 Остатки', 'stocks')
    .text('🏆 Топ за неделю', 'top');

export function createBot(options: BotOptions) {
  const { reports, adminIds } = options;
  const bot = new Bot(options.token, {
    client: options.proxyUrl ? { baseFetchConfig: { agent: new HttpsProxyAgent(options.proxyUrl) } } : undefined
  });

  // Отчёты — коммерческая информация: бот отвечает только владельцу и тем, кого он добавил
  bot.use(async (ctx, next) => {
    if (ctx.from && adminIds.includes(ctx.from.id)) return next();
    if (ctx.message?.text === '/myid') return next();
    await ctx.reply(
      adminIds.length === 0
        ? 'Бот ещё не настроен. Отправьте /myid и впишите свой ID в ADMIN_IDS.'
        : 'Это закрытый бот магазина. Доступ выдаёт владелец.'
    );
  });

  bot.command('myid', (ctx) => ctx.reply(`Ваш Telegram ID: ${ctx.from?.id}`));

  bot.command('start', (ctx) =>
    ctx.reply(
      `Привет! Я присылаю сводку по магазину на Wildberries каждый день в ${options.reportTime} (МСК) и показываю остатки по запросу.`,
      { reply_markup: menu() }
    )
  );

  async function send(ctx: Context, build: () => Promise<string>) {
    await ctx.replyWithChatAction('typing').catch(() => {});
    try {
      await ctx.reply(await build(), { parse_mode: 'HTML', reply_markup: menu() });
    } catch (error) {
      const message = error instanceof WbApiError ? error.message : 'Не удалось получить данные. Попробуйте позже';
      if (!(error instanceof WbApiError)) console.error(error);
      await ctx.reply(`⚠️ ${message}`);
    }
  }

  const handlers: Record<string, () => Promise<string>> = {
    report: () => reports.daily(1),
    today: () => reports.daily(0),
    stocks: () => reports.stocks(),
    top: () => reports.top()
  };

  for (const [name, build] of Object.entries(handlers)) {
    bot.command(name, (ctx) => send(ctx, build));
    bot.callbackQuery(name, async (ctx) => {
      await ctx.answerCallbackQuery();
      await send(ctx, build);
    });
  }

  bot.catch(({ error, ctx }) => {
    const description = error instanceof GrammyError ? error.description : String(error);
    console.error(`Ошибка при обработке update ${ctx.update.update_id}:`, description);
  });

  /** Утренняя рассылка отчёта за вчера всем получателям */
  async function sendDailyReport() {
    const text = await reports.daily(1);
    for (const chatId of adminIds) {
      await bot.api
        .sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: menu() })
        .catch((error) => console.warn(`Не удалось отправить отчёт ${chatId}:`, error.message));
    }
  }

  async function setup() {
    await bot.api.setMyCommands([
      { command: 'report', description: 'Отчёт за вчера' },
      { command: 'today', description: 'Сегодня на текущий момент' },
      { command: 'stocks', description: 'Остатки и прогноз' },
      { command: 'top', description: 'Топ товаров за неделю' }
    ]);
  }

  return { bot, setup, sendDailyReport };
}
