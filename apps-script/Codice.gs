// =====================================================================
//  Registro Guasti - Backend Google Apps Script
// ---------------------------------------------------------------------
//  - Ogni richiesta deve contenere il PIN corretto.
//    Il PIN NON è scritto qui: si imposta in
//    Impostazioni progetto (⚙️) > Proprietà script > proprietà "PIN".
//  - Le foto nuove vengono salvate in una cartella di Google Drive
//    ("Registro Guasti - Foto") e nel foglio resta solo il link.
//  - Le foto vecchie, salvate come testo nella cella, restano leggibili.
//  - Colonne: A Data, B WR, C Centrale, D RL/Arlo, E Box/PTE, F Tipo,
//    G Note Guasto, H Note Riparazione, I Foto, J Note Reali,
//    K Codice Chiusura, L Quantità (K e L si intitolano da sole al primo salvataggio).
// =====================================================================

var ss = SpreadsheetApp.getActiveSpreadsheet();
// Foglio con gli interventi: si chiama "Interventi" (prima era "Foglio1": va bene anche quel nome)
var NOME_FOGLIO = "Interventi";
var sheet = trovaFoglio([NOME_FOGLIO, "Foglio1"]);

// Cerca la scheda per nome, senza badare a maiuscole e spazi in più
function trovaFoglio(nomi) {
  var cercati = nomi.map(function (n) { return n.trim().toLowerCase(); });
  var schede = ss.getSheets();
  for (var i = 0; i < cercati.length; i++) {
    for (var j = 0; j < schede.length; j++) {
      if (schede[j].getName().trim().toLowerCase() === cercati[i]) return schede[j];
    }
  }
  return null;
}

var NUM_COLONNE = 12;
var INTESTAZIONI_NUOVE = { 11: "Codice Chiusura", 12: "Quantità" };

var NOME_CARTELLA_FOTO = "Registro Guasti - Foto";
var MAX_TENTATIVI_PIN = 10;      // tentativi errati prima del blocco
var DURATA_BLOCCO_SEC = 15 * 60; // durata del blocco (15 minuti)

function sendJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------
//  Controllo PIN
// ---------------------------------------------------------------------
function controllaPin(pinRicevuto) {
  var pinCorretto = PropertiesService.getScriptProperties().getProperty("PIN");
  if (!pinCorretto) {
    return { ok: false, code: "no_pin", message: "PIN non configurato nello script (Proprietà script > PIN)." };
  }

  var cache = CacheService.getScriptCache();
  var errori = parseInt(cache.get("pin_errori") || "0", 10);
  if (errori >= MAX_TENTATIVI_PIN) {
    return { ok: false, code: "locked", message: "Troppi tentativi errati. Riprova tra 15 minuti." };
  }

  if (String(pinRicevuto || "") !== String(pinCorretto)) {
    cache.put("pin_errori", String(errori + 1), DURATA_BLOCCO_SEC);
    return { ok: false, code: "pin", message: "PIN errato." };
  }

  cache.remove("pin_errori");
  return { ok: true };
}

// ---------------------------------------------------------------------
//  Foto su Google Drive
// ---------------------------------------------------------------------
function getCartellaFoto() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("CARTELLA_FOTO_ID");
  if (id) {
    try {
      var cartella = DriveApp.getFolderById(id);
      if (!cartella.isTrashed()) return cartella;
    } catch (err) { /* cartella cancellata: ne crea una nuova */ }
  }
  var nuova = DriveApp.createFolder(NOME_CARTELLA_FOTO);
  props.setProperty("CARTELLA_FOTO_ID", nuova.getId());
  return nuova;
}

function linkFoto(fileId) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600";
}

function idDaLink(link) {
  var m = String(link).match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Salva su Drive le foto nuove (data:image/...), lascia invariati i link esistenti
function salvaFotoSuDrive(listaFoto, wr) {
  if (!listaFoto || !Array.isArray(listaFoto)) return [];
  var risultato = [];
  var cartella = null;

  listaFoto.forEach(function (foto, i) {
    var f = String(foto || "").trim();
    if (!f) return;

    var m = f.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (!m) {
      risultato.push(f); // già un link Drive: lo mantiene
      return;
    }

    if (!cartella) cartella = getCartellaFoto();
    var estensione = m[1] === "image/png" ? "png" : "jpg";
    var nome = "WR" + (wr || "") + "_" +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss") +
      "_" + (i + 1) + "." + estensione;
    var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nome);
    var file = cartella.createFile(blob);
    // Visibile solo a chi ha il link (che si ottiene solo con il PIN)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    risultato.push(linkFoto(file.getId()));
  });

  return risultato;
}

