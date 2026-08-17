import { describe, expect, it } from "vitest";
import { nextBusinessDay, projectBalance } from "./projection";

describe("nextBusinessDay", () => {
  it("moves a weekend date to Monday", () => {
    expect(nextBusinessDay("2026-08-15", "FR")).toBe("2026-08-17");
  });

  it("moves the French national holiday on 14 July", () => {
    expect(nextBusinessDay("2026-07-14", "FR")).toBe("2026-07-15");
  });
});

describe("projectBalance", () => {
  it("orders income and expenses and calculates the running balance", () => {
    const events = projectBalance({
      currentBalanceCents: 10_000,
      region: "NONE",
      through: "2026-10-01",
      incomes: [{ id: "income123456", name: "Pay", amountCents: 200_000, frequency: "once", nextDate: "2026-08-20", active: true }],
      expenses: [{ id: "expense123456", label: "Installment", amountCents: 50_000, category: "bnpl", frequency: "monthly", dueDate: "2026-08-21", installmentCount: 1, endDate: null, active: true }],
    });
    expect(events.map((event) => event.balanceCents)).toEqual([210_000, 160_000]);
  });

  it("stops a BNPL payment after its last instalment", () => {
    const events = projectBalance({
      currentBalanceCents: 0,
      region: "NONE",
      through: "2026-12-31",
      incomes: [],
      expenses: [{ id: "expense123456", label: "Phone", amountCents: 10_000, category: "bnpl", frequency: "monthly", dueDate: "2026-08-15", installmentCount: 3, endDate: null, active: true }],
    });
    expect(events).toHaveLength(3);
    expect(events.at(-1)?.balanceCents).toBe(-30_000);
  });

  it("stops a monthly expense on its chosen end date", () => {
    const events = projectBalance({
      currentBalanceCents: 0,
      region: "NONE",
      through: "2026-12-31",
      incomes: [],
      expenses: [{ id: "expense123456", label: "Subscription", amountCents: 2_000, category: "bill", frequency: "monthly", dueDate: "2026-08-15", installmentCount: null, endDate: "2026-10-15", active: true }],
    });
    expect(events).toHaveLength(3);
    expect(events.at(-1)?.balanceCents).toBe(-6_000);
  });
});
