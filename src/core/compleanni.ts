import type { ISODate } from './tipi.ts'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isBisestile(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function giorniNelMese(mese: number, anno: number): number {
  if (mese === 2) return isBisestile(anno) ? 29 : 28
  if ([4, 6, 9, 11].includes(mese)) return 30
  return 31
}

/** Valida giorno/mese (anno opzionale) e restituisce "MM-DD" o "YYYY-MM-DD". */
export function leggiCompleanno(giorno: number, mese: number, anno?: number): string | null {
  if (!Number.isInteger(giorno) || !Number.isInteger(mese)) return null
  if (mese < 1 || mese > 12 || giorno < 1) return null
  const y = anno ?? 2000
  if (giorno > giorniNelMese(mese, y)) return null
  if (mese === 2 && giorno === 29 && anno !== undefined && !isBisestile(anno)) return null
  if (anno !== undefined) {
    if (anno < 1 || anno > 9999) return null
    return `${anno}-${pad2(mese)}-${pad2(giorno)}`
  }
  return `${pad2(mese)}-${pad2(giorno)}`
}

export function parseCompleanno(compleanno: string): { mese: number; giorno: number; anno?: number } | null {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(compleanno)
  if (full) {
    const anno = Number(full[1])
    const mese = Number(full[2])
    const giorno = Number(full[3])
    return leggiCompleanno(giorno, mese, anno) ? { mese, giorno, anno } : null
  }
  const short = /^(\d{2})-(\d{2})$/.exec(compleanno)
  if (short) {
    const mese = Number(short[1])
    const giorno = Number(short[2])
    return leggiCompleanno(giorno, mese) ? { mese, giorno } : null
  }
  return null
}

export function dataCompleannoInAnno(mese: number, giorno: number, anno: number): ISODate | null {
  let d = giorno
  let m = mese
  if (m === 2 && d === 29 && !isBisestile(anno)) {
    d = 28
  }
  const norm = leggiCompleanno(d, m, anno)
  return norm ? norm : null
}

function localDateFromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODateParts(y: number, m: number, d: number): ISODate {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function addDays(iso: ISODate, giorni: number): ISODate {
  const d = localDateFromISODate(iso)
  d.setDate(d.getDate() + giorni)
  return toISODateParts(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function fineMese(iso: ISODate): ISODate {
  const d = localDateFromISODate(iso)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return toISODateParts(ultimo.getFullYear(), ultimo.getMonth() + 1, ultimo.getDate())
}

/** Prossima occorrenza del compleanno con data >= oggi (estremi in Europe/Rome come ISODate). */
export function prossimoCompleanno(compleanno: string, oggi: ISODate): ISODate {
  const p = parseCompleanno(compleanno)
  if (!p) throw new Error('Compleanno non valido')
  const [y0] = oggi.split('-').map(Number)
  for (let y = y0; y <= y0 + 1; y++) {
    const data = dataCompleannoInAnno(p.mese, p.giorno, y)
    if (data && data >= oggi) return data
  }
  const data = dataCompleannoInAnno(p.mese, p.giorno, y0 + 2)!
  return data
}

export function compleannoNelGiorno(compleanno: string | undefined, data: ISODate): boolean {
  if (!compleanno) return false
  const p = parseCompleanno(compleanno)
  if (!p) return false
  const [y] = data.split('-').map(Number)
  const occ = dataCompleannoInAnno(p.mese, p.giorno, y)
  return occ === data
}

export function etaAlCompleanno(compleanno: string, dataOccorrenza: ISODate): number | undefined {
  const p = parseCompleanno(compleanno)
  if (!p?.anno) return undefined
  const [yOcc] = dataOccorrenza.split('-').map(Number)
  return yOcc - p.anno
}

export function medianaGapGiorni(dateAsc: ISODate[]): number | undefined {
  if (dateAsc.length < 3) return undefined
  const gaps: number[] = []
  for (let i = 1; i < dateAsc.length; i++) {
    const a = localDateFromISODate(dateAsc[i - 1]!)
    const b = localDateFromISODate(dateAsc[i]!)
    gaps.push(Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
  }
  gaps.sort((x, y) => x - y)
  const mid = Math.floor(gaps.length / 2)
  if (gaps.length % 2 === 1) return gaps[mid]
  return Math.round((gaps[mid - 1]! + gaps[mid]!) / 2)
}
