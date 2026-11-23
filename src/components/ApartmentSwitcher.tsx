import type { ApartmentCase, ApartmentComparisonResult } from "../lib/calculations";
import { formatEur } from "../lib/format";
import { GLOSSARY } from "../lib/glossary";
import { Button, InputField, StatusPill } from "./ui";

type ApartmentEditableKey =
  | "label"
  | "note"
  | "purchasePrice"
  | "renovation"
  | "hausgeld"
  | "parkingPrice"
  | "kfwAmount"
  | "kfwRate"
  | "kfwTermYears"
  | "moveInMonths";

type ApartmentSwitcherProps = {
  results: ApartmentComparisonResult[];
  activeApartmentId: string;
  onSelect: (apartmentId: string) => void;
  onAdd: () => void;
};

type ApartmentFactsProps = {
  apartment: ApartmentCase;
  /** Grundsteuer + own reserve, added on top of the Hausgeld (D35). */
  ownerExtraMonthly: number;
  onChange: (patch: Partial<Pick<ApartmentCase, ApartmentEditableKey>>) => void;
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
            {/* At the EK level on screen: tragbar with a reserve or deadline warning reads
                amber, so a green chip never hides one (D44). */}
            {result.decision.noSafeScenario ? (
              <StatusPill tone="red">nicht tragbar</StatusPill>
            ) : result.selectedScenario.feasible && result.selectedScenario.diagnosis.warnings.length > 0 ? (
              <StatusPill tone="amber">tragbar, mit Hinweis</StatusPill>
            ) : (
              <StatusPill tone="green">tragbar</StatusPill>
            )}
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
export function ApartmentFacts({ apartment, ownerExtraMonthly, onChange }: ApartmentFactsProps) {
  return (
    <details className="apartment-facts">
      <summary>Fakten zu {apartment.label} bearbeiten</summary>
      <div className="apartment-facts-text">
        <label className="save-field">
          <span>Name</span>
          <input
            type="text"
            value={apartment.label}
            maxLength={60}
            placeholder="z.B. Altbau Lindenstraße"
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="save-field">
          <span>Notiz</span>
          <textarea
            rows={2}
            value={apartment.note ?? ""}
            placeholder="z.B. Adresse, Makler, Link zum Exposé"
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </label>
      </div>
      <div className="apartment-facts-grid">
        <InputField
          label="Kaufpreis"
          value={apartment.purchasePrice}
          onChange={(value) => onChange({ purchasePrice: value })}
          highlight
        />
        <InputField
          label="davon Stellplatz"
          value={apartment.parkingPrice}
          min={0}
          onChange={(value) => onChange({ parkingPrice: Math.max(0, value) })}
          info={GLOSSARY.parkingPrice}
          hint="steckt im Kaufpreis · 0 = keiner"
        />
        <InputField
          label="Renovierung"
          value={apartment.renovation}
          onChange={(value) => onChange({ renovation: value })}
        />
        {/*
          The Hausgeld as the Exposé states it, a number the couple can look up. The old
          "Eigentumskosten mtl." meant something nobody could reconstruct later (D35);
          the hint shows the total the model actually uses.
        */}
        <InputField
          label="Hausgeld mtl. (laut Exposé)"
          value={apartment.hausgeld}
          onChange={(value) => onChange({ hausgeld: value })}
          info={GLOSSARY.hausgeld}
          hint={`+ ${formatEur(ownerExtraMonthly)} Grundsteuer und eigene Rücklage = ${formatEur(apartment.hausgeld + ownerExtraMonthly)} im Monat`}
        />
        <InputField
          label="KfW-Darlehen"
          value={apartment.kfwAmount}
          min={0}
          onChange={(value) => onChange({ kfwAmount: Math.max(0, value) })}
          info={GLOSSARY.kfwAmount}
          hint="0 = keins"
        />
        <InputField
          label="KfW-Zins"
          value={apartment.kfwRate}
          suffix="%"
          step={0.05}
          min={0}
          onChange={(value) => onChange({ kfwRate: Math.max(0, value) })}
          info={GLOSSARY.kfwRate}
        />
        <InputField
          label="KfW-Laufzeit"
          value={apartment.kfwTermYears}
          suffix="Jahre"
          step={1}
          min={2}
          onChange={(value) => onChange({ kfwTermYears: Math.max(2, Math.round(value)) })}
          info={GLOSSARY.kfwTermYears}
          hint="inkl. 1 tilgungsfreiem Jahr"
        />
        <InputField
          label="Monate bis Einzug"
          value={apartment.moveInMonths}
          suffix="Monate"
          step={1}
          min={0}
          onChange={(value) => onChange({ moveInMonths: Math.max(0, Math.round(value)) })}
          info={GLOSSARY.moveInMonths}
          hint="0 = sofort · Neubau: bis zur Übergabe"
        />
      </div>
    </details>
  );
}
