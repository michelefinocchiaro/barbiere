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
  cercaClienti,
  eliminaAppuntamento,
  formattaOra,
  formattaTelefono,
  impostaStato,
  normalizzaTelefono,
  salvaAppuntamento,
  spostaAppuntamento,
  storicoCliente,
  trovaOCreaCliente,
  verificaAppuntamento,
} from '../../core'
import { AvvisiFascia } from '../components/AvvisiFascia'
import type { ToastAzione } from '../components/Toast'
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
}

export function PannelloAppuntamento({ imp, pannello, onChiudi, onToast }: Props) {
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

  const campoRef = useRef<HTMLInputElement>(null)

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

  const elimina = async () => {
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
          id: copia.id,
        })
      },
    })
    onChiudi()
  }

  const sposta = async () => {
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
    onChiudi()
  }

  const telefonoMostra = clienteSel
    ? formattaTelefono(clienteSel.telefono)
    : clienteEsistente
      ? formattaTelefono(clienteEsistente.telefono)
      : ''

  return (
    <aside className="pannello-app" role="dialog" aria-labelledby="pannello-titolo">
      <header className="pannello-intestazione">
        <h2 id="pannello-titolo">{modifica ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</h2>
        <button type="button" className="pannello-chiudi" onClick={onChiudi} aria-label="Chiudi">
          ✕
        </button>
      </header>

      <div className="pannello-corpo">
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

        {modifica && clienteSel ? (
          <div className="telefono-grande">
            <a href={`tel:+${clienteSel.telefono}`}>{telefonoMostra}</a>
          </div>
        ) : null}

        {modifica && esistente ? (
          <div className="azioni-modifica">
            <button type="button" onClick={() => setMostraSposta((v) => !v)}>
              Sposta
            </button>
            <button type="button" className="btn-disdici" onClick={() => void disdici()}>
              Disdici
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
        ) : null}

        {mostraSposta && esistente ? (
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

        {modifica && clienteSel ? (
          <StoricoCliente clienteId={clienteSel.id} formattaOra={formattaOra} />
        ) : null}
      </div>

      <footer className="pannello-piede">
        <button
          type="button"
          className="btn-primario btn-salva"
          disabled={!clienteSel || inSalvataggio}
          onClick={() => void salva(false)}
        >
          Salva
        </button>
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
