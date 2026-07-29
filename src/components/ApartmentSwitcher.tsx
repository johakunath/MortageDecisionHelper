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
 */
export default function ApartmentSwitcher({
  results,
  activeApartmentId,
  onSelect,
  onAdd,
}: ApartmentSwitcherProps) {
  return (
    <div className="apartment-switcher">
      <div className="apartment-chip-row" role="tablist" aria-label="Wohnung wählen">
        {results.map((result) => (
          <button
            key={result.apartment.id}
            type="button"
            role="tab"
            aria-selected={result.apartment.id === activeApartmentId}
            className={`apartment-chip ${result.apartment.id === activeApartmentId ? "is-active" : ""}`}
            onClick={() => onSelect(result.apartment.id)}
          >
            <span className="apartment-chip-label">{result.apartment.label}</span>
            <span className="apartment-chip-price">{formatEur(result.apartment.purchasePrice)}</span>
            <StatusPill tone={result.decision.noSafeScenario ? "red" : "green"}>
              {result.decision.noSafeScenario ? "kein sauberes Szenario" : "sauber möglich"}
            </StatusPill>
          </button>
        ))}
        <Button variant="action" onClick={onAdd}>+ Neue Wohnung</Button>
      </div>
    </div>
  );
}

/**
 * Deliberately NOT inside the sticky header. Keeping the header a fixed height means
 * everything sticking below it can clear it with one constant, instead of a runtime
 * measurement that has to stay in sync with a collapsible.
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
