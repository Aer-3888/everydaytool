import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { incomeSources, plannedExpenses, plannerSettings } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import type { ExpenseInput, Frequency, IncomeInput, LocaleCode, RegionCode } from "@/lib/projection";

const DEFAULT_SETTINGS = { currency: "EUR", locale: "fr" as LocaleCode, region: "FR" as RegionCode, currentBalanceCents: 0 };
const MAX_ITEMS = 60;
const MAX_AMOUNT_CENTS = 1_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}

function money(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT_CENTS ? value : null;
}

function date(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null;
}

function frequency(value: unknown): Frequency | null {
  return value === "once" || value === "monthly" ? value : null;
}

function id(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12,80}$/u.test(value) ? value : null;
}

function installments(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 120 ? value : null;
}

function parseIncomes(value: unknown): IncomeInput[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const seen = new Set<string>();
  const result: IncomeInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const parsedId = id(item.id);
    const name = text(item.name, 80);
    const amountCents = money(item.amountCents);
    const nextDate = date(item.nextDate);
    const parsedFrequency = frequency(item.frequency);
    if (!parsedId || !name || amountCents === null || !nextDate || !parsedFrequency || typeof item.active !== "boolean" || seen.has(parsedId)) return null;
    seen.add(parsedId);
    result.push({ id: parsedId, name, amountCents, nextDate, frequency: parsedFrequency, active: item.active });
  }
  return result;
}

function parseExpenses(value: unknown): ExpenseInput[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const seen = new Set<string>();
  const result: ExpenseInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const parsedId = id(item.id);
    const label = text(item.label, 80);
    const amountCents = money(item.amountCents);
    const dueDate = date(item.dueDate);
    const endDate = item.endDate === null || item.endDate === undefined ? null : date(item.endDate);
    const parsedFrequency = frequency(item.frequency);
    const category = item.category === "bnpl" || item.category === "bill" || item.category === "other" ? item.category : null;
    const installmentCount = item.installmentCount === null ? null : installments(item.installmentCount);
    if (!parsedId || !label || amountCents === null || !dueDate || !parsedFrequency || !category || (item.endDate !== null && item.endDate !== undefined && endDate === null) || (endDate !== null && parsedFrequency !== "monthly") || (category === "bnpl" && (installmentCount === null || parsedFrequency !== "monthly")) || (category !== "bnpl" && installmentCount !== null) || typeof item.active !== "boolean" || seen.has(parsedId)) return null;
    seen.add(parsedId);
    result.push({ id: parsedId, label, amountCents, dueDate, frequency: parsedFrequency, category, installmentCount, endDate, active: item.active });
  }
  return result;
}

async function requireUser(request: Request) {
  const user = await currentUser(request);
  if (!user) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const db = getDb();
  const [savedSettings, incomes, expenses] = await Promise.all([
    db.select().from(plannerSettings).where(eq(plannerSettings.userId, user.id)).limit(1),
    db.select().from(incomeSources).where(eq(incomeSources.userId, user.id)).orderBy(asc(incomeSources.nextDate)),
    db.select().from(plannedExpenses).where(eq(plannedExpenses.userId, user.id)).orderBy(asc(plannedExpenses.dueDate)),
  ]);
  return Response.json({
    settings: savedSettings[0] ?? DEFAULT_SETTINGS,
    incomes: incomes.map((income) => ({
      id: income.id,
      name: income.name,
      amountCents: income.amountCents,
      frequency: income.frequency as Frequency,
      nextDate: income.nextDate,
      active: income.active,
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      label: expense.label,
      amountCents: expense.amountCents,
      category: expense.category as ExpenseInput["category"],
      frequency: expense.frequency as Frequency,
      dueDate: expense.dueDate,
      installmentCount: expense.installmentCount ?? (expense.category === "bnpl" ? 1 : null),
      endDate: expense.endDate,
      active: expense.active,
    })),
  });
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!isRecord(body) || !isRecord(body.settings)) return Response.json({ error: "Invalid planner data." }, { status: 400 });

  const currency = text(body.settings.currency, 3)?.toUpperCase();
  const locale = body.settings.locale === "fr" || body.settings.locale === "en" || body.settings.locale === "vi" ? body.settings.locale : null;
  const region = body.settings.region === "FR" || body.settings.region === "NONE" ? body.settings.region : null;
  const currentBalanceCents = typeof body.settings.currentBalanceCents === "number" && Number.isSafeInteger(body.settings.currentBalanceCents) && Math.abs(body.settings.currentBalanceCents) <= MAX_AMOUNT_CENTS ? body.settings.currentBalanceCents : null;
  const incomes = parseIncomes(body.incomes);
  const expenses = parseExpenses(body.expenses);
  if (!currency || !/^[A-Z]{3}$/u.test(currency) || !locale || !region || currentBalanceCents === null || !incomes || !expenses) {
    return Response.json({ error: "Invalid planner data." }, { status: 400 });
  }

  const statements = [
    env.DB.prepare("INSERT INTO planner_settings (user_id, currency, locale, region, current_balance_cents, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET currency = excluded.currency, locale = excluded.locale, region = excluded.region, current_balance_cents = excluded.current_balance_cents, updated_at = CURRENT_TIMESTAMP").bind(user.id, currency, locale, region, currentBalanceCents),
    env.DB.prepare("DELETE FROM income_sources WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM planned_expenses WHERE user_id = ?").bind(user.id),
    ...incomes.map((income) => env.DB.prepare("INSERT INTO income_sources (id, user_id, name, amount_cents, frequency, next_date, active) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(income.id, user.id, income.name, income.amountCents, income.frequency, income.nextDate, income.active ? 1 : 0)),
    ...expenses.map((expense) => env.DB.prepare("INSERT INTO planned_expenses (id, user_id, label, amount_cents, category, frequency, due_date, installment_count, end_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(expense.id, user.id, expense.label, expense.amountCents, expense.category, expense.frequency, expense.dueDate, expense.installmentCount, expense.endDate, expense.active ? 1 : 0)),
  ];
  await env.DB.batch(statements);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM income_sources WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM planned_expenses WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM planner_settings WHERE user_id = ?").bind(user.id),
  ]);
  return Response.json({ ok: true });
}
