import type { Impostazioni } from '../../core'

const PALETTE = ['var(--tc-rosso)', 'var(--tc-blu)', 'var(--tc-oro)', 'var(--tc-verde-salvia)']

export function coloreOperatore(operatoreId: string, imp: Impostazioni): string {
  const attivi = [...imp.operatori].filter((o) => o.attivo).sort((a, b) => a.ordine - b.ordine)
  const i = attivi.findIndex((o) => o.id === operatoreId)
  return PALETTE[Math.max(0, i) % PALETTE.length]!
}
