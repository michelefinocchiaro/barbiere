export type VistaAgenda = 'giorno' | 'settimana'

const CHIAVE = 'barbiere-agenda-vista'

export function leggiVistaAgenda(): VistaAgenda {
  try {
    const v = localStorage.getItem(CHIAVE)
    if (v === 'settimana' || v === 'giorno') return v
  } catch {
    /* storage non disponibile */
  }
  return 'giorno'
}

export function salvaVistaAgenda(v: VistaAgenda): void {
  try {
    localStorage.setItem(CHIAVE, v)
  } catch {
    /* storage non disponibile */
  }
}