// Sposta nel cestino di Drive le foto tolte durante una modifica
function cestinaFotoRimosse(vecchieFoto, nuoveFoto) {
  var nuoviId = {};
  nuoveFoto.forEach(function (f) { var id = idDaLink(f); if (id) nuoviId[id] = true; });
  vecchieFoto.forEach(function (f) {
    var id = idDaLink(f);
    if (id && !nuoviId[id]) {
      try { DriveApp.getFileById(id).setTrashed(true); } catch (err) { /* già rimossa */ }
    }
  });
}

function leggiFotoCella(valore) {
  var testo = valore ? valore.toString().trim() : "";
  return testo ? testo.split(" || ") : [];
}

// Scrive i titoli delle colonne nuove (K, L) se mancano
function controllaIntestazioni() {
  Object.keys(INTESTAZIONI_NUOVE).forEach(function (col) {
    var cella = sheet.getRange(1, parseInt(col, 10));
    if (String(cella.getValue()).trim() === "") cella.setValue(INTESTAZIONI_NUOVE[col]);
  });
}

// ---------------------------------------------------------------------
//  Lettura dei dati
// ---------------------------------------------------------------------
function formattaData(rawDate) {
  var d = null;
  if (rawDate instanceof Date) {
    d = rawDate;
  } else if (rawDate) {
    var dStr = rawDate.toString().trim();
    var parsed = new Date(dStr);
    if (isNaN(parsed.getTime())) return dStr.split("T")[0];
    d = parsed;
  } else {
    return "";
  }
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var g = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + g;
}

function elencoGuasti() {
  var rows = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    result.push({
      rowIndex: i + 1,
      data: formattaData(row[0]),
      wr: row[1] || "",
      centrale: row[2] || "",
      rlArlo: row[3] || "",
      boxPte: row[4] || "",
      tipoGuasto: row[5] || "",
      noteGuasto: row[6] || "",
      noteRiparazione: row[7] || "",
      foto: leggiFotoCella(row[8]),
      noteReali: row[9] || "",
      codiceChiusura: row[10] || "",
      quantita: row[11] || ""
    });
  }
  return result;
}

// ---------------------------------------------------------------------
//  Punti di ingresso
// ---------------------------------------------------------------------
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var verifica = controllaPin(data.pin);
    if (verifica.ok && !sheet) {
      return sendJSON({ result: "error", code: "server", message: 'Scheda "' + NOME_FOGLIO + '" non trovata nel foglio Google: controlla il nome della scheda in basso.' });
    }
    if (!verifica.ok) {
      return sendJSON({ result: "error", code: verifica.code, message: verifica.message });
    }

    var action = data.action || "insert";

    if (action === "list") {
      return sendJSON({ result: "success", data: elencoGuasti() });
    }

    if (action === "delete") {
      return eliminaIntervento(data);
    }

    var vecchiLinkInviati = (data.foto || []).filter(function (f) { return !/^data:image\//.test(String(f)); });
    var fotoLinks = salvaFotoSuDrive(data.foto, data.wr);
    var fotoString = fotoLinks.join(" || ");

    var valori = [
      data.data || "",
      data.wr || "",
      data.centrale || "",
      data.rlArlo || "",
      data.boxPte || "",
      data.tipoGuasto || "",
      data.noteGuasto || "",
      data.noteRiparazione || "",
      fotoString,                // Colonna I: Foto (link Drive)
      data.noteReali || "",      // Colonna J: Note Reali
      data.codiceChiusura || "", // Colonna K: Codice Chiusura
      data.quantita || ""        // Colonna L: Quantità
    ];
    controllaIntestazioni();

    if (action === "update") {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        // Prima di modificare, controlla che la riga sia ancora quella giusta
        var controllo = controllaRiga(data);
        if (!controllo.ok) {
          // Annulla: rimette nel cestino le foto appena caricate per questo tentativo
          cestinaFotoRimosse(fotoLinks, vecchiLinkInviati);
          return sendJSON({ result: "error", code: "row", message: controllo.message });
        }
        var vecchieFoto = leggiFotoCella(sheet.getRange(controllo.rowIndex, 9).getValue());
        sheet.getRange(controllo.rowIndex, 1, 1, NUM_COLONNE).setValues([valori]);
        cestinaFotoRimosse(vecchieFoto, fotoLinks);
        return sendJSON({ result: "success", message: "updated" });
      } finally {
        lock.releaseLock();
      }
    }

    sheet.appendRow(valori);
    return sendJSON({ result: "success", message: "inserted" });

  } catch (error) {
    return sendJSON({ result: "error", code: "server", message: error.toString() });
  }
}

