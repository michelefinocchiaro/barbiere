import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Appuntamento, Blocco, Cliente, HHMM, ISODate, Impostazioni } from '../../core'
import {
  appuntamentiDelGiorno,
  blocchiDelGiorno,
  formattaOra,
  fraseDelMomento,
  leggiImpostazioni,
  momentoDellaGiornata,
  oggi,
  prossimoGiornoApertura,
  quando,
  tuttiIClienti,
} from '../../core'
import {
  aggiungiGiorni,
  formattaDataBreve,
  formattaDataLunga,
  inputDateVal,
  minutiDaOra,
  oraAdesso,
  slotOrari,
} from '../utils/dateUi'
import { PannelloAppuntamento } from '../appuntamento/PannelloAppuntamento'
import type { ToastAzione } from '../components/Toast'
import { Caricamento } from '../components/Caricamento'
import { IllustrazioneForbici } from '../components/IllustrazioneForbici'
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
  dataIniziale?: ISODate | null
}

function useMinuto(): HHMM {
  const [ora, setOra] = useState(oraAdesso)
  useEffect(() => {
    const tick = () => setOra(oraAdesso())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
  return ora
}

function conteggioServizi(appuntamenti: Appuntamento[], imp: Impostazioni): string {
  const m = new Map<string, number>()
  for (const a of appuntamenti) {
    if (a.stato === 'disdetto') continue
    const nome = a.servizioId
      ? (imp.servizi.find((s) => s.id === a.servizioId)?.nome ?? 'Altro')
      : 'Senza servizio'
    m.set(nome, (m.get(nome) ?? 0) + 1)
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, n]) => `${n} ${nome}`)
    .join(' · ')
}

