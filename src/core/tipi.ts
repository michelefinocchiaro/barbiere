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
}

export type TipoAvviso = "sovrapposizione" | "fuori_orario" | "giorno_chiuso" | "assenza";
export interface Avviso { tipo: TipoAvviso; messaggio: string; conAppuntamentoId?: string }

/** Una riga della schermata Promemoria, già pronta da mostrare. */
export interface RigaPromemoria {
  appuntamento: Appuntamento; cliente: Cliente; operatore: Operatore; servizio?: Servizio;
  testo: string;                // testo finale (ritoccato o standard, segnaposto già sostituiti)
  link: string;                 // https://wa.me/...?text=...
  inAttesa: boolean;            // promemoria inviato e stato non ancora confermato/disdetto
}

export interface Riepilogo {
  totale: number; daInviare: number; inviati: number; avvisatiTelefono: number; nonServe: number;
  inAttesa: number; confermati: number; disdetti: number;
}