// ---------------------------------------------------------------------
//  Controllo riga ed eliminazione
// ---------------------------------------------------------------------

// Verifica che la riga indicata contenga ancora l'intervento atteso (stesso WR).
// Evita di modificare/eliminare la riga sbagliata se il foglio è cambiato nel frattempo.
function controllaRiga(data) {
  var rowIndex = parseInt(data.rowIndex, 10);
  if (!(rowIndex >= 2 && rowIndex <= sheet.getLastRow())) {
    return { ok: false, message: "Intervento non trovato nel foglio. Ricarica la pagina e riprova." };
  }
  if (data.controlloWr !== undefined && data.controlloWr !== null && data.controlloWr !== "") {
    var wrNelFoglio = sheet.getRange(rowIndex, 2).getValue();
    if (String(wrNelFoglio).trim() !== String(data.controlloWr).trim()) {
      return { ok: false, message: "Il foglio è cambiato nel frattempo (la riga non corrisponde più al WR " + data.controlloWr + "). Ricarica la pagina e riprova." };
    }
  }
  return { ok: true, rowIndex: rowIndex };
}

// Sposta l'intervento nel foglio "Eliminati" (copia di sicurezza) e lo toglie dal foglio Interventi.
// Le foto su Drive NON vengono cancellate, così l'intervento si può recuperare.
function eliminaIntervento(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var controllo = controllaRiga(data);
    if (!controllo.ok) {
      return sendJSON({ result: "error", code: "row", message: controllo.message });
    }

    // Foglio "Eliminati": colonne A-J come Interventi, K data di eliminazione, L Codice Chiusura, M Quantità
    var cestino = ss.getSheetByName("Eliminati");
    if (!cestino) {
      cestino = ss.insertSheet("Eliminati");
      var intestazioni = sheet.getRange(1, 1, 1, 10).getValues()[0];
      cestino.appendRow(intestazioni.concat(["Eliminato il", "Codice Chiusura", "Quantità"]));
    } else if (String(cestino.getRange(1, 12).getValue()).trim() === "") {
      cestino.getRange(1, 12, 1, 2).setValues([["Codice Chiusura", "Quantità"]]);
    }

    var valori = sheet.getRange(controllo.rowIndex, 1, 1, NUM_COLONNE).getValues()[0];
    cestino.appendRow(valori.slice(0, 10).concat([new Date()], valori.slice(10, 12)));
    sheet.deleteRow(controllo.rowIndex);

    return sendJSON({ result: "success", message: "deleted" });
  } finally {
    lock.releaseLock();
  }
}

// La lettura libera tramite link non è più consentita: tutto passa da doPost con il PIN.
function doGet(e) {
  return sendJSON({ result: "error", code: "pin", message: "Accesso riservato." });
}

