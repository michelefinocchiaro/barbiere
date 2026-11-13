import Dexie from 'dexie'
import type { Table } from 'dexie'

import { impostazioni as impostazioniDefault } from '../negozi/index.ts'
import type {
  Appuntamento,
  Avviso,
  Blocco,
  Cliente,
  Debito,
  EsitoPromemoria,
  HHMM,
  Impostazioni,
  ISODate,
  MessaggioRapido,
  Riepilogo,
  RiepilogoCliente,
  RigaDebito,
  RigaPromemoria,
  RisultatoRicerca,
  StatoAppuntamento,
  TotaleDaPagare,
  VoceSerie,
} from './tipi.ts'
import { FRASI_PREDEFINITE, fraseDelMomento, momentoDellaGiornata } from './frasi.ts'
import { datePerSerie } from './serie.ts'

export { datePerSerie }

export type {
  Appuntamento,
  Avviso,
  Blocco,
  Cliente,
  ContestoFrase,
  Debito,
  EsitoPromemoria,
  HHMM,
  Impostazioni,
  ISODate,
  MembroSquadra,
  MessaggioRapido,
  MomentoFrase,
  Operatore,
  Riepilogo,
  RiepilogoCliente,
  RigaDebito,
  RigaPromemoria,
  RisultatoRicerca,
  Servizio,
  RegolaSerie,
  StatoAppuntamento,
  TipoAvviso,
  TotaleDaPagare,
  VoceSerie,
} from './tipi.ts'

export { FRASI_PREDEFINITE, fraseDelMomento, momentoDellaGiornata }

// Database
export const db = new Dexie('barbiere') as Dexie & {
  clienti: Table<Cliente, string>
  appuntamenti: Table<Appuntamento, string>
  blocchi: Table<Blocco, string>
  debiti: Table<Debito, string>
  impostazioni: Table<{ id: string; valore: Impostazioni }, string>
}

db.version(1).stores({
  clienti: 'id, &telefono, nome, aggiornatoIl',
  appuntamenti: 'id, data, operatoreId, clienteId, stato, aggiornatoIl',
  blocchi: 'id, data, operatoreId',
  impostazioni: 'id',
})

db.version(2).stores({
  debiti: 'id, clienteId, pagatoIl, data',
})

db.version(3).stores({
  appuntamenti: 'id, data, operatoreId, clienteId, stato, serieId, aggiornatoIl',
})

// Helper
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

/** Blocco di chiusura tutto il negozio per la giornata (esclude impegni). */
export function bloccoChiudeNegozioIntera(b: Blocco): boolean {
  if (b.tipo === 'impegno') return false
  return b.operatoreId === null && b.dalle === undefined && b.alle === undefined
}

export function giornoAperto(data: ISODate, imp: Impostazioni, blocchi: Blocco[]): boolean {
  const giorno = localDateFromISODate(data).getDay()
  if (!imp.giorniApertura.includes(giorno)) return false
  return !blocchi.some((b) => b.data === data && bloccoChiudeNegozioIntera(b))
}

export function settimanaDi(data: ISODate): ISODate[] {
  const d = localDateFromISODate(data)
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  const lunedi = d.getTime()
  const out: ISODate[] = []
  for (let i = 0; i < 7; i++) {
    const g = new Date(lunedi)
    g.setDate(g.getDate() + i)
    out.push(toISODate(g))
  }
  return out
}

