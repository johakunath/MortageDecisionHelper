import type { ApartmentCase, ApartmentComparisonResult } from "../lib/calculations";
import { formatEur } from "../lib/format";
import { Button, InputField, StatusPill } from "./ui";

type ApartmentNumericKey = "purchasePrice" | "renovation" | "monthlyOwnershipCosts";

type ApartmentSwitcherProps = {
  results: ApartmentComparisonResult[];
  activeApartmentId: string;
  onSelect: (apartmentId: string) => void;
  onAdd: () => void;
};

type ApartmentFactsProps = {
  apartment: ApartmentCase;
  onChange: (patch: Partial<Pick<ApartmentCase, ApartmentNumericKey>>) => void;
};

/**
 * The apartment is the context the EK decision is made in, not a competing analysis
 * (docs/DECISIONS.md D3). Switching a chip re-bases every other section on the page —
 * there is exactly one place that owns purchasePrice/renovation/ownershipCosts for the
 * active apartment, this panel, which is why the old 648k-vs-600k mismatch cannot
 * recur: nothing downstream is ever fed a copy of these numbers, only a derivation.
 *
 * Lives at the top of §1, not in the sticky header: it is used once at the start of a
 * session and does not earn permanent screen space (D21). The header keeps the active
 * apartment's name and price as read-only text, so the context is still never in doubt.
 */
export default function ApartmentSwitcher({
  results,
  activeApartmentId,
  onSelect,
  onAdd,
}: ApartmentSwitcherProps) {
  return (
    <div className="apartment-switcher">
      {/*
        A group of toggles, not a tablist: these chips control the entire page rather
        than a tabpanel, and the "+ Neue Wohnung" button sitting among them is not a
        tab at all. `aria-pressed` is also what the scenario doors use, so the two
        selection controls on this screen announce themselves the same way.
      */}
      <div className="apartment-chip-row" role="group" aria-label="Wohnung wählen">
        {results.map((result) => (
          <button
            key={result.apartment.id}
            type="button"
            aria-pressed={result.apartment.id === activeApartmentId}
            className={`apartment-chip ${result.apartment.id === activeApartmentId ? "is-active" : ""}`}
            onClick={() => onSelect(result.apartment.id)}
          >
            <span className="apartment-chip-label">{result.apartment.label}</span>
            <span className="apartment-chip-price">{formatEur(result.apartment.purchasePrice)}</span>
            <StatusPill tone={result.decision.noSafeScenario ? "red" : "green"}>
              {result.decision.noSafeScenario ? "nicht tragbar" : "tragbar"}
            </StatusPill>
          </button>
        ))}
        <Button variant="action" onClick={onAdd}>+ Neue Wohnung</Button>
      </div>
    </div>
  );
}

/**
 * Deliberately NOT inside the sticky header — a collapsible up there would make the
 * header's height variable, and everything sticking below it clears that height with
 * one constant rather than a runtime measurement.
 */
export function ApartmentFacts({ apartment, onChange }: ApartmentFactsProps) {
  return (
    <details className="apartment-facts">
      <summary>Fakten zu {apartment.label} bearbeiten</summary>
      <div className="apartment-facts-grid">
        <InputField
          label="Kaufpreis"
          value={apartment.purchasePrice}
          onChange={(value) => onChange({ purchasePrice: value })}
          highlight
        />
        <InputField
          label="Renovierung"
          value={apartment.renovation}
          onChange={(value) => onChange({ renovation: value })}
        />
        <InputField
          label="Eigentumskosten mtl."
          value={apartment.monthlyOwnershipCosts}
          onChange={(value) => onChange({ monthlyOwnershipCosts: value })}
        />
      </div>
    </details>
  );
}
