import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type {
  Appuntamento,
  Avviso,
  Cliente,
  HHMM,
  Impostazioni,
  ISODate,
  StatoAppuntamento,
} from '../../core'
import {
  appuntamentiSerie,
  cercaClienti,
  componiMessaggioRapido,
  eliminaAppuntamento,
  eliminaSerieDa,
  formattaOra,
  giornoEsteso,
  formattaTelefono,
  impostaStato,
  linkWhatsApp,
  normalizzaTelefono,
  oggi,
  ripristinaAppuntamenti,
  salvaAppuntamento,
  spostaAppuntamento,
  spostaSerieDa,
  storicoCliente,
  trovaOCreaCliente,
  verificaAppuntamento,
} from '../../core'
import { ModuloRipeti } from './ModuloRipeti'
import { AvvisiFascia } from '../components/AvvisiFascia'
import { InviaRiepilogoCliente } from '../components/InviaRiepilogoCliente'
import type { ToastAzione } from '../components/Toast'
import {
  ModuloSegnaDaPagare,
  type ModuloSegnaDaPagareHandle,
} from '../debiti/ModuloSegnaDaPagare'
import { inputDateVal } from '../utils/dateUi'
import './PannelloAppuntamento.css'

interface SlotTap {
  data: ISODate
  ora: HHMM
  operatoreId: string
}

interface ModificaTap {
  appuntamento: Appuntamento
}

type PannelloInput = SlotTap | ModificaTap

function isModifica(p: PannelloInput): p is ModificaTap {
  return 'appuntamento' in p
}

interface Props {
  imp: Impostazioni
  pannello: PannelloInput
  onChiudi: () => void
  onToast?: (t: ToastAzione) => void
  onIniziaScambio?: (a: Appuntamento) => void
  onVaiAData?: (data: ISODate, app: Appuntamento) => void
  onApriSchedaCliente?: (clienteId: string) => void
}

