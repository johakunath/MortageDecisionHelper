/**
 * Hausrechner · Sync über ein Google Sheet (D38)
 *
 * In das Sheet einfügen: Erweiterungen → Apps Script → diesen Code einfügen → speichern.
 * Danach einmal die Funktion `einrichten` ausführen (oben auswählen, ▶ Ausführen) und
 * den Token aus dem Ausführungsprotokoll kopieren. Dann bereitstellen als Web-App:
 * Ausführen als "Ich", Zugriff "Jeder". Anleitung: docs/google-sheet-sync/README.md
 *
 * Das Sheet hält den kompletten Stand als JSON im Tab "Daten" (über mehrere Zellen
 * verteilt, eine Zelle fasst höchstens 50.000 Zeichen). Die Tabs "Wohnungen" und
 * "Zinsen" sind nur zum Lesen da und werden bei jedem Speichern neu geschrieben.
 * Wer dort etwas ändert, verliert es beim nächsten Speichern aus der App.
 */

var DATA_SHEET = "Daten";
var CHUNK = 45000;

function einrichten() {
  var token = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("SYNC_TOKEN", token);
  Logger.log("Token für die App: " + token);
}

function doPost(e) {
  var request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad-request" });
  }

  var expected = PropertiesService.getScriptProperties().getProperty("SYNC_TOKEN");
  if (!expected || request.token !== expected) {
    return reply({ ok: false, error: "unauthorized" });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var stored = readBundle();
    if (request.action === "load") {
      return reply({ ok: true, bundle: stored });
    }
    if (request.action === "save") {
      var storedAt = stored ? stored.savedAt : "";
      // Last writer wins only if it saw the latest state. Otherwise the app asks.
      if (storedAt && request.baseSavedAt !== storedAt && !request.force) {
        return reply({ ok: false, error: "conflict", savedAt: storedAt });
      }
      writeBundle(request.bundle);
      writeOverview(request.bundle);
      return reply({ ok: true, savedAt: request.bundle.savedAt });
    }
    return reply({ ok: false, error: "bad-request" });
  } finally {
    lock.releaseLock();
  }
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(name) || book.insertSheet(name);
}

function readBundle() {
  var data = sheet(DATA_SHEET);
  var rows = data.getLastRow();
  if (rows === 0) return null;
  var text = data.getRange(1, 1, rows, 1).getValues().map(function (row) { return row[0]; }).join("");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function writeBundle(bundle) {
  var text = JSON.stringify(bundle);
  var chunks = [];
  for (var i = 0; i < text.length; i += CHUNK) chunks.push([text.slice(i, i + CHUNK)]);
  var data = sheet(DATA_SHEET);
  data.clearContents();
  data.getRange(1, 1, chunks.length, 1).setNumberFormat("@").setValues(chunks);
}

function writeOverview(bundle) {
  var current = bundle.current || {};
  var flats = sheet("Wohnungen");
  flats.clearContents();
  var rows = [["Name", "Kaufpreis €", "Renovierung €", "Hausgeld €/Monat", "Notiz"]];
  (current.apartmentCases || []).forEach(function (flat) {
    rows.push([flat.label, flat.purchasePrice, flat.renovation, flat.hausgeld, flat.note || ""]);
  });
  flats.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  var rates = sheet("Zinsen");
  rates.clearContents();
  var r = current.rates || {};
  var grid = [["EK", "10 Jahre %", "15 Jahre %"]];
  ["ek10", "ek15", "ek20"].forEach(function (id) {
    grid.push([id.replace("ek", "") + "% EK", (r[10] || {})[id], (r[15] || {})[id]]);
  });
  grid.push(["Stand und Quelle", current.ratesNote || "", ""]);
  grid.push(["Gespeichert", bundle.savedAt, ""]);
  rates.getRange(1, 1, grid.length, 3).setValues(grid);
}
