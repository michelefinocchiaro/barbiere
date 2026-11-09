import Dexie from 'dexie'
import type { Table } from 'dexie'

import { impostazioni as impostazioniDefault } from '../negozi/index.ts'
import type {
  Appuntamento,
  Avviso,
  Blocco,
  Cliente,
  EsitoPromemoria,
  HHMM,
  Impostazioni,
  ISODate,
  Riepilogo,
  RigaPromemoria,
  StatoAppuntamento,
} from './tipi.ts'

export type {
  Appuntamento,
  Avviso,
  Blocco,
  Cliente,
  EsitoPromemoria,
  HHMM,
  Impostazioni,
  ISODate,
  Operatore,
  Riepilogo,
  RigaPromemoria,
  Servizio,
  StatoAppuntamento,
  TipoAvviso,
} from './tipi.ts'

// Database
export const db = new Dexie('barbiere') as Dexie & {
  clienti: Table<Cliente, string>
  appuntamenti: Table<Appuntamento, string>
  blocchi: Table<Blocco, string>
  impostazioni: Table<{ id: string; valore: Impostazioni }, string>
}

db.version(1).stores({
  clienti: 'id, &telefono, nome, aggiornatoIl',
  appuntamenti: 'id, data, operatoreId, clienteId, stato, aggiornatoIl',
  blocchi: 'id, data, operatoreId',
  impostazioni: 'id',
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

function normalizzaRicerca(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  // Assenze
  const blocchi = await db.blocchi.where('data').equals(app.data).toArray()
  for (const b of blocchi) {
    if (b.operatoreId !== null && b.operatoreId !== app.operatoreId) continue
    const bloccoInizio = b.dalle ? hhmmToMinuti(b.dalle) : 0
    const bloccoFine = b.alle ? hhmmToMinuti(b.alle) : 24 * 60
    if (fine > bloccoInizio && inizio < bloccoFine) {
      const chi = b.operatoreId === null ? 'Il negozio' : "L'operatore"
      avvisi.push({ tipo: 'assenza', messaggio: `${chi} è assente in questo orario.` })
    }
  }

  // Sovrapposizioni
  if (app.stato !== 'disdetto') {
    const altri = await db.appuntamenti
      .where('data')
      .equals(app.data)
      .and((a) => a.operatoreId === app.operatoreId && a.id !== app.id && a.stato !== 'disdetto')
      .toArray()
    for (const a of altri) {
      const aInizio = hhmmToMinuti(a.ora)
      const aFine = aInizio + a.durataMin
      if (fine > aInizio && inizio < aFine) {
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

export function prossimoGiornoApertura(da: ISODate, imp: Impostazioni, blocchi: Blocco[]): ISODate {
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

export function componiPromemoria(modello: string, valori: Record<string, string>): string {
  return modello.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, chiave: string) => {
    return chiave in valori ? valori[chiave] : match
  })
}

export function linkWhatsApp(telefono: string, testo: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(testo)}`
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
  const norm = normalizzaTelefono(telefono) ?? telefono
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

export async function salvaAppuntamento(
  a: Omit<Appuntamento, 'id' | 'creatoIl' | 'aggiornatoIl'> & { id?: string },
): Promise<{ appuntamento: Appuntamento; avvisi: Avviso[] }> {
  const now = new Date().toISOString()
  let app: Appuntamento
  if (a.id) {
    const esistente = await db.appuntamenti.get(a.id)
    app = { ...(esistente ?? {}), ...a, aggiornatoIl: now } as Appuntamento
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

export async function impostaStato(id: string, stato: StatoAppuntamento): Promise<void> {
  await db.appuntamenti.update(id, { stato, aggiornatoIl: new Date().toISOString() })
}

export async function eliminaAppuntamento(id: string): Promise<void> {
  await db.appuntamenti.delete(id)
}

export async function blocchiDelGiorno(data: ISODate): Promise<Blocco[]> {
  return db.blocchi.where('data').equals(data).toArray()
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

// Impostazioni, backup, demo
export async function leggiImpostazioni(): Promise<Impostazioni> {
  const row = await db.impostazioni.get('impostazioni')
  if (row) return row.valore
  return { ...impostazioniDefault }
}

export async function salvaImpostazioni(imp: Impostazioni): Promise<void> {
  await db.impostazioni.put({ id: 'impostazioni', valore: imp })
}

export async function esportaBackup(): Promise<Blob> {
  const [clienti, appuntamenti, blocchi, imp] = await Promise.all([
    db.clienti.toArray(),
    db.appuntamenti.toArray(),
    db.blocchi.toArray(),
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
    impostazioni: impAgg,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export async function importaBackup(file: Blob): Promise<{ clienti: number; appuntamenti: number }> {
  const testo = await file.text()
  const payload = JSON.parse(testo)
  if (payload.versione !== 1) throw new Error('Versione backup non supportata')
  await db.transaction('rw', db.clienti, db.appuntamenti, db.blocchi, db.impostazioni, async () => {
    await db.clienti.clear()
    await db.appuntamenti.clear()
    await db.blocchi.clear()
    await db.impostazioni.clear()
    await db.clienti.bulkAdd(payload.clienti ?? [])
    await db.appuntamenti.bulkAdd(payload.appuntamenti ?? [])
    await db.blocchi.bulkAdd(payload.blocchi ?? [])
    if (payload.impostazioni) {
      await db.impostazioni.add({ id: 'impostazioni', valore: payload.impostazioni })
    }
  })
  return {
    clienti: payload.clienti?.length ?? 0,
    appuntamenti: payload.appuntamenti?.length ?? 0,
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
}

export async function svuotaTutto(): Promise<void> {
  await db.transaction('rw', db.clienti, db.appuntamenti, db.blocchi, db.impostazioni, async () => {
    await db.clienti.clear()
    await db.appuntamenti.clear()
    await db.blocchi.clear()
    await db.impostazioni.clear()
  })
}
