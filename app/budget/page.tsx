"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flower2 } from "lucide-react";
import Link from "next/link";
import { dateAfterMonths, projectBalance, type ExpenseInput, type IncomeInput, type LocaleCode, type RegionCode } from "@/lib/projection";

type Settings = {
  currency: string;
  locale: LocaleCode;
  region: RegionCode;
  currentBalanceCents: number;
};

type Planner = { settings: Settings; incomes: IncomeInput[]; expenses: ExpenseInput[] };
type User = { id: string; email: string; name: string | null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId() {
  return crypto.randomUUID().replaceAll("-", "");
}

function cents(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function format(centsValue: number, locale: LocaleCode, currency: string) {
  const language = locale === "vi" ? "vi-VN" : locale === "en" ? "en-GB" : "fr-FR";
  return new Intl.NumberFormat(language, { style: "currency", currency, maximumFractionDigits: 2 }).format(centsValue / 100);
}

const initialPlanner: Planner = {
  settings: { currency: "EUR", locale: "fr", region: "FR", currentBalanceCents: 0 },
  incomes: [],
  expenses: [],
};

export default function BudgetPage() {
  const [user, setUser] = useState<User | null>(null);
  const [planner, setPlanner] = useState<Planner>(initialPlanner);
  const [state, setState] = useState<"loading" | "signed-out" | "ready" | "saving" | "saved" | "error">("loading");
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const account = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!account.ok) {
          setState("signed-out");
          return;
        }
        const accountBody = (await account.json()) as { user: User };
        const response = await fetch("/api/planner", { credentials: "same-origin" });
        if (!response.ok) throw new Error("planner unavailable");
        const loadedPlanner = (await response.json()) as Planner;
        setUser(accountBody.user);
        setPlanner(loadedPlanner);
        setLastSavedSnapshot(JSON.stringify(loadedPlanner));
        setState("ready");
      } catch {
        setState("error");
      }
    }
    void load();
  }, []);

  const events = useMemo(() => projectBalance({
    currentBalanceCents: planner.settings.currentBalanceCents,
    incomes: planner.incomes,
    expenses: planner.expenses,
    region: planner.settings.region,
    through: dateAfterMonths(3),
  }), [planner]);
  const futureBalance = events.at(-1)?.balanceCents ?? planner.settings.currentBalanceCents;

  function updateSettings(update: Partial<Settings>) {
    setPlanner((value) => ({ ...value, settings: { ...value.settings, ...update } }));
    setState("ready");
  }

  function updateIncome(id: string, update: Partial<IncomeInput>) {
    setPlanner((value) => ({ ...value, incomes: value.incomes.map((income) => income.id === id ? { ...income, ...update } : income) }));
    setState("ready");
  }

  function updateExpense(id: string, update: Partial<ExpenseInput>) {
    setPlanner((value) => ({ ...value, expenses: value.expenses.map((expense) => expense.id === id ? { ...expense, ...update } : expense) }));
    setState("ready");
  }

  const snapshot = useMemo(() => JSON.stringify(planner), [planner]);

  const save = useCallback(async () => {
    const savedSnapshot = JSON.stringify(planner);
    setState("saving");
    try {
      const response = await fetch("/api/planner", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(planner),
      });
      if (!response.ok) throw new Error("save failed");
      setLastSavedSnapshot(savedSnapshot);
      setState("saved");
    } catch {
      setState("error");
    }
  }, [planner]);

  useEffect(() => {
    if (!user || (state !== "ready" && state !== "saved") || snapshot === lastSavedSnapshot) return;
    const timeout = window.setTimeout(() => { void save(); }, 700);
    return () => window.clearTimeout(timeout);
  }, [lastSavedSnapshot, save, snapshot, state, user]);

  if (state === "loading") return <main className="inner-page"><p>Chargement du budget.</p></main>;
  if (state === "signed-out") return <SignIn />;
  if (state === "error" && !user) return <main className="inner-page"><Link href="/">EDT.</Link><h1>Le budget est indisponible.</h1><p>Réessayez plus tard.</p></main>;

  return (
    <main className="inner-page budget-page">
      <header className="topbar">
        <Link className="wordmark mark-icon" href="/" aria-label="Accueil"><Flower2 aria-hidden="true" strokeWidth={1.75} /></Link>
        <nav aria-label="Navigation principale"><Link href="/">Outils</Link><a href="/account">Compte</a></nav>
        <span className="account-name">{user?.name ?? user?.email}</span>
      </header>

      <section className="budget-heading">
        <h1>Budget</h1>
        <p className={`save-indicator ${state}`} role="status">{state === "saving" ? "Enregistrement" : state === "error" ? "Échec de l’enregistrement" : "Enregistré automatiquement"}</p>
      </section>

      <section className="balance-strip" aria-label="Solde prévu">
        <div><span>Solde actuel</span><strong>{format(planner.settings.currentBalanceCents, planner.settings.locale, planner.settings.currency)}</strong></div>
        <div><span>Dans trois mois</span><strong>{format(futureBalance, planner.settings.locale, planner.settings.currency)}</strong></div>
        <p>Les échéances tombant un week-end ou un jour férié français passent au jour ouvré suivant.</p>
      </section>

      <section className="settings-row" aria-label="Réglages du budget">
        <label>Devise<select value={planner.settings.currency} onChange={(event) => updateSettings({ currency: event.target.value })}><option value="EUR">EUR</option><option value="USD">USD</option><option value="VND">VND</option><option value="GBP">GBP</option></select></label>
        <label>Langue<select value={planner.settings.locale} onChange={(event) => updateSettings({ locale: event.target.value as LocaleCode })}><option value="fr">Français</option><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
        <label>Jours fériés<select value={planner.settings.region} onChange={(event) => updateSettings({ region: event.target.value as RegionCode })}><option value="FR">France</option><option value="NONE">Aucun</option></select></label>
        <label>Solde de départ<input inputMode="decimal" value={(planner.settings.currentBalanceCents / 100).toString()} onChange={(event) => updateSettings({ currentBalanceCents: cents(event.target.value) })} /></label>
      </section>

      <section className="planner-section">
        <div className="section-heading"><div><h2>Revenus</h2></div><button type="button" onClick={() => setPlanner((value) => ({ ...value, incomes: [...value.incomes, { id: newId(), name: "Nouveau revenu", amountCents: 0, frequency: "monthly", nextDate: today(), active: true }] }))}>Ajouter</button></div>
        {planner.incomes.length === 0 ? <p className="empty-note">Ajoutez chaque source de revenu avec sa prochaine date.</p> : <div className="entry-table">{planner.incomes.map((income) => <div className="entry-row" key={income.id}>
          <input aria-label="Nom du revenu" value={income.name} onChange={(event) => updateIncome(income.id, { name: event.target.value })} />
          <input aria-label="Montant du revenu" inputMode="decimal" value={(income.amountCents / 100).toString()} onChange={(event) => updateIncome(income.id, { amountCents: cents(event.target.value) })} />
          <input aria-label="Prochaine date de revenu" type="date" value={income.nextDate} onChange={(event) => updateIncome(income.id, { nextDate: event.target.value })} />
          <select aria-label="Fréquence du revenu" value={income.frequency} onChange={(event) => updateIncome(income.id, { frequency: event.target.value as IncomeInput["frequency"] })}><option value="monthly">Chaque mois</option><option value="once">Une fois</option></select>
          <button className="remove-button" type="button" onClick={() => setPlanner((value) => ({ ...value, incomes: value.incomes.filter((item) => item.id !== income.id) }))}>Supprimer</button>
        </div>)}</div>}
      </section>

      <section className="planner-section">
        <div className="section-heading"><div><h2>Dépenses et BNPL</h2></div><button type="button" onClick={() => setPlanner((value) => ({ ...value, expenses: [...value.expenses, { id: newId(), label: "Nouvelle dépense", amountCents: 0, category: "bnpl", frequency: "monthly", dueDate: today(), installmentCount: 1, endDate: null, active: true }] }))}>Ajouter</button></div>
        {planner.expenses.length === 0 ? <p className="empty-note">Ajoutez vos paiements, y compris les échéances BNPL.</p> : <div className="entry-table">{planner.expenses.map((expense) => <div className={`entry-row expense-entry${expense.category === "bnpl" ? " bnpl-entry" : expense.frequency === "monthly" ? " monthly-expense-entry" : ""}`} key={expense.id}>
          <input aria-label="Nom de la dépense" value={expense.label} onChange={(event) => updateExpense(expense.id, { label: event.target.value })} />
          <input aria-label="Montant de la dépense" inputMode="decimal" value={(expense.amountCents / 100).toString()} onChange={(event) => updateExpense(expense.id, { amountCents: cents(event.target.value) })} />
          <input aria-label="Date de la dépense" type="date" value={expense.dueDate} onChange={(event) => updateExpense(expense.id, { dueDate: event.target.value })} />
          <select aria-label="Type de dépense" value={expense.category} onChange={(event) => { const category = event.target.value as ExpenseInput["category"]; updateExpense(expense.id, { category, frequency: category === "bnpl" ? "monthly" : expense.frequency, installmentCount: category === "bnpl" ? expense.installmentCount ?? 1 : null }); }}><option value="bnpl">BNPL</option><option value="bill">Facture</option><option value="other">Autre</option></select>
          <select aria-label="Fréquence de la dépense" value={expense.frequency} disabled={expense.category === "bnpl"} onChange={(event) => { const frequency = event.target.value as ExpenseInput["frequency"]; updateExpense(expense.id, { frequency, endDate: frequency === "monthly" ? expense.endDate : null }); }}><option value="monthly">Chaque mois</option>{expense.category !== "bnpl" ? <option value="once">Une fois</option> : null}</select>
          {expense.category === "bnpl" ? <label className="optional-field">Paiements<input aria-label="Nombre de paiements BNPL" type="number" min="1" max="120" inputMode="numeric" value={expense.installmentCount ?? 1} onChange={(event) => updateExpense(expense.id, { installmentCount: Math.max(1, Math.min(120, Math.trunc(Number(event.target.value) || 1))) })} /></label> : null}
          {expense.category !== "bnpl" && expense.frequency === "monthly" ? <label className="optional-field">Fin<input aria-label="Fin de la dépense mensuelle" type="date" value={expense.endDate ?? ""} onChange={(event) => updateExpense(expense.id, { endDate: event.target.value || null })} /></label> : null}
          <button className="remove-button" type="button" onClick={() => setPlanner((value) => ({ ...value, expenses: value.expenses.filter((item) => item.id !== expense.id) }))}>Supprimer</button>
        </div>)}</div>}
      </section>

      <section className="planner-section projection-section">
        <div className="section-heading"><div><h2>À venir</h2></div><span>{dateAfterMonths(3)}</span></div>
        {events.length === 0 ? <p className="empty-note">Ajoutez un revenu ou une dépense pour voir la projection.</p> : <ol className="projection-list">{events.map((event, index) => <li key={`${event.id}-${index}`}><time dateTime={event.date}>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${event.date}T00:00:00Z`))}</time><span>{event.label}</span><span className={event.kind === "income" ? "income" : "expense"}>{event.kind === "income" ? "+" : "−"}{format(Math.abs(event.amountCents), planner.settings.locale, planner.settings.currency)}</span><strong>{format(event.balanceCents, planner.settings.locale, planner.settings.currency)}</strong></li>)}</ol>}
      </section>
      {state === "saved" ? <p className="save-status" role="status">Enregistré.</p> : null}
      {state === "error" ? <p className="save-status error" role="alert">L&apos;enregistrement a échoué.</p> : null}
    </main>
  );
}

function SignIn() {
  const reason = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("signIn");
  return <main className="inner-page gate-page">
    <header className="topbar">
      <Link className="wordmark mark-icon" href="/" aria-label="Accueil"><Flower2 aria-hidden="true" strokeWidth={1.75} /></Link>
      <nav aria-label="Navigation principale"><Link href="/">Outils</Link><Link href="/account">Compte</Link></nav>
      <span className="language" lang="fr">FR</span>
    </header>
    <section className="sign-in-panel">
      <h1>Budget</h1>
      <div className="sign-in-card">
        <Flower2 aria-hidden="true" strokeWidth={1.35} />
        <a className="google-button" href="/api/auth/google">Se connecter avec Google</a>
        {reason ? <p className="error">La connexion n&apos;a pas abouti.</p> : null}
      </div>
    </section>
  </main>;
}
