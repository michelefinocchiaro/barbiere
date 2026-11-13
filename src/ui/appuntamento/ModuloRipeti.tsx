import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Appuntamento, HHMM, Impostazioni, ISODate, RegolaSerie, StatoAppuntamento } from '../../core'
import {
  anteprimaSerie,
  creaSerie,
  datePerSerie,
  eliminaAppuntamento,
  giornoEsteso,
} from '../../core'
import { inputDateVal } from '../utils/dateUi'
import type { ToastAzione } from '../components/Toast'
import './ModuloRipeti.css'

interface BaseRipeti {
  data: ISODate
  ora: HHMM
  durataMin: number
  operatoreId: string
  clienteId: string
  servizioId?: string
  note?: string
  stato: StatoAppuntamento
  promemoria: Appuntamento['promemoria']
}

interface VoceUi {
  data: ISODate
  ora: HHMM
  esclusa: boolean
  avvisi: { messaggio: string }[]
}

interface Props {
  imp: Impostazioni
  base: BaseRipeti
  onIndietro: () => void
  onChiudi: () => void
  onToast?: (t: ToastAzione) => void
}

const SCORCIATOIE: { etichetta: string; regola: RegolaSerie }[] = [
  { etichetta: 'Ogni settimana', regola: { ogni: 1, unita: 'settimane', volte: 8 } },
  { etichetta: 'Ogni 2 sett.', regola: { ogni: 2, unita: 'settimane', volte: 8 } },
  { etichetta: 'Ogni 3 sett.', regola: { ogni: 3, unita: 'settimane', volte: 8 } },
  { etichetta: 'Ogni 4 sett.', regola: { ogni: 4, unita: 'settimane', volte: 8 } },
]

