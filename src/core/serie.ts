import type { ISODate, RegolaSerie } from './tipi.ts'

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

function aggiungiGiorni(iso: ISODate, giorni: number): ISODate {
  const d = localDateFromISODate(iso)
  d.setDate(d.getDate() + giorni)
  return toISODate(d)
}

/** Aggiunge `mesi` mantenendo il giorno di ancoraggio; se non esiste usa l'ultimo del mese. */
function aggiungiMesi(iso: ISODate, mesi: number, giornoAncora: number): ISODate {
  const base = localDateFromISODate(iso)
  const targetMonth = base.getMonth() + mesi
  const target = new Date(base.getFullYear(), targetMonth, 1)
  const ultimo = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(giornoAncora, ultimo))
  return toISODate(target)
}

function dataValida(r: RegolaSerie): void {
  if (r.ogni < 1) throw new Error('ogni deve essere >= 1')
  if (r.volte == null && r.finoA == null) throw new Error('Serve volte o finoA')
  if (r.volte != null && r.volte < 1) throw new Error('volte deve essere >= 1')
}

export function datePerSerie(inizio: ISODate, r: RegolaSerie): ISODate[] {
  dataValida(r)
  const giornoAncora = localDateFromISODate(inizio).getDate()
  const out: ISODate[] = [inizio]
  const max = 60

  let corrente = inizio
  let n = 1
  while (out.length < max) {
    if (r.volte != null && n >= r.volte) break

    if (r.unita === 'giorni') {
      corrente = aggiungiGiorni(corrente, r.ogni)
    } else if (r.unita === 'settimane') {
      corrente = aggiungiGiorni(corrente, r.ogni * 7)
    } else {
      corrente = aggiungiMesi(corrente, r.ogni, giornoAncora)
    }

    if (r.finoA != null && corrente > r.finoA) break
    out.push(corrente)
    n++
    if (r.volte != null && n >= r.volte) break
  }

  return out.slice(0, max)
}
