import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  appuntamentiDelGiorno,
  caricaDatiDemo,
  cercaClienti,
  db,
  debitiAperti,
  debitiCliente,
  eliminaAppuntamento,
  eliminaDebito,
  esportaBackup,
  impostaTestoPromemoria,
  importaBackup,
  leggiImpostazioni,
  modificaDebito,
  oggi,
  prossimoGiornoApertura,
  righePromemoria,
  riepilogo,
  salvaAppuntamento,
  salvaBlocco,
  salvaCliente,
  salvaImpostazioni,
  segnaDaPagare,
  segnaPagato,
  spostaAppuntamento,
  svuotaTutto,
  totaleDaPagare,
  trovaOCreaCliente,
  verificaAppuntamento,
} from './index.ts'
import { impostazioni as impostazioniNegozio } from '../negozi/index.ts'
import type { Appuntamento, Blocco, Cliente, Impostazioni } from './tipi.ts'

const op1 = 'op1'
const op2 = 'op2'
const dataAperta = '2026-11-17' // martedì

function app(
  overrides: Partial<Appuntamento> & Pick<Appuntamento, 'ora' | 'durataMin' | 'operatoreId'>,
): Omit<Appuntamento, 'id' | 'creatoIl' | 'aggiornatoIl'> {
  return {
    data: dataAperta,
    clienteId: 'c1',
    stato: 'prenotato',
    promemoria: 'da_inviare',
    ...overrides,
  }
}

beforeEach(async () => {
  await db.appuntamenti.clear()
  await db.blocchi.clear()
  await db.clienti.clear()
  await db.debiti.clear()
  await db.impostazioni.clear()
})

describe('trovaOCreaCliente', () => {
  it('deduplica per telefono normalizzato', async () => {
    const a = await trovaOCreaCliente('Nicolò', '333 123 4567')
    const b = await trovaOCreaCliente('Nicolò Verdi', '+39 3331234567')
    expect(b.id).toBe(a.id)
    expect(b.telefono).toBe('393331234567')
  })
})

describe('cercaClienti', () => {
  it('trova per nome accentato o per ultime cifre del telefono', async () => {
    const cliente: Cliente = {
      id: 'c1',
      nome: 'Nicolò',
      telefono: '393331234567',
      creatoIl: new Date().toISOString(),
      aggiornatoIl: new Date().toISOString(),
    }
    await salvaCliente(cliente)

    const perNomeNormale = await cercaClienti('nicolò')
    expect(perNomeNormale.map((c) => c.nome)).toContain('Nicolò')

    const perNomeSenzaAccento = await cercaClienti('nicolo')
    expect(perNomeSenzaAccento.map((c) => c.nome)).toContain('Nicolò')

    const perTelefono = await cercaClienti('4567')
    expect(perTelefono.map((c) => c.id)).toContain('c1')
  })
})

describe('verificaAppuntamento', () => {
  it('riporta sovrapposizione per lo stesso operatore', async () => {
    await salvaAppuntamento(app({ ora: '10:00', durataMin: 30, operatoreId: op1 }))
    const avvisi = await verificaAppuntamento({
      data: dataAperta,
      ora: '10:15',
      durataMin: 30,
      operatoreId: op1,
    })
    expect(avvisi.some((a) => a.tipo === 'sovrapposizione')).toBe(true)
  })

  it('ignora appuntamenti disdetti', async () => {
    await salvaAppuntamento(app({ ora: '10:00', durataMin: 30, operatoreId: op1, stato: 'disdetto' }))
    const avvisi = await verificaAppuntamento({
      data: dataAperta,
      ora: '10:15',
      durataMin: 30,
      operatoreId: op1,
    })
    expect(avvisi.some((a) => a.tipo === 'sovrapposizione')).toBe(false)
  })

  it('ignora operatori diversi', async () => {
    await salvaAppuntamento(app({ ora: '10:00', durataMin: 30, operatoreId: op1 }))
    const avvisi = await verificaAppuntamento({
      data: dataAperta,
      ora: '10:15',
      durataMin: 30,
      operatoreId: op2,
    })
    expect(avvisi.some((a) => a.tipo === 'sovrapposizione')).toBe(false)
  })

  it('non segnala appuntamenti consecutivi', async () => {
    await salvaAppuntamento(app({ ora: '10:00', durataMin: 30, operatoreId: op1 }))
    const avvisi = await verificaAppuntamento({
      data: dataAperta,
      ora: '10:30',
      durataMin: 30,
      operatoreId: op1,
    })
    expect(avvisi.some((a) => a.tipo === 'sovrapposizione')).toBe(false)
  })
})

