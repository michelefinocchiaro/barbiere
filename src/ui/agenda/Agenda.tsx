import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Appuntamento, Avviso, Blocco, Cliente, HHMM, ISODate, Impostazioni } from '../../core'
import {
  appuntamentiDelGiorno,
  appuntamentiTra,
  blocchiDelGiorno,
  blocchiTra,
  compleannoNelGiorno,
  formattaOra,
  fraseDelMomento,
  giornoAperto,
  leggiImpostazioni,
  momentoDellaGiornata,
  oggi,
  prossimoGiornoApertura,
  quando,
  scambiaAppuntamenti,
  settimanaDi,
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
import { PannelloRicerca } from './PannelloRicerca'
import type { ToastAzione } from '../components/Toast'
import { Caricamento } from '../components/Caricamento'
import { IllustrazioneForbici } from '../components/IllustrazioneForbici'
import { AgendaSettimana } from './AgendaSettimana'
import { PannelloImpegno } from './PannelloImpegno'
import { primoSlotLibero } from './primoSlotLibero'
import { coloreOperatore } from '../utils/coloreOperatore'
import { leggiVistaAgenda, salvaVistaAgenda, type VistaAgenda } from './vistaAgenda'
import './Agenda.css'
import './AgendaSettimana.css'

interface SlotTap {
  data: ISODate
  ora: HHMM
  operatoreId: string
}

interface ModificaTap {
  appuntamento: Appuntamento
}

interface ImpegnoTap {
  data: ISODate
  blocco?: Blocco
}

type PannelloAgenda = SlotTap | ModificaTap

interface AgendaProps {
  onToast?: (t: ToastAzione) => void
  dataIniziale?: ISODate | null
  onApriSchedaCliente?: (clienteId: string) => void
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

export function Agenda({ onToast, dataIniziale, onApriSchedaCliente }: AgendaProps) {
  const [data, setData] = useState<ISODate>(() => dataIniziale ?? oggi())
  const [nascondiDisdetti, setNascondiDisdetti] = useState(true)
  const [vista, setVista] = useState<VistaAgenda>(() => leggiVistaAgenda())
  const [settimanaAncora, setSettimanaAncora] = useState<ISODate>(() => dataIniziale ?? oggi())
  const [pannello, setPannello] = useState<PannelloAgenda | null>(null)
  const [pannelloImpegno, setPannelloImpegno] = useState<ImpegnoTap | null>(null)
  const [ricercaAperta, setRicercaAperta] = useState(false)
  const [scrollAppId, setScrollAppId] = useState<string | null>(null)
  const [scambioDa, setScambioDa] = useState<Appuntamento | null>(null)
  const [confermaScambio, setConfermaScambio] = useState<{ da: Appuntamento; con: Appuntamento } | null>(
    null,
  )
  const [avvisiScambio, setAvvisiScambio] = useState<Avviso[]>([])
  const dataInputRef = useRef<HTMLInputElement>(null)
  const grigliaRef = useRef<HTMLDivElement>(null)
  const oraCorrente = useMinuto()

  useEffect(() => {
    if (dataIniziale) setData(dataIniziale)
  }, [dataIniziale])

  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const appuntamenti = useLiveQuery(() => appuntamentiDelGiorno(data), [data])
  const blocchi = useLiveQuery(() => blocchiDelGiorno(data), [data])
  const settimanaGiorni = useMemo(() => settimanaDi(settimanaAncora), [settimanaAncora])
  const settimanaDa = settimanaGiorni[0]!
  const settimanaA = settimanaGiorni[6]!
  const appuntamentiSettimana = useLiveQuery(
    () => (vista === 'settimana' ? appuntamentiTra(settimanaDa, settimanaA) : Promise.resolve([])),
    [vista, settimanaDa, settimanaA],
  )
  const blocchiSettimana = useLiveQuery(
    () => (vista === 'settimana' ? blocchiTra(settimanaDa, settimanaA) : Promise.resolve([])),
    [vista, settimanaDa, settimanaA],
  )

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
  const negozioAperto = imp ? giornoAperto(data, imp, blocchi ?? []) : true
  const giornataVuota = momento === 'giornata_vuota' && negozioAperto
  const blocchiAssenza = useMemo(
    () => (blocchi ?? []).filter((b) => b.tipo !== 'impegno'),
    [blocchi],
  )
  const impegniGiorno = useMemo(
    () => (blocchi ?? []).filter((b) => b.tipo === 'impegno'),
    [blocchi],
  )

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

  const barraTurno = useMemo(() => {
    if (!imp || data !== oggiIso || chiuso) return null
    const now = minutiDaOra(oraCorrente)
    const chiudeMin = minutiDaOra(imp.chiude)
    const durata = chiudeMin - apreMin
    if (durata <= 0) return null
    if (now < apreMin) {
      return {
        fill: 0,
        testo: `si apre alle ${formattaOra(imp.apre)}`,
        ariaNow: 0,
      }
    }
    if (now >= chiudeMin) {
      return { fill: 1, testo: 'turno finito', ariaNow: 100 }
    }
    const fill = (now - apreMin) / durata
    return {
      fill,
      testo: `${formattaOra(oraCorrente)} · fine turno alle ${formattaOra(imp.chiude)}`,
      ariaNow: Math.round(fill * 100),
    }
  }, [imp, data, oggiIso, chiuso, oraCorrente, apreMin])

  const apriNuovo = useCallback((tap: SlotTap) => {
    setRicercaAperta(false)
    setPannello(tap)
  }, [])
  const apriModifica = useCallback(
    (a: Appuntamento) => {
      if (scambioDa) {
        if (a.id === scambioDa.id) return
        setConfermaScambio({ da: scambioDa, con: a })
        return
      }
      setPannello({ appuntamento: a })
    },
    [scambioDa],
  )
  const chiudiPannello = useCallback(() => setPannello(null), [])

  const vaiAAppuntamentoSerie = useCallback((dataSerie: ISODate, a: Appuntamento) => {
    setData(dataSerie)
    setSettimanaAncora(dataSerie)
    setVista('giorno')
    salvaVistaAgenda('giorno')
    setPannello({ appuntamento: a })
  }, [])

  const iniziaScambio = useCallback((a: Appuntamento) => {
    setPannello(null)
    setScambioDa(a)
    setData(a.data)
  }, [])

  const annullaScambio = useCallback(() => {
    setScambioDa(null)
    setConfermaScambio(null)
  }, [])

  const confermaScambioEsegui = useCallback(async () => {
    if (!confermaScambio) return
    const { da, con } = confermaScambio
    const { avvisi } = await scambiaAppuntamenti(da.id, con.id)
    setConfermaScambio(null)
    setScambioDa(null)
    setAvvisiScambio(avvisi)
    onToast?.({
      messaggio: 'Scambiati',
      annulla: () => {
        void scambiaAppuntamenti(da.id, con.id).then(() => setAvvisiScambio([]))
      },
    })
    setData(da.data)
    setScrollAppId(da.id)
  }, [confermaScambio, onToast])

  const apriNuovoAutomatico = useCallback(() => {
    if (!imp) return
    const { ora, operatoreId } = primoSlotLibero(
      data,
      imp,
      appuntamenti ?? [],
      blocchi ?? [],
      operatoriAttivi,
      oraCorrente,
    )
    if (operatoreId) apriNuovo({ data, ora, operatoreId })
  }, [imp, data, appuntamenti, blocchi, operatoriAttivi, oraCorrente, apriNuovo])

  const apriDaRicerca = useCallback(
    (a: Appuntamento) => {
      setRicercaAperta(false)
      setData(a.data)
      setScrollAppId(a.id)
      setPannello({ appuntamento: a })
    },
    [],
  )

  const cambiaVista = (v: VistaAgenda) => {
    setVista(v)
    salvaVistaAgenda(v)
    if (v === 'settimana') setSettimanaAncora(data)
  }

  const vaiOggi = () => {
    setData(oggiIso)
    setSettimanaAncora(oggiIso)
  }
  const giornoPrima = () => {
    if (vista === 'settimana') setSettimanaAncora((d) => aggiungiGiorni(d, -7))
    else setData((d) => aggiungiGiorni(d, -1))
  }
  const giornoDopo = () => {
    if (vista === 'settimana') setSettimanaAncora((d) => aggiungiGiorni(d, 7))
    else setData((d) => aggiungiGiorni(d, 1))
  }

  const apriGiornoDaSettimana = (iso: ISODate) => {
    setData(iso)
    setVista('giorno')
    salvaVistaAgenda('giorno')
  }

  const apriNuovoImpegno = useCallback((giorno: ISODate) => {
    setPannelloImpegno({ data: giorno })
  }, [])

  const apriModificaImpegno = useCallback((b: Blocco) => {
    setPannelloImpegno({ data: b.data, blocco: b })
  }, [])

  const nuovoAppuntamentoGiorno = useCallback(
    (giorno: ISODate) => {
      if (!imp) return
      const { ora, operatoreId } = primoSlotLibero(
        giorno,
        imp,
        (vista === 'settimana' ? appuntamentiSettimana : appuntamenti) ?? [],
        (vista === 'settimana' ? blocchiSettimana : blocchi) ?? [],
        operatoriAttivi,
        oraCorrente,
      )
      if (operatoreId) apriNuovo({ data: giorno, ora, operatoreId })
    },
    [
      imp,
      vista,
      appuntamentiSettimana,
      appuntamenti,
      blocchiSettimana,
      blocchi,
      operatoriAttivi,
      oraCorrente,
      apriNuovo,
    ],
  )

  const nomeOperatore = (id: string) => imp?.operatori.find((o) => o.id === id)?.nome ?? '…'

  const rigaScambio = (prima: Appuntamento, nuovoSlot: Appuntamento) => {
    const sinistra: string[] = []
    const destra: string[] = []
    if (prima.data !== nuovoSlot.data) {
      sinistra.push(formattaDataBreve(prima.data))
      destra.push(formattaDataBreve(nuovoSlot.data))
    }
    sinistra.push(`${formattaOra(prima.ora)} con ${nomeOperatore(prima.operatoreId)}`)
    destra.push(`${formattaOra(nuovoSlot.ora)} con ${nomeOperatore(nuovoSlot.operatoreId)}`)
    return `${sinistra.join(' ')} → ${destra.join(' ')}`
  }

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

  useEffect(() => {
    if (!scrollAppId || !grigliaRef.current || !appuntamenti?.some((a) => a.id === scrollAppId)) return
    const id = scrollAppId
    requestAnimationFrame(() => {
      const el = grigliaRef.current?.querySelector(`[data-app-id="${id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'auto' })
      setScrollAppId(null)
    })
  }, [scrollAppId, appuntamenti, data])

  if (!imp) {
    return <Caricamento className="agenda-caricamento" />
  }

  const fraseChiuso = fraseDelMomento('chiuso', contestoFrase, imp)
  const fraseVuota = fraseDelMomento('giornata_vuota', contestoFrase, imp)

  const pannelloImpegnoEl = pannelloImpegno ? (
    <>
      <div className="pannello-backdrop" role="presentation" onClick={() => setPannelloImpegno(null)} />
      <PannelloImpegno
        imp={imp}
        data={pannelloImpegno.data}
        blocco={pannelloImpegno.blocco}
        onChiudi={() => setPannelloImpegno(null)}
        onToast={onToast}
      />
    </>
  ) : null

  const scambioFascia = scambioDa ? (
    <div className="agenda-scambio-fascia" role="status">
      <span>Tocca l&apos;appuntamento con cui scambiare</span>
      <button type="button" onClick={annullaScambio}>
        Annulla
      </button>
    </div>
  ) : null

  const overlayConfermaScambio = confermaScambio ? (
    <div className="agenda-scambio-conferma" role="dialog" aria-labelledby="scambio-titolo">
      <div className="agenda-scambio-conferma-interno">
        <h2 id="scambio-titolo">Confermi lo scambio?</h2>
        <ul className="agenda-scambio-dettagli">
          <li>
            <strong>{mappaClienti.get(confermaScambio.da.clienteId)?.nome ?? '…'}</strong>
            <span>{rigaScambio(confermaScambio.da, confermaScambio.con)}</span>
          </li>
          <li>
            <strong>{mappaClienti.get(confermaScambio.con.clienteId)?.nome ?? '…'}</strong>
            <span>{rigaScambio(confermaScambio.con, confermaScambio.da)}</span>
          </li>
        </ul>
        <div className="agenda-scambio-azioni">
          <button type="button" className="btn-primario" onClick={() => void confermaScambioEsegui()}>
            Scambia
          </button>
          <button type="button" onClick={() => setConfermaScambio(null)}>
            Indietro
          </button>
        </div>
      </div>
    </div>
  ) : null

  const avvisiDopoScambio =
    avvisiScambio.length > 0 ? (
      <div className="avvisi-fascia agenda-avvisi-scambio" role="alert">
        <ul>
          {avvisiScambio.map((a, i) => (
            <li key={i}>{a.messaggio}</li>
          ))}
        </ul>
        <button type="button" className="btn-secondario" onClick={() => setAvvisiScambio([])}>
          Chiudi
        </button>
      </div>
    ) : null

  const intestazione = (
    <header className="agenda-intestazione">
      <div className="agenda-riga-principale">
        <button
          type="button"
          className="nav-freccia"
          onClick={giornoPrima}
          aria-label={vista === 'settimana' ? 'Settimana precedente' : 'Giorno precedente'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1
          className="agenda-titolo font-titolo"
          onClick={vista === 'giorno' ? apriPickerData : undefined}
        >
          {vista === 'settimana'
            ? `Settimana ${formattaDataBreve(settimanaDa)} – ${formattaDataBreve(settimanaA)}`
            : formattaDataLunga(data)}
        </h1>
        <button
          type="button"
          className="nav-freccia"
          onClick={giornoDopo}
          aria-label={vista === 'settimana' ? 'Settimana successiva' : 'Giorno successivo'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          type="button"
          className="agenda-btn-cerca"
          onClick={() => setRicercaAperta(true)}
          aria-label="Cerca appuntamento"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="btn-oggi" onClick={vaiOggi}>
          Oggi
        </button>
        <div className="agenda-vista-toggle" role="group" aria-label="Vista agenda">
          <button
            type="button"
            className={vista === 'giorno' ? 'attivo' : ''}
            aria-pressed={vista === 'giorno'}
            onClick={() => cambiaVista('giorno')}
          >
            Giorno
          </button>
          <button
            type="button"
            className={vista === 'settimana' ? 'attivo' : ''}
            aria-pressed={vista === 'settimana'}
            onClick={() => cambiaVista('settimana')}
          >
            Settimana
          </button>
        </div>
        <button type="button" className="agenda-btn-nuovo-testata" onClick={apriNuovoAutomatico}>
          + Nuovo
        </button>
      </div>
      {vista === 'giorno' ? (
        <label className="agenda-data-picker">
          <span className="sr-only">Scegli data</span>
          <input
            ref={dataInputRef}
            type="date"
            value={inputDateVal(data)}
            onChange={(e) => setData(e.target.value as ISODate)}
          />
        </label>
      ) : null}
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
      {chiuso && vista === 'giorno' ? (
        <p className="agenda-fascia-chiuso">
          <span className="agenda-stato-label">Chiuso</span>
          <span className="agenda-frase-momento font-titolo">{fraseChiuso}</span>
        </p>
      ) : null}
      {contoServizi ? <p className="agenda-conto-servizi font-tabular">{contoServizi}</p> : null}
      {barraTurno ? (
        <div className="agenda-barra-turno">
          <span className="agenda-barra-turno-testo font-tabular">{barraTurno.testo}</span>
          <div
            className="agenda-barra-turno-traccia"
            role="progressbar"
            aria-valuenow={barraTurno.ariaNow}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="agenda-barra-turno-pieno" style={{ width: `${barraTurno.fill * 100}%` }} />
          </div>
        </div>
      ) : null}
    </header>
  )

  if (vista === 'settimana') {
    return (
      <div className={`agenda agenda-vista-settimana${scambioDa ? ' agenda-scambio-attiva' : ''}`}>
        {scambioFascia}
        {avvisiDopoScambio}
        {intestazione}
        <AgendaSettimana
          imp={imp}
          ancora={settimanaAncora}
          oggiIso={oggiIso}
          appuntamenti={appuntamentiSettimana ?? []}
          blocchi={blocchiSettimana ?? []}
          nascondiDisdetti={nascondiDisdetti}
          mappaClienti={mappaClienti}
          onGiorno={apriGiornoDaSettimana}
          onAppuntamento={(a) => {
            setData(a.data)
            setPannello({ appuntamento: a })
          }}
          onImpegno={apriModificaImpegno}
          onNuovoAppuntamento={nuovoAppuntamentoGiorno}
          onNuovoImpegno={apriNuovoImpegno}
        />
        {ricercaAperta ? (
          <>
            <div className="pannello-backdrop" role="presentation" onClick={() => setRicercaAperta(false)} />
            <PannelloRicerca onChiudi={() => setRicercaAperta(false)} onScegli={apriDaRicerca} />
          </>
        ) : null}
        {pannello ? (
          <>
            <div className="pannello-backdrop" role="presentation" onClick={chiudiPannello} />
            <PannelloAppuntamento
              imp={imp}
              pannello={pannello}
              onChiudi={chiudiPannello}
              onToast={onToast}
              onIniziaScambio={iniziaScambio}
              onVaiAData={vaiAAppuntamentoSerie}
              onApriSchedaCliente={onApriSchedaCliente}
            />
          </>
        ) : null}
        {pannelloImpegnoEl}
        {overlayConfermaScambio}
      </div>
    )
  }

  return (
    <div
      className={`agenda agenda-con-pfab${chiuso ? ' agenda-giorno-chiuso' : ''}${scambioDa ? ' agenda-scambio-attiva' : ''}`}
    >
      {scambioFascia}
      {avvisiDopoScambio}
      {intestazione}

      {impegniGiorno.length > 0 ? (
        <ul className="agenda-impegni-giorno">
          {impegniGiorno.map((b) => (
            <li key={b.id}>
              <button type="button" className="agenda-impegno-riga" onClick={() => apriModificaImpegno(b)}>
                <span className="agenda-impegno-titolo">{b.motivo}</span>
                <span className="agenda-impegno-ora font-tabular">
                  {b.dalle ? `${formattaOra(b.dalle)}${b.alle ? `–${formattaOra(b.alle)}` : ''}` : 'Tutto il giorno'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="agenda-griglia-wrap" ref={grigliaRef}>
        <div className="agenda-ore" style={{ '--slot-count': slotCount } as React.CSSProperties}>
          {slots.map((ora) => (
            <div key={ora} className="agenda-ora-label font-tabular">
              {formattaOra(ora)}
            </div>
          ))}
          <div className="agenda-ora-chiusura font-tabular">{formattaOra(imp.chiude)}</div>
        </div>
        <div className="agenda-colonne">
          {              operatoriAttivi.map((op) => (
            <ColonnaOperatore
              key={op.id}
              nome={op.nome}
              operatoreId={op.id}
              coloreOperatore={coloreOperatore(op.id, imp)}
              data={data}
              slots={slots}
              passo={passo}
              slotCount={slotCount}
              apreMin={apreMin}
              appuntamenti={visibili.filter((a) => a.operatoreId === op.id)}
              blocchi={blocchiAssenza.filter((b) => b.operatoreId === null || b.operatoreId === op.id)}
              servizi={imp.servizi}
              mappaClienti={mappaClienti}
              onSlotTap={apriNuovo}
              onAppuntamentoTap={apriModifica}
              scambioEvidenzaId={scambioDa?.id}
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

      <button type="button" className="agenda-fab-nuovo" onClick={apriNuovoAutomatico} aria-label="Nuovo appuntamento">
        +
      </button>

      {ricercaAperta ? (
        <>
          <div className="pannello-backdrop" role="presentation" onClick={() => setRicercaAperta(false)} />
          <PannelloRicerca onChiudi={() => setRicercaAperta(false)} onScegli={apriDaRicerca} />
        </>
      ) : null}
      {pannello ? (
        <>
          <div className="pannello-backdrop" role="presentation" onClick={chiudiPannello} />
          <PannelloAppuntamento
            imp={imp}
            pannello={pannello}
            onChiudi={chiudiPannello}
            onToast={onToast}
            onIniziaScambio={iniziaScambio}
            onVaiAData={vaiAAppuntamentoSerie}
            onApriSchedaCliente={onApriSchedaCliente}
          />
        </>
      ) : null}
      {pannelloImpegnoEl}
      {overlayConfermaScambio}
    </div>
  )
}

interface ColonnaProps {
  nome: string
  operatoreId: string
  coloreOperatore: string
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
  scambioEvidenzaId?: string
}

function ColonnaOperatore({
  nome,
  operatoreId,
  coloreOperatore: coloreOp,
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
  scambioEvidenzaId,
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
          const cliente = mappaClienti.get(a.clienteId)
          const clienteNome = cliente?.nome ?? '…'
          const torta = cliente && compleannoNelGiorno(cliente.compleanno, data) ? ' 🎂' : ''
          const servizioNome = nomeServizio(a.servizioId)
          const rigaBreve = servizioNome
            ? `${formattaOra(a.ora)} ${clienteNome}${torta} · ${servizioNome}`
            : `${formattaOra(a.ora)} ${clienteNome}${torta}`
          return (
            <button
              key={a.id}
              type="button"
              data-app-id={a.id}
              className={`app-blocco stato-${stato}${inAttesa ? ' in-attesa' : ''}${breve ? ' app-blocco-breve' : ''}${scambioEvidenzaId === a.id ? ' scambio-origine' : ''}${scambioEvidenzaId && scambioEvidenzaId !== a.id ? ' scambio-bersaglio' : ''}${a.serieId ? ' app-blocco-serie' : ''}`}
              style={{
                top: `${top}%`,
                height: `${height}%`,
                borderLeftColor: coloreOp,
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
                  <span className="app-blocco-cliente">
                    {clienteNome}
                    {torta}
                  </span>
                  {servizioNome ? <span className="app-blocco-servizio">{servizioNome}</span> : null}
                </>
              )}
              {a.serieId ? (
                <span className="app-blocco-serie-mark" aria-hidden title="Appuntamento fisso">
                  ↻
                </span>
              ) : null}
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
