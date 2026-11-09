import { useCallback, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Appuntamento, Blocco, Cliente, HHMM, ISODate } from '../../core'
import {
  appuntamentiDelGiorno,
  blocchiDelGiorno,
  formattaOra,
  leggiImpostazioni,
  oggi,
  tuttiIClienti,
} from '../../core'
import {
  aggiungiGiorni,
  formattaDataLunga,
  giornoSettimana,
  inputDateVal,
  minutiDaOra,
  slotOrari,
} from '../utils/dateUi'
import { PannelloAppuntamento } from '../appuntamento/PannelloAppuntamento'
import type { ToastAzione } from '../components/Toast'
import './Agenda.css'

interface SlotTap {
  data: ISODate
  ora: HHMM
  operatoreId: string
}

interface ModificaTap {
  appuntamento: Appuntamento
}

interface AgendaProps {
  onToast?: (t: ToastAzione) => void
}

export function Agenda({ onToast }: AgendaProps) {
  const [data, setData] = useState<ISODate>(() => oggi())
  const [nascondiDisdetti, setNascondiDisdetti] = useState(true)
  const [pannello, setPannello] = useState<SlotTap | ModificaTap | null>(null)

  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const appuntamenti = useLiveQuery(() => appuntamentiDelGiorno(data), [data])
  const blocchi = useLiveQuery(() => blocchiDelGiorno(data), [data])

  const operatoriAttivi = useMemo(
    () => (imp ? [...imp.operatori].filter((o) => o.attivo).sort((a, b) => a.ordine - b.ordine) : []),
    [imp],
  )

  const clienti = useLiveQuery(() => tuttiIClienti(), [])
  const mappaClienti = useMemo(() => {
    const m = new Map<string, Cliente>()
    for (const c of clienti ?? []) m.set(c.id, c)
    return m
  }, [clienti])

  const chiuso = useMemo(() => {
    if (!imp) return false
    return !imp.giorniApertura.includes(giornoSettimana(data))
  }, [imp, data])

  const slots = useMemo(() => {
    if (!imp) return []
    return slotOrari(imp.apre, imp.chiude, imp.passoGrigliaMin)
  }, [imp])

  const slotCount = slots.length
  const apreMin = imp ? minutiDaOra(imp.apre) : 0
  const passo = imp?.passoGrigliaMin ?? 15

  const visibili = useMemo(() => {
    if (!appuntamenti) return []
    return nascondiDisdetti ? appuntamenti.filter((a) => a.stato !== 'disdetto') : appuntamenti
  }, [appuntamenti, nascondiDisdetti])

  const apriNuovo = useCallback((tap: SlotTap) => setPannello(tap), [])
  const apriModifica = useCallback((a: Appuntamento) => setPannello({ appuntamento: a }), [])
  const chiudiPannello = useCallback(() => setPannello(null), [])

  const vaiOggi = () => setData(oggi())
  const giornoPrima = () => setData((d) => aggiungiGiorni(d, -1))
  const giornoDopo = () => setData((d) => aggiungiGiorni(d, 1))

  if (!imp) {
    return <div className="agenda-caricamento">Caricamento…</div>
  }

  return (
    <div className={`agenda${chiuso ? ' agenda-chiuso' : ''}`}>
      <header className="agenda-intestazione">
        <div className="agenda-nav-data">
          <button type="button" className="nav-freccia" onClick={giornoPrima} aria-label="Giorno precedente">
            ◀
          </button>
          <h1 className="agenda-titolo">{formattaDataLunga(data)}</h1>
          <button type="button" className="nav-freccia" onClick={giornoDopo} aria-label="Giorno successivo">
            ▶
          </button>
        </div>
        <button type="button" className="btn-oggi" onClick={vaiOggi}>
          Oggi
        </button>
        <label className="agenda-data-picker">
          <span className="sr-only">Scegli data</span>
          <input
            type="date"
            value={inputDateVal(data)}
            onChange={(e) => setData(e.target.value as ISODate)}
          />
        </label>
        <label className="agenda-toggle">
          <input
            type="checkbox"
            checked={nascondiDisdetti}
            onChange={(e) => setNascondiDisdetti(e.target.checked)}
          />
          Nascondi disdetti
        </label>
      </header>

      {chiuso ? <p className="agenda-chiuso-msg">Chiuso</p> : null}

      <div className="agenda-griglia-wrap">
        <div className="agenda-ore" style={{ '--slot-count': slotCount } as React.CSSProperties}>
          {slots.map((ora) => (
            <div key={ora} className="agenda-ora-label">
              {formattaOra(ora)}
            </div>
          ))}
        </div>
        <div className="agenda-colonne">
          {operatoriAttivi.map((op) => (
            <ColonnaOperatore
              key={op.id}
              nome={op.nome}
              operatoreId={op.id}
              data={data}
              slots={slots}
              passo={passo}
              slotCount={slotCount}
              apreMin={apreMin}
              appuntamenti={visibili.filter((a) => a.operatoreId === op.id)}
              blocchi={(blocchi ?? []).filter((b) => b.operatoreId === null || b.operatoreId === op.id)}
              servizi={imp.servizi}
              mappaClienti={mappaClienti}
              onSlotTap={apriNuovo}
              onAppuntamentoTap={apriModifica}
            />
          ))}
        </div>
      </div>

      {pannello ? (
        <PannelloAppuntamento
          imp={imp}
          pannello={pannello}
          onChiudi={chiudiPannello}
          onToast={onToast}
        />
      ) : null}
    </div>
  )
}

