import { Section } from "./ui";

export default function QASection() {
  return (
    <Section
      title="QA / Formelprüfung"
      subtitle="Formeltransparenz statt Black Box. Das Tool ersetzt keine Bankberatung und keine Steuerberatung."
    >
      <div className="qa-grid">
        <div className="qa-block">
          <h3>Formelannahmen</h3>
          <ul>
            <li>Annuität: Darlehen × (Sollzins + Anfangstilgung) / 12.</li>
            <li>Restschuld: monatliche Simulation, zuerst Zinsanteil, dann reguläre Tilgung.</li>
            <li>Sondertilgung: jährlich einzeln eingegeben, je Jahr gedeckelt durch Prozent vom Anfangsdarlehen.</li>
            <li>Cashbedarf: Anzahlung + Kaufnebenkosten + Renovierung + Umzug.</li>
            <li>Immobilienwert: Kaufpreis × (1 + Wertsteigerung)^Laufzeit.</li>
            <li>Nettovermögen: Immobilienwert - Cashbedarf - Gesamtzinsen.</li>
            <li>Sauber machbar: Cash nach Kauf mindestens Reserve und Monatslast höchstens 40%.</li>
          </ul>
        </div>
        <div className="qa-block warning">
          <h3>Manuelle Validierung</h3>
          <ul>
            <li>10% EK gegen eigenes Sheet und deutschen Baufinanzierungsrechner prüfen.</li>
            <li>Sondertilgungscap und jährliche Sondertilgungsrechte gegen echtes Bankangebot prüfen.</li>
            <li>Wertsteigerung und Inflation bewusst konservativ setzen.</li>
            <li>Bei 850k Stress muss klar „Kein sauberes Szenario“ erscheinen.</li>
          </ul>
        </div>
      </div>
      <div className="table-wrap">
        <table className="tradeoff-table">
          <thead>
            <tr>
              <th>Testfall</th>
              <th>Erwartung</th>
              <th>Was prüfen?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>600k machbar</td>
              <td>Mindestens ein Szenario sauber</td>
              <td>Kompromiss, Cash-Puffer, Monatslast</td>
            </tr>
            <tr>
              <td>720k Base</td>
              <td>Grenzfall sichtbar</td>
              <td>Warnungen, Reserve-Gap, Sondertilgung, Immobilienwert</td>
            </tr>
            <tr>
              <td>850k Stress</td>
              <td>Kein sauberes Szenario</td>
              <td>Keine weichgespülte Empfehlung anzeigen</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}
