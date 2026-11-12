import type { Appuntamento, Blocco, HHMM, Impostazioni, ISODate, Operatore } from '../../core'
import { oggi } from '../../core'
import { minutiDaOra, slotOrari } from '../utils/dateUi'

const DURATA_DEFAULT = 30

function intervalliSiSovrappongono(inizio: number, fine: number, aInizio: number, aFine: number): boolean {
  return fine > aInizio && inizio < aFine
}

function bloccoCopre(
  blocco: Blocco,
  operatoreId: string,
  inizio: number,
  fine: number,
): boolean {
  if (blocco.operatoreId !== null && blocco.operatoreId !== operatoreId) return false
  const bloccoInizio = blocco.dalle ? minutiDaOra(blocco.dalle) : 0
  const bloccoFine = blocco.alle ? minutiDaOra(blocco.alle) : 24 * 60
  return intervalliSiSovrappongono(inizio, fine, bloccoInizio, bloccoFine)
}

function slotLibero(
  operatoreId: string,
  ora: HHMM,
  durataMin: number,
  appuntamenti: Appuntamento[],
  blocchi: Blocco[],
): boolean {
  const inizio = minutiDaOra(ora)
  const fine = inizio + durataMin
  for (const b of blocchi) {
    if (bloccoCopre(b, operatoreId, inizio, fine)) return false
  }
  for (const a of appuntamenti) {
    if (a.operatoreId !== operatoreId || a.stato === 'disdetto') continue
    const aInizio = minutiDaOra(a.ora)
    const aFine = aInizio + a.durataMin
    if (intervalliSiSovrappongono(inizio, fine, aInizio, aFine)) return false
  }
  return true
}

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
