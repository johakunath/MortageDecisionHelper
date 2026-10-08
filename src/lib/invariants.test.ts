import { describe, expect, it } from "vitest";
import {
  buildApartmentInputs,
  buildScenario,
  buildScenarios,
  buildWaitScenario,
  compareEkScenarios,
  ekStepReturn,
  interestForPlan,
  wealthAtHorizon,
} from "./calculations";
import { DEFAULT_APARTMENT_CASES, DEFAULT_INPUTS, DEFAULT_RATES, EK_SCENARIOS } from "./defaults";

/**
 * Properties that must hold for any sensible input, independent of what the defaults
 * happen to be. They pin the arithmetic the trade-off statements are built on, so a
 * future change cannot quietly break the identity that makes those statements true.
 */
const apartments = DEFAULT_APARTMENT_CASES.map((apartment) => [
  apartment.label,
  buildApartmentInputs(DEFAULT_INPUTS, apartment),
] as const);

describe("engine invariants", () => {
  it.each(apartments)(
    "%s: at one Monatsrate, the Restschuld gap is exactly extra EK + interest saved",
    (_label, inputs) => {
      // Both sides pay the same rate and the same Sondertilgung (well under either cap),
      // so the bank receives the same cash; whatever less EK still owes after the
      // binding is the extra loan plus the extra interest. This identity is what makes
      // `interestSavedFixed − ETF growth` a terminal-wealth difference.
      const scenarios = buildScenarios(EK_SCENARIOS, inputs, DEFAULT_RATES);
      for (let i = 0; i < scenarios.length; i += 1) {
        for (let j = i + 1; j < scenarios.length; j += 1) {
          const from = scenarios[i];
          const to = scenarios[j];
          const tradeoff = compareEkScenarios(from, to, inputs);
          expect(from.mortgage.remainingAfterFixed - to.mortgage.remainingAfterFixed).toBeCloseTo(
            tradeoff.extraCashRequired + tradeoff.interestSavedFixed,
            4,
          );
        }
      }
    },
  );

  it.each(apartments)("%s: more Sondertilgung never costs more interest", (_label, inputs) => {
    for (const base of EK_SCENARIOS) {
      let previous = Infinity;
      for (const annual of [0, 1000, 3000, 6000, 12000, 50000]) {
        const interest = interestForPlan(base, inputs, DEFAULT_RATES, { kind: "flat", annual });
        expect(interest).toBeLessThanOrEqual(previous + 1e-6);
        previous = interest;
      }
    }
  });

  it.each(apartments)("%s: waiting zero months is buying now", (_label, inputs) => {
    for (const base of EK_SCENARIOS) {
      const now = buildScenario(base, inputs, DEFAULT_RATES);
      const wait = buildWaitScenario(base, now, inputs, DEFAULT_RATES, 0);
      expect(wait.scenario.mortgage.interestTotal).toBeCloseTo(now.mortgage.interestTotal, 6);
      expect(wait.deltaTotalCost).toBeCloseTo(0, 6);
      expect(wait.cashLeftAfterPurchase).toBeCloseTo(now.cashLeft, 6);
    }
  });

  it.each(apartments)(
    "%s: with non-increasing rates, more EK never leaves more Restschuld",
    (_label, inputs) => {
      const scenarios = buildScenarios(EK_SCENARIOS, inputs, DEFAULT_RATES);
      for (let i = 1; i < scenarios.length; i += 1) {
        expect(scenarios[i].mortgage.remainingAfterFixed).toBeLessThan(
          scenarios[i - 1].mortgage.remainingAfterFixed,
        );
      }
    },
  );

  it.each(apartments)(
    "%s: the wealth ledger reproduces the after-tax trade-off exactly",
    (_label, inputs) => {
      // Same Monatsrate, same budget, same Sondertilgung: the only thing that differs
      // between two EK levels is where the extra capital sits. So the ledger's wealth gap
      // at the end of the binding must be the closed-form statement, to the cent.
      const scenarios = buildScenarios(EK_SCENARIOS, inputs, DEFAULT_RATES);
      const wealth = EK_SCENARIOS.map(
        (base) => wealthAtHorizon({ base, inputs, rates: DEFAULT_RATES }).wealth,
      );
      for (let i = 0; i < scenarios.length; i += 1) {
        for (let j = i + 1; j < scenarios.length; j += 1) {
          const tradeoff = compareEkScenarios(scenarios[i], scenarios[j], inputs);
          expect(wealth[j] - wealth[i]).toBeCloseTo(tradeoff.netAdvantageFixed, 4);
        }
      }
    },
  );

  it.each(apartments)(
    "%s: Sondertilgung is neutral when the ETF earns exactly the loan's rate, untaxed",
    (_label, inputs) => {
      // Paying s into the loan saves the Sollzins on s; keeping it earns the ETF rate on
      // s. At equal effective rates and no tax the two paths must end level. Anything
      // else would mean the ledger books a cash flow on one side only.
      for (const base of EK_SCENARIOS) {
        const rate = buildScenario(base, inputs, DEFAULT_RATES).interestRate;
        const effective = (Math.pow(1 + rate / 1200, 12) - 1) * 100;
        const neutral = { ...inputs, etfReturnRate: effective, etfTaxRate: 0 };
        const withPlan = wealthAtHorizon({ base, inputs: neutral, rates: DEFAULT_RATES });
        const without = wealthAtHorizon({
          base,
          inputs: neutral,
          rates: DEFAULT_RATES,
          specialPlan: { kind: "none" },
        });
        expect(withPlan.specialPaid).toBeGreaterThan(0);
        expect(withPlan.wealth - without.wealth).toBeCloseTo(0, 4);
      }
    },
  );

  it.each(apartments)("%s: the ledger's debt is the simulated Restschuld", (_label, inputs) => {
    for (const base of EK_SCENARIOS) {
      const scenario = buildScenario(base, inputs, DEFAULT_RATES);
      const path = wealthAtHorizon({ base, inputs, rates: DEFAULT_RATES });
      expect(path.debt).toBeCloseTo(scenario.mortgage.remainingAfterFixed, 6);
      expect(path.loan).toBeCloseTo(scenario.loan, 6);
    }
  });

  it.each(apartments)(
    "%s: a step's 'EK vorn' verdict always agrees with the after-tax trade-off",
    (_label, inputs) => {
      // Two readings of the same comparison (the matrix column and the statement) must
      // never point opposite ways, at any ETF assumption.
      const scenarios = buildScenarios(EK_SCENARIOS, inputs, DEFAULT_RATES);
      for (const etfReturnRate of [0, 2, 4, 4.5, 5, 6, 9]) {
        const assumed = { ...inputs, etfReturnRate };
        for (let i = 0; i < scenarios.length; i += 1) {
          for (let j = i + 1; j < scenarios.length; j += 1) {
            const step = ekStepReturn(scenarios[i], scenarios[j], assumed);
            const tradeoff = compareEkScenarios(scenarios[i], scenarios[j], assumed);
            expect(step.ekAhead).toBe(tradeoff.netAdvantageFixed > 0);
          }
        }
      }
    },
  );
});
