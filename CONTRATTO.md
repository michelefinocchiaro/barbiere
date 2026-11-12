# Contratto fra `core/` e `ui/`

È l'unica cosa che le due parti condividono. `core/` lo implementa, `ui/` lo usa.
**Chi vuole cambiarlo non lo cambia da solo:** scrive la proposta e la decide chi tiene il
contratto. Due persone che lo ritoccano in parallelo si rompono a vicenda.

## Il principio che decide i casi dubbi

L'app è un **aiuto per chi prende gli appuntamenti**, non il suo sostituto. Quindi:
- **avvisa, non blocca**: sovrapposizioni, fuori orario, giorno chiuso, assenze producono
  `Avviso[]`, mai un errore che impedisce di salvare;
- **non fa niente da sola**: non invia, non disdice, non sposta. Ogni cambiamento parte da un tocco;
- **tutto si annulla**: ogni setter è idempotente e accetta il valore precedente, così la UI
  può offrire "Annulla".

## Stack (già installato, non aggiungere dipendenze)

Vite 8 + React 19 + TypeScript strict · Dexie 4 + `dexie-react-hooks` · Vitest + `fake-indexeddb` ·
`vite-plugin-pwa` · Playwright per l'e2e. Se serve un'altra dipendenza, si propone prima.

## Cartelle

```
src/core/      ← il core. Niente React, niente DOM (tranne Blob/File nel backup).
  tipi.ts      ← i tipi di questo contratto, copiati alla lettera
  index.ts     ← esporta SOLO le funzioni elencate sotto
src/ui/        ← l'interfaccia. Importa solo da "src/core" (index.ts), mai dai file interni.
src/negozi/    ← un file di configurazione per negozio, più l'elenco in index.ts. Regola: un solo
                 codice per tutti i clienti, il negozio è un file.
public/brand/  ← logo e palette (copiati da ~/barbiere/brand/)
```

## Convenzioni

- **Date** come stringhe `ISODate` `"YYYY-MM-DD"` e ore come `HHMM` `"08:15"`, sempre nel fuso
  `Europe/Rome`. Niente `Date` nel modello dei dati: i bug di fuso orario nascono lì.
- **Telefoni** salvati normalizzati, solo cifre col prefisso internazionale e senza `+`:
  `"393331234567"`.
- **Id** con `crypto.randomUUID()`. Timestamp `creatoIl`/`aggiornatoIl` in ISO 8601 completo.
- Giorni della settimana: `0 = domenica … 6 = sabato` (come `Date.getDay()`).

## Tipi (`src/core/tipi.ts`)