interface ColonnaProps {
  nome: string
  operatoreId: string
  data: ISODate
  slots: HHMM[]
  passo: number
  slotCount: number
  apreMin: number
  appuntamenti: Appuntamento[]
  blocchi: Blocco[]
  servizi: { id: string; nome: string }[]
  mappaClienti: Map<string, Cliente>
  onSlotTap: (t: SlotTap) => void
  onAppuntamentoTap: (a: Appuntamento) => void
}

function ColonnaOperatore({
  nome,
  operatoreId,
  data,
  slots,
  passo,
  slotCount,
  apreMin,
  appuntamenti,
  blocchi,
  servizi,
  mappaClienti,
  onSlotTap,
  onAppuntamentoTap,
}: ColonnaProps) {
  const nomeServizio = (id?: string) => servizi.find((s) => s.id === id)?.nome ?? ''

  return (
    <div className="agenda-colonna">
      <h2 className="agenda-operatore-nome">{nome}</h2>
      <div className="agenda-colonna-body" style={{ '--slot-count': slots.length } as React.CSSProperties}>
        {slots.map((ora) => (
          <button
            key={ora}
            type="button"
            className="agenda-slot"
            disabled={false}
            aria-label={`Nuovo appuntamento ${ora}`}
            onClick={() => onSlotTap({ data, ora, operatoreId })}
          />
        ))}

        {blocchi.map((b) => (
          <BloccoOverlay key={b.id} blocco={b} apreMin={apreMin} passo={passo} slotCount={slotCount} />
        ))}

        {appuntamenti.map((a) => {
          const pctRiga = 100 / slotCount
          const top = ((minutiDaOra(a.ora) - apreMin) / passo) * pctRiga
          const height = (a.durataMin / passo) * pctRiga
          const stato = a.stato
          const breve = a.durataMin <= 20
          const clienteNome = mappaClienti.get(a.clienteId)?.nome ?? '…'
          const servizioNome = nomeServizio(a.servizioId)
          const rigaBreve = servizioNome
            ? `${formattaOra(a.ora)} ${clienteNome} · ${servizioNome}`
            : `${formattaOra(a.ora)} ${clienteNome}`
          return (
            <button
              key={a.id}
              type="button"
              className={`app-blocco stato-${stato}${breve ? ' app-blocco-breve' : ''}`}
              style={{
                top: `${top}%`,
                height: `${height}%`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onAppuntamentoTap(a)
              }}
            >
              {breve ? (
                <span className="app-blocco-riga">{rigaBreve}</span>
              ) : (
                <>
                  <span className="app-blocco-ora">{formattaOra(a.ora)}</span>
                  <span className="app-blocco-cliente">{clienteNome}</span>
                  {servizioNome ? <span className="app-blocco-servizio">{servizioNome}</span> : null}
                </>
              )}
              {a.stato === 'confermato' ? (
                <span className="app-blocco-spunta" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BloccoOverlay({
  blocco,
  apreMin,
  passo,
  slotCount,
}: {
  blocco: Blocco
  apreMin: number
  passo: number
  slotCount: number
}) {
  const dalle = blocco.dalle ?? '00:00'
  const alle = blocco.alle ?? '23:59'
  const pctRiga = 100 / slotCount
  const top = ((minutiDaOra(dalle) - apreMin) / passo) * pctRiga
  const height = ((minutiDaOra(alle) - minutiDaOra(dalle)) / passo) * pctRiga

  return (
    <div
      className="agenda-blocco-pausa"
      style={{ top: `${top}%`, height: `${Math.max(height, pctRiga)}%` }}
      title={blocco.motivo}
    >
      {blocco.motivo ?? 'Blocco'}
    </div>
  )
}
