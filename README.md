# ConversAI

Applicazione web full-stack per la gestione di conversazioni testuali con un assistente simulato.
Progetto del corso di **Applicazioni Web — A.A. 2025/26**.

**Studentessa:** Giulia Anedda — Matricola 169298

## Cos'è ConversAI

ConversAI offre un'interfaccia in stile chat con assistenti LLM: una sidebar permette di creare e selezionare **progetti**, ogni progetto può contenere più **conversazioni** dedicate a un topic, e ogni conversazione contiene una sequenza di **messaggi** scambiati tra l'utente e un assistente simulato lato server (nessuna integrazione con servizi esterni o modelli linguistici reali).

Funzionalità aggiuntive implementate:
- **Ricerca** nello storico di progetti, conversazioni e messaggi
- **Preferiti** e **Archiviazione** delle conversazioni, con filtri dedicati

## Stack tecnologico

| Livello | Tecnologia |
|---|---|
| Front-end | HTML, CSS, JavaScript (vanilla) |
| Back-end | Node.js, Express.js |
| Persistenza | SQLite (driver `sqlite3`) |

## Requisiti

- [Node.js](https://nodejs.org/) (versione 18 o superiore consigliata)
- npm (incluso con Node.js)

Verifica le versioni installate:

```bash
node -v
npm -v
```

## Installazione

1. Clona la repository e spostati nella cartella del progetto:

   ```bash
   git clone <url-della-repository>
   cd conversai
   ```

2. Installa le dipendenze:

   ```bash
   npm install
   ```

   Verranno installati `express` e `sqlite3` come dichiarato in `package.json`.

## Inizializzazione del database

Non è richiesta alcuna azione manuale: il database SQLite (`data/app.sqlite`) e le tabelle `projects`, `conversations` e `messages` vengono creati automaticamente all'avvio del server, tramite istruzioni `CREATE TABLE IF NOT EXISTS` eseguite in `database.js`.

> **Nota:** la cartella `data/` deve esistere già nella repository (anche vuota, con un file `.gitkeep`) perché SQLite possa creare il file del database al suo interno.

## Avvio dell'applicazione

```bash
npm start
```

Il comando equivale a `node server.js`. Una volta avviato, il server resta in ascolto e nel terminale comparirà:

```
ConversAI server listening at http://localhost:3000
```

Apri il browser all'indirizzo **http://localhost:3000** per usare l'applicazione. Per interrompere il server, premi `Ctrl + C` nel terminale.

## Struttura del progetto

```
conversai/
├── data/
│   └── app.sqlite        # creato automaticamente al primo avvio
├── public/
│   ├── index.html        # interfaccia (sidebar + area principale)
│   ├── style.css
│   └── client.js          # logica front-end, comunica via Fetch API
├── database.js           # accesso al database SQLite (nessuna route qui)
├── server.js              # API REST Express
├── package.json
└── README.md
```

## API principali

Tutte le risposte sono in formato JSON. Riepilogo sintetico (la documentazione completa, con metodo, path, dati ricevuti e casi di errore, è nella relazione):

| Risorsa | Endpoint |
|---|---|
| Progetti | `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` |
| Conversazioni | `GET/POST /api/projects/:id/conversations`, `GET/PATCH/DELETE /api/conversations/:id` |
| Messaggi | `GET/POST /api/conversations/:id/messages` |
| Ricerca | `GET /api/search?q=...` |

## Screenshot

<img width="1850" height="962" alt="image" src="https://github.com/user-attachments/assets/9cb77c0b-4a4e-416e-800f-0e1f33aa6437" />

Interfaccia desktop con sidebar dei progetti, area chat e ricerca integrata. La bolla viola identifica i messaggi dell'utente, quella bianca le risposte dell'assistente simulato.

## Note

- Il progetto è eseguibile interamente in locale, senza servizi esterni, autenticazione o chiavi API.
- Le risposte dell'assistente vengono generate interamente lato server dalla funzione `simulateAssistantResponse` in `server.js`. La funzione analizza il testo del prompt e il topic della conversazione per scegliere tra diversi template di risposta: saluti, ringraziamenti, domande, richieste di sintesi, spiegazioni ed esempi. La risposta include sempre il topic e il contenuto del messaggio ricevuto, così ogni risposta è diversa dall'altra pur senza usare un modello linguistico reale.