describe('salvaAppuntamento', () => {
  it('salva anche quando ci sono avvisi', async () => {
    await salvaAppuntamento(app({ ora: '10:00', durataMin: 30, operatoreId: op1 }))
    const { appuntamento, avvisi } = await salvaAppuntamento(
      app({ ora: '10:15', durataMin: 30, operatoreId: op1 }),
    )
    expect(avvisi.some((a) => a.tipo === 'sovrapposizione')).toBe(true)
    const salvato = await appuntamentiDelGiorno(dataAperta)
    expect(salvato.map((a) => a.id)).toContain(appuntamento.id)
  })
})

describe('spostaAppuntamento', () => {
  it('riporta il promemoria a da_inviare se cambia il giorno', async () => {
    const { appuntamento } = await salvaAppuntamento(
      app({ data: '2026-11-17', ora: '10:00', durataMin: 30, operatoreId: op1, promemoria: 'inviato' }),
    )
    const risultato = await spostaAppuntamento(appuntamento.id, '2026-11-18', '11:00', op1)
    expect(risultato.appuntamento.promemoria).toBe('da_inviare')
  })

  it('lascia il promemoria invariato sullo stesso giorno', async () => {
    const { appuntamento } = await salvaAppuntamento(
      app({ data: '2026-11-17', ora: '10:00', durataMin: 30, operatoreId: op1, promemoria: 'inviato' }),
    )
    const risultato = await spostaAppuntamento(appuntamento.id, '2026-11-17', '11:00', op1)
    expect(risultato.appuntamento.promemoria).toBe('inviato')
  })
})

describe('eliminaAppuntamento', () => {
  it('rimuove l\'appuntamento', async () => {
    const { appuntamento } = await salvaAppuntamento(app({ ora: '10:00', durataMin: 30, operatoreId: op1 }))
    await eliminaAppuntamento(appuntamento.id)
    const salvati = await appuntamentiDelGiorno(dataAperta)
    expect(salvati).toHaveLength(0)
  })
})

const impDemo: Impostazioni = {
  nomeNegozio: 'Demo',
  logo: 'brand/logo-demo.png',
  prefissoPredefinito: '39',
  giorniApertura: [2, 3, 4, 5, 6],
  apre: '08:00',
  chiude: '20:00',
  passoGrigliaMin: 15,
  operatori: [{ id: op1, nome: 'Marco', attivo: true, ordine: 1 }],
  servizi: [{ id: 'taglio', nome: 'Taglio', durataMin: 30, ordine: 1 }],
  testoPromemoria: 'Ciao {nome}, ci vediamo {quando} alle {ora}.',
}

async function clienteDemo(id: string, nome: string, telefono: string): Promise<Cliente> {
  const c: Cliente = {
    id,
    nome,
    telefono,
    creatoIl: new Date().toISOString(),
    aggiornatoIl: new Date().toISOString(),
  }
  await salvaCliente(c)
  return c
}

describe('righePromemoria', () => {
  beforeEach(async () => {
    await salvaImpostazioni(impDemo)
  })

  it('ordina per ora e, a parità, per ordine operatore', async () => {
    const c = await clienteDemo('c1', 'Mario', '393330000001')
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '14:00', durataMin: 30 }))
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '09:00', durataMin: 30 }))
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '11:00', durataMin: 30 }))
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '10:00', durataMin: 30 }))
    const righe = await righePromemoria(dataAperta)
    expect(righe.map((r) => r.appuntamento.ora)).toEqual(['09:00', '10:00', '11:00', '14:00'])
  })

  it('esclude i disdetti', async () => {
    const c = await clienteDemo('c1', 'Mario', '393330000001')
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '09:00', durataMin: 30, stato: 'disdetto' }))
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '10:00', durataMin: 30, stato: 'prenotato' }))
    const righe = await righePromemoria(dataAperta)
    expect(righe).toHaveLength(1)
    expect(righe[0].appuntamento.stato).toBe('prenotato')
  })

  it('usa il testo ritoccato se presente, altrimenti quello standard', async () => {
    const c = await clienteDemo('c1', 'Mario', '393330000001')
    const { appuntamento } = await salvaAppuntamento(
      app({ clienteId: c.id, operatoreId: op1, ora: '10:00', durataMin: 30 }),
    )
    await impostaTestoPromemoria(appuntamento.id, 'Promemoria personalizzato per {nome}.')
    let righe = await righePromemoria(dataAperta)
    expect(righe[0].testo).toBe('Promemoria personalizzato per Mario.')

    await impostaTestoPromemoria(appuntamento.id, null)
    righe = await righePromemoria(dataAperta)
    expect(righe[0].testo).toContain('Ciao Mario, ci vediamo')
  })
})

