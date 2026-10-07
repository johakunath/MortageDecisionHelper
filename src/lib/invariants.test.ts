import { describe, expect, it } from "vitest";
import {
  buildApartmentInputs,
  buildScenario,
  buildScenarios,
  buildWaitScenario,
  compareEkScenarios,
  interestForPlan,
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
});
