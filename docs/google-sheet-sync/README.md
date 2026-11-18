# Abgleich über ein Google Sheet

Damit PC und Handy denselben Stand haben: Wohnungen, Annahmen, Zinsen, gespeicherte Datensätze. Das Sheet liegt in deinem eigenen Google Drive. Die App schickt nur etwas dorthin, wenn du auf **Ins Sheet speichern** drückst, und holt nur etwas, wenn du **Aus Sheet laden** drückst.

## Einmalig einrichten (ca. 5 Minuten, am PC)

| Schritt | Was |
|---|---|
| 1 | Neues Google Sheet anlegen, z.B. "Hausrechner" |
| 2 | Im Sheet: **Erweiterungen → Apps Script** |
| 3 | Den Inhalt von [`Code.gs`](Code.gs) komplett einfügen, alten Code ersetzen, speichern |
| 4 | Oben die Funktion **einrichten** auswählen, **▶ Ausführen**. Google fragt nach Berechtigungen für dieses Sheet: erlauben |
| 5 | **Ausführungsprotokoll** zeigt `Token für die App: …`. Den Token kopieren |
| 6 | **Bereitstellen → Neue Bereitstellung → Typ: Web-App**. Ausführen als: **Ich**. Zugriff: **Jeder**. Bereitstellen |
| 7 | Die **Web-App-URL** kopieren (endet auf `/exec`) |

## Pro Gerät verbinden

In der App unter **2 · Annahmen**, ganz unten: **Mit Google Sheet abgleichen** → URL und Token eintragen → **Verbinden**. URL und Token bleiben nur in diesem Browser gespeichert, nicht in Exporten und nicht im Repository.

## Im Alltag

| Situation | Was tun |
|---|---|
| Gerät aufmachen | **Aus Sheet laden** |
| Etwas geändert | **Ins Sheet speichern** |
| Meldung "neuerer Stand im Sheet" | Das andere Gerät hat zwischendurch gespeichert. **Erst laden** und dann neu eintragen, oder bewusst **Trotzdem überschreiben** |

Im Sheet stehen die Tabs **Wohnungen** und **Zinsen** zum Nachlesen. Sie werden bei jedem Speichern neu geschrieben. Änderungen dort kommen nicht in der App an. Der eigentliche Stand liegt als JSON im Tab **Daten**: nicht von Hand bearbeiten.

## Sicherheit

- Wer die URL **und** den Token kennt, kann den Stand lesen und überschreiben. Beides nicht teilen.
- Neuer Token: `einrichten` erneut ausführen, dann auf beiden Geräten trennen und neu verbinden.
- Nach einer Änderung an `Code.gs`: **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Version: Neu**. Sonst läuft weiter der alte Code. Die URL bleibt dabei gleich.
