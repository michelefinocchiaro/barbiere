import type { Appuntamento, Blocco, HHMM, Impostazioni, ISODate, Operatore } from '../../core'
import { oggi, slotLibero } from '../../core'
import { minutiDaOra, slotOrari } from '../utils/dateUi'

const DURATA_DEFAULT = 30

/** Primo orario libero sul giorno mostrato e primo operatore libero a quell'ora. */
export function primoSlotLibero(
  data: ISODate,
  imp: Impostazioni,
  appuntamenti: Appuntamento[],
  blocchi: Blocco[],
  operatori: Operatore[],
  oraCorrente: HHMM,
): { ora: HHMM; operatoreId: string } {
  const slots = slotOrari(imp.apre, imp.chiude, imp.passoGrigliaMin)
  const passo = imp.passoGrigliaMin
  const apreMin = minutiDaOra(imp.apre)
  const oggiIso = oggi()

  let startMin = apreMin
  if (data === oggiIso) {
    const now = minutiDaOra(oraCorrente)
    if (now > apreMin) {
      startMin = apreMin + Math.ceil((now - apreMin) / passo) * passo
    }
  }

  for (const slot of slots) {
    const slotMin = minutiDaOra(slot)
    if (slotMin < startMin) continue
    for (const op of operatori) {
      if (slotLibero(op.id, slot, DURATA_DEFAULT, appuntamenti, blocchi)) {
        return { ora: slot, operatoreId: op.id }
      }
    }
  }

  const op = operatori[0]
  return { ora: imp.apre, operatoreId: op?.id ?? '' }
}
