import { describe, expect, it } from 'vitest'
import {
  componiPromemoria,
  formattaOra,
  formattaTelefono,
  linkWhatsApp,
  normalizzaTelefono,
  oggi,
  prossimoGiornoApertura,
  quando,
} from './index.ts'
import { impostazioni as impostazioniNegozio } from '../negozi/index.ts'
import type { Blocco, Impostazioni } from './tipi.ts'

const imp: Impostazioni = {
  nomeNegozio: 'Test',
  logo: 'brand/logo-test.png',
  prefissoPredefinito: '39',
  giorniApertura: [2, 3, 4, 5, 6],
  apre: '08:00',
  chiude: '20:00',
  passoGrigliaMin: 15,
  operatori: [],
  servizi: [],
  testoPromemoria: '',
}

describe('normalizzaTelefono', () => {
  it('accetta varianti di cellulare italiano', () => {
    expect(normalizzaTelefono('333 123 4567')).toBe('393331234567')
    expect(normalizzaTelefono('+39 333-123.4567')).toBe('393331234567')
    expect(normalizzaTelefono('0039 3331234567')).toBe('393331234567')
    expect(normalizzaTelefono('(333) 1234567')).toBe('393331234567')
  })

  it('tiene lo zero dei fissi', () => {
    expect(normalizzaTelefono('095 123456')).toBe('39095123456')
  })

  it('rifiuta numeri troppo corti o non numerici', () => {
    expect(normalizzaTelefono('12345')).toBeNull()
    expect(normalizzaTelefono('abc')).toBeNull()
  })
})

describe('formattaTelefono', () => {
  it('formatta un numero normalizzato', () => {
    expect(formattaTelefono('393331234567')).toBe('+39 333 123 4567')
  })
})

describe('formattaOra', () => {
  it('toglie lo zero iniziale all\'ora', () => {
    expect(formattaOra('08:15')).toBe('8.15')
    expect(formattaOra('14:00')).toBe('14.00')
  })
})

describe('quando', () => {
  const oggiStr = '2026-11-14'

  it('restituisce oggi, domani, giorno della settimana o data lunga', () => {
    expect(quando('2026-11-14', oggiStr)).toBe('oggi')
    expect(quando('2026-11-15', oggiStr)).toBe('domani')
    expect(quando('2026-11-17', oggiStr)).toBe('martedì')
    expect(quando('2026-11-24', oggiStr)).toBe('martedì 24 novembre')
  })
})

describe('prossimoGiornoApertura', () => {
  it('salta la domenica e il lunedì', () => {
    expect(prossimoGiornoApertura('2026-11-14', imp, [])).toBe('2026-11-17')
  })

  it('va al giorno successivo se oggi è aperto', () => {
    expect(prossimoGiornoApertura('2026-11-10', imp, [])).toBe('2026-11-11')
  })

  it('salta un blocco di tutto il negozio', () => {
    const blocchi: Blocco[] = [{ id: '1', operatoreId: null, data: '2026-11-17' }]
    expect(prossimoGiornoApertura('2026-11-14', imp, blocchi)).toBe('2026-11-18')
  })

  it('non salta un blocco di un solo operatore', () => {
    const blocchi: Blocco[] = [{ id: '1', operatoreId: 'op1', data: '2026-11-17' }]
    expect(prossimoGiornoApertura('2026-11-14', imp, blocchi)).toBe('2026-11-17')
  })
})

describe('componiPromemoria', () => {
  it('sostituisce i segnaposto noti e lascia intatti quelli sconosciuti', () => {
    expect(componiPromemoria('Ciao {nome}, ci vediamo {quando}', { nome: 'Luca', quando: 'domani' }))
      .toBe('Ciao Luca, ci vediamo domani')
    expect(componiPromemoria('Ciao {nome} {cognome}', { nome: 'Luca' }))
      .toBe('Ciao Luca {cognome}')
  })
})

describe('linkWhatsApp', () => {
  it('codifica il testo e si decodifica identico', () => {
    const modello = `Ciao friend ti ricordiamo l’appuntamento di {quando}
RESTIAMO IN ATTESA DI CONFERMA !! 😉💈💇🏻‍♂️👋🏻
Ci vediamo alle {ora}`
    const testo = componiPromemoria(modello, { quando: 'martedì', ora: '8.15' })
    const link = linkWhatsApp('393331234567', testo)
    const url = new URL(link)
    const decoded = url.searchParams.get('text')!

    expect(link).toBe(
      `https://api.whatsapp.com/send/?phone=393331234567&text=${encodeURIComponent(testo)}`,
    )
    expect(decoded).toBe(testo)
    expect(decoded).toContain('Ciao friend ti ricordiamo l’appuntamento di martedì')
    expect((link.match(/%0A/g) ?? []).length).toBe(2)
    expect(link).toContain('%E2%80%99')
    expect(decoded.includes('💇🏻‍♂️')).toBe(true)
  })

  it('con il testo standard del negozio il parametro text è identico byte per byte', () => {
    const testo = componiPromemoria(impostazioniNegozio.testoPromemoria, {
      quando: 'martedì',
      ora: '8.15',
    })
    const link = linkWhatsApp('393330000001', testo)
    expect(new URL(link).searchParams.get('text')).toBe(testo)
  })
})

describe('testo promemoria standard', () => {
  it('confronta il testo promemoria standard del negozio per intero', () => {
    const testo = componiPromemoria(impostazioniNegozio.testoPromemoria, { quando: 'martedì', ora: '8.15' })
    expect(testo).toBe(`Ciao friend ti ricordiamo l’appuntamento di martedì\nRESTIAMO IN ATTESA DI CONFERMA !! 😉💈💇🏻‍♂️👋🏻\nCi vediamo alle 8.15`)
  })
})

describe('oggi', () => {
  it('restituisce una data ISO', () => {
    expect(oggi()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
