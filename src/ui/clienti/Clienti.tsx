import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, Debito } from '../../core'
import {
  cercaClienti,
  formattaEuro,
  formattaOra,
  formattaTelefono,
  giornoEsteso,
  leggiCompleanno,
  leggiImpostazioni,
  normalizzaTelefono,
  parseCompleanno,
  salvaCliente,
  schedaCliente,
  storicoCliente,
  tuttiIClienti,
} from '../../core'
import { formattaDataLunga } from '../utils/dateUi'
import { InviaRiepilogoCliente } from '../components/InviaRiepilogoCliente'
import type { ToastAzione } from '../components/Toast'
import { RiquadroCompleanni } from './RiquadroCompleanni'
import './Clienti.css'
import './RiquadroCompleanni.css'

interface Props {
  clienteInizialeId?: string | null
  onToast?: (t: ToastAzione) => void
}

export function Clienti({ clienteInizialeId, onToast }: Props) {
  const [query, setQuery] = useState('')
  const [selezionato, setSelezionato] = useState<Cliente | null>(null)

  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const tutti = useLiveQuery(() => tuttiIClienti(), [])

  useEffect(() => {
    if (!clienteInizialeId || !tutti) return
    const c = tutti.find((x) => x.id === clienteInizialeId)
    if (c) setSelezionato(c)
  }, [clienteInizialeId, tutti])

  const filtrati = useLiveQuery(
    () => (query.trim() ? cercaClienti(query, 50) : tuttiIClienti()),
    [query],
  )

  const lista = useMemo(() => {
    const sorgente = query.trim() ? filtrati : tutti
    return [...(sorgente ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  }, [filtrati, tutti, query])

  return (
    <div className="clienti">
      <header className="clienti-intestazione">
        <h1>Clienti</h1>
        <input
          type="search"
          className="clienti-cerca"
          placeholder="Cerca per nome o telefono"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className={`clienti-corpo${selezionato ? ' clienti-vista-scheda' : ''}`}>
        <div className="clienti-lista-colonna">
          {!selezionato ? <RiquadroCompleanni onToast={onToast} /> : null}
          <ul className="clienti-lista">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`cliente-voce${selezionato?.id === c.id ? ' attivo' : ''}`}
                  onClick={() => setSelezionato(c)}
                >
                  <span className="cliente-nome">{c.nome}</span>
                  <span className="cliente-tel">{formattaTelefono(c.telefono)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selezionato ? (
          <div className="clienti-scheda-wrap">
            <button type="button" className="clienti-indietro" onClick={() => setSelezionato(null)}>
              ← Clienti
            </button>
            <SchedaCliente
              cliente={selezionato}
              prefisso={imp?.prefissoPredefinito ?? '39'}
              operatori={(imp?.operatori ?? []).filter((o) => o.attivo)}
              onSalvato={setSelezionato}
            />
          </div>
        ) : (
          <p className="clienti-scegli">Seleziona un cliente</p>
        )}
      </div>
    </div>
  )
}

function SchedaCliente({
  cliente,
  prefisso,
  operatori,
  onSalvato,
}: {
  cliente: Cliente
  prefisso: string
  operatori: { id: string; nome: string }[]
  onSalvato: (c: Cliente) => void
}) {
  const [nome, setNome] = useState(cliente.nome)
  const [telefono, setTelefono] = useState(formattaTelefono(cliente.telefono))
  const [note, setNote] = useState(cliente.note ?? '')
  const [taglioAbituale, setTaglioAbituale] = useState(cliente.taglioAbituale ?? '')
  const [operatorePreferitoId, setOperatorePreferitoId] = useState(cliente.operatorePreferitoId ?? '')
  const [giornoC, setGiornoC] = useState(() => giornoIniziale(cliente.compleanno))
  const [meseC, setMeseC] = useState(() => meseIniziale(cliente.compleanno))
  const [annoC, setAnnoC] = useState(() => annoIniziale(cliente.compleanno))
  const [errore, setErrore] = useState('')

  const scheda = useLiveQuery(() => schedaCliente(cliente.id), [cliente.id])
  const storico = useLiveQuery(() => storicoCliente(cliente.id), [cliente.id])

  useEffect(() => {
    setNome(cliente.nome)
    setTelefono(formattaTelefono(cliente.telefono))
    setNote(cliente.note ?? '')
    setTaglioAbituale(cliente.taglioAbituale ?? '')
    setOperatorePreferitoId(cliente.operatorePreferitoId ?? '')
    setGiornoC(giornoIniziale(cliente.compleanno))
    setMeseC(meseIniziale(cliente.compleanno))
    setAnnoC(annoIniziale(cliente.compleanno))
  }, [cliente])

  const salva = async () => {
    const norm = normalizzaTelefono(telefono, prefisso)
    if (!norm) {
      setErrore('Numero non valido')
      return
    }
    let compleanno: string | undefined
    if (giornoC.trim() && meseC.trim()) {
      const g = Number(giornoC)
      const m = Number(meseC)
      const a = annoC.trim() ? Number(annoC) : undefined
      const letto = leggiCompleanno(g, m, a)
      if (!letto) {
        setErrore('Compleanno non valido')
        return
      }
      compleanno = letto
    } else if (!giornoC.trim() && !meseC.trim()) {
      compleanno = undefined
    } else {
      setErrore('Compleanno incompleto')
      return
    }
    const aggiornato: Cliente = {
      ...cliente,
      nome: nome.trim(),
      telefono: norm,
      note: note.trim() || undefined,
      taglioAbituale: taglioAbituale.trim() || undefined,
      operatorePreferitoId: operatorePreferitoId || undefined,
      compleanno,
      aggiornatoIl: new Date().toISOString(),
    }
    await salvaCliente(aggiornato)
    onSalvato(aggiornato)
    setErrore('')
  }

  const s = scheda

  return (
    <div className="cliente-scheda">
      <div className="cliente-scheda-colonne">
        <div className="cliente-scheda-modifica">
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Telefono
            <input type="tel" inputMode="numeric" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
          <fieldset className="cliente-compleanno-campi">
            <legend>Compleanno</legend>
            <div className="cliente-compleanno-riga">
              <label>
                Giorno
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={giornoC}
                  onChange={(e) => setGiornoC(e.target.value)}
                />
              </label>
              <label>
                Mese
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={meseC}
                  onChange={(e) => setMeseC(e.target.value)}
                />
              </label>
              <label>
                Anno <span className="opzionale">(facoltativo)</span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={annoC}
                  onChange={(e) => setAnnoC(e.target.value)}
                  placeholder="—"
                />
              </label>
            </div>
          </fieldset>
          <label>
            Taglio abituale
            <textarea value={taglioAbituale} onChange={(e) => setTaglioAbituale(e.target.value)} rows={2} />
          </label>
          <label>
            Operatore preferito
            <select
              value={operatorePreferitoId}
              onChange={(e) => setOperatorePreferitoId(e.target.value)}
            >
              <option value="">—</option>
              {operatori.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>
          {errore ? <p className="errore">{errore}</p> : null}
          <button type="button" className="btn-salva-cliente" onClick={() => void salva()}>
            Salva
          </button>
        </div>

        <div className="cliente-scheda-info">
          {s ? (
            <>
              {s.ultimaVisita ? (
                <p className="cliente-info-riga">
                  <strong>Ultima volta:</strong> {giornoEsteso(s.ultimaVisita.data)} alle{' '}
                  {formattaOra(s.ultimaVisita.ora)}
                </p>
              ) : (
                <p className="cliente-info-riga cliente-info-mancante">
                  <strong>Ultima volta:</strong> —
                </p>
              )}
              {s.prossimo ? (
                <p className="cliente-info-riga">
                  <strong>Prossimo appuntamento:</strong> {giornoEsteso(s.prossimo.data)} alle{' '}
                  {formattaOra(s.prossimo.ora)}
                </p>
              ) : null}
              {s.servizioAbituale || s.operatoreAbituale ? (
                <p className="cliente-info-riga">
                  <strong>Di solito:</strong>{' '}
                  {[s.servizioAbituale?.nome, s.operatoreAbituale?.nome].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              {s.ogniQuantiGiorni !== undefined ? (
                <p className="cliente-info-riga">
                  <strong>Viene ogni circa</strong> {Math.max(1, Math.round(s.ogniQuantiGiorni / 7))} settimane
                </p>
              ) : null}
              {s.compleanno ? (
                <p className="cliente-info-riga">
                  <strong>Prossimo compleanno:</strong> {formattaDataLunga(s.compleanno.data)}
                  {s.compleanno.anni !== undefined ? ` (${s.compleanno.anni} anni)` : ''}
                </p>
              ) : null}
            </>
          ) : null}

          <InviaRiepilogoCliente clienteId={cliente.id} />

          {s && s.debitiAperti.length > 0 ? (
            <section className="cliente-debiti">
              <h2>Conti aperti</h2>
              <ul className="cliente-debiti-lista">
                {s.debitiAperti.map((d: Debito) => (
                  <li key={d.id}>
                    <span className="tabular-nums">{formattaEuro(d.importoCent)}</span>
                    <span> · {formattaDataLunga(d.data)}</span>
                    {d.nota ? <span className="cliente-debiti-nota"> — {d.nota}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <h2>Storico appuntamenti</h2>
          <ul className="storico-lista">
            {(storico ?? []).map((a) => (
              <li key={a.id}>
                {formattaDataLunga(a.data)}, {formattaOra(a.ora)} · {a.stato}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function giornoIniziale(compleanno?: string): string {
  const p = compleanno ? parseCompleanno(compleanno) : null
  return p ? String(p.giorno) : ''
}

function meseIniziale(compleanno?: string): string {
  const p = compleanno ? parseCompleanno(compleanno) : null
  return p ? String(p.mese) : ''
}

function annoIniziale(compleanno?: string): string {
  const p = compleanno ? parseCompleanno(compleanno) : null
  return p?.anno !== undefined ? String(p.anno) : ''
}