function normalizzaRicerca(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function intervalliSiSovrappongono(
  inizio: number,
  fine: number,
  aInizio: number,
  aFine: number,
): boolean {
  return fine > aInizio && inizio < aFine
}

/** True se l'intervallo [inizioMin, fineMin) collide con blocchi o appuntamenti (esclusi i disdetti). */
export function intervalloOccupato(
  operatoreId: string,
  inizioMin: number,
  fineMin: number,
  appuntamenti: Pick<Appuntamento, 'id' | 'ora' | 'durataMin' | 'operatoreId' | 'stato'>[],
  blocchi: Blocco[],
  escludiAppuntamentoId?: string,
): boolean {
  for (const b of blocchi) {
    if (b.tipo === 'impegno' && b.dalle === undefined && b.alle === undefined) continue
    if (b.operatoreId !== null && b.operatoreId !== operatoreId) continue
    const bloccoInizio = b.dalle ? hhmmToMinuti(b.dalle) : 0
    const bloccoFine = b.alle ? hhmmToMinuti(b.alle) : 24 * 60
    if (intervalliSiSovrappongono(inizioMin, fineMin, bloccoInizio, bloccoFine)) return true
  }
  for (const a of appuntamenti) {
    if (a.operatoreId !== operatoreId || a.stato === 'disdetto') continue
    if (escludiAppuntamentoId && a.id === escludiAppuntamentoId) continue
    const aInizio = hhmmToMinuti(a.ora)
    const aFine = aInizio + a.durataMin
    if (intervalliSiSovrappongono(inizioMin, fineMin, aInizio, aFine)) return true
  }
  return false
}

export function slotLibero(
  operatoreId: string,
  ora: HHMM,
  durataMin: number,
  appuntamenti: Pick<Appuntamento, 'id' | 'ora' | 'durataMin' | 'operatoreId' | 'stato'>[],
  blocchi: Blocco[],
  escludiAppuntamentoId?: string,
): boolean {
  const inizio = hhmmToMinuti(ora)
  return !intervalloOccupato(
    operatoreId,
    inizio,
    inizio + durataMin,
    appuntamenti,
    blocchi,
    escludiAppuntamentoId,
  )
}

async function calcolaAvvisi(
  app: Pick<Appuntamento, 'id' | 'data' | 'ora' | 'durataMin' | 'operatoreId' | 'stato'>,
): Promise<Avviso[]> {
  const imp = await leggiImpostazioni()
  const avvisi: Avviso[] = []

  // Giorno chiuso
  const giorno = localDateFromISODate(app.data).getDay()
  if (!imp.giorniApertura.includes(giorno)) {
    avvisi.push({ tipo: 'giorno_chiuso', messaggio: 'Il negozio è chiuso in questo giorno.' })
  }

  // Fuori orario
  const inizio = hhmmToMinuti(app.ora)
  const fine = inizio + app.durataMin
  const apre = hhmmToMinuti(imp.apre)
  const chiude = hhmmToMinuti(imp.chiude)
  if (inizio < apre || fine > chiude) {
    avvisi.push({ tipo: 'fuori_orario', messaggio: `L'orario è fuori dall'apertura (${imp.apre}-${imp.chiude}).` })
  }

  const blocchi = await db.blocchi.where('data').equals(app.data).toArray()
  for (const b of blocchi) {
    if (b.operatoreId !== null && b.operatoreId !== app.operatoreId) continue
    const bloccoInizio = b.dalle ? hhmmToMinuti(b.dalle) : 0
    const bloccoFine = b.alle ? hhmmToMinuti(b.alle) : 24 * 60
    if (intervalliSiSovrappongono(inizio, fine, bloccoInizio, bloccoFine)) {
      if (b.tipo === 'impegno') {
        avvisi.push({
          tipo: 'assenza',
          messaggio: `C'è un impegno in questo orario: ${b.motivo ?? ''}`,
        })
      } else {
        const chi = b.operatoreId === null ? 'Il negozio' : "L'operatore"
        avvisi.push({ tipo: 'assenza', messaggio: `${chi} è assente in questo orario.` })
      }
    }
  }

  if (app.stato !== 'disdetto') {
    const altri = await db.appuntamenti
      .where('data')
      .equals(app.data)
      .and((a) => a.operatoreId === app.operatoreId && a.id !== app.id && a.stato !== 'disdetto')
      .toArray()
    for (const a of altri) {
      const aInizio = hhmmToMinuti(a.ora)
      const aFine = aInizio + a.durataMin
      if (intervalliSiSovrappongono(inizio, fine, aInizio, aFine)) {
        avvisi.push({
          tipo: 'sovrapposizione',
          messaggio: "L'appuntamento si sovrappone a un altro.",
          conAppuntamentoId: a.id,
        })
      }
    }
  }

  return avvisi
}

// Funzioni pure
export function normalizzaTelefono(input: string, prefisso: string = '39'): string | null {
  const separatori = /[ \-\.\(\)]/g
  const cleaned = input.replace(separatori, '')

  let num = cleaned
  if (num.startsWith('+')) num = num.slice(1)
  if (num.startsWith('00')) num = num.slice(2)

  if (!/^\d+$/.test(num)) return null
  if (num.length < 8) return null

  if (num.startsWith(prefisso)) return num

  if (num.startsWith('3') && (num.length === 9 || num.length === 10)) {
    return prefisso + num
  }
  if (num.startsWith('0')) {
    return prefisso + num
  }
  return null
}

export function formattaTelefono(normalizzato: string): string {
  const prefisso = normalizzato.slice(0, 2)
  const resto = normalizzato.slice(2)
  let gruppi: string[]
  if (resto.startsWith('3') && resto.length === 10) {
    gruppi = [resto.slice(0, 3), resto.slice(3, 6), resto.slice(6)]
  } else {
    gruppi = []
    let i = resto.length
    while (i > 0) {
      const start = Math.max(0, i - 3)
      gruppi.unshift(resto.slice(start, i))
      i = start
    }
  }
  return `+${prefisso} ${gruppi.join(' ')}`
}

export function formattaOra(ora: HHMM): string {
  const [h, m] = ora.split(':')
  return `${Number(h)}.${m}`
}

export function formattaEuro(cent: number): string {
  const intero = Math.floor(cent / 100)
  const decimali = String(cent % 100).padStart(2, '0')
  const interoFormattato = String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${interoFormattato},${decimali} €`
}

export function leggiEuro(input: string): number | null {
  const pulito = input
    .replace(/\s/g, '')
    .replace(/\u20AC/g, '')
    .replace(/€/g, '')
  if (!pulito) return null
  if (/[^\d,.]/.test(pulito)) return null
  if (pulito.includes('-')) return null

  let interoStr: string
  let decimaleStr: string

  if (pulito.includes(',')) {
    const parti = pulito.split(',')
    if (parti.length > 2) return null
    interoStr = parti[0].replace(/\./g, '')
    decimaleStr = parti[1] ?? '00'
  } else if (pulito.includes('.')) {
    const parti = pulito.split('.')
    if (parti.length === 2 && parti[1].length >= 1 && parti[1].length <= 2) {
      interoStr = parti[0]
      decimaleStr = parti[1]
    } else if (parti.every((p) => /^\d+$/.test(p))) {
      interoStr = parti.join('')
      decimaleStr = '00'
    } else {
      return null
    }
  } else {
    interoStr = pulito
    decimaleStr = '00'
  }

  if (interoStr === '') interoStr = '0'
  if (!/^\d+$/.test(interoStr)) return null
  if (!/^\d+$/.test(decimaleStr)) return null
  if (decimaleStr.length > 2) return null

  const intero = Number(interoStr)
  const decimale = decimaleStr.padEnd(2, '0').slice(0, 2)
  const cent = intero * 100 + Number(decimale)

  if (cent <= 0 || !Number.isFinite(cent)) return null
  return cent
}

export function quando(dataAppuntamento: ISODate, oggi: ISODate): string {
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

export function sommaMinuti(ora: HHMM, minuti: number): HHMM {
  const tot = Math.min(hhmmToMinuti(ora) + minuti, 23 * 60 + 59)
  const h = Math.floor(tot / 60)
  const m = tot % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function giornoEsteso(data: ISODate): string {
  const d = localDateFromISODate(data)
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(d)
}

export function componiMessaggioRapido(
  m: MessaggioRapido,
  a: Appuntamento,
  c: Cliente,
  oggiIso: ISODate,
): string {
  const ritardo = m.ritardoMin ?? 0
  return componiPromemoria(m.testo, {
    nome: c.nome,
    ora: formattaOra(a.ora),
    ora_dopo: formattaOra(sommaMinuti(a.ora, ritardo)),
    quando: quando(a.data, oggiIso),
  })
}

export function prossimoGiornoApertura(da: ISODate, imp: Impostazioni, blocchi: Blocco[]): ISODate {
  const giorni = new Set(imp.giorniApertura)
  const blocchiInteri = new Set(
    blocchi.filter((b) => bloccoChiudeNegozioIntera(b)).map((b) => b.data),
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

export function componiPromemoria(modello: string, valori: Record<string, string>): string {
  return modello.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, chiave: string) => {
    return chiave in valori ? valori[chiave] : match
  })
}

export function linkWhatsApp(telefono: string, testo: string): string {
  return `https://api.whatsapp.com/send/?phone=${telefono}&text=${encodeURIComponent(testo)}`
}

export function oggi(): ISODate {
  return toISODate(new Date())
}

// Clienti
export async function cercaClienti(query: string, limite?: number): Promise<Cliente[]> {
  const q = normalizzaRicerca(query)
  const cifre = q.replace(/\D/g, '')

  const byNome = await db.clienti
    .filter((c) => normalizzaRicerca(c.nome).includes(q))
    .toArray()

  const byTelefono = cifre.length > 0
    ? await db.clienti.filter((c) => c.telefono.endsWith(cifre)).toArray()
    : []

  const mappa = new Map([...byNome, ...byTelefono].map((c) => [c.id, c]))
  const tutti = [...mappa.values()]

  const appuntamenti = await db.appuntamenti.toArray()
  const ultimoApp: Record<string, string> = {}
  for (const a of appuntamenti) {
    const chiave = `${a.data}T${a.ora}`
    if (!ultimoApp[a.clienteId] || chiave > ultimoApp[a.clienteId]) {
      ultimoApp[a.clienteId] = chiave
    }
  }

  tutti.sort((a, b) => (ultimoApp[b.id] ?? '0').localeCompare(ultimoApp[a.id] ?? '0'))
  return tutti.slice(0, limite ?? 8)
}

export async function trovaOCreaCliente(nome: string, telefono: string): Promise<Cliente> {
  const norm = normalizzaTelefono(telefono)
  if (!norm) throw new Error('Telefono non valido')
  const esistente = await db.clienti.where('telefono').equals(norm).first()
  const now = new Date().toISOString()
  if (esistente) {
    if (nome.trim() && nome.trim() !== esistente.nome) {
      const aggiornato = { ...esistente, nome: nome.trim(), aggiornatoIl: now }
      await db.clienti.put(aggiornato)
      return aggiornato
    }
    return esistente
  }
  const nuovo: Cliente = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    telefono: norm,
    creatoIl: now,
    aggiornatoIl: now,
  }
  await db.clienti.add(nuovo)
  return nuovo
}