```ts
export type ISODate = string;   // "2026-11-10"
export type HHMM = string;      // "08:15"

export interface Operatore { id: string; nome: string; attivo: boolean; ordine: number }
export interface Servizio  { id: string; nome: string; durataMin: number; ordine: number }

export interface Cliente {
  id: string;
  nome: string;
  telefono: string;             // normalizzato, "393331234567"
  note?: string;
  creatoIl: string; aggiornatoIl: string;
}

/** provvisorio = "forse giovedì"; prenotato = default; confermato = ha risposto sì; disdetto = libera lo spazio */
export type StatoAppuntamento = "provvisorio" | "prenotato" | "confermato" | "disdetto";
/** inviato = chi è al bancone ha aperto WhatsApp; avvisato_telefono = l'ha sentito a voce; non_serve = scelta sua */
export type EsitoPromemoria = "da_inviare" | "inviato" | "avvisato_telefono" | "non_serve";

export interface Appuntamento {
  id: string;
  data: ISODate; ora: HHMM; durataMin: number;
  operatoreId: string;
  clienteId: string;
  servizioId?: string;          // facoltativo: la durata può essere libera
  note?: string;
  stato: StatoAppuntamento;
  promemoria: EsitoPromemoria;
  testoPromemoria?: string;     // testo ritoccato a mano per questo cliente; assente = testo standard
  creatoIl: string; aggiornatoIl: string;
}

/** Pausa, assenza o chiusura. operatoreId null = tutto il negozio. dalle/alle assenti = giornata intera. */
export interface Blocco {
  id: string; operatoreId: string | null; data: ISODate;
  dalle?: HHMM; alle?: HHMM; motivo?: string;
}

export interface Impostazioni {
  nomeNegozio: string;
  logo: string;                 // relativo a public/, SENZA "/" iniziale: "brand/logo-<negozio>-trasparente.png"; la UI antepone import.meta.env.BASE_URL
  prefissoPredefinito: string;  // "39"
  giorniApertura: number[];     // es. [2,3,4,5,6] = da martedì a sabato
  apre: HHMM; chiude: HHMM;     // "08:00", "20:00"
  passoGrigliaMin: number;      // 15
  operatori: Operatore[];
  servizi: Servizio[];
  testoPromemoria: string;      // con segnaposto {quando} {ora} {nome} {operatore} {servizio}
  ultimoBackupIl?: string;
  frasi?: Partial<Record<MomentoFrase, string[]>>;  // battute dell'app per chi sta al bancone; mancano = predefinite
  demoAttiva?: boolean;         // true dopo caricaDatiDemo, false dopo svuotaTutto/importaBackup
  squadra?: MembroSquadra[];    // ritratti in fondo alla barra laterale (solo tablet e PC); mancano = niente ritratti
}

/** Un ritratto della squadra: toccandolo dice la sua frase in una nuvoletta. */
export interface MembroSquadra { nome: string; immagine: string; frase: string }  // immagine relativa a public/, senza "/" iniziale

/** Le battute che l'app mostra a chi sta al bancone. Mai nei messaggi ai clienti. */
export type MomentoFrase =
  | "mattina" | "pomeriggio" | "sera" | "fine_giornata"
  | "giornata_vuota" | "chiuso" | "promemoria_finiti" | "caricamento";
export interface ContestoFrase {
  data: ISODate;
  teste?: number;               // appuntamenti non disdetti del giorno
  restanti?: number;            // di questi, quelli non ancora iniziati
  prossimo?: string;            // es. "martedì", già calcolato con quando()
}

export type TipoAvviso = "sovrapposizione" | "fuori_orario" | "giorno_chiuso" | "assenza";
export interface Avviso { tipo: TipoAvviso; messaggio: string; conAppuntamentoId?: string }

/** Una riga della schermata Promemoria, già pronta da mostrare. */
export interface RigaPromemoria {
  appuntamento: Appuntamento; cliente: Cliente; operatore: Operatore; servizio?: Servizio;
  testo: string;                // testo finale (ritoccato o standard, segnaposto già sostituiti)
  link: string;                 // https://api.whatsapp.com/send/?phone=...&text=...
  inAttesa: boolean;            // promemoria inviato e stato non ancora confermato/disdetto
}

export interface Riepilogo {
  totale: number; daInviare: number; inviati: number; avvisatiTelefono: number; nonServe: number;
  inAttesa: number; confermati: number; disdetti: number;
}
/** Un conto lasciato aperto: il cliente ha fatto il servizio e paga la prossima volta. */
export interface Debito {
  id: string;
  clienteId: string;
  importoCent: number;          // in centesimi: 15,00 € = 1500. Sempre > 0
  data: ISODate;                // il giorno del servizio
  appuntamentoId?: string;      // se nasce da un appuntamento
  nota?: string;                // "taglio + barba", "metà la prossima volta"
  pagatoIl?: string;            // ISO 8601 completo; assente = ancora da pagare
  creatoIl: string; aggiornatoIl: string;
}

/** Una riga della schermata "Da pagare", già pronta da mostrare. */
export interface RigaDebito { debito: Debito; cliente: Cliente }

export interface TotaleDaPagare { totaleCent: number; clienti: number; voci: number }

/** Un risultato della ricerca appuntamenti, già pronto da mostrare. */
export interface RisultatoRicerca {
  appuntamento: Appuntamento; cliente: Cliente; operatore?: Operatore; servizio?: Servizio;
  futuro: boolean;              // data >= oggi
}
```

## Funzioni (`src/core/index.ts`)

Le letture sono funzioni `async` che interrogano Dexie: la UI le avvolge in
`useLiveQuery(() => …)` e si aggiorna da sola quando i dati cambiano.

### Funzioni pure (nessun database)
```ts
normalizzaTelefono(input: string, prefisso?: string): string | null
formattaTelefono(normalizzato: string): string             // "393331234567" -> "+39 333 123 4567"
formattaOra(ora: HHMM): string                             // "08:15" -> "8.15", "14:00" -> "14.00"
quando(dataAppuntamento: ISODate, oggi: ISODate): string   // vedi regole
prossimoGiornoApertura(da: ISODate, imp: Impostazioni, blocchi: Blocco[]): ISODate
componiPromemoria(modello: string, valori: Record<string, string>): string
linkWhatsApp(telefono: string, testo: string): string
oggi(): ISODate                                            // data corrente a Europe/Rome
momentoDellaGiornata(data: ISODate, ora: HHMM, imp: Impostazioni, blocchi: Blocco[],
                     teste: number, restanti: number): MomentoFrase
fraseDelMomento(momento: MomentoFrase, contesto: ContestoFrase, imp: Impostazioni): string
```

