import { describe, expect, it } from "vitest";
import {
  buildApartmentInputs,
  buildScenarios,
  buildWaitScenarios,
  compareEkScenarios,
  compareSpecialScenarios,
  evaluateDecision,
  waitPeriodsFor,
  type InterestRates,
  type MortgageInputs,
  type ScenarioResult,
} from "./calculations";
import {
  CASE_PRESETS,
  DEFAULT_APARTMENT_CASES,
  DEFAULT_INPUTS,
  DEFAULT_RATES,
  EK_SCENARIOS,
} from "./defaults";

/**
 * Golden master of every figure the screen leads with, on the states the app actually
 * ships: the three default apartments and the three QA presets.
 *
 * The other tests pin behaviour one rule at a time. This one pins the *output*, so a
 * change anywhere in the engine that moves a number the couple reads shows up as an
 * explicit snapshot diff in review instead of slipping through because no individual
 * rule was broken. Update it with `npx vitest -u` only together with a DECISIONS or
 * ASSUMPTIONS entry that explains why the number moved.
 */

const euro = (value: number) => Math.round(value);
const years = (value: number) => Math.round(value * 100) / 100;

function scenarioRow(scenario: ScenarioResult) {
  return {
    loan: euro(scenario.loan),
    cashLeft: euro(scenario.cashLeft),
    status: scenario.status,
    feasible: scenario.feasible,
    interestFixed: euro(scenario.mortgage.interestFixed),
    interestTotal: euro(scenario.mortgage.interestTotal),
    remainingAfterFixed: euro(scenario.mortgage.remainingAfterFixed),
    runtimeYears: years(scenario.mortgage.runtimeYears),
  };
}

function headline(inputs: MortgageInputs, rates: InterestRates) {
  const scenarios = buildScenarios(EK_SCENARIOS, inputs, rates);
  const decision = evaluateDecision(scenarios);
  const low = scenarios[0];
  const high = scenarios[scenarios.length - 1];
  const tradeoff = compareEkScenarios(low, high, inputs);
  const waits = buildWaitScenarios(EK_SCENARIOS[0], low, inputs, rates, waitPeriodsFor(inputs.waitMonths));
  const special = compareSpecialScenarios(EK_SCENARIOS, low.id, inputs, rates);

  return {
    scenarios: Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenarioRow(scenario)])),
    decision: {
      noSafeScenario: decision.noSafeScenario,
      feasible: decision.feasibleScenarios.map((scenario) => scenario.id),
      failedInAll: decision.diagnosis.failedInAll,
    },
    tradeoff: {
      extraCashRequired: euro(tradeoff.extraCashRequired),
      interestSavedFixed: euro(tradeoff.interestSavedFixed),
      etfForegone: euro(tradeoff.etfForegone),
      netAdvantageFixed: euro(tradeoff.netAdvantageFixed),
    },
    wait: waits.map((wait) => ({
      months: wait.waitMonths,
      deltaInterest: euro(wait.deltaInterest),
      deltaTotalCost: euro(wait.deltaTotalCost),
      cashLeftAfterPurchase: euro(wait.cashLeftAfterPurchase),
    })),
    special: {
      planSaving: euro(special.planSaving),
      catchUp: special.rows.map((row) => ({
        id: row.base.id,
        payer: row.catchUp?.payer ?? null,
        amount: row.catchUp?.amount == null ? null : euro(row.catchUp.amount),
        planCovers: row.catchUp?.planCovers ?? null,
      })),
    },
  };
}

describe("golden master", () => {
  it.each(DEFAULT_APARTMENT_CASES.map((apartment) => [apartment.label, apartment] as const))(
    "default apartment %s",
    (_label, apartment) => {
      expect(headline(buildApartmentInputs(DEFAULT_INPUTS, apartment), DEFAULT_RATES)).toMatchSnapshot();
    },
  );

  it.each(Object.entries(CASE_PRESETS))("QA preset %s", (_id, preset) => {
    expect(headline(preset.inputs, preset.rates)).toMatchSnapshot();
  });
});