export async function salvaCliente(c: Cliente): Promise<void> {
  const now = new Date().toISOString()
  await db.clienti.put({ ...c, aggiornatoIl: now })
}

export async function storicoCliente(clienteId: string): Promise<Appuntamento[]> {
  const apps = await db.appuntamenti.where('clienteId').equals(clienteId).toArray()
  return apps.sort((a, b) => `${b.data}T${b.ora}`.localeCompare(`${a.data}T${a.ora}`))
}

export async function tuttiIClienti(): Promise<Cliente[]> {
  return db.clienti.orderBy('nome').toArray()
}

// Appuntamenti e blocchi
export async function appuntamentiDelGiorno(data: ISODate): Promise<Appuntamento[]> {
  return db.appuntamenti.where('data').equals(data).sortBy('ora')
}

export async function appuntamentiTra(da: ISODate, a: ISODate): Promise<Appuntamento[]> {
  const rows = await db.appuntamenti.where('data').between(da, a, true, true).toArray()
  return rows.sort((x, y) => `${x.data}T${x.ora}`.localeCompare(`${y.data}T${y.ora}`))
}

export async function salvaAppuntamento(
  a: Omit<Appuntamento, 'id' | 'creatoIl' | 'aggiornatoIl'> & { id?: string },
): Promise<{ appuntamento: Appuntamento; avvisi: Avviso[] }> {
  const now = new Date().toISOString()
  let app: Appuntamento
  if (a.id) {
    const esistente = await db.appuntamenti.get(a.id)
    if (!esistente) throw new Error('Appuntamento non trovato')
    app = { ...esistente, ...a, aggiornatoIl: now }
  } else {
    app = { ...a, id: crypto.randomUUID(), creatoIl: now, aggiornatoIl: now } as Appuntamento
  }
  const avvisi = await calcolaAvvisi(app)
  await db.appuntamenti.put(app)
  return { appuntamento: app, avvisi }
}

