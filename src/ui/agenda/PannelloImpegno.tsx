import { useState } from 'react'
import type { Blocco, HHMM, Impostazioni, ISODate } from '../../core'
import { eliminaBlocco, salvaBlocco } from '../../core'
import type { ToastAzione } from '../components/Toast'
import { inputDateVal } from '../utils/dateUi'
import '../appuntamento/PannelloAppuntamento.css'
import './PannelloImpegno.css'

interface Props {
  imp: Impostazioni
  data: ISODate
  blocco?: Blocco
  onChiudi: () => void
  onToast?: (t: ToastAzione) => void
}

export function PannelloImpegno({ imp, data: dataIniziale, blocco, onChiudi, onToast }: Props) {
  const modifica = Boolean(blocco)
  const [titolo, setTitolo] = useState(blocco?.motivo ?? '')
  const [data, setData] = useState<ISODate>(blocco?.data ?? dataIniziale)
  const [dalle, setDalle] = useState(blocco?.dalle ?? '')
  const [alle, setAlle] = useState(blocco?.alle ?? '')
  const [operatoreId, setOperatoreId] = useState<string | null>(blocco?.operatoreId ?? null)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const operatori = [...imp.operatori].filter((o) => o.attivo).sort((a, b) => a.ordine - b.ordine)

  const salva = async () => {
    const motivo = titolo.trim()
    if (!motivo) return
    const payload: Omit<Blocco, 'id'> & { id?: string } = {
      ...(blocco ?? { id: undefined }),
      operatoreId,
      data,
      motivo,
      tipo: 'impegno',
      dalle: dalle || undefined,
      alle: alle || undefined,
    }
    await salvaBlocco(payload)
    onChiudi()
    onToast?.({ messaggio: modifica ? 'Impegno aggiornato' : 'Impegno creato' })
  }

  const elimina = async () => {
    if (!blocco) return
    const id = blocco.id
    const snap = { ...blocco }
    await eliminaBlocco(id)
    setConfermaElimina(false)
    onChiudi()
    onToast?.({
      messaggio: 'Impegno eliminato',
      annulla: () => {
        void salvaBlocco(snap).then(() => onToast?.({ messaggio: 'Eliminazione annullata' }))
      },
    })
  }

  return (
    <div className="pannello-impegno" role="dialog" aria-labelledby="impegno-titolo-dlg">
      <header className="pannello-intestazione">
        <h2 id="impegno-titolo-dlg">{modifica ? 'Modifica impegno' : 'Nuovo impegno'}</h2>
        <button type="button" className="pannello-chiudi" onClick={onChiudi} aria-label="Chiudi">
          ×
        </button>
      </header>
      <div className="pannello-corpo">
        <label>
          Titolo
          <input
            type="text"
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Giorno
          <input type="date" value={inputDateVal(data)} onChange={(e) => setData(e.target.value as ISODate)} />
        </label>
        <div className="pannello-impegno-orari">
          <label>
            Dalle
            <input type="time" value={dalle} onChange={(e) => setDalle(e.target.value as HHMM)} />
          </label>
          <label>
            Alle
            <input type="time" value={alle} onChange={(e) => setAlle(e.target.value as HHMM)} />
          </label>
        </div>
        <p className="pannello-impegno-nota">Senza orario = tutto il giorno</p>
        <label>
          Operatore
          <select
            value={operatoreId ?? ''}
            onChange={(e) => setOperatoreId(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Tutto il negozio</option>
            {operatori.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <footer className="pannello-piede">
        {modifica ? (
          confermaElimina ? (
            <>
              <button type="button" className="btn-pericolo" onClick={() => void elimina()}>
                Conferma elimina
              </button>
              <button type="button" onClick={() => setConfermaElimina(false)}>
                Annulla
              </button>
            </>
          ) : (
            <button type="button" className="btn-pericolo" onClick={() => setConfermaElimina(true)}>
              Elimina
            </button>
          )
        ) : null}
        <button type="button" className="btn-primario" disabled={!titolo.trim()} onClick={() => void salva()}>
          Salva
        </button>
        <button type="button" onClick={onChiudi}>
          Chiudi
        </button>
      </footer>
    </div>
  )
}
