import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente } from '../../core'
import {
  cercaClienti,
  formattaOra,
  formattaTelefono,
  leggiImpostazioni,
  normalizzaTelefono,
  salvaCliente,
  storicoCliente,
  tuttiIClienti,
} from '../../core'
import { formattaDataLunga } from '../utils/dateUi'
import './Clienti.css'

export function Clienti() {
  const [query, setQuery] = useState('')
  const [selezionato, setSelezionato] = useState<Cliente | null>(null)

  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const tutti = useLiveQuery(() => tuttiIClienti(), [])
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

        {selezionato ? (
          <div className="clienti-scheda-wrap">
            <button type="button" className="clienti-indietro" onClick={() => setSelezionato(null)}>
              ← Clienti
            </button>
            <SchedaCliente
              cliente={selezionato}
              prefisso={imp?.prefissoPredefinito ?? '39'}
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
  onSalvato,
}: {
  cliente: Cliente
  prefisso: string
  onSalvato: (c: Cliente) => void
}) {
  const [nome, setNome] = useState(cliente.nome)
  const [telefono, setTelefono] = useState(formattaTelefono(cliente.telefono))
  const [note, setNote] = useState(cliente.note ?? '')
  const [errore, setErrore] = useState('')

  const storico = useLiveQuery(() => storicoCliente(cliente.id), [cliente.id])

  const salva = async () => {
    const norm = normalizzaTelefono(telefono, prefisso)
    if (!norm) {
      setErrore('Numero non valido')
      return
    }
    const aggiornato: Cliente = {
      ...cliente,
      nome: nome.trim(),
      telefono: norm,
      note: note.trim() || undefined,
      aggiornatoIl: new Date().toISOString(),
    }
    await salvaCliente(aggiornato)
    onSalvato(aggiornato)
    setErrore('')
  }

  return (
    <div className="cliente-scheda">
      <label>
        Nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label>
        Telefono
        <input type="tel" inputMode="numeric" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </label>
      <label>
        Note
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      {errore ? <p className="errore">{errore}</p> : null}
      <button type="button" className="btn-salva-cliente" onClick={() => void salva()}>
        Salva
      </button>

      <h2>Storico appuntamenti</h2>
      <ul className="storico-lista">
        {(storico ?? []).map((a) => (
          <li key={a.id}>
            {formattaDataLunga(a.data)}, {formattaOra(a.ora)} · {a.stato}
          </li>
        ))}
      </ul>
    </div>
  )
}