export async function verificaAppuntamento(
  a: Pick<Appuntamento, 'data' | 'ora' | 'durataMin' | 'operatoreId'> & { id?: string },
): Promise<Avviso[]> {
  return calcolaAvvisi({ ...a, stato: 'prenotato' } as Appuntamento)
}

export async function spostaAppuntamento(
  id: string,
  data: ISODate,
  ora: HHMM,
  operatoreId: string,
): Promise<{ appuntamento: Appuntamento; avvisi: Avviso[] }> {
  const app = await db.appuntamenti.get(id)
  if (!app) throw new Error('Appuntamento non trovato')
  const cambiaGiorno = app.data !== data
  const aggiornato: Appuntamento = {
    ...app,
    data,
    ora,
    operatoreId,
    aggiornatoIl: new Date().toISOString(),
    promemoria: cambiaGiorno ? 'da_inviare' : app.promemoria,
  }
  const avvisi = await calcolaAvvisi(aggiornato)
  await db.appuntamenti.put(aggiornato)
  return { appuntamento: aggiornato, avvisi }
}

export async function scambiaAppuntamenti(
  idA: string,
  idB: string,
): Promise<{ a: Appuntamento; b: Appuntamento; avvisi: Avviso[] }> {
  if (idA === idB) throw new Error('Non puoi scambiare un appuntamento con sé stesso')
  const now = new Date().toISOString()
  let aFinale!: Appuntamento
  let bFinale!: Appuntamento

  await db.transaction('rw', db.appuntamenti, async () => {
    const a = await db.appuntamenti.get(idA)
    const b = await db.appuntamenti.get(idB)
    if (!a || !b) throw new Error('Appuntamento non trovato')

    const aCambiaGiorno = a.data !== b.data
    const bCambiaGiorno = b.data !== a.data

    aFinale = {
      ...a,
      data: b.data,
      ora: b.ora,
      operatoreId: b.operatoreId,
      promemoria: aCambiaGiorno ? 'da_inviare' : a.promemoria,
      aggiornatoIl: now,
    }
    bFinale = {
      ...b,
      data: a.data,
      ora: a.ora,
      operatoreId: a.operatoreId,
      promemoria: bCambiaGiorno ? 'da_inviare' : b.promemoria,
      aggiornatoIl: now,
    }
    await db.appuntamenti.put(aFinale)
    await db.appuntamenti.put(bFinale)
  })

  const avvisiA = await calcolaAvvisi(aFinale)
  const avvisiB = await calcolaAvvisi(bFinale)
  const avvisi = [...avvisiA, ...avvisiB]
  return { a: aFinale, b: bFinale, avvisi }
}

export async function riepilogoCliente(clienteId: string, da?: ISODate): Promise<RiepilogoCliente> {
  const dal = da ?? oggi()
  const cliente = await db.clienti.get(clienteId)
  if (!cliente) throw new Error('Cliente non trovato')

  const appuntamenti = (
    await db.appuntamenti
      .where('clienteId')
      .equals(clienteId)
      .filter((a) => a.stato !== 'disdetto' && a.data >= dal)
      .toArray()
  ).sort((a, b) => {
    const cmp = a.data.localeCompare(b.data)
    return cmp !== 0 ? cmp : a.ora.localeCompare(b.ora)
  })

  const imp = await leggiImpostazioni()
  const modello =
    imp.testoRiepilogo ??
    impostazioniDefault.testoRiepilogo ??
    ''
  const elenco = appuntamenti
    .map((a) => `• ${giornoEsteso(a.data)} alle ${formattaOra(a.ora)}`)
    .join('\n')
  const testo = componiPromemoria(modello, { elenco })
  const link = linkWhatsApp(cliente.telefono, testo)
  return { cliente, appuntamenti, testo, link }
}

export async function impostaStato(id: string, stato: StatoAppuntamento): Promise<void> {
  await db.appuntamenti.update(id, { stato, aggiornatoIl: new Date().toISOString() })
}

export async function eliminaAppuntamento(id: string): Promise<void> {
  await db.appuntamenti.delete(id)
}

export async function anteprimaSerie(
  base: Pick<Appuntamento, 'ora' | 'durataMin' | 'operatoreId'>,
  date: ISODate[],
): Promise<VoceSerie[]> {
  const voci: VoceSerie[] = []
  for (const data of date) {
    const avvisi = await verificaAppuntamento({
      data,
      ora: base.ora,
      durataMin: base.durataMin,
      operatoreId: base.operatoreId,
    })
    voci.push({ data, ora: base.ora, avvisi })
  }
  return voci
}

export async function creaSerie(
  base: Omit<Appuntamento, 'id' | 'creatoIl' | 'aggiornatoIl' | 'data' | 'serieId'>,
  voci: { data: ISODate; ora: HHMM }[],
): Promise<Appuntamento[]> {
  if (voci.length === 0) return []
  const serieId = crypto.randomUUID()
  const now = new Date().toISOString()
  const creati: Appuntamento[] = voci.map((v) => ({
    ...base,
    id: crypto.randomUUID(),
    data: v.data,
    ora: v.ora,
    serieId,
    promemoria: base.promemoria ?? 'da_inviare',
    creatoIl: now,
    aggiornatoIl: now,
  }))
  await db.transaction('rw', db.appuntamenti, async () => {
    await db.appuntamenti.bulkAdd(creati)
  })
  return creati
}

