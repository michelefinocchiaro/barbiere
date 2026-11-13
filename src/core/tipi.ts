export type ISODate = string;   // "2026-11-10"
export type HHMM = string;      // "08:15"

export interface Operatore { id: string; nome: string; attivo: boolean; ordine: number }
export interface Servizio  { id: string; nome: string; durataMin: number; ordine: number }

export interface Cliente {
  id: string;
  nome: string;
  telefono: string;             // normalizzato, "393331234567"
  note?: string;
  compleanno?: string;            // "MM-DD" oppure "YYYY-MM-DD" se si sa l'anno
  taglioAbituale?: string;        // testo libero, distinto da `note`
  operatorePreferitoId?: string;
  auguriFattiAnno?: number;       // anno in cui si sono fatti gli auguri (per non rifarli)
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
  serieId?: string;             // uguale per tutti gli appuntamenti nati dalla stessa serie
  creatoIl: string; aggiornatoIl: string;
}

export interface RegolaSerie {
  ogni: number;                   // >= 1
  unita: "giorni" | "settimane" | "mesi";
  volte?: number;                 // quante in tutto, la prima compresa
  finoA?: ISODate;                // oppure fino a questa data compresa. Uno dei due è obbligatorio
}

export interface VoceSerie { data: ISODate; ora: HHMM; avvisi: Avviso[] }

/** Pausa, assenza o chiusura. operatoreId null = tutto il negozio. dalle/alle assenti = giornata intera. */
export interface Blocco {
  id: string; operatoreId: string | null; data: ISODate;
  dalle?: HHMM; alle?: HHMM; motivo?: string;
  tipo?: "assenza" | "impegno";   // assenza = default; impegno = evento extra, motivo è il titolo
}

/** Un messaggio WhatsApp già pronto, da mandare con un tocco dal pannello dell'appuntamento. */
export interface MessaggioRapido {
  id: string; etichetta: string;   // "Sii puntuale", "Ritarda 10 min"
  testo: string;                   // segnaposto {nome} {ora} {ora_dopo} {quando}
  ritardoMin?: number;             // se c'è, {ora_dopo} = ora + ritardoMin
}

export interface Impostazioni {
  nomeNegozio: string;
  logo: string;                 // relativo a public/, SENZA "/" iniziale: "brand/logo-<negozio>-trasparente.png"; la UI antepone import.meta.env.BASE_URL
  prefissoPredefinito: string;  // "39"
  giorniApertura: number[];     // es. [2,3,4,5,6] = mar–sab
  apre: HHMM; chiude: HHMM;     // "08:00", "20:00"
  passoGrigliaMin: number;      // 15
  operatori: Operatore[];
  servizi: Servizio[];
  testoPromemoria: string;      // con segnaposto {quando} {ora} {nome} {operatore} {servizio}
  ultimoBackupIl?: string;
  frasi?: Partial<Record<MomentoFrase, string[]>>;  // battute dell'app per chi sta al bancone; mancano = predefinite
  demoAttiva?: boolean;         // true dopo caricaDatiDemo, false dopo svuotaTutto/importaBackup
  squadra?: MembroSquadra[];    // ritratti in fondo alla barra laterale (solo tablet e PC); mancano = niente ritratti
  messaggiRapidi?: MessaggioRapido[];  // mancano = quelli di src/negozi/<negozio>.ts (come `frasi`)
  testoRiepilogo?: string;             // segnaposto {elenco}; manca = quello del negozio
  testoAuguri?: string;           // segnaposto {nome}; manca = quello del negozio
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

export interface RiepilogoCliente {
  cliente: Cliente; appuntamenti: Appuntamento[];   // futuri non disdetti, dal più vicino
  testo: string; link: string;
}

export interface RigaCompleanno { cliente: Cliente; data: ISODate; anni?: number; auguriFatti: boolean; link: string }
export interface SchedaCliente {
  cliente: Cliente;
  ultimaVisita?: Appuntamento;    // ultimo passato non disdetto
  prossimo?: Appuntamento;        // primo futuro non disdetto
  servizioAbituale?: Servizio; operatoreAbituale?: Operatore;   // i più frequenti nelle visite passate
  ogniQuantiGiorni?: number;      // mediana dei giorni fra visite, solo con almeno 3 visite
  debitiAperti: Debito[];
  compleanno?: RigaCompleanno;    // il prossimo
}
