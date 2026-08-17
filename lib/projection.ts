export type LocaleCode = "fr" | "en" | "vi";
export type RegionCode = "FR" | "NONE";
export type Frequency = "once" | "monthly";

export type IncomeInput = {
  id: string;
  name: string;
  amountCents: number;
  frequency: Frequency;
  nextDate: string;
  active: boolean;
};

export type ExpenseInput = {
  id: string;
  label: string;
  amountCents: number;
  category: "bnpl" | "bill" | "other";
  frequency: Frequency;
  dueDate: string;
  installmentCount: number | null;
  endDate: string | null;
  active: boolean;
};

export type ProjectionEvent = {
  id: string;
  date: string;
  label: string;
  amountCents: number;
  kind: "income" | "expense";
  balanceCents: number;
};

const DAY_MS = 86_400_000;

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

function frenchHolidayKeys(year: number) {
  const easter = easterSunday(year);
  return new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`,
    `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
    dateKey(addDays(easter, 1)), dateKey(addDays(easter, 39)), dateKey(addDays(easter, 50)),
  ]);
}

export function nextBusinessDay(value: string, region: RegionCode) {
  let date = parseDate(value);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || (region === "FR" && frenchHolidayKeys(date.getUTCFullYear()).has(dateKey(date)))) {
    date = addDays(date, 1);
  }
  return dateKey(date);
}

function nextMonth(value: string) {
  const date = parseDate(value);
  const day = date.getUTCDate();
  const nextMonth = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear() + Math.floor(nextMonth / 12);
  const month = nextMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return dateKey(new Date(Date.UTC(year, month, Math.min(day, lastDay))));
}

function occurrences(start: string, frequency: Frequency, end: string, maximumOccurrences: number | null = null, endDate: string | null = null) {
  const dates: string[] = [];
  let current = start;
  while (current <= end && (endDate === null || current <= endDate) && (maximumOccurrences === null || dates.length < maximumOccurrences)) {
    dates.push(current);
    if (frequency === "once") break;
    current = nextMonth(current);
  }
  return dates;
}

export function projectBalance({ currentBalanceCents, incomes, expenses, region, through }: {
  currentBalanceCents: number;
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  region: RegionCode;
  through: string;
}) {
  const events = [
    ...incomes.filter((income) => income.active).flatMap((income) => occurrences(income.nextDate, income.frequency, through).map((date) => ({ id: income.id, date: nextBusinessDay(date, region), label: income.name, amountCents: income.amountCents, kind: "income" as const }))),
    ...expenses.filter((expense) => expense.active).flatMap((expense) => occurrences(expense.dueDate, expense.frequency, through, expense.category === "bnpl" ? expense.installmentCount : null, expense.endDate).map((date) => ({ id: expense.id, date: nextBusinessDay(date, region), label: expense.label, amountCents: -expense.amountCents, kind: "expense" as const }))),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));

  let balanceCents = currentBalanceCents;
  return events.map((event) => {
    balanceCents += event.amountCents;
    return { ...event, balanceCents };
  });
}

export function dateAfterMonths(months: number) {
  const now = new Date();
  return dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate())));
}
