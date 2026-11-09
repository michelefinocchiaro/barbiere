import type { ContestoFrase, HHMM, Impostazioni, ISODate, MomentoFrase, Operatore } from './tipi.ts'

export const FRASI_PREDEFINITE: Record<MomentoFrase, string[]> = {
  mattina: [
    'Buongiorno! Oggi {teste} teste da sistemare 💈',
    'Caffè fatto? Si parte: {teste} appuntamenti in agenda ☕',
    'Forbici affilate, {teste} clienti in arrivo ✂️',
  ],
  pomeriggio: [
    'Si riparte! Ancora {restanti} da fare 💪',
    'Pomeriggio pieno: {restanti} teste ancora in coda',
    'Mezza giornata fatta, ne mancano {restanti}',
  ],
  sera: [
    'Ultimi tagli e si chiude 🌙',
    'Ancora {restanti}, poi tutti a casa',
    'Rush finale: {restanti} e abbiamo finito',
  ],
  fine_giornata: [
    'Giornata chiusa: {teste} teste sistemate. Bel lavoro! 💈',
    '{teste} clienti serviti oggi. Si spazza e si va 🧹',
    'Fatto! {teste} appuntamenti, zero pensieri',
  ],
  giornata_vuota: [
    'Agenda libera… {operatore}, è l\'ora del caffè ☕',
    'Nessuno in agenda. Buon momento per affilare le forbici ✂️',
    'Giornata tranquilla: il telefono squillerà 📞',
  ],
  chiuso: [
    'Forbici a riposo ✂️💤',
    'Oggi si chiude. Ci vediamo {prossimo}!',
    'Chiuso: anche i barbieri hanno una vita 😎',
  ],
  promemoria_finiti: [
    'Tutti avvisati! 👋',
    'Promemoria finiti, missione compiuta 😉',
    'Nessuno da avvisare: si può respirare',
  ],
  caricamento: [
    'Un attimo, affilo le forbici…',
    'Scaldo il rasoio…',
    'Preparo la poltrona…',
  ],
}

function localDateFromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(date: Date): ISODate {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function hhmmToMinuti(ora: HHMM): number {
  const [h, m] = ora.split(':').map(Number)
  return h * 60 + m
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function componiPromemoria(modello: string, valori: Record<string, string>): string {
  return modello.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, chiave: string) => {
    return chiave in valori ? valori[chiave] : match
  })
}

function quando(dataAppuntamento: ISODate, oggi: ISODate): string {
  const dApp = localDateFromISODate(dataAppuntamento)
  const dOggi = localDateFromISODate(oggi)
  const diff = Math.round((dApp.getTime() - dOggi.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return 'oggi'
  if (diff === 1) return 'domani'

  const fmtGiorno = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    timeZone: 'Europe/Rome',
  })
  const fmtLunga = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  })

  if (diff >= 2 && diff <= 6) {
    return fmtGiorno.format(dApp)
  }
  return fmtLunga.format(dApp)
}

function prossimoGiornoApertura(
  da: ISODate,
  imp: Impostazioni,
  blocchi: { operatoreId: string | null; data: ISODate; dalle?: HHMM; alle?: HHMM }[],
): ISODate {
  const giorni = new Set(imp.giorniApertura)
  const blocchiInteri = new Set(
    blocchi
      .filter((b) => b.operatoreId === null && b.dalle === undefined && b.alle === undefined)
      .map((b) => b.data),
  )
  const data = localDateFromISODate(da)
  for (let i = 0; i < 366; i++) {
    data.setDate(data.getDate() + 1)
    const iso = toISODate(data)
    if (giorni.has(data.getDay()) && !blocchiInteri.has(iso)) {
      return iso
    }
  }
  throw new Error('Nessun giorno di apertura trovato entro un anno')
}

function negozioChiuso(
  data: ISODate,
  imp: Impostazioni,
  blocchi: { operatoreId: string | null; data: ISODate; dalle?: HHMM; alle?: HHMM }[],
): boolean {
  const giorno = localDateFromISODate(data).getDay()
  if (!imp.giorniApertura.includes(giorno)) return true
  return blocchi.some(
    (b) =>
      b.operatoreId === null &&
      b.data === data &&
      b.dalle === undefined &&
      b.alle === undefined,
  )
}

export function momentoDellaGiornata(
  data: ISODate,
  ora: HHMM,
  imp: Impostazioni,
  blocchi: { operatoreId: string | null; data: ISODate; dalle?: HHMM; alle?: HHMM }[],
  teste: number,
  restanti: number,
): MomentoFrase {
  if (negozioChiuso(data, imp, blocchi)) return 'chiuso'
  if (teste === 0) return 'giornata_vuota'
  if (hhmmToMinuti(ora) >= hhmmToMinuti(imp.chiude) || restanti === 0) return 'fine_giornata'
  if (hhmmToMinuti(ora) < 12 * 60) return 'mattina'
  if (hhmmToMinuti(ora) < 17 * 60) return 'pomeriggio'
  return 'sera'
}

function operatoreAttivoPerHash(operatori: Operatore[], hash: number): string {
  const attivi = operatori.filter((o) => o.attivo).sort((a, b) => a.ordine - b.ordine)
  if (attivi.length === 0) return ''
  return attivi[hash % attivi.length].nome
}

export function fraseDelMomento(
  momento: MomentoFrase,
  contesto: ContestoFrase,
  imp: Impostazioni,
): string {
  const listaPersonalizzata = imp.frasi?.[momento]
  const lista = listaPersonalizzata && listaPersonalizzata.length > 0
    ? listaPersonalizzata
    : FRASI_PREDEFINITE[momento]
  const hash = fnv1a32(`${contesto.data}:${momento}`)
  const modello = lista[hash % lista.length]
  const prossimo = prossimoGiornoApertura(contesto.data, imp, [])
  return componiPromemoria(modello, {
    teste: String(contesto.teste ?? 0),
    restanti: String(contesto.restanti ?? 0),
    prossimo: contesto.prossimo ?? quando(prossimo, contesto.data),
    operatore: operatoreAttivoPerHash(imp.operatori, hash),
  })
}