describe('riepilogo', () => {
  it('conta anche i disdetti', async () => {
    const c = await clienteDemo('c1', 'Mario', '393330000001')
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '09:00', durataMin: 30, stato: 'disdetto' }))
    await salvaAppuntamento(app({ clienteId: c.id, operatoreId: op1, ora: '10:00', durataMin: 30, stato: 'prenotato' }))
    const r = await riepilogo(dataAperta)
    expect(r.totale).toBe(2)
    expect(r.disdetti).toBe(1)
  })
})

describe('debiti', () => {
  it('segnaDaPagare rifiuta importi non validi e salva quelli validi', async () => {
    await expect(segnaDaPagare({ clienteId: 'c1', importoCent: 0, data: dataAperta })).rejects.toThrow()
    await expect(segnaDaPagare({ clienteId: 'c1', importoCent: -100, data: dataAperta })).rejects.toThrow()
    await expect(segnaDaPagare({ clienteId: 'c1', importoCent: 15.5, data: dataAperta })).rejects.toThrow()

    const debito = await segnaDaPagare({ clienteId: 'c1', importoCent: 1500, data: dataAperta })
    expect(debito.importoCent).toBe(1500)
    const aperti = await debitiAperti()
    expect(aperti).toHaveLength(1)
    expect(aperti[0].debito.id).toBe(debito.id)
  })

  it('segnaPagato toglie e rimette il debito dagli aperti', async () => {
    const debito = await segnaDaPagare({ clienteId: 'c1', importoCent: 1000, data: dataAperta })
    expect((await debitiAperti()).map((d) => d.debito.id)).toContain(debito.id)

    await segnaPagato(debito.id, true)
    const pagato = await db.debiti.get(debito.id)
    expect(pagato?.pagatoIl).toBeDefined()
    expect((await debitiAperti()).map((d) => d.debito.id)).not.toContain(debito.id)

    await segnaPagato(debito.id, false)
    const annullato = await db.debiti.get(debito.id)
    expect(annullato?.pagatoIl).toBeUndefined()
    expect((await debitiAperti()).map((d) => d.debito.id)).toContain(debito.id)
  })

  it('debitiAperti è ordinato dal più vecchio e include il cliente giusto', async () => {
    const mario = await clienteDemo('c1', 'Mario', '393330000001')
    const luigi = await clienteDemo('c2', 'Luigi', '393330000002')
    await segnaDaPagare({ clienteId: mario.id, importoCent: 1000, data: '2026-11-20' })
    await segnaDaPagare({ clienteId: luigi.id, importoCent: 2000, data: '2026-11-18' })
    await segnaDaPagare({ clienteId: mario.id, importoCent: 500, data: '2026-11-19' })

    const aperti = await debitiAperti()
    expect(aperti.map((d) => d.debito.data)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20'])
    expect(aperti.map((d) => d.cliente.nome)).toEqual(['Luigi', 'Mario', 'Mario'])
  })

  it('totaleDaPagare conta solo gli aperti', async () => {
    await segnaDaPagare({ clienteId: 'c1', importoCent: 1000, data: dataAperta })
    await segnaDaPagare({ clienteId: 'c1', importoCent: 2000, data: dataAperta })
    const pagato = await segnaDaPagare({ clienteId: 'c2', importoCent: 500, data: dataAperta })
    await segnaDaPagare({ clienteId: 'c2', importoCent: 1500, data: dataAperta })
    await segnaPagato(pagato.id, true)

    const totale = await totaleDaPagare()
    expect(totale).toEqual({ totaleCent: 4500, clienti: 2, voci: 3 })
  })

  it('debitiCliente mette aperti prima e pagati dal più recente', async () => {
    const mario = await clienteDemo('c1', 'Mario', '393330000001')
    const aperto = await segnaDaPagare({ clienteId: mario.id, importoCent: 1000, data: '2026-11-15' })
    const pagatoVecchio = await segnaDaPagare({ clienteId: mario.id, importoCent: 500, data: '2026-11-10' })
    const pagatoRecente = await segnaDaPagare({ clienteId: mario.id, importoCent: 800, data: '2026-11-12' })
    await segnaPagato(pagatoVecchio.id, true)
    await segnaPagato(pagatoRecente.id, true)

    const lista = await debitiCliente(mario.id)
    expect(lista[0].id).toBe(aperto.id)
    expect(lista[1].id).toBe(pagatoRecente.id)
    expect(lista[2].id).toBe(pagatoVecchio.id)
  })

  it('modificaDebito aggiorna importo, nota e data', async () => {
    const debito = await segnaDaPagare({ clienteId: 'c1', importoCent: 1000, data: dataAperta, nota: 'prima' })
    await modificaDebito(debito.id, { importoCent: 1200, nota: 'dopo', data: '2026-11-20' })
    const aggiornato = await db.debiti.get(debito.id)
    expect(aggiornato?.importoCent).toBe(1200)
    expect(aggiornato?.nota).toBe('dopo')
    expect(aggiornato?.data).toBe('2026-11-20')
  })

  it('eliminaDebito rimuove il debito', async () => {
    const debito = await segnaDaPagare({ clienteId: 'c1', importoCent: 1000, data: dataAperta })
    await eliminaDebito(debito.id)
    expect(await db.debiti.get(debito.id)).toBeUndefined()
  })
})

describe('backup', () => {
  it('esporta, svuota e reimporta tutti i campi', async () => {
    const impConTutto: Impostazioni = {
      ...impDemo,
      nomeNegozio: 'Demo Modificata',
      ultimoBackupIl: '2026-11-01T10:00:00.000Z',
    }
    await salvaImpostazioni(impConTutto)

    const cliente: Cliente = {
      id: 'c-note',
      nome: 'Mario Note',
      telefono: '393330000001',
      note: 'Preferisce il pomeriggio',
      creatoIl: new Date().toISOString(),
      aggiornatoIl: new Date().toISOString(),
    }
    await salvaCliente(cliente)

    await salvaAppuntamento(
      app({
        id: 'a-note',
        clienteId: cliente.id,
        operatoreId: op1,
        ora: '10:00',
        durataMin: 30,
        stato: 'confermato',
        promemoria: 'inviato',
        note: 'Taglio preciso',
        testoPromemoria: 'Ciao {nome}, ci vediamo {quando}.',
      }),
    )

    const blocco: Omit<Blocco, 'id'> = {
      operatoreId: op1,
      data: dataAperta,
      dalle: '12:00',
      alle: '13:00',
      motivo: 'Pranzo',
    }
    await salvaBlocco(blocco)

    await segnaDaPagare({ clienteId: cliente.id, importoCent: 1500, data: dataAperta, nota: 'Taglio' })

    const clientiPrima = await db.clienti.toArray()
    const appuntamentiPrima = await db.appuntamenti.toArray()
    const blocchiPrima = await db.blocchi.toArray()
    const debitiPrima = await db.debiti.toArray()

    const blob = await esportaBackup()
    await svuotaTutto()
    expect((await db.clienti.toArray()).length).toBe(0)

    const risultato = await importaBackup(blob)
    expect(risultato).toEqual({ clienti: 1, appuntamenti: 1 })

    const clientiDopo = await db.clienti.toArray()
    const appuntamentiDopo = await db.appuntamenti.toArray()
    const blocchiDopo = await db.blocchi.toArray()
    const debitiDopo = await db.debiti.toArray()
    const impDopo = await leggiImpostazioni()

    expect(clientiDopo).toEqual(clientiPrima)
    expect(appuntamentiDopo).toEqual(appuntamentiPrima)
    expect(blocchiDopo).toEqual(blocchiPrima)
    expect(debitiDopo).toEqual(debitiPrima)

    const {
      ultimoBackupIl: _dopo,
      frasi: _frasiDopo,
      demoAttiva: _demoDopo,
      ...impSenzaBackup
    } = impDopo
    const {
      ultimoBackupIl: _prima,
      frasi: _frasiPrima,
      demoAttiva: _demoPrima,
      ...impAttesa
    } = impConTutto
    expect(impSenzaBackup).toEqual(impAttesa)
    expect(impDopo.ultimoBackupIl).toBeDefined()
    expect(impDopo.demoAttiva).toBe(false)
  })

  it('rifiuta versioni sconosciute', async () => {
    const blob = new Blob([JSON.stringify({ versione: 99, clienti: [], appuntamenti: [], blocchi: [] })])
    await expect(importaBackup(blob)).rejects.toThrow('Versione backup non supportata')
  })

  it('accetta backup senza debiti lasciando la tabella vuota', async () => {
    const blob = new Blob([JSON.stringify({ versione: 1, clienti: [], appuntamenti: [], blocchi: [] })])
    await importaBackup(blob)
    expect(await db.debiti.toArray()).toEqual([])
  })
})

describe('demoAttiva', () => {
  it('true dopo caricaDatiDemo, false dopo svuotaTutto e importaBackup', async () => {
    await caricaDatiDemo()
    expect((await leggiImpostazioni()).demoAttiva).toBe(true)

    await svuotaTutto()
    const dopoSvuota = await leggiImpostazioni()
    expect(dopoSvuota.demoAttiva).toBeFalsy()

    await salvaImpostazioni({ ...impDemo, demoAttiva: true })
    const blob = await esportaBackup()
    await svuotaTutto()
    await importaBackup(blob)
    expect((await leggiImpostazioni()).demoAttiva).toBe(false)
  })
})

describe('leggiImpostazioni frasi', () => {
  it('riempie frasi dal negozio se mancano nelle impostazioni salvate', async () => {
    const senzaFrasi: Impostazioni = {
      ...impDemo,
      nomeNegozio: 'Salvato',
    }
    delete senzaFrasi.frasi
    await salvaImpostazioni(senzaFrasi)

    const imp = await leggiImpostazioni()
    expect(imp.nomeNegozio).toBe('Salvato')
    expect(imp.frasi).toEqual(impostazioniNegozio.frasi)
    expect(imp.frasi?.mattina?.[0]).toContain('friend')
  })
})

describe('caricaDatiDemo', () => {
  it('mette gli appuntamenti nel prossimo giorno di apertura con tutti gli esiti', async () => {
    await caricaDatiDemo()
    const imp = await leggiImpostazioni()
    const prossimo = prossimoGiornoApertura(oggi(), imp, [])

    const righe = await righePromemoria(prossimo)
    expect(righe.length).toBeGreaterThanOrEqual(4)

    const esiti = new Set(righe.map((r) => r.appuntamento.promemoria))
    expect(esiti).toContain('da_inviare')
    expect(esiti).toContain('inviato')
    expect(esiti).toContain('avvisato_telefono')
    expect(esiti).toContain('non_serve')

    const inAttesa = righe.filter((r) => r.inAttesa)
    expect(inAttesa.length).toBeGreaterThanOrEqual(1)

    const confermati = righe.filter((r) => r.appuntamento.stato === 'confermato')
    expect(confermati.length).toBeGreaterThanOrEqual(1)

    const nomiOperatori = new Set(imp.operatori.map((o) => o.nome))
    const clienti = await db.clienti.toArray()
    for (const c of clienti) {
      expect(nomiOperatori.has(c.nome)).toBe(false)
    }
  })

  it('aggiunge 2 debiti aperti su 2 clienti diversi e svuotaTutto li cancella', async () => {
    await caricaDatiDemo()
    const aperti = await debitiAperti()
    expect(aperti).toHaveLength(2)
    expect(new Set(aperti.map((d) => d.debito.clienteId)).size).toBe(2)

    await svuotaTutto()
    expect(await db.debiti.toArray()).toHaveLength(0)
  })
})