export async function appuntamentiSerie(serieId: string): Promise<Appuntamento[]> {
  const rows = await db.appuntamenti.where('serieId').equals(serieId).toArray()
  return rows.sort((a, b) => {
    const cmp = a.data.localeCompare(b.data)
    return cmp !== 0 ? cmp : a.ora.localeCompare(b.ora)
  })
}

function indiceInSerie(apps: Appuntamento[], id: string): number {
  return apps.findIndex((a) => a.id === id)
}

function successiviInSerie(apps: Appuntamento[], id: string): Appuntamento[] {
  const i = indiceInSerie(apps, id)
  if (i < 0) return []
  return apps.slice(i)
}

export async function spostaSerieDa(
  id: string,
  ora: HHMM,
  operatoreId: string,
): Promise<Appuntamento[]> {
  const app = await db.appuntamenti.get(id)
  if (!app?.serieId) throw new Error('Appuntamento senza serie')
  const serie = await appuntamentiSerie(app.serieId)
  const bersagli = successiviInSerie(serie, id)
  const prima = bersagli.map((a) => ({ ...a }))
  const now = new Date().toISOString()
  await db.transaction('rw', db.appuntamenti, async () => {
    for (const a of bersagli) {
      await db.appuntamenti.put({
        ...a,
        ora,
        operatoreId,
        aggiornatoIl: now,
      })
    }
  })
  return prima
}

export async function eliminaSerieDa(id: string): Promise<Appuntamento[]> {
  const app = await db.appuntamenti.get(id)
  if (!app?.serieId) throw new Error('Appuntamento senza serie')
  const serie = await appuntamentiSerie(app.serieId)
  const bersagli = successiviInSerie(serie, id)
  const copia = bersagli.map((a) => ({ ...a }))
  await db.transaction('rw', db.appuntamenti, async () => {
    for (const a of bersagli) {
      await db.appuntamenti.delete(a.id)
    }
  })
  return copia
}

export async function ripristinaAppuntamenti(apps: Appuntamento[]): Promise<void> {
  if (apps.length === 0) return
  await db.transaction('rw', db.appuntamenti, async () => {
    for (const a of apps) {
      const esiste = await db.appuntamenti.get(a.id)
      if (esiste) {
        await db.appuntamenti.put(a)
      } else {
        await db.appuntamenti.add(a)
      }
    }
  })
}

export async function cercaAppuntamenti(query: string, limite?: number): Promise<RisultatoRicerca[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const qNorm = normalizzaRicerca(q)
  const cifre = qNorm.replace(/\D/g, '')

  const clienti = await db.clienti.toArray()
  const clientiMatch = clienti.filter((c) => {
    if (normalizzaRicerca(c.nome).includes(qNorm)) return true
    if (cifre.length > 0 && c.telefono.endsWith(cifre)) return true
    return false
  })
  if (clientiMatch.length === 0) return []

  const ids = new Set(clientiMatch.map((c) => c.id))
  const clientiMap = new Map(clientiMatch.map((c) => [c.id, c]))

  const imp = await leggiImpostazioni()
  const operatoriMap = new Map(imp.operatori.map((o) => [o.id, o]))
  const serviziMap = new Map(imp.servizi.map((s) => [s.id, s]))

  const apps = await db.appuntamenti.filter((a) => ids.has(a.clienteId)).toArray()
  const oggiStr = oggi()

  const risultati: RisultatoRicerca[] = apps.map((a) => ({
    appuntamento: a,
    cliente: clientiMap.get(a.clienteId)!,
    operatore: operatoriMap.get(a.operatoreId),
    servizio: a.servizioId ? serviziMap.get(a.servizioId) : undefined,
    futuro: a.data >= oggiStr,
  }))

  const futuri = risultati
    .filter((r) => r.futuro)
    .sort((a, b) => `${a.appuntamento.data}T${a.appuntamento.ora}`.localeCompare(`${b.appuntamento.data}T${b.appuntamento.ora}`))
  const passati = risultati
    .filter((r) => !r.futuro)
    .sort((a, b) => `${b.appuntamento.data}T${b.appuntamento.ora}`.localeCompare(`${a.appuntamento.data}T${a.appuntamento.ora}`))

  return [...futuri, ...passati].slice(0, limite ?? 30)
}

export async function blocchiDelGiorno(data: ISODate): Promise<Blocco[]> {
  return db.blocchi.where('data').equals(data).toArray()
}

export async function blocchiTra(da: ISODate, a: ISODate): Promise<Blocco[]> {
  return db.blocchi.where('data').between(da, a, true, true).toArray()
}

export async function salvaBlocco(b: Omit<Blocco, 'id'> & { id?: string }): Promise<Blocco> {
  let blocco: Blocco
  if (b.id) {
    const esistente = await db.blocchi.get(b.id)
    blocco = { ...(esistente ?? {}), ...b } as Blocco
  } else {
    blocco = { ...b, id: crypto.randomUUID() } as Blocco
  }
  await db.blocchi.put(blocco)
  return blocco
}

export async function eliminaBlocco(id: string): Promise<void> {
  await db.blocchi.delete(id)
}