**Regole che i test devono fissare:**
- `normalizzaTelefono`: toglie spazi, trattini, punti, parentesi. `+39…` e `0039…` diventano `39…`.
  Un cellulare italiano senza prefisso (inizia per `3`, 9-10 cifre) prende `39`. Un fisso
  (inizia per `0`) prende `39` e **tiene lo zero**. Meno di 8 cifre o caratteri non validi → `null`.
- `quando`: lo stesso giorno → `"oggi"`; il giorno dopo → `"domani"`; dal secondo al sesto giorno
  → il nome del giorno in minuscolo (`"martedì"`); oltre → `"martedì 18 novembre"`.
- `prossimoGiornoApertura`: il primo giorno **dopo** `da` che sta in `giorniApertura` e non ha un
  blocco di tutto il negozio per la giornata intera. Sabato 14/11/2026 → martedì 17/11/2026.
- `componiPromemoria`: sostituisce i segnaposto noti e **lascia intatti quelli sconosciuti**.
  Non tocca nient'altro: emoji, `’`, a capo, maiuscole restano identici.
- `momentoDellaGiornata`: giorno chiuso (fuori da `giorniApertura` o blocco di tutto il negozio per
  la giornata intera) → `"chiuso"`; `teste === 0` → `"giornata_vuota"`; ora ≥ `chiude` oppure
  `restanti === 0` → `"fine_giornata"`; prima delle 12:00 → `"mattina"`; prima delle 17:00 →
  `"pomeriggio"`; altrimenti `"sera"`.
- `fraseDelMomento`: prende `imp.frasi[momento]` se non vuoto, altrimenti `FRASI_PREDEFINITE[momento]`.
  La scelta è **deterministica**: stesso giorno e stesso momento → stessa frase (non cambia a ogni
  aggiornamento della schermata), giorni diversi → di solito frasi diverse (indice = hash di
  `data + momento` modulo il numero di frasi). Segnaposto: `{teste}` `{restanti}` `{prossimo}`
  `{operatore}` (un operatore attivo scelto con lo stesso hash), sostituiti con `componiPromemoria`.
- `linkWhatsApp`: `https://api.whatsapp.com/send/?phone=<telefono>&text=<encodeURIComponent(testo)>`.
  **Non `wa.me`**: il suo rimando sostituisce le emoji di 4 byte con `�` (verificato il 9/11/2026:
  `%F0%9F%98%89` arriva come `%EF%BF%BD`). Il testo decodificato
  dal link deve essere **identico byte per byte** all'originale.

### Clienti
```ts
cercaClienti(query: string, limite?: number): Promise<Cliente[]>
  // nome senza badare a maiuscole/accenti, oppure cifre del telefono (anche solo le ultime);
  // ordinati per appuntamento più recente; limite predefinito 8
trovaOCreaCliente(nome: string, telefono: string): Promise<Cliente>  // deduplica per telefono normalizzato
salvaCliente(c: Cliente): Promise<void>
storicoCliente(clienteId: string): Promise<Appuntamento[]>
tuttiIClienti(): Promise<Cliente[]>
```

### Appuntamenti e blocchi
```ts
appuntamentiDelGiorno(data: ISODate): Promise<Appuntamento[]>   // inclusi i disdetti: la UI decide
salvaAppuntamento(a: Omit<Appuntamento,"id"|"creatoIl"|"aggiornatoIl"> & { id?: string }):
  Promise<{ appuntamento: Appuntamento; avvisi: Avviso[] }>     // salva SEMPRE, poi restituisce gli avvisi
verificaAppuntamento(a: Pick<Appuntamento,"data"|"ora"|"durataMin"|"operatoreId"> & { id?: string }):
  Promise<Avviso[]>                                             // per avvisare PRIMA di salvare
spostaAppuntamento(id: string, data: ISODate, ora: HHMM, operatoreId: string):
  Promise<{ appuntamento: Appuntamento; avvisi: Avviso[] }>     // se cambia il giorno, promemoria torna "da_inviare"
impostaStato(id: string, stato: StatoAppuntamento): Promise<void>
eliminaAppuntamento(id: string): Promise<void>                  // per gli errori di battitura; disdire è impostaStato
cercaAppuntamenti(query: string, limite?: number): Promise<RisultatoRicerca[]>
  // stesso criterio di cercaClienti (nome senza maiuscole/accenti, o cifre del telefono);
  // prima i futuri (data >= oggi) dal più vicino, poi i passati dal più recente; disdetti inclusi;
  // query vuota o di 1 carattere → []; limite predefinito 30
blocchiDelGiorno(data: ISODate): Promise<Blocco[]>
salvaBlocco(b: Omit<Blocco,"id"> & { id?: string }): Promise<Blocco>
eliminaBlocco(id: string): Promise<void>
```
Le sovrapposizioni ignorano gli appuntamenti `disdetto`.