export function Agenda({ onToast, dataIniziale }: AgendaProps) {
  const [data, setData] = useState<ISODate>(() => dataIniziale ?? oggi())
  const [nascondiDisdetti, setNascondiDisdetti] = useState(true)
  const [pannello, setPannello] = useState<SlotTap | ModificaTap | null>(null)
  const dataInputRef = useRef<HTMLInputElement>(null)
  const grigliaRef = useRef<HTMLDivElement>(null)
  const oraCorrente = useMinuto()

  useEffect(() => {
    if (dataIniziale) setData(dataIniziale)
  }, [dataIniziale])

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

  const oggiIso = oggi()

  const nonDisdetti = useMemo(
    () => (appuntamenti ?? []).filter((a) => a.stato !== 'disdetto'),
    [appuntamenti],
  )

  const visibili = useMemo(() => {
    if (!appuntamenti) return []
    return nascondiDisdetti ? appuntamenti.filter((a) => a.stato !== 'disdetto') : appuntamenti
  }, [appuntamenti, nascondiDisdetti])

  const oraMomento: HHMM = data === oggiIso ? oraCorrente : '08:00'
  const teste = nonDisdetti.length
  const restanti = useMemo(() => {
    if (data !== oggiIso) return teste
    const now = minutiDaOra(oraCorrente)
    return nonDisdetti.filter((a) => minutiDaOra(a.ora) > now).length
  }, [data, oggiIso, oraCorrente, nonDisdetti, teste])

  const momento = useMemo(() => {
    if (!imp) return 'mattina' as const
    return momentoDellaGiornata(data, oraMomento, imp, blocchi ?? [], teste, restanti)
  }, [imp, data, oraMomento, blocchi, teste, restanti])

  const chiuso = momento === 'chiuso'
  const giornataVuota = momento === 'giornata_vuota'

  const contestoFrase = useMemo(() => {
    if (!imp) return { data, teste, restanti }
    const pross =
      data === oggiIso
        ? quando(prossimoGiornoApertura(oggiIso, imp, blocchi ?? []), data)
        : quando(prossimoGiornoApertura(data, imp, blocchi ?? []), data)
    return { data, teste, restanti, prossimo: pross }
  }, [imp, data, blocchi, teste, restanti, oggiIso])

  const battuta = useMemo(() => {
    if (!imp) return ''
    return fraseDelMomento(momento, contestoFrase, imp)
  }, [imp, momento, contestoFrase])

  const contoServizi =
    data === oggiIso && momento === 'fine_giornata' && imp ? conteggioServizi(nonDisdetti, imp) : ''

  const slots = useMemo(() => {
    if (!imp) return []
    return slotOrari(imp.apre, imp.chiude, imp.passoGrigliaMin)
  }, [imp])

  const slotCount = slots.length
  const apreMin = imp ? minutiDaOra(imp.apre) : 0
  const passo = imp?.passoGrigliaMin ?? 15

  const lineaOra = useMemo(() => {
    if (!imp || data !== oggiIso || chiuso) return null
    const now = minutiDaOra(oraCorrente)
    const chiude = minutiDaOra(imp.chiude)
    if (now < apreMin || now >= chiude) return null
    const riga = (now - apreMin) / passo
    return {
      top: `calc(var(--agenda-testata-h) + ${riga} * var(--tc-slot-h))`,
      label: formattaOra(oraCorrente),
    }
  }, [imp, data, oggiIso, chiuso, oraCorrente, apreMin, passo])

  const apriNuovo = useCallback((tap: SlotTap) => setPannello(tap), [])
  const apriModifica = useCallback((a: Appuntamento) => setPannello({ appuntamento: a }), [])
  const chiudiPannello = useCallback(() => setPannello(null), [])

  const vaiOggi = () => setData(oggiIso)
  const giornoPrima = () => setData((d) => aggiungiGiorni(d, -1))
  const giornoDopo = () => setData((d) => aggiungiGiorni(d, 1))

  const apriPickerData = () => {
    const el = dataInputRef.current
    if (el?.showPicker) el.showPicker()
    else el?.click()
  }

  const nuovoPrimoSlot = () => {
    const op = operatoriAttivi[0]
    const ora = slots[0]
    if (op && ora) apriNuovo({ data, ora, operatoreId: op.id })
  }

  const aggiungiComunque = () => {
    const op = operatoriAttivi[0]
    const ora = imp?.apre ?? '08:00'
    if (op) apriNuovo({ data, ora, operatoreId: op.id })
  }

  useEffect(() => {
    if (data !== oggiIso || chiuso || !imp || !grigliaRef.current) return
    const wrap = grigliaRef.current
    const now = minutiDaOra(oraCorrente)
    let targetMin = now
    if (visibili.length) {
      const inizi = visibili.map((a) => minutiDaOra(a.ora))
      const dopo = inizi.filter((m) => m >= now)
      targetMin = dopo.length ? Math.min(...dopo) : Math.max(...inizi)
      if (targetMin < now && dopo.length === 0) targetMin = now
    }
    const riga = Math.max(0, (targetMin - apreMin) / passo)
    const testata = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--agenda-testata-h')) || 40
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tc-slot-h')) || 48
    const top = testata + riga * slotH
    wrap.scrollTop = Math.max(0, top - wrap.clientHeight / 3)
  }, [data, oggiIso, chiuso, imp, visibili, apreMin, passo, oraCorrente])

  if (!imp) {
    return <Caricamento className="agenda-caricamento" />
  }

  const prossimoAperto = prossimoGiornoApertura(data, imp, blocchi ?? [])
  const fraseChiuso = fraseDelMomento('chiuso', contestoFrase, imp)
  const fraseVuota = fraseDelMomento('giornata_vuota', contestoFrase, imp)

  const intestazione = (
    <header className="agenda-intestazione">
      <div className="agenda-riga-principale">
        <button type="button" className="nav-freccia" onClick={giornoPrima} aria-label="Giorno precedente">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1 className="agenda-titolo font-titolo" onClick={apriPickerData}>
          {formattaDataLunga(data)}
        </h1>
        <button type="button" className="nav-freccia" onClick={giornoDopo} aria-label="Giorno successivo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="btn-oggi" onClick={vaiOggi}>
          Oggi
        </button>
      </div>
      <label className="agenda-data-picker">
        <span className="sr-only">Scegli data</span>
        <input
          ref={dataInputRef}
          type="date"
          value={inputDateVal(data)}
          onChange={(e) => setData(e.target.value as ISODate)}
        />
      </label>
      <div className="agenda-riga-battuta">
        <p className="agenda-battuta font-titolo">{chiuso || giornataVuota ? '' : battuta}</p>
        <label className="agenda-toggle-compatto">
          <input
            type="checkbox"
            checked={nascondiDisdetti}
            onChange={(e) => setNascondiDisdetti(e.target.checked)}
          />
          <span>Disdetti</span>
        </label>
      </div>
      {contoServizi ? <p className="agenda-conto-servizi font-tabular">{contoServizi}</p> : null}
    </header>
  )

  if (chiuso) {
    return (
      <div className="agenda agenda-vista-chiuso">
        {intestazione}
        <div className="agenda-vista-centro">
          <IllustrazioneForbici />
          <p className="agenda-stato-label">Chiuso</p>
          <p className="agenda-frase-momento font-titolo">{fraseChiuso}</p>
          <button type="button" className="btn-primario" onClick={() => setData(prossimoAperto)}>
            Vai a {formattaDataBreve(prossimoAperto)}
          </button>
          <button type="button" className="agenda-link-discreto" onClick={aggiungiComunque}>
            Aggiungi comunque un appuntamento
          </button>
        </div>
        {pannello ? (
          <>
            <div className="pannello-backdrop" role="presentation" onClick={chiudiPannello} />
            <PannelloAppuntamento imp={imp} pannello={pannello} onChiudi={chiudiPannello} onToast={onToast} />
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="agenda">
      {intestazione}

      <div className="agenda-griglia-wrap" ref={grigliaRef}>
        {lineaOra ? (
          <div className="agenda-linea-ora" style={{ top: lineaOra.top }} aria-hidden>
            <span className="agenda-linea-ora-etichetta font-tabular">{lineaOra.label}</span>
          </div>
        ) : null}

        <div className="agenda-ore" style={{ '--slot-count': slotCount } as React.CSSProperties}>
          {slots.map((ora) => (
            <div key={ora} className="agenda-ora-label font-tabular">
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

        {giornataVuota ? (
          <div className="agenda-vuota-overlay">
            <IllustrazioneForbici />
            <p className="agenda-frase-momento font-titolo">{fraseVuota}</p>
            <button type="button" className="btn-primario agenda-btn-nuovo" onClick={nuovoPrimoSlot}>
              + Nuovo appuntamento
            </button>
          </div>
        ) : null}
      </div>

      {pannello ? (
        <>
          <div className="pannello-backdrop" role="presentation" onClick={chiudiPannello} />
          <PannelloAppuntamento imp={imp} pannello={pannello} onChiudi={chiudiPannello} onToast={onToast} />
        </>
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
          const inAttesa =
            a.promemoria === 'inviato' && a.stato !== 'confermato' && a.stato !== 'disdetto'
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
              className={`app-blocco stato-${stato}${inAttesa ? ' in-attesa' : ''}${breve ? ' app-blocco-breve' : ''}`}
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
                  <span className="app-blocco-ora font-tabular">{formattaOra(a.ora)}</span>
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
