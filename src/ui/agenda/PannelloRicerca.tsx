import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Appuntamento, RisultatoRicerca } from '../../core'
import { cercaAppuntamenti, formattaOra } from '../../core'
import { formattaDataLunga } from '../utils/dateUi'
import '../appuntamento/PannelloAppuntamento.css'
import './PannelloRicerca.css'

function etichettaStato(stato: Appuntamento['stato']): string | null {
  if (stato === 'disdetto') return 'Disdetto'
  if (stato === 'provvisorio') return 'Provvisorio'
  if (stato === 'confermato') return 'Confermato'
  return null
}

interface Props {
  onChiudi: () => void
  onScegli: (appuntamento: Appuntamento) => void
}

export function PannelloRicerca({ onChiudi, onScegli }: Props) {
  const [query, setQuery] = useState('')
  const campoRef = useRef<HTMLInputElement>(null)

  const risultati = useLiveQuery(
    () => (query.trim().length >= 2 ? cercaAppuntamenti(query) : Promise.resolve([])),
    [query],
  )

  const { prossimi, passati } = useMemo(() => {
    const lista = risultati ?? []
    return {
      prossimi: lista.filter((r) => r.futuro),
      passati: lista.filter((r) => !r.futuro),
    }
  }, [risultati])

  useEffect(() => {
    campoRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onChiudi])

  const q = query.trim()
  const nessuno = q.length >= 2 && risultati && risultati.length === 0

  return (
    <aside className="pannello-app pannello-ricerca" role="dialog" aria-labelledby="ricerca-titolo">
      <header className="pannello-intestazione">
        <h2 id="ricerca-titolo">Cerca appuntamento</h2>
        <button type="button" className="pannello-chiudi" onClick={onChiudi} aria-label="Chiudi">
          ✕
        </button>
      </header>
      <div className="pannello-corpo">
        <label className="campo">
          Cerca
          <input
            ref={campoRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome o ultime cifre del telefono"
            autoComplete="off"
            aria-label="Nome o ultime cifre del telefono"
          />
        </label>

        {nessuno ? <p className="ricerca-vuoto">Nessun appuntamento per &quot;{q}&quot;</p> : null}

        {prossimi.length > 0 ? (
          <RisultatiGruppo titolo="Prossimi" righe={prossimi} onScegli={onScegli} />
        ) : null}
        {passati.length > 0 ? (
          <RisultatiGruppo titolo="Passati" righe={passati} onScegli={onScegli} />
        ) : null}
      </div>
    </aside>
  )
}

function RisultatiGruppo({
  titolo,
  righe,
  onScegli,
}: {
  titolo: string
  righe: RisultatoRicerca[]
  onScegli: (a: Appuntamento) => void
}) {
  return (
    <section className="ricerca-gruppo">
      <h3 className="ricerca-gruppo-titolo">{titolo}</h3>
      <ul className="ricerca-lista">
        {righe.map((r) => {
          const statoEt = etichettaStato(r.appuntamento.stato)
          const servizio = r.servizio?.nome ?? ''
          const operatore = r.operatore?.nome ?? ''
          const dettaglio = [servizio, operatore].filter(Boolean).join(' · ')
          return (
            <li key={r.appuntamento.id}>
              <button
                type="button"
                className={`ricerca-riga stato-${r.appuntamento.stato}`}
                onClick={() => onScegli(r.appuntamento)}
              >
                <span className="ricerca-riga-quando font-titolo">
                  {formattaDataLunga(r.appuntamento.data)} · {formattaOra(r.appuntamento.ora)}
                </span>
                <span className="ricerca-riga-cliente">{r.cliente.nome}</span>
                {dettaglio ? <span className="ricerca-riga-dettaglio">{dettaglio}</span> : null}
                {statoEt ? <span className="ricerca-riga-stato">{statoEt}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