### Promemoria
```ts
righePromemoria(data: ISODate): Promise<RigaPromemoria[]>  // per ora; esclusi i disdetti
riepilogo(data: ISODate): Promise<Riepilogo>               // i disdetti contano qui
impostaEsitoPromemoria(id: string, esito: EsitoPromemoria): Promise<void>
impostaTestoPromemoria(id: string, testo: string | null): Promise<void>  // null = torna al testo standard
```

### Da pagare
```ts
segnaDaPagare(d: Omit<Debito,"id"|"creatoIl"|"aggiornatoIl"|"pagatoIl">): Promise<Debito>
modificaDebito(id: string, campi: Partial<Pick<Debito,"importoCent"|"nota"|"data">>): Promise<void>
segnaPagato(id: string, pagato: boolean): Promise<void>  // true imposta pagatoIl, false lo toglie (per Annulla)
eliminaDebito(id: string): Promise<void>                  // per gli errori di battitura
debitiAperti(): Promise<RigaDebito[]>                     // non pagati, dal più vecchio
debitiCliente(clienteId: string): Promise<Debito[]>       // tutti, aperti prima, poi pagati dal più recente
totaleDaPagare(): Promise<TotaleDaPagare>                 // solo gli aperti; clienti = clienti distinti
formattaEuro(cent: number): string                        // 1500 -> "15,00 €", 50 -> "0,50 €", 123456 -> "1.234,56 €"
leggiEuro(input: string): number | null                   // "15" "15,5" "15.50" "€ 15,50" -> centesimi; "", "abc", "0", negativi -> null
```
- `segnaDaPagare` rifiuta (lancia) `importoCent <= 0` o non intero: è l'unico controllo che blocca,
  perché un importo sbagliato non è un avviso, è un dato rotto.
- Il **backup** include la tabella `debiti`; `importaBackup` accetta anche i backup vecchi senza
  `debiti` (tabella vuota). `caricaDatiDemo` aggiunge 2 debiti inventati su clienti demo diversi;
  `svuotaTutto` li cancella.
- Schema Dexie: nuova versione con la tabella `debiti` (indici: `id, clienteId, pagatoIl, data`),
  senza perdere i dati della versione precedente.

### Impostazioni, backup, demo
```ts
leggiImpostazioni(): Promise<Impostazioni>           // al primo avvio: i valori di src/negozi/<negozio>.ts
salvaImpostazioni(imp: Impostazioni): Promise<void>
esportaBackup(): Promise<Blob>                        // JSON { versione: 1, esportatoIl, ...tabelle }; aggiorna ultimoBackupIl
importaBackup(file: Blob): Promise<{ clienti: number; appuntamenti: number }>  // sostituisce tutto; rifiuta versioni sconosciute
giorniDallUltimoBackup(): Promise<number | null>
caricaDatiDemo(): Promise<void>                       // SOLO dati inventati, vedi sotto; imposta demoAttiva = true
svuotaTutto(): Promise<void>                          // demoAttiva = false
```
`leggiImpostazioni`: se le impostazioni salvate non hanno `frasi` (o `squadra`), le prende da `src/negozi/<negozio>.ts`
(così chi aveva già l'app riceve le battute nuove). `FRASI_PREDEFINITE` è esportato da `index.ts`.

## Un negozio: `src/negozi/<negozio>.ts`

Il primo negozio configurato è fatto così:

- Due operatori che tagliano; chi prende gli appuntamenti sta al bancone e non taglia.
- Aperto da martedì a sabato (`[2,3,4,5,6]`), 08:00–20:00, griglia da 15 minuti.
- Servizi di partenza (si cambiano dalle impostazioni): Taglio 30, Barba 20, Taglio + Barba 45,
  Bambino 20.
- Il testo standard che usano già, **alla lettera**, a capo compresi:

```
Ciao friend ti ricordiamo l’appuntamento di {quando}
RESTIAMO IN ATTESA DI CONFERMA !! 😉💈💇🏻‍♂️👋🏻
Ci vediamo alle {ora}
```

Il negozio si sceglie al build con `VITE_NEGOZIO=<negozio>`; senza, vale il primo dell'elenco in
`src/negozi/index.ts`.

## Dati di prova

**Mai dati veri** nel codice, nei test o nei log. I dati demo usano nomi inventati e numeri
palesemente finti nel blocco `39 333 000 0xxx`. Con i dati veri dei clienti lavora solo il tablet
del negozio.
