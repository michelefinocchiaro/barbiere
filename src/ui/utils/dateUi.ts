import type { HHMM, ISODate } from '../../core'

const GIORNI = [
  'domenica',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
] as const

const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const

/** Europe/Rome: parti da una ISODate senza usare Date nel modello dati (solo UI). */
function parti(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toIso(y: number, m: number, d: number): ISODate {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/** Giorno della settimana 0=domenica … 6=sabato (Zeller, calendario gregoriano). */
export function giornoSettimana(iso: ISODate): number {
  const { y, m, d } = parti(iso)
  const q = m < 3 ? m + 12 : m
  const K = m < 3 ? y - 1 : y
  const h =
    (d +
      Math.floor((13 * (q + 1)) / 5) +
      K +
      Math.floor(K / 4) -
      Math.floor(K / 100) +
      Math.floor(K / 400)) %
    7
  return (h + 6) % 7
}

export function aggiungiGiorni(iso: ISODate, delta: number): ISODate {
  const { y, m, d } = parti(iso)
  const utc = new Date(Date.UTC(y, m - 1, d + delta))
  return toIso(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

export function formattaDataLunga(iso: ISODate): string {
  const { m, d } = parti(iso)
  const nome = GIORNI[giornoSettimana(iso)]
  const cap = nome.charAt(0).toUpperCase() + nome.slice(1)
  return `${cap} ${d} ${MESI[m - 1]}`
}

export function formattaDataBreve(iso: ISODate): string {
  const { d } = parti(iso)
  const nome = GIORNI[giornoSettimana(iso)]
  return `${nome} ${d} ${MESI[parti(iso).m - 1]}`
}

/** Minuti da mezzanotte per HHMM. */
export function minutiDaOra(ora: HHMM): number {
  const [h, m] = ora.split(':').map(Number)
  return h * 60 + m
}

export function oraDaMinuti(min: number): HHMM {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function slotOrari(apre: HHMM, chiude: HHMM, passoMin: number): HHMM[] {
  const slots: HHMM[] = []
  for (let t = minutiDaOra(apre); t < minutiDaOra(chiude); t += passoMin) {
    slots.push(oraDaMinuti(t))
  }
  return slots
}

export function inputDateVal(iso: ISODate): string {
  return iso
}