export function ModuloRipeti({ imp: _imp, base, onIndietro, onChiudi, onToast }: Props) {
  const [ogni, setOgni] = useState(2)
  const [unita, setUnita] = useState<RegolaSerie['unita']>('settimane')
  const [modoFine, setModoFine] = useState<'volte' | 'fino'>('volte')
  const [volte, setVolte] = useState(8)
  const [finoA, setFinoA] = useState(base.data)
  const [voci, setVoci] = useState<VoceUi[]>([])
  const [caricamento, setCaricamento] = useState(false)
  const [inCreazione, setInCreazione] = useState(false)

  const regola = useMemo((): RegolaSerie => {
    if (modoFine === 'volte') return { ogni, unita, volte }
    return { ogni, unita, finoA }
  }, [ogni, unita, modoFine, volte, finoA])

  const dateCalcolate = useMemo(() => {
    try {
      return datePerSerie(base.data, regola)
    } catch {
      return []
    }
  }, [base.data, regola])

  const aggiornaAnteprima = useCallback(async () => {
    if (dateCalcolate.length === 0) {
      setVoci([])
      return
    }
    setCaricamento(true)
    try {
      const righe = await anteprimaSerie(
        { ora: base.ora, durataMin: base.durataMin, operatoreId: base.operatoreId },
        dateCalcolate,
      )
      setVoci(
        righe.map((r) => ({
          data: r.data,
          ora: r.ora,
          esclusa: false,
          avvisi: r.avvisi,
        })),
      )
    } finally {
      setCaricamento(false)
    }
  }, [base.durataMin, base.operatoreId, base.ora, dateCalcolate])

  useEffect(() => {
    void aggiornaAnteprima()
  }, [aggiornaAnteprima])

  const applciaScorciatoia = (r: RegolaSerie) => {
    setOgni(r.ogni)
    setUnita(r.unita)
    if (r.volte != null) {
      setModoFine('volte')
      setVolte(r.volte)
    } else if (r.finoA) {
      setModoFine('fino')
      setFinoA(r.finoA)
    }
  }

  const vociAttive = voci.filter((v) => !v.esclusa)
  const nCrea = vociAttive.length

  const crea = async () => {
    if (nCrea === 0 || !base.clienteId) return
    setInCreazione(true)
    try {
      const creati = await creaSerie(
        {
          ora: base.ora,
          durataMin: base.durataMin,
          operatoreId: base.operatoreId,
          clienteId: base.clienteId,
          servizioId: base.servizioId,
          note: base.note,
          stato: base.stato === 'provvisorio' ? 'provvisorio' : 'prenotato',
          promemoria: 'da_inviare',
        },
        vociAttive.map((v) => ({ data: v.data, ora: v.ora })),
      )
      onToast?.({
        messaggio: `Serie creata: ${creati.length} appuntamenti`,
        annulla: () => {
          void (async () => {
            for (const a of creati) await eliminaAppuntamento(a.id)
          })()
        },
      })
      onChiudi()
    } finally {
      setInCreazione(false)
    }
  }

  return (
    <div className="modulo-ripeti">
      <div className="modulo-ripeti-regola">
        <div className="modulo-ripeti-ogni-riga">
          <label className="campo modulo-ripeti-campo-stretto">
            Ogni
            <input
              type="number"
              min={1}
              max={60}
              value={ogni}
              onChange={(e) => setOgni(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="campo">
            Unità
            <select value={unita} onChange={(e) => setUnita(e.target.value as RegolaSerie['unita'])}>
              <option value="giorni">giorni</option>
              <option value="settimane">settimane</option>
              <option value="mesi">mesi</option>
            </select>
          </label>
        </div>
        <fieldset className="modulo-ripeti-fine">
          <legend>Fine serie</legend>
          <div className="modulo-ripeti-fine-righe">
            <label className="modulo-ripeti-fine-opzione">
              <input
                type="radio"
                name="fine-serie"
                checked={modoFine === 'volte'}
                onChange={() => setModoFine('volte')}
              />
              <span>Per</span>
              <input
                type="number"
                min={1}
                max={60}
                disabled={modoFine !== 'volte'}
                value={volte}
                onChange={(e) => setVolte(Math.max(1, Number(e.target.value) || 1))}
              />
              <span>volte</span>
            </label>
            <label className="modulo-ripeti-fine-opzione">
              <input
                type="radio"
                name="fine-serie"
                checked={modoFine === 'fino'}
                onChange={() => setModoFine('fino')}
              />
              <span>Fino al</span>
              <input
                type="date"
                disabled={modoFine !== 'fino'}
                value={inputDateVal(finoA)}
                onChange={(e) => setFinoA(e.target.value as ISODate)}
              />
            </label>
          </div>
        </fieldset>
        <div className="modulo-ripeti-scorciatoie" role="group" aria-label="Scorciatoie">
          {SCORCIATOIE.map((s) => (
            <button
              key={s.etichetta}
              type="button"
              className="modulo-ripeti-pill"
              onClick={() => applciaScorciatoia(s.regola)}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
      </div>

      <h3 className="modulo-ripeti-anteprima-titolo">Anteprima</h3>
      {caricamento ? <p className="modulo-ripeti-attesa">Calcolo avvisi…</p> : null}
      <ul className="modulo-ripeti-lista">
        {voci.map((v, i) => (
          <li key={`${v.data}-${i}`} className={v.esclusa ? 'esclusa' : ''}>
            <div className="modulo-ripeti-riga">
              <label className="modulo-ripeti-escludi">
                <input
                  type="checkbox"
                  checked={!v.esclusa}
                  onChange={(e) => {
                    const attiva = e.target.checked
                    setVoci((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, esclusa: !attiva } : row)),
                    )
                  }}
                />
                <span className="modulo-ripeti-giorno">{giornoEsteso(v.data)}</span>
              </label>
              <label className="modulo-ripeti-ora">
                <span className="sr-only">Ora</span>
                <input
                  type="time"
                  value={v.ora}
                  disabled={v.esclusa}
                  onChange={(e) => {
                    const nuova = e.target.value as HHMM
                    setVoci((prev) => prev.map((row, j) => (j === i ? { ...row, ora: nuova } : row)))
                  }}
                />
              </label>
              <label className="modulo-ripeti-data">
                <span className="sr-only">Data</span>
                <input
                  type="date"
                  value={inputDateVal(v.data)}
                  disabled={v.esclusa}
                  onChange={(e) => {
                    const nuova = e.target.value as ISODate
                    setVoci((prev) => prev.map((row, j) => (j === i ? { ...row, data: nuova } : row)))
                  }}
                />
              </label>
            </div>
            {v.avvisi.length > 0 && !v.esclusa ? (
              <p className="modulo-ripeti-avviso-riga">
                {v.avvisi.map((a) => a.messaggio).join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="modulo-ripeti-piede">
        <button type="button" className="btn-secondario" onClick={onIndietro}>
          Indietro
        </button>
        <button
          type="button"
          className="btn-primario"
          disabled={nCrea === 0 || inCreazione}
          onClick={() => void crea()}
        >
          Crea {nCrea} appuntament{nCrea === 1 ? 'o' : 'i'}
        </button>
      </div>
    </div>
  )
}
