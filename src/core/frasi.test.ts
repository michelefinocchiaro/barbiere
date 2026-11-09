import { describe, expect, it } from 'vitest'
import {
  FRASI_PREDEFINITE,
  fraseDelMomento,
  momentoDellaGiornata,
} from './index.ts'
import type { Blocco, ContestoFrase, Impostazioni } from './tipi.ts'
import { impostazioni as impNegozio } from '../negozi/index.ts'

const impBase: Impostazioni = {
  nomeNegozio: 'Test',
  logo: 'brand/logo-test.png',
  prefissoPredefinito: '39',
  giorniApertura: [2, 3, 4, 5, 6],
  apre: '08:00',
  chiude: '20:00',
  passoGrigliaMin: 15,
  operatori: [
    { id: 'op1', nome: 'Marco', attivo: true, ordine: 1 },
    { id: 'op2', nome: 'Luca', attivo: true, ordine: 2 },
  ],
  servizi: [],
  testoPromemoria: '',
}

const martedi = '2026-11-17' // martedì
const lunedi = '2026-11-16'

function contesto(data: string, extra?: Partial<ContestoFrase>): ContestoFrase {
  return { data, teste: 5, restanti: 3, ...extra }
}

describe('momentoDellaGiornata', () => {
  it('restituisce mattina, pomeriggio, sera, fine_giornata, giornata_vuota e chiuso', () => {
    expect(momentoDellaGiornata(martedi, '09:00', impBase, [], 5, 3)).toBe('mattina')
    expect(momentoDellaGiornata(martedi, '14:00', impBase, [], 5, 3)).toBe('pomeriggio')
    expect(momentoDellaGiornata(martedi, '18:00', impBase, [], 5, 3)).toBe('sera')
    expect(momentoDellaGiornata(martedi, '20:00', impBase, [], 5, 0)).toBe('fine_giornata')
    expect(momentoDellaGiornata(martedi, '10:00', impBase, [], 0, 0)).toBe('giornata_vuota')
    expect(momentoDellaGiornata(lunedi, '10:00', impBase, [], 5, 3)).toBe('chiuso')
  })

  it('rispetta i confini orari 11:59/12:00 e 16:59/17:00', () => {
    expect(momentoDellaGiornata(martedi, '11:59', impBase, [], 5, 3)).toBe('mattina')
    expect(momentoDellaGiornata(martedi, '12:00', impBase, [], 5, 3)).toBe('pomeriggio')
    expect(momentoDellaGiornata(martedi, '16:59', impBase, [], 5, 3)).toBe('pomeriggio')
    expect(momentoDellaGiornata(martedi, '17:00', impBase, [], 5, 3)).toBe('sera')
  })

  it('ora uguale a chiude o restanti zero → fine_giornata', () => {
    expect(momentoDellaGiornata(martedi, '20:00', impBase, [], 5, 3)).toBe('fine_giornata')
    expect(momentoDellaGiornata(martedi, '15:00', impBase, [], 5, 0)).toBe('fine_giornata')
  })

  it('lunedì chiuso anche con teste > 0', () => {
    expect(momentoDellaGiornata(lunedi, '10:00', impBase, [], 10, 5)).toBe('chiuso')
  })

  it('blocco negozio giornata intera → chiuso', () => {
    const blocchi: Blocco[] = [{ id: 'b1', operatoreId: null, data: martedi }]
    expect(momentoDellaGiornata(martedi, '10:00', impBase, blocchi, 5, 3)).toBe('chiuso')
  })
})

describe('fraseDelMomento', () => {
  it('è deterministica a parità di argomenti', () => {
    const ctx = contesto(martedi)
    const a = fraseDelMomento('mattina', ctx, impBase)
    const b = fraseDelMomento('mattina', ctx, impBase)
    expect(a).toBe(b)
  })

  it('su 7 date consecutive almeno 2 frasi diverse', () => {
    const frasi = new Set<string>()
    for (let i = 0; i < 7; i++) {
      const d = `2026-11-${17 + i}`
      frasi.add(fraseDelMomento('mattina', contesto(d), impBase))
    }
    expect(frasi.size).toBeGreaterThanOrEqual(2)
  })

  it('usa le frasi personalizzate del negozio', () => {
    const imp: Impostazioni = { ...impBase, frasi: { mattina: ['A {teste}'] } }
    expect(fraseDelMomento('mattina', contesto(martedi, { teste: 3 }), imp)).toBe('A 3')
  })

  it('con lista vuota usa le predefinite', () => {
    const imp: Impostazioni = { ...impBase, frasi: { mattina: [] } }
    const frase = fraseDelMomento('mattina', contesto(martedi), imp)
    const tutte = FRASI_PREDEFINITE.mattina.map((m) =>
      m.replace('{teste}', String(contesto(martedi).teste ?? 0)),
    )
    expect(tutte).toContain(frase)
  })

  it('lascia i segnaposto sconosciuti intatti', () => {
    const imp: Impostazioni = { ...impBase, frasi: { mattina: ['Ciao {boh}'] } }
    expect(fraseDelMomento('mattina', contesto(martedi), imp)).toBe('Ciao {boh}')
  })

  it('{operatore} non include operatori disattivati', () => {
    const imp: Impostazioni = {
      ...impBase,
      operatori: [
        { id: 'op1', nome: 'Marco', attivo: true, ordine: 1 },
        { id: 'op2', nome: 'Luca', attivo: false, ordine: 2 },
      ],
      frasi: { giornata_vuota: ['Ehi {operatore}!'] },
    }
    for (let i = 0; i < 30; i++) {
      const d = `2026-11-${String(i + 1).padStart(2, '0')}`
      const frase = fraseDelMomento('giornata_vuota', contesto(d), imp)
      expect(frase).not.toContain('Luca')
    }
  })
})

describe('FRASI_PREDEFINITE', () => {
  it('non contiene "friend" né nomi di persone', () => {
    for (const lista of Object.values(FRASI_PREDEFINITE)) {
      for (const frase of lista) {
        expect(frase.toLowerCase()).not.toContain('friend')
        for (const op of [...impNegozio.operatori, ...impBase.operatori]) {
          expect(frase).not.toContain(op.nome)
        }
      }
    }
  })
})