// Promemoria
export async function righePromemoria(data: ISODate): Promise<RigaPromemoria[]> {
  const imp = await leggiImpostazioni()
  const oggiStr = oggi()
  const apps = await db.appuntamenti
    .where('data')
    .equals(data)
    .and((a) => a.stato !== 'disdetto')
    .toArray()

  const clienti = await db.clienti.where('id').anyOf(apps.map((a) => a.clienteId)).toArray()
  const clientiMap = new Map(clienti.map((c) => [c.id, c]))
  const operatoriMap = new Map(imp.operatori.map((o) => [o.id, o]))
  const serviziMap = new Map(imp.servizi.map((s) => [s.id, s]))

  apps.sort((a, b) => {
    if (a.ora !== b.ora) return a.ora.localeCompare(b.ora)
    const ordA = operatoriMap.get(a.operatoreId)?.ordine ?? 0
    const ordB = operatoriMap.get(b.operatoreId)?.ordine ?? 0
    return ordA - ordB
  })

  return apps.map((a) => {
    const cliente = clientiMap.get(a.clienteId)!
    const operatore = operatoriMap.get(a.operatoreId)!
    const servizio = a.servizioId ? serviziMap.get(a.servizioId) : undefined
    const modello = a.testoPromemoria ?? imp.testoPromemoria
    const testo = componiPromemoria(modello, {
      quando: quando(a.data, oggiStr),
      ora: formattaOra(a.ora),
      nome: cliente.nome,
      operatore: operatore.nome,
      servizio: servizio?.nome ?? '',
    })
    const link = linkWhatsApp(cliente.telefono, testo)
    const inAttesa = a.promemoria === 'inviato' && a.stato !== 'confermato' && a.stato !== 'disdetto'
    return { appuntamento: a, cliente, operatore, servizio, testo, link, inAttesa }
  })
}

export async function riepilogo(data: ISODate): Promise<Riepilogo> {
  const apps = await db.appuntamenti.where('data').equals(data).toArray()
  const r: Riepilogo = {
    totale: apps.length,
    daInviare: 0,
    inviati: 0,
    avvisatiTelefono: 0,
    nonServe: 0,
    inAttesa: 0,
    confermati: 0,
    disdetti: 0,
  }
  for (const a of apps) {
    if (a.promemoria === 'da_inviare') r.daInviare++
    if (a.promemoria === 'inviato') r.inviati++
    if (a.promemoria === 'avvisato_telefono') r.avvisatiTelefono++
    if (a.promemoria === 'non_serve') r.nonServe++
    if (a.stato === 'confermato') r.confermati++
    if (a.stato === 'disdetto') r.disdetti++
    if (a.promemoria === 'inviato' && a.stato !== 'confermato' && a.stato !== 'disdetto') r.inAttesa++
  }
  return r
}

export async function impostaEsitoPromemoria(id: string, esito: EsitoPromemoria): Promise<void> {
  await db.appuntamenti.update(id, { promemoria: esito, aggiornatoIl: new Date().toISOString() })
}

export async function impostaTestoPromemoria(id: string, testo: string | null): Promise<void> {
  await db.appuntamenti.update(id, {
    testoPromemoria: testo ?? undefined,
    aggiornatoIl: new Date().toISOString(),
  })
}

// Da pagare
export async function segnaDaPagare(
  d: Omit<Debito, 'id' | 'creatoIl' | 'aggiornatoIl' | 'pagatoIl'>,
): Promise<Debito> {
  if (!Number.isInteger(d.importoCent) || d.importoCent <= 0) {
    throw new Error('Importo non valido')
  }
  const now = new Date().toISOString()
  const debito: Debito = {
    ...d,
    id: crypto.randomUUID(),
    creatoIl: now,
    aggiornatoIl: now,
  }
  await db.debiti.add(debito)
  return debito
}

export async function modificaDebito(
  id: string,
  campi: Partial<Pick<Debito, 'importoCent' | 'nota' | 'data'>>,
): Promise<void> {
  if (campi.importoCent !== undefined && (!Number.isInteger(campi.importoCent) || campi.importoCent <= 0)) {
    throw new Error('Importo non valido')
  }
  await db.debiti.update(id, { ...campi, aggiornatoIl: new Date().toISOString() })
}

export async function segnaPagato(id: string, pagato: boolean): Promise<void> {
  const pagatoIl = pagato ? new Date().toISOString() : undefined
  await db.debiti.update(id, { pagatoIl, aggiornatoIl: new Date().toISOString() })
}

export async function eliminaDebito(id: string): Promise<void> {
  await db.debiti.delete(id)
}

export async function debitiAperti(): Promise<RigaDebito[]> {
  const debiti = (await db.debiti.filter((d) => d.pagatoIl === undefined).toArray())
    .sort((a, b) => a.data.localeCompare(b.data))
  const clienteIds = [...new Set(debiti.map((d) => d.clienteId))]
  const clienti = await db.clienti.where('id').anyOf(clienteIds).toArray()
  const clientiMap = new Map(clienti.map((c) => [c.id, c]))
  const clienteRimosso = (id: string): Cliente => ({
    id,
    nome: 'Cliente rimosso',
    telefono: '',
    creatoIl: '',
    aggiornatoIl: '',
  })
  return debiti.map((debito) => ({
    debito,
    cliente: clientiMap.get(debito.clienteId) ?? clienteRimosso(debito.clienteId),
  }))
}

export async function debitiCliente(clienteId: string): Promise<Debito[]> {
  const tutti = await db.debiti.where('clienteId').equals(clienteId).sortBy('data')
  const aperti = tutti.filter((d) => d.pagatoIl === undefined)
  const pagati = tutti.filter((d) => d.pagatoIl !== undefined).sort((a, b) => b.data.localeCompare(a.data))
  return [...aperti, ...pagati]
}

