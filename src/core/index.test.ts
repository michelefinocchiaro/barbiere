import { describe, expect, it } from 'vitest'
import {
  componiMessaggioRapido,
  componiPromemoria,
  formattaEuro,
  formattaOra,
  formattaTelefono,
  giornoEsteso,
  leggiEuro,
  linkWhatsApp,
  normalizzaTelefono,
  oggi,
  giornoAperto,
  intervalloOccupato,
  prossimoGiornoApertura,
  quando,
  settimanaDi,
  sommaMinuti,
} from './index.ts'
import type { Appuntamento, Cliente, MessaggioRapido } from './tipi.ts'
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

describe('formattaEuro', () => {
  it('formatta i centesimi in euro', () => {
    expect(formattaEuro(1500)).toBe('15,00 €')
    expect(formattaEuro(50)).toBe('0,50 €')
    expect(formattaEuro(123456)).toBe('1.234,56 €')
    expect(formattaEuro(100000)).toBe('1.000,00 €')
  })
})

describe('leggiEuro', () => {
  it('converte stringhe valide in centesimi', () => {
    expect(leggiEuro('15')).toBe(1500)
    expect(leggiEuro('15,5')).toBe(1550)
    expect(leggiEuro('15.50')).toBe(1550)
    expect(leggiEuro('€ 15,50')).toBe(1550)
    expect(leggiEuro(' 8,5 € ')).toBe(850)
  })

  it('rifiuta stringhe non valide', () => {
    expect(leggiEuro('')).toBeNull()
    expect(leggiEuro('abc')).toBeNull()
    expect(leggiEuro('0')).toBeNull()
    expect(leggiEuro('-5')).toBeNull()
    expect(leggiEuro('15,555')).toBeNull()
  })

  it('legge gli importi formattati con migliaia e fa andata e ritorno con formattaEuro', () => {
    const casi = [1, 99, 100000, 1234550]
    for (const cent of casi) {
      const testo = formattaEuro(cent).replace(' €', '')
      expect(leggiEuro(testo)).toBe(cent)
    }
    expect(leggiEuro('1.000,00')).toBe(100000)
    expect(leggiEuro('12.345,50')).toBe(1234550)
    expect(leggiEuro('12.5')).toBe(1250)
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

describe('settimanaDi', () => {
  it('restituisce sette giorni da lunedì a domenica', () => {
    expect(settimanaDi('2026-11-14')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
  })
})

describe('giornoAperto', () => {
  it('lunedì e domenica chiusi per il negozio demo', () => {
    expect(giornoAperto('2026-11-16', imp, [])).toBe(false)
    expect(giornoAperto('2026-11-17', imp, [])).toBe(true)
  })

  it('un impegno di giornata intera non chiude il negozio', () => {
    const blocchi: Blocco[] = [
      { id: '1', operatoreId: null, data: '2026-11-17', motivo: 'Corso', tipo: 'impegno' },
    ]
    expect(giornoAperto('2026-11-17', imp, blocchi)).toBe(true)
  })

  it('blocco assenza tutto il negozio chiude quel giorno', () => {
    const blocchi: Blocco[] = [{ id: '1', operatoreId: null, data: '2026-11-17' }]
    expect(giornoAperto('2026-11-17', imp, blocchi)).toBe(false)
  })
})

describe('intervalloOccupato', () => {
  const apps: Appuntamento[] = []

  it('impegno con orario occupa lo slot', () => {
    const blocchi: Blocco[] = [
      {
        id: 'i1',
        operatoreId: null,
        data: '2026-11-17',
        dalle: '10:00',
        alle: '11:00',
        tipo: 'impegno',
        motivo: 'Corso',
      },
    ]
    expect(intervalloOccupato('op1', 10 * 60, 10 * 60 + 30, apps, blocchi)).toBe(true)
  })

  it('impegno tutto il giorno non occupa gli slot orari', () => {
    const blocchi: Blocco[] = [
      { id: 'i2', operatoreId: null, data: '2026-11-17', tipo: 'impegno', motivo: 'Fiera' },
    ]
    expect(intervalloOccupato('op1', 10 * 60, 10 * 60 + 30, apps, blocchi)).toBe(false)
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

  it('ignora un impegno a giornata intera', () => {
    const blocchi: Blocco[] = [
      { id: '1', operatoreId: null, data: '2026-11-17', motivo: 'Fornitore', tipo: 'impegno' },
    ]
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

describe('sommaMinuti', () => {
  it('somma i minuti e non supera 23:59', () => {
    expect(sommaMinuti('08:50', 10)).toBe('09:00')
    expect(sommaMinuti('23:50', 30)).toBe('23:59')
  })
})

describe('giornoEsteso', () => {
  it('formatta giorno, numero e mese in italiano', () => {
    expect(giornoEsteso('2026-11-17')).toMatch(/martedì\s+17\s+novembre/i)
  })
})

describe('componiMessaggioRapido', () => {
  const cliente: Cliente = {
    id: 'c1',
    nome: 'Cliente Demo',
    telefono: '393330000001',
    creatoIl: '',
    aggiornatoIl: '',
  }
  const appuntamento: Appuntamento = {
    id: 'a1',
    data: '2026-11-17',
    ora: '10:00',
    durataMin: 30,
    operatoreId: 'op1',
    clienteId: 'c1',
    stato: 'prenotato',
    promemoria: 'da_inviare',
    creatoIl: '',
    aggiornatoIl: '',
  }

  it('sostituisce i segnaposto incluso ora_dopo con ritardo', () => {
    const m: MessaggioRapido = {
      id: 'ritardo',
      etichetta: 'Ritarda',
      ritardoMin: 10,
      testo: 'Alle {ora} o {ora_dopo} per {nome}',
    }
    const testo = componiMessaggioRapido(m, appuntamento, cliente, '2026-11-14')
    expect(testo).toBe('Alle 10.00 o 10.10 per Cliente Demo')
  })
})
