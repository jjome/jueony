export const calendarStampFormats = ['date-dots', 'date-korean', 'date-iso', 'time', 'date-time'] as const;
export type CalendarStampFormat = typeof calendarStampFormats[number];
export type CalendarStamp = { year:number; month:number; day:number; hour:number; minute:number; second:number };
/** Local calendar components arrive through an adapter; this domain never reads a clock. */
export function formatCalendarStamp(value: CalendarStamp, format: unknown): string {
  if (!calendarStampFormats.includes(format as CalendarStampFormat)) throw new Error('지원하지 않는 날짜/시간 형식입니다.');
  if (!value || !Object.values(value).every(Number.isSafeInteger) || ![value.year,value.month,value.day,value.hour,value.minute,value.second].every(Number.isSafeInteger)
    || value.year < 1 || value.year > 9999 || value.month < 1 || value.month > 12 || value.hour < 0 || value.hour > 23 || value.minute < 0 || value.minute > 59 || value.second < 0 || value.second > 59) throw new Error('날짜/시간 값이 올바르지 않습니다.');
  const leap = value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0);
  const days = [31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if (value.day < 1 || value.day > days[value.month-1]) throw new Error('날짜/시간 값이 올바르지 않습니다.');
  const pad = (number:number) => String(number).padStart(2,'0');
  const date = `${String(value.year).padStart(4,'0')}.${pad(value.month)}.${pad(value.day)}`;
  const time = `${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}`;
  switch (format) {
    case 'date-dots': return date;
    case 'date-korean': return `${value.year}년 ${value.month}월 ${value.day}일`;
    case 'date-iso': return date.replaceAll('.','-');
    case 'time': return time;
    default: return `${date} ${time}`;
  }
}