export async function totaleDaPagare(): Promise<TotaleDaPagare> {
  const aperti = (await db.debiti.filter((d) => d.pagatoIl === undefined).toArray())
  const totaleCent = aperti.reduce((sum, d) => sum + d.importoCent, 0)
  const clienti = new Set(aperti.map((d) => d.clienteId)).size
  return { totaleCent, clienti, voci: aperti.length }
}

// Impostazioni, backup, demo
export async function leggiImpostazioni(): Promise<Impostazioni> {
  const row = await db.impostazioni.get('impostazioni')
  if (row) {
    let valore = row.valore
    if (valore.frasi === undefined && impostazioniDefault.frasi !== undefined) {
      valore = { ...valore, frasi: impostazioniDefault.frasi }
    }
    if (valore.squadra === undefined && impostazioniDefault.squadra !== undefined) {
      valore = { ...valore, squadra: impostazioniDefault.squadra }
    }
    if (valore.messaggiRapidi === undefined && impostazioniDefault.messaggiRapidi !== undefined) {
      valore = { ...valore, messaggiRapidi: impostazioniDefault.messaggiRapidi }
    }
    if (valore.testoRiepilogo === undefined && impostazioniDefault.testoRiepilogo !== undefined) {
      valore = { ...valore, testoRiepilogo: impostazioniDefault.testoRiepilogo }
    }
    return valore
  }
  return { ...impostazioniDefault }
}

export async function salvaImpostazioni(imp: Impostazioni): Promise<void> {
  await db.impostazioni.put({ id: 'impostazioni', valore: imp })
}

