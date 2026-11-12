# 🛠️ Registro Interventi Fibra & Rame

Applicazione web mobile-friendly per la registrazione, il monitoraggio e la gestione di interventi di manutenzione su linee in fibra e rame, con sincronizzazione in tempo reale su Google Sheets e gestione delle immagini.

## 🚀 Caratteristiche Principali
- **CRUD Completo**: Inserimento, modifica ed eliminazione degli interventi. Gli interventi eliminati vengono spostati nel foglio **"Eliminati"** (creato automaticamente), da cui si possono recuperare; le loro foto restano su Drive.
- **Salvataggio verificato**: l'app conferma solo dopo la risposta dello script. Prima di modificare o eliminare, lo script controlla che la riga corrisponda ancora allo stesso WR, così non tocca mai l'intervento sbagliato.
- **Database Google Sheets**: Utilizzo di unFoglio Google come database persistente e leggero.
- **Gestione Foto Integrata**: Compressione automatica delle immagini lato client e salvataggio su Google Drive, con il link nel foglio.
- **Accesso con PIN**: Il PIN è controllato dallo script Google, non è scritto nel codice pubblico.
- **Ricerca Globale & Filtri**: Filtro per data e tipo di guasto (Fibra/Rame), con ricerca testuale in tempo reale che estende l'analisi a tutto lo storico.
- **Campi Dettagliati**: Tracciamento di Data, WR, Centrale, RL/Arlo, Box/PTE, Tipo Guasto, Note Guasto, Note Riparazione, Note Reali e Foto.

---

## 🏗️ Stack Tecnologico
- **Frontend**: HTML5, Tailwind CSS (via CDN), JavaScript Vanilla.
- **Backend**: Google Apps Script (Webhook doPost / doGet).
- **Database & Storage**: Google Sheets & Google Drive.

---

## ⚙️ Guida alla Configurazione

### 1. Configurazione del Backend (Google Apps Script)
1. Crea un nuovo **Google Sheet** con un foglio denominato `Interventi` (va bene anche `Foglio1`).
2. Imposta le intestazioni nelle prime 10 colonne (dalla A alla J):
   - `Data` | `WR` | `Centrale` | `RL/Arlo` | `Box/PTE` | `TipoGuasto` | `NoteGuasto` | `NoteRiparazione` | `Foto` | `NoteReali`
3. Nel foglio, vai su **Estensioni > Apps Script** e incolla il codice del file [`apps-script/Codice.gs`](apps-script/Codice.gs).
4. Imposta il **PIN di accesso** (non va mai scritto nel codice):
   - nell'editor di Apps Script apri **Impostazioni progetto** (icona ⚙️ a sinistra);
   - in fondo, alla voce **Proprietà script**, clicca **Aggiungi proprietà script**;
   - Proprietà: `PIN` — Valore: il tuo PIN (consigliato almeno 6 cifre) → **Salva**.
   Dopo 10 PIN errati lo script blocca l'accesso per 15 minuti.
5. Clicca su **Distribuisci > Nuova distribuzione**:
   - Tipo di selezione: **App Web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
   Al primo avvio Google chiede di autorizzare l'accesso a Fogli e Drive.
6. Copia l'**URL dell'app web** generato.

> **Aggiornare lo script senza cambiare URL:** dopo aver incollato il nuovo codice vai su **Distribuisci > Gestisci distribuzioni**, clicca la matita ✏️, in **Versione** scegli **Nuova versione** e poi **Distribuisci**.

### Allegati PDF e Word
Oltre alle foto si possono allegare file **PDF** e **Word** (.doc, .docx), fino a 10 MB ciascuno. Vengono salvati nella cartella Drive **"Registro Guasti - Allegati"**, creata in automatico. Nella colonna **M** del foglio restano il nome e il link di ogni file, e nella scheda dell'intervento compaiono come link da aprire. Gli allegati tolti durante una modifica finiscono nel cestino di Drive.

### Foto su Google Drive
Le foto nuove vengono salvate nella cartella **"Registro Guasti - Foto"** su Google Drive (creata automaticamente) e nel foglio resta solo il link. I file sono visibili solo a chi ha il link, che l'app ottiene solo dopo il PIN. Le foto rimosse durante una modifica finiscono nel cestino di Drive.
Le foto vecchie salvate dentro le celle restano visibili. Per spostarle su Drive (facoltativo) esegui una volta la funzione `migraFotoEsistenti` dall'editor di Apps Script.

### 2. Configurazione dell'Interfaccia (Frontend)
1. Carica il file `index.html` all'interno del tuo repository GitHub.
2. Abilita **GitHub Pages** nelle impostazioni del repository per pubblicare la web app online tramite protocollo HTTPS (`Settings > Pages > Branch: main / root`).
3. Apri il link della tua pagina web pubblicata: al primo avvio inserisci l'URL del tuo Google Apps Script e il PIN nella schermata di accesso. L'app sarà pronta all'uso!

---

## 💾 Backup mensile
L'ultimo giorno di ogni mese, tra le 23 e mezzanotte, lo script crea un file **.zip** con tutti i dati: il foglio completo in Excel e i CSV di Interventi ed Eliminati. Lo salva nella cartella Drive **"Registro Guasti - Backup"** e lo invia per email al proprietario del foglio. Le foto non sono incluse, perché restano nella cartella "Registro Guasti - Foto".
- **Attivare:** nell'editor di Apps Script seleziona `attivaBackupMensile` e premi **Esegui**. Basta una volta: Google chiede di autorizzare email e connessioni esterne.
- **Provare subito:** esegui `backupMensile`.
- **Disattivare:** esegui `disattivaBackupMensile`.

## 📵 Uso offline
- Dopo il primo accesso con la connessione, l'app si apre anche **senza rete** (service worker `sw.js`).
- Offline si accede con lo stesso PIN: il telefono conserva solo un'impronta cifrata del PIN, non il PIN.
- Si vedono gli **ultimi dati scaricati**, con la ricerca per centrale. L'indicatore in alto mostra quando sono stati aggiornati.
- I **nuovi interventi** registrati offline restano salvati sul telefono, foto comprese, e vengono **inviati da soli** al ritorno della connessione. Fino all'invio compaiono nella lista con la scritta "⏳ In attesa di invio" e si possono annullare.
- **Modifiche ed eliminazioni** richiedono la connessione.
- Le foto su Drive già viste online restano visibili anche offline.

## 📱 Utilizzo come PWA (Progressive Web App)
Puoi installare facilmente l'applicazione direttamente sulla schermata Home del tuo smartphone (Android o iOS) aprendo il link della web app dal browser e selezionando *"Aggiungi a schermata Home"*.