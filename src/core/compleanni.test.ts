import { describe, expect, it } from 'vitest'
import {
  addDays,
  compleannoNelGiorno,
  dataCompleannoInAnno,
  leggiCompleanno,
  medianaGapGiorni,
  prossimoCompleanno,
} from './compleanni.ts'

describe('leggiCompleanno', () => {
  it('valida giorni del mese', () => {
    expect(leggiCompleanno(30, 2)).toBeNull()
    expect(leggiCompleanno(31, 4)).toBeNull()
    expect(leggiCompleanno(15, 7)).toBe('07-15')
    expect(leggiCompleanno(15, 7, 1990)).toBe('1990-07-15')
  })

  it('29 febbraio solo se bisestile con anno', () => {
    expect(leggiCompleanno(29, 2, 2024)).toBe('2024-02-29')
    expect(leggiCompleanno(29, 2, 2023)).toBeNull()
    expect(leggiCompleanno(29, 2)).toBe('02-29')
  })
})

describe('prossimoCompleanno', () => {
  it('29/2 in anno non bisestile diventa 28/2', () => {
    expect(prossimoCompleanno('02-29', '2025-01-01')).toBe('2025-02-28')
    expect(dataCompleannoInAnno(2, 29, 2025)).toBe('2025-02-28')
  })

  it('prende il compleanno ancora nel futuro quest anno', () => {
    expect(prossimoCompleanno('12-25', '2026-11-13')).toBe('2026-12-25')
  })

  it('dopo il giorno passa all anno successivo', () => {
    expect(prossimoCompleanno('03-01', '2026-11-13')).toBe('2027-03-01')
  })
})

describe('compleannoNelGiorno', () => {
  it('confronta mese e giorno', () => {
    expect(compleannoNelGiorno('11-13', '2026-11-13')).toBe(true)
    expect(compleannoNelGiorno('11-13', '2026-11-14')).toBe(false)
  })
})

describe('medianaGapGiorni', () => {
  it('serve almeno 3 visite', () => {
    expect(medianaGapGiorni(['2026-01-01', '2026-01-08'])).toBeUndefined()
    expect(medianaGapGiorni(['2026-01-01', '2026-01-08', '2026-01-22'])).toBe(11)
  })
})

describe('addDays', () => {
  it('attraversa capodanno', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})
