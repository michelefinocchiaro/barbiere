import { describe, expect, it } from 'vitest'
import { datePerSerie } from './serie.ts'

describe('datePerSerie', () => {
  it('ogni N giorni con volte', () => {
    expect(datePerSerie('2026-11-10', { ogni: 3, unita: 'giorni', volte: 3 })).toEqual([
      '2026-11-10',
      '2026-11-13',
      '2026-11-16',
    ])
  })

  it('ogni settimane fino a data inclusa', () => {
    const date = datePerSerie('2026-11-10', { ogni: 2, unita: 'settimane', finoA: '2026-12-08' })
    expect(date[0]).toBe('2026-11-10')
    expect(date).toContain('2026-11-24')
    expect(date.at(-1)).toBe('2026-12-08')
  })

  it('31 gennaio + mesi: febbraio ultimo giorno, marzo torna 31', () => {
    const date = datePerSerie('2026-01-31', { ogni: 1, unita: 'mesi', volte: 3 })
    expect(date).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('al massimo 60 date', () => {
    const date = datePerSerie('2026-01-01', { ogni: 1, unita: 'giorni', volte: 100 })
    expect(date).toHaveLength(60)
  })

  it('rifiuta regola senza volte né finoA', () => {
    expect(() => datePerSerie('2026-11-10', { ogni: 1, unita: 'giorni' })).toThrow()
  })
})