export function PannelloAppuntamento({
  imp,
  pannello,
  onChiudi,
  onToast,
  onIniziaScambio,
  onVaiAData,
  onApriSchedaCliente,
}: Props) {
  const modifica = isModifica(pannello)
  const esistente = modifica ? pannello.appuntamento : null

  const [queryCliente, setQueryCliente] = useState('')
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null)
  const [nomeNuovo, setNomeNuovo] = useState('')
  const [telNuovo, setTelNuovo] = useState('')
  const [mostraNuovo, setMostraNuovo] = useState(false)

  const [data, setData] = useState<ISODate>(esistente?.data ?? (pannello as SlotTap).data)
  const [ora, setOra] = useState<HHMM>(esistente?.ora ?? (pannello as SlotTap).ora)
  const [operatoreId, setOperatoreId] = useState(
    esistente?.operatoreId ?? (pannello as SlotTap).operatoreId,
  )
  const [durataMin, setDurataMin] = useState(esistente?.durataMin ?? 30)
  const [servizioId, setServizioId] = useState<string | undefined>(esistente?.servizioId)
  const [provvisorio, setProvvisorio] = useState(esistente?.stato === 'provvisorio')
  const [note, setNote] = useState(esistente?.note ?? '')
  const [avvisi, setAvvisi] = useState<Avviso[]>([])
  const [inSalvataggio, setInSalvataggio] = useState(false)
  const [mostraSposta, setMostraSposta] = useState(false)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [mostraDebito, setMostraDebito] = useState(false)
  const [mostraRipeti, setMostraRipeti] = useState(false)
  const [sceltaSerie, setSceltaSerie] = useState<'sposta' | 'elimina' | null>(null)

  const campoRef = useRef<HTMLInputElement>(null)
  const moduloDebitoRef = useRef<ModuloSegnaDaPagareHandle>(null)

  const suggerimenti = useLiveQuery(
    () =>
      queryCliente.trim().length >= 1 ? cercaClienti(queryCliente) : Promise.resolve([]),
    [queryCliente],
  )

  const clienteEsistente = useLiveQuery(async () => {
    if (!esistente) return null
    const tutti = await cercaClienti('', 500)
    return tutti.find((c) => c.id === esistente.clienteId) ?? null
  }, [esistente?.clienteId])

  const serie = useLiveQuery(
    () => (esistente?.serieId ? appuntamentiSerie(esistente.serieId) : Promise.resolve([])),
    [esistente?.serieId],
  )
  const posizioneSerie =
    esistente?.serieId && serie
      ? serie.findIndex((a) => a.id === esistente.id) + 1
      : 0

  useEffect(() => {
    campoRef.current?.focus()
  }, [])

  useEffect(() => {
    if (esistente && clienteEsistente) {
      setClienteSel(clienteEsistente)
      setQueryCliente(clienteEsistente.nome)
    }
  }, [esistente, clienteEsistente])

  const passo = imp.passoGrigliaMin

  const scegliServizio = (id: string, durata: number) => {
    setServizioId(id)
    setDurataMin(durata)
  }

  const payloadBase = useCallback(() => {
    let statoFinale: StatoAppuntamento = provvisorio
      ? 'provvisorio'
      : esistente?.stato === 'disdetto'
        ? 'disdetto'
        : 'prenotato'
    if (esistente?.stato === 'confermato') statoFinale = 'confermato'
    return {
      data,
      ora,
      durataMin,
      operatoreId,
      clienteId: clienteSel!.id,
      servizioId,
      note: note || undefined,
      stato: statoFinale,
      promemoria: esistente?.promemoria ?? ('da_inviare' as const),
      testoPromemoria: esistente?.testoPromemoria,
      id: esistente?.id,
    }
  }, [
    provvisorio,
    esistente,
    data,
    ora,
    durataMin,
    operatoreId,
    clienteSel,
    servizioId,
    note,
  ])

  const verifica = async () => {
    if (!clienteSel) return
    const a = payloadBase()
    const v = await verificaAppuntamento({
      data: a.data,
      ora: a.ora,
      durataMin: a.durataMin,
      operatoreId: a.operatoreId,
      id: a.id,
    })
    setAvvisi(v)
    return v
  }

  const salva = async (ignoraAvvisi = false) => {
    if (!clienteSel) return
    setInSalvataggio(true)
    try {
      if (!ignoraAvvisi) {
        const v = await verifica()
        if (v && v.length > 0) {
          setInSalvataggio(false)
          return
        }
      }
      const prima = esistente ? { ...esistente } : null
      const { appuntamento } = await salvaAppuntamento(payloadBase())
      onToast?.({
        messaggio: modifica ? 'Appuntamento aggiornato' : 'Appuntamento salvato',
        annulla: prima
          ? () => {
              void salvaAppuntamento({ ...prima, id: prima.id })
            }
          : () => {
              void eliminaAppuntamento(appuntamento.id)
            },
      })
      onChiudi()
    } finally {
      setInSalvataggio(false)
    }
  }

  const creaCliente = async () => {
    const norm = normalizzaTelefono(telNuovo, imp.prefissoPredefinito)
    if (!norm || !nomeNuovo.trim()) return
    const c = await trovaOCreaCliente(nomeNuovo.trim(), norm)
    setClienteSel(c)
    setQueryCliente(c.nome)
    setMostraNuovo(false)
  }

  const disdici = async () => {
    if (!esistente) return
    const statoPrima = esistente.stato
    await impostaStato(esistente.id, 'disdetto')
    onToast?.({
      messaggio: 'Appuntamento disdetto',
      annulla: () => impostaStato(esistente.id, statoPrima),
    })
    onChiudi()
  }

  const eliminaSolo = async () => {
    if (!esistente) return
    const copia = { ...esistente }
    await eliminaAppuntamento(esistente.id)
    onToast?.({
      messaggio: 'Appuntamento eliminato',
      annulla: () => {
        void salvaAppuntamento({
          data: copia.data,
          ora: copia.ora,
          durataMin: copia.durataMin,
          operatoreId: copia.operatoreId,
          clienteId: copia.clienteId,
          servizioId: copia.servizioId,
          note: copia.note,
          stato: copia.stato,
          promemoria: copia.promemoria,
          testoPromemoria: copia.testoPromemoria,
          serieId: copia.serieId,
          id: copia.id,
        })
      },
    })
    onChiudi()
  }

  const eliminaConSuccessivi = async () => {
    if (!esistente?.serieId) return
    const prima = await eliminaSerieDa(esistente.id)
    onToast?.({
      messaggio: `Eliminati ${prima.length} appuntamenti della serie`,
      annulla: () => ripristinaAppuntamenti(prima),
    })
    onChiudi()
  }

  const elimina = async () => {
    if (!esistente) return
    if (esistente.serieId && serie && serie.length > 1) {
      setSceltaSerie('elimina')
      return
    }
    await eliminaSolo()
  }

  const spostaSolo = async () => {
    if (!esistente) return
    const prima = { data: esistente.data, ora: esistente.ora, operatoreId: esistente.operatoreId }
    await spostaAppuntamento(esistente.id, data, ora, operatoreId)
    onToast?.({
      messaggio: 'Appuntamento spostato',
      annulla: () => {
        void spostaAppuntamento(esistente.id, prima.data, prima.ora, prima.operatoreId)
      },
    })
    setMostraSposta(false)
    setSceltaSerie(null)
    onChiudi()
  }

  const spostaConSuccessivi = async () => {
    if (!esistente?.serieId) return
    if (data !== esistente.data) {
      await spostaSolo()
      return
    }
    const prima = await spostaSerieDa(esistente.id, ora, operatoreId)
    onToast?.({
      messaggio: `Orario aggiornato su ${prima.length} appuntamenti`,
      annulla: () => ripristinaAppuntamenti(prima),
    })
    setMostraSposta(false)
    setSceltaSerie(null)
    onChiudi()
  }

  const sposta = async () => {
    if (!esistente) return
    const cambiaOraOp = esistente.ora !== ora || esistente.operatoreId !== operatoreId
    if (esistente.serieId && serie && serie.length > 1 && cambiaOraOp) {
      setSceltaSerie('sposta')
      return
    }
    await spostaSolo()
  }

  const telefonoMostra = clienteSel
    ? formattaTelefono(clienteSel.telefono)
    : clienteEsistente
      ? formattaTelefono(clienteEsistente.telefono)
      : ''

  const messaggiRapidi = imp.messaggiRapidi ?? []
  const oggiIso = oggi()

  return (
    <aside className="pannello-app" role="dialog" aria-labelledby="pannello-titolo">
      <header className="pannello-intestazione">
        {mostraDebito ? (
          <>
            <button
              type="button"
              className="pannello-indietro"
              onClick={() => setMostraDebito(false)}
            >
              ‹ Appuntamento
            </button>
            <h2 id="pannello-titolo">Segna da pagare</h2>
            <button type="button" className="pannello-chiudi" onClick={onChiudi} aria-label="Chiudi">
              ✕
            </button>
          </>
        ) : mostraRipeti ? (
          <>
            <button type="button" className="pannello-indietro" onClick={() => setMostraRipeti(false)}>
              ‹ Appuntamento
            </button>
            <h2 id="pannello-titolo">Ripeti appuntamento</h2>
            <button type="button" className="pannello-chiudi" onClick={onChiudi} aria-label="Chiudi">
              ✕
            </button>
          </>
        ) : (
          <>
            <h2 id="pannello-titolo">{modifica ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</h2>
            <button type="button" className="pannello-chiudi" onClick={onChiudi} aria-label="Chiudi">
              ✕
            </button>
          </>
        )}
      </header>

      {mostraRipeti && clienteSel ? (
        <div className="pannello-corpo">
          <ModuloRipeti
            imp={imp}
            base={{
              data,
              ora,
              durataMin,
              operatoreId,
              clienteId: clienteSel.id,
              servizioId,
              note: note || undefined,
              stato: provvisorio ? 'provvisorio' : 'prenotato',
              promemoria: esistente?.promemoria ?? 'da_inviare',
            }}
            onIndietro={() => setMostraRipeti(false)}
            onChiudi={onChiudi}
            onToast={onToast}
          />
        </div>
      ) : mostraDebito && clienteSel ? (
        <div className="pannello-corpo pannello-corpo-debito">
          <ModuloSegnaDaPagare
            ref={moduloDebitoRef}
            daPannello
            imp={imp}
            onChiudi={() => setMostraDebito(false)}
            onToast={(t) => onToast?.(t)}
            iniziale={{
              cliente: clienteSel,
              data: esistente?.data ?? data,
              appuntamentoId: esistente?.id,
            }}
          />
        </div>
      ) : (
      <div className="pannello-corpo">
        <div className="pannello-griglia">
        <div className="pannello-dati">
        <label className="campo">
          Cliente
          <input
            ref={campoRef}
            type="search"
            value={queryCliente}
            onChange={(e) => {
              setQueryCliente(e.target.value)
              setClienteSel(null)
              setMostraNuovo(false)
            }}
            placeholder="Nome o ultime cifre del telefono"
            autoComplete="off"
          />
        </label>

        {suggerimenti && suggerimenti.length > 0 && !clienteSel ? (
          <ul className="suggerimenti">
            {suggerimenti.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setClienteSel(c)
                    setQueryCliente(c.nome)
                  }}
                >
                  <strong>{c.nome}</strong>
                  <span>{formattaTelefono(c.telefono)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!clienteSel && queryCliente.length >= 2 && (!suggerimenti || suggerimenti.length === 0) ? (
          <div className="cliente-nuovo">
            <button type="button" className="link-nuovo" onClick={() => setMostraNuovo(true)}>
              Cliente nuovo
            </button>
          </div>
        ) : null}

        {mostraNuovo ? (
          <div className="cliente-nuovo-form">
            <label>
              Nome
              <input value={nomeNuovo} onChange={(e) => setNomeNuovo(e.target.value)} />
            </label>
            <label>
              Telefono
              <input
                type="tel"
                inputMode="numeric"
                value={telNuovo}
                onChange={(e) => setTelNuovo(e.target.value)}
              />
            </label>
            <button type="button" className="btn-primario" onClick={() => void creaCliente()}>
              Aggiungi cliente
            </button>
          </div>
        ) : null}

        {clienteSel ? (
          <div className="pannello-cliente-annotazioni">
            {clienteSel.taglioAbituale ? (
              <p className="pannello-taglio-abituale">
                <strong>Taglio abituale:</strong> {clienteSel.taglioAbituale}
              </p>
            ) : null}
            {clienteSel.note ? (
              <p className="pannello-note-cliente">
                <strong>Note cliente:</strong> {clienteSel.note}
              </p>
            ) : null}
            {onApriSchedaCliente ? (
              <button
                type="button"
                className="btn-secondario btn-apri-scheda"
                onClick={() => onApriSchedaCliente(clienteSel.id)}
              >
                Apri scheda
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="servizi-pulsanti">
          <span className="etichetta-sezione">Servizio</span>
          <div className="griglia-servizi">
            {[...imp.servizi]
              .sort((a, b) => a.ordine - b.ordine)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`btn-servizio${servizioId === s.id ? ' attivo' : ''}`}
                  onClick={() => scegliServizio(s.id, s.durataMin)}
                >
                  {s.nome}
                  <small>{s.durataMin} min</small>
                </button>
              ))}
          </div>
        </div>

        <div className="durata-riga">
          <span>Durata</span>
          <button type="button" onClick={() => setDurataMin((d) => Math.max(passo, d - passo))}>
            −{passo}
          </button>
          <strong>{durataMin} min</strong>
          <button type="button" onClick={() => setDurataMin((d) => d + passo)}>
            +{passo}
          </button>
        </div>

        <div className="campi-riga">
          <label>
            Ora
            <input type="time" value={ora} onChange={(e) => setOra(e.target.value as HHMM)} />
          </label>
          <label>
            Operatore
            <select value={operatoreId} onChange={(e) => setOperatoreId(e.target.value)}>
              {imp.operatori
                .filter((o) => o.attivo)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <label className="toggle-provvisorio">
          <input
            type="checkbox"
            checked={provvisorio}
            onChange={(e) => setProvvisorio(e.target.checked)}
          />
          Provvisorio
        </label>

        <label className="campo">
          Note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>

        <AvvisiFascia
          avvisi={avvisi}
          onCambia={() => setAvvisi([])}
          onSalvaComunque={() => void salva(true)}
        />

        {sceltaSerie ? (
          <div className="conferma-serie" role="dialog" aria-label="Modifica serie">
            <p>
              {sceltaSerie === 'elimina'
                ? 'Eliminare solo questo appuntamento o anche i successivi della serie?'
                : 'Aggiornare solo questo o anche i successivi (stesse date)?'}
            </p>
            <button type="button" onClick={() => void (sceltaSerie === 'elimina' ? eliminaSolo() : spostaSolo())}>
              Solo questo
            </button>
            <button
              type="button"
              className="btn-primario"
              onClick={() => void (sceltaSerie === 'elimina' ? eliminaConSuccessivi() : spostaConSuccessivi())}
            >
              Questo e i successivi
            </button>
            <button type="button" className="btn-secondario" onClick={() => setSceltaSerie(null)}>
              Annulla
            </button>
          </div>
        ) : null}
        </div>

        {clienteSel ? (
        <div className="pannello-azioni-lato">
          <section className="pannello-gruppo" aria-labelledby="pannello-gruppo-fisso">
            <h3 id="pannello-gruppo-fisso" className="pannello-gruppo-titolo">
              Fisso
            </h3>
            <button
              type="button"
              className="btn-secondario btn-ripeti"
              onClick={() => setMostraRipeti(true)}
            >
              Ripeti…
            </button>
            {modifica && esistente?.serieId && serie && serie.length > 0 ? (
              <section className="pannello-serie" aria-label="Appuntamenti fissi">
                <p className="pannello-serie-titolo">
                  Appuntamento fisso · {posizioneSerie} di {serie.length}
                </p>
                <ul className="pannello-serie-date">
                  {serie.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={a.id === esistente.id ? 'attivo' : ''}
                        onClick={() => onVaiAData?.(a.data, a)}
                      >
                        {giornoEsteso(a.data)} · {formattaOra(a.ora)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>

        {modifica && clienteSel ? (
          <section className="pannello-gruppo" aria-labelledby="pannello-gruppo-messaggi">
            <h3 id="pannello-gruppo-messaggi" className="pannello-gruppo-titolo">
              Messaggi
            </h3>
            <div className="telefono-grande">
              <a href={`tel:+${clienteSel.telefono}`}>{telefonoMostra}</a>
            </div>
            {esistente && messaggiRapidi.length > 0 ? (
              <div className="messaggi-rapidi">
                <span className="etichetta-sezione">Messaggi rapidi</span>
                <div className="griglia-messaggi-rapidi">
                  {messaggiRapidi.map((m) => {
                    const testo = componiMessaggioRapido(m, esistente, clienteSel, oggiIso)
                    const href = linkWhatsApp(clienteSel.telefono, testo)
                    return (
                      <a
                        key={m.id}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-messaggio-rapido"
                      >
                        {m.etichetta}
                      </a>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <InviaRiepilogoCliente clienteId={clienteSel.id} />
          </section>
        ) : null}

        {modifica && esistente && clienteSel ? (
          <section className="pannello-gruppo" aria-labelledby="pannello-gruppo-altro">
            <h3 id="pannello-gruppo-altro" className="pannello-gruppo-titolo">
              Altro
            </h3>
            <div className="azioni-modifica">
              <button type="button" onClick={() => setMostraSposta((v) => !v)}>
                Sposta
              </button>
              {onIniziaScambio ? (
                <button type="button" onClick={() => onIniziaScambio(esistente)}>
                  Scambia con…
                </button>
              ) : null}
              <button type="button" className="btn-disdici" onClick={() => void disdici()}>
                Disdici
              </button>
              <button type="button" onClick={() => setMostraDebito(true)}>
                Segna da pagare
              </button>
              {!confermaElimina ? (
                <button type="button" className="btn-pericolo" onClick={() => setConfermaElimina(true)}>
                  Elimina
                </button>
              ) : (
                <div className="conferma-elimina">
                  <span>Sicuro?</span>
                  <button type="button" onClick={() => setConfermaElimina(false)}>
                    No
                  </button>
                  <button type="button" className="btn-pericolo" onClick={() => void elimina()}>
                    Sì, elimina
                  </button>
                </div>
              )}
            </div>
            {mostraSposta ? (
              <div className="sposta-box">
                <label>
                  Data
                  <input
                    type="date"
                    value={inputDateVal(data)}
                    onChange={(e) => setData(e.target.value as ISODate)}
                  />
                </label>
                <label>
                  Ora
                  <input type="time" value={ora} onChange={(e) => setOra(e.target.value as HHMM)} />
                </label>
                <label>
                  Operatore
                  <select value={operatoreId} onChange={(e) => setOperatoreId(e.target.value)}>
                    {imp.operatori
                      .filter((o) => o.attivo)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="sposta-azioni">
                  <button type="button" onClick={() => void sposta()}>
                    Conferma spostamento
                  </button>
                  <button type="button" onClick={() => setMostraSposta(false)}>
                    Annulla
                  </button>
                </div>
              </div>
            ) : null}
            <StoricoCliente clienteId={clienteSel.id} formattaOra={formattaOra} />
          </section>
        ) : null}
        </div>
        ) : null}
        </div>
      </div>
      )}

      <footer className="pannello-piede" hidden={mostraRipeti}>
        {mostraDebito ? (
          <button
            type="button"
            className="btn-primario btn-salva"
            onClick={() => void moduloDebitoRef.current?.salva()}
          >
            Salva da pagare
          </button>
        ) : (
          <button
            type="button"
            className="btn-primario btn-salva"
            disabled={!clienteSel || inSalvataggio}
            onClick={() => void salva(false)}
          >
            Salva
          </button>
        )}
      </footer>
    </aside>
  )
}

function StoricoCliente({
  clienteId,
  formattaOra,
}: {
  clienteId: string
  formattaOra: (o: HHMM) => string
}) {
  const storico = useLiveQuery(
    () => storicoCliente(clienteId),
    [clienteId],
  )
  if (!storico?.length) return null
  return (
    <details className="storico-cliente">
      <summary>Storico appuntamenti</summary>
      <ul>
        {storico.slice(0, 8).map((a) => (
          <li key={a.id}>
            {a.data} {formattaOra(a.ora)} — {a.stato}
          </li>
        ))}
      </ul>
    </details>
  )
}
