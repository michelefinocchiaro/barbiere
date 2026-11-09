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
  giorniApertura: number[];     // es. [2,3,4,5,6] = mar–sab
  apre: HHMM; chiude: HHMM;     // "08:00", "20:00"
  passoGrigliaMin: number;      // 15
  operatori: Operatore[];
  servizi: Servizio[];
  testoPromemoria: string;      // con segnaposto {quando} {ora} {nome} {operatore} {servizio}
  ultimoBackupIl?: string;
  frasi?: Partial<Record<MomentoFrase, string[]>>;  // battute dell'app per chi sta al bancone; mancano = predefinite
  demoAttiva?: boolean;         // true dopo caricaDatiDemo, false dopo svuotaTutto/importaBackup
}

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