// ---------------------------------------------------------------------
//  FACOLTATIVO: sposta su Drive le foto vecchie salvate nelle celle.
//  Si avvia a mano dall'editor (seleziona "migraFotoEsistenti" e premi Esegui).
//  Se ci sono molte foto e si ferma per il limite di tempo, basta rilanciarla:
//  riprende da dove era rimasta.
// ---------------------------------------------------------------------
function migraFotoEsistenti() {
  var inizio = Date.now();
  var ultimaRiga = sheet.getLastRow();
  var spostate = 0;

  for (var r = 2; r <= ultimaRiga; r++) {
    if (Date.now() - inizio > 5 * 60 * 1000) {
      Logger.log("Tempo quasi scaduto: rilancia la funzione per continuare. Foto spostate finora: " + spostate);
      return;
    }
    var cella = sheet.getRange(r, 9);
    var foto = leggiFotoCella(cella.getValue());
    var daSpostare = foto.some(function (f) { return /^data:image\//.test(f); });
    if (!daSpostare) continue;

    var wr = sheet.getRange(r, 2).getValue();
    var nuove = salvaFotoSuDrive(foto, wr);
    cella.setValue(nuove.join(" || "));
    spostate += foto.filter(function (f) { return /^data:image\//.test(f); }).length;
  }
  Logger.log("Migrazione completata. Foto spostate su Drive: " + spostate);
}

// =====================================================================
//  BACKUP MENSILE
// ---------------------------------------------------------------------
//  L'ultimo giorno di ogni mese, verso le 23, crea un file .zip con
//  tutti i dati (foglio Excel completo + CSV di Interventi ed Eliminati),
//  lo salva nella cartella Drive "Registro Guasti - Backup" e lo manda
//  per email al proprietario del foglio. Le foto non sono incluse:
//  restano nella cartella "Registro Guasti - Foto".
//
//  Per attivarlo: seleziona "attivaBackupMensile" e premi Esegui (una volta).
//  Per provarlo subito: seleziona "backupMensile" e premi Esegui.
//  Per disattivarlo: seleziona "disattivaBackupMensile" e premi Esegui.
// =====================================================================

var NOME_CARTELLA_BACKUP = "Registro Guasti - Backup";

function getCartellaBackup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("CARTELLA_BACKUP_ID");
  if (id) {
    try {
      var cartella = DriveApp.getFolderById(id);
      if (!cartella.isTrashed()) return cartella;
    } catch (err) { /* cartella cancellata: ne crea una nuova */ }
  }
  var nuova = DriveApp.createFolder(NOME_CARTELLA_BACKUP);
  props.setProperty("CARTELLA_BACKUP_ID", nuova.getId());
  return nuova;
}

// CSV con punto e virgola (si apre bene con Excel in italiano)
function foglioInCsv(foglio) {
  if (!foglio || foglio.getLastRow() === 0) return "";
  var valori = foglio.getDataRange().getDisplayValues();
  return "﻿" + valori.map(function (riga) {
    return riga.map(function (v) {
      var t = String(v);
      return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }).join(";");
  }).join("\r\n");
}

// Esegue il backup solo se oggi è l'ultimo giorno del mese (la chiama il trigger ogni sera)
function controlloBackupMensile() {
  var tz = Session.getScriptTimeZone();
  var oggi = new Date(Date.now());
  var domani = new Date(oggi.getTime() + 24 * 60 * 60 * 1000);
  if (Utilities.formatDate(domani, tz, "d") === "1") backupMensile(oggi);
}

// dataRiferimento: il giorno del controllo (così il nome del mese è giusto anche se finisce dopo mezzanotte)
function backupMensile(dataRiferimento) {
  var tz = Session.getScriptTimeZone();
  var adesso = (dataRiferimento instanceof Date) ? dataRiferimento : new Date(Date.now());
  var mese = Utilities.formatDate(adesso, tz, "yyyy-MM");
  var nomeBase = "Registro-Guasti_" + mese;

  // Foglio completo in formato Excel
  var url = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=xlsx";
  var xlsx = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (xlsx.getResponseCode() !== 200) {
    throw new Error("Esportazione Excel non riuscita (codice " + xlsx.getResponseCode() + ")");
  }
  var file = [xlsx.getBlob().setName(nomeBase + ".xlsx")];

  // Un CSV per ogni foglio (Interventi ed Eliminati)
  [sheet, ss.getSheetByName("Eliminati")].forEach(function (f) {
    if (!f) return;
    file.push(Utilities.newBlob(foglioInCsv(f), "text/csv", nomeBase + "_" + f.getName() + ".csv"));
  });

  var zip = Utilities.zip(file, nomeBase + ".zip");
  var salvato = getCartellaBackup().createFile(zip);

  var interventi = Math.max(sheet.getLastRow() - 1, 0);
  var destinatario = Session.getEffectiveUser().getEmail();
  var corpo =
    "Backup del Registro Guasti di " + Utilities.formatDate(adesso, tz, "MM/yyyy") + " completato.\n\n" +
    "Interventi nel foglio: " + interventi + "\n" +
    "Il file è allegato a questa email ed è salvato anche su Google Drive, nella cartella \"" + NOME_CARTELLA_BACKUP + "\":\n" +
    salvato.getUrl() + "\n\n" +
    "Contenuto: foglio completo in Excel (.xlsx) e CSV di " + sheet.getName() + " ed Eliminati. Le foto restano nella cartella \"" + NOME_CARTELLA_FOTO + "\".";
  MailApp.sendEmail({
    to: destinatario,
    subject: "Backup Registro Guasti " + Utilities.formatDate(adesso, tz, "MM/yyyy"),
    body: corpo,
    attachments: [zip]
  });

  Logger.log("Backup creato: " + salvato.getName() + " (" + interventi + " interventi), inviato a " + destinatario);
}

function attivaBackupMensile() {
  disattivaBackupMensile();
  ScriptApp.newTrigger("controlloBackupMensile").timeBased().everyDays(1).atHour(23).create();
  Logger.log("Backup mensile attivato: l'ultimo giorno di ogni mese, tra le 23 e mezzanotte.");
}

function disattivaBackupMensile() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "controlloBackupMensile") ScriptApp.deleteTrigger(t);
  });
}