export async function esportaBackup(): Promise<Blob> {
  const [clienti, appuntamenti, blocchi, debiti, imp] = await Promise.all([
    db.clienti.toArray(),
    db.appuntamenti.toArray(),
    db.blocchi.toArray(),
    db.debiti.toArray(),
    leggiImpostazioni(),
  ])
  const esportatoIl = new Date().toISOString()
  const impAgg = { ...imp, ultimoBackupIl: esportatoIl }
  await salvaImpostazioni(impAgg)
  const payload = {
    versione: 1,
    esportatoIl,
    clienti,
    appuntamenti,
    blocchi,
    debiti,
    impostazioni: impAgg,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

function validaBackup(payload: unknown): {
  clienti: Cliente[]
  appuntamenti: Appuntamento[]
  blocchi: Blocco[]
  debiti: Debito[]
  impostazioni?: Impostazioni
} {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Il file di backup non è valido')
  }
  const p = payload as Record<string, unknown>
  if (p.versione !== 1) throw new Error('Versione backup non supportata')

  const richiedeCampi = (oggetto: unknown, campi: string[], etichetta: string) => {
    if (typeof oggetto !== 'object' || oggetto === null) {
      throw new Error(`${etichetta}: voce non valida`)
    }
    for (const c of campi) {
      if ((oggetto as Record<string, unknown>)[c] === undefined) {
        throw new Error(`${etichetta}: manca il campo ${c}`)
      }
    }
  }

  if (!Array.isArray(p.clienti)) throw new Error('Il backup non contiene l’elenco clienti')
  if (!Array.isArray(p.appuntamenti)) throw new Error('Il backup non contiene l’elenco appuntamenti')
  if (!Array.isArray(p.blocchi)) throw new Error('Il backup non contiene l’elenco blocchi')

  const clienti = p.clienti as Cliente[]
  const appuntamenti = p.appuntamenti as Appuntamento[]
  const blocchi = p.blocchi as Blocco[]
  const debiti = Array.isArray(p.debiti) ? (p.debiti as Debito[]) : []

  for (const c of clienti) {
    richiedeCampi(c, ['id', 'nome', 'telefono', 'creatoIl', 'aggiornatoIl'], 'Cliente')
  }
  for (const a of appuntamenti) {
    richiedeCampi(
      a,
      ['id', 'data', 'ora', 'durataMin', 'operatoreId', 'clienteId', 'stato', 'promemoria', 'creatoIl', 'aggiornatoIl'],
      'Appuntamento',
    )
  }
  for (const b of blocchi) {
    richiedeCampi(b, ['id', 'data', 'operatoreId'], 'Blocco')
  }
  for (const d of debiti) {
    richiedeCampi(
      d,
      ['id', 'clienteId', 'importoCent', 'data', 'creatoIl', 'aggiornatoIl'],
      'Debito',
    )
  }

  const impostazioni =
    p.impostazioni !== undefined && typeof p.impostazioni === 'object' && p.impostazioni !== null
      ? (p.impostazioni as Impostazioni)
      : undefined

  return { clienti, appuntamenti, blocchi, debiti, impostazioni }
}

export async function importaBackup(file: Blob): Promise<{ clienti: number; appuntamenti: number }> {
  let payload: unknown
  try {
    payload = JSON.parse(await file.text())
  } catch {
    throw new Error('Il file non è un JSON valido')
  }
  const dati = validaBackup(payload)
  await db.transaction('rw', db.clienti, db.appuntamenti, db.blocchi, db.debiti, db.impostazioni, async () => {
    await db.clienti.clear()
    await db.appuntamenti.clear()
    await db.blocchi.clear()
    await db.debiti.clear()
    await db.impostazioni.clear()
    await db.clienti.bulkAdd(dati.clienti)
    await db.appuntamenti.bulkAdd(dati.appuntamenti)
    await db.blocchi.bulkAdd(dati.blocchi)
    await db.debiti.bulkAdd(dati.debiti)
    if (dati.impostazioni) {
      await db.impostazioni.add({
        id: 'impostazioni',
        valore: { ...dati.impostazioni, demoAttiva: false },
      })
    }
  })
  return {
    clienti: dati.clienti.length,
    appuntamenti: dati.appuntamenti.length,
  }
}

export async function giorniDallUltimoBackup(): Promise<number | null> {
  const imp = await leggiImpostazioni()
  if (!imp.ultimoBackupIl) return null
  const ultimo = new Date(imp.ultimoBackupIl)
  const oggiDate = new Date(oggi() + 'T00:00:00')
  const diff = Math.floor((oggiDate.getTime() - ultimo.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export async function caricaDatiDemo(): Promise<void> {
  await svuotaTutto()
  const imp = await leggiImpostazioni()
  await salvaImpostazioni({ ...imp, demoAttiva: true })
  const operatoriAttivi = [...imp.operatori]
    .filter((o) => o.attivo)
    .sort((a, b) => a.ordine - b.ordine)
  const op0 = operatoriAttivi[0]?.id
  const op1 = operatoriAttivi[1]?.id ?? op0
  if (!op0) return

  const serviziOrd = [...imp.servizi].sort((a, b) => a.ordine - b.ordine)
  const servizio0 = serviziOrd[0]?.id
  const servizio1 = serviziOrd[1]?.id

  const clienti: Cliente[] = [
    { id: crypto.randomUUID(), nome: 'Mario Rossi', telefono: '393330000001', creatoIl: new Date().toISOString(), aggiornatoIl: new Date().toISOString() },
    { id: crypto.randomUUID(), nome: 'Luigi Bianchi', telefono: '393330000002', creatoIl: new Date().toISOString(), aggiornatoIl: new Date().toISOString() },
    { id: crypto.randomUUID(), nome: 'Paolo Neri', telefono: '393330000003', creatoIl: new Date().toISOString(), aggiornatoIl: new Date().toISOString() },
    { id: crypto.randomUUID(), nome: 'Antonio Russo', telefono: '393330000004', creatoIl: new Date().toISOString(), aggiornatoIl: new Date().toISOString() },
  ]
  await db.clienti.bulkAdd(clienti)

  const prossimo = prossimoGiornoApertura(oggi(), imp, [])
  const ts = new Date().toISOString()

  const appuntamenti: Appuntamento[] = [
    {
      id: crypto.randomUUID(),
      data: prossimo,
      ora: '09:00',
      durataMin: serviziOrd[0]?.durataMin ?? 30,
      operatoreId: op0,
      clienteId: clienti[0].id,
      servizioId: servizio0,
      stato: 'prenotato',
      promemoria: 'da_inviare',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
    {
      id: crypto.randomUUID(),
      data: prossimo,
      ora: '10:00',
      durataMin: serviziOrd[1]?.durataMin ?? 20,
      operatoreId: op1,
      clienteId: clienti[1].id,
      servizioId: servizio1,
      stato: 'prenotato',
      promemoria: 'inviato',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
    {
      id: crypto.randomUUID(),
      data: prossimo,
      ora: '11:00',
      durataMin: serviziOrd[0]?.durataMin ?? 30,
      operatoreId: op0,
      clienteId: clienti[2].id,
      servizioId: servizio0,
      stato: 'confermato',
      promemoria: 'inviato',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
    {
      id: crypto.randomUUID(),
      data: prossimo,
      ora: '14:00',
      durataMin: serviziOrd[1]?.durataMin ?? 20,
      operatoreId: op1,
      clienteId: clienti[3].id,
      servizioId: servizio1,
      stato: 'provvisorio',
      promemoria: 'non_serve',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
    {
      id: crypto.randomUUID(),
      data: prossimo,
      ora: '15:00',
      durataMin: serviziOrd[0]?.durataMin ?? 30,
      operatoreId: op0,
      clienteId: clienti[0].id,
      servizioId: servizio0,
      stato: 'prenotato',
      promemoria: 'avvisato_telefono',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
  ]
  await db.appuntamenti.bulkAdd(appuntamenti)

  const lunediSettimana = settimanaDi(prossimo)[0]!
  await db.blocchi.add({
    id: crypto.randomUUID(),
    operatoreId: null,
    data: lunediSettimana,
    motivo: 'Corso fornitori',
    tipo: 'impegno',
  })

  const debitiDemo: Debito[] = [
    {
      id: crypto.randomUUID(),
      clienteId: clienti[0].id,
      importoCent: 1500,
      data: prossimo,
      nota: 'Taglio + barba',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
    {
      id: crypto.randomUUID(),
      clienteId: clienti[1].id,
      importoCent: 850,
      data: prossimo,
      nota: 'Metà la prossima volta',
      creatoIl: ts,
      aggiornatoIl: ts,
    },
  ]
  await db.debiti.bulkAdd(debitiDemo)

  const serieInizio = prossimo
  await creaSerie(
    {
      ora: '09:30',
      durataMin: serviziOrd[0]?.durataMin ?? 30,
      operatoreId: op0,
      clienteId: clienti[3]!.id,
      servizioId: servizio0,
      stato: 'prenotato',
      promemoria: 'da_inviare',
      note: 'Serie demo ogni 2 settimane',
    },
  datePerSerie(serieInizio, { ogni: 2, unita: 'settimane', volte: 4 }).map((data) => ({
      data,
      ora: '09:30',
    })),
  )
}

export async function svuotaTutto(): Promise<void> {
  await db.transaction('rw', db.clienti, db.appuntamenti, db.blocchi, db.debiti, db.impostazioni, async () => {
    await db.clienti.clear()
    await db.appuntamenti.clear()
    await db.blocchi.clear()
    await db.debiti.clear()
    await db.impostazioni.clear()
  })
}
