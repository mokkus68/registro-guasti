# 🛠️ Registro Interventi Fibra & Rame

Applicazione web mobile-friendly per la registrazione, il monitoraggio e la gestione di interventi di manutenzione su linee in fibra e rame, con sincronizzazione in tempo reale su Google Sheets e gestione delle immagini.

## 🚀 Caratteristiche Principali
- **CRUD Completo**: Inserimento di nuovi interventi e modalità di modifica rapida dei record esistenti.
- **Database Google Sheets**: Utilizzo di unFoglio Google come database persistente e leggero.
- **Gestione Foto Integrata**: Compressione automatica delle immagini lato client e salvataggio ottimizzato in stringhe compatte.
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
1. Crea un nuovo **Google Sheet** con un foglio denominato `Foglio1`.
2. Imposta le intestazioni nelle prime 10 colonne (dalla A alla J):
   - `Data` | `WR` | `Centrale` | `RL/Arlo` | `Box/PTE` | `TipoGuasto` | `NoteGuasto` | `NoteRiparazione` | `Foto` | `NoteReali`
3. Nel foglio, vai su **Estensioni > Apps Script** e incolla il codice del backend (disponibile nello script del progetto).
4. Clicca su **Distribuisci > Nuova distribuzione**:
   - Tipo di selezione: **App Web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
5. Copia l'**URL dell'app web** generato.

### 2. Configurazione dell'Interfaccia (Frontend)
1. Carica il file `index.html` all'interno del tuo repository GitHub.
2. Abilita **GitHub Pages** nelle impostazioni del repository per pubblicare la web app online tramite protocollo HTTPS (`Settings > Pages > Branch: main / root`).
3. Apri il link della tua pagina web pubblicata: al primo avvio, incolla l'URL del tuo Google Apps Script nell'apposita schermata di configurazione. L'app sarà pronta all'uso!

---

## 📱 Utilizzo come PWA (Progressive Web App)
Puoi installare facilmente l'applicazione direttamente sulla schermata Home del tuo smartphone (Android o iOS) aprendo il link della web app dal browser e selezionando *"Aggiungi a schermata Home"*.