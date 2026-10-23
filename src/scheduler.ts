/** Сколько миллисекунд до ближайшего наступления времени HH:MM (по часовому поясу процесса) */
export function msUntil(time: string, now: number): number {
  const [h, m] = time.split(':').map(Number);
  const current = new Date(now);
  const target = new Date(current.getFullYear(), current.getMonth(), current.getDate(), h, m);
  if (target.getTime() <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now;
}

/** Запускает task каждый день в указанное время. Возвращает функцию остановки */
export function everyDayAt(time: string, task: () => Promise<void>): () => void {
  let timer: NodeJS.Timeout;
  const schedule = () => {
    timer = setTimeout(async () => {
      try {
        await task();
      } catch (error) {
        console.error('Ошибка ежедневной задачи:', error);
      }
      schedule();
    }, msUntil(time, Date.now()));
  };
  schedule();
  return () => clearTimeout(timer);
}
