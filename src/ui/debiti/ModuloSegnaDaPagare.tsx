import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Cliente, Impostazioni, ISODate } from '../../core'
import {
  cercaClienti,
  eliminaDebito,
  formattaTelefono,
  leggiEuro,
  normalizzaTelefono,
  oggi,
  segnaDaPagare,
  trovaOCreaCliente,
} from '../../core'
import type { ToastAzione } from '../components/Toast'
import { inputDateVal } from '../utils/dateUi'

export interface InizialeModuloDebito {
  cliente?: Cliente | null
  data?: ISODate
  appuntamentoId?: string
  importo?: string
  nota?: string
}

export interface ModuloSegnaDaPagareHandle {
  salva: () => Promise<void>
}

interface Props {
  imp: Impostazioni
  onChiudi: () => void
  onToast: (t: ToastAzione) => void
  iniziale?: InizialeModuloDebito
  /** Nel pannello appuntamento: niente titolo né pulsanti nel modulo (salva nel piede). */
  daPannello?: boolean
}

export const ModuloSegnaDaPagare = forwardRef<ModuloSegnaDaPagareHandle, Props>(
  function ModuloSegnaDaPagare({ imp, onChiudi, onToast, iniziale, daPannello }, ref) {
    const [queryCliente, setQueryCliente] = useState(iniziale?.cliente?.nome ?? '')
    const [clienteSel, setClienteSel] = useState<Cliente | null>(iniziale?.cliente ?? null)
    const [mostraNuovo, setMostraNuovo] = useState(false)
    const [nomeNuovo, setNomeNuovo] = useState('')
    const [telNuovo, setTelNuovo] = useState('')
    const [importo, setImporto] = useState(iniziale?.importo ?? '')
    const [nota, setNota] = useState(iniziale?.nota ?? '')
    const [data, setData] = useState<ISODate>(iniziale?.data ?? oggi())
    const [errore, setErrore] = useState('')
    const [inSalvataggio, setInSalvataggio] = useState(false)

    const campoRef = useRef<HTMLInputElement>(null)

    const suggerimenti = useLiveQuery(
      () => (queryCliente.trim().length >= 1 ? cercaClienti(queryCliente) : Promise.resolve([])),
      [queryCliente],
    )

    useEffect(() => {
      campoRef.current?.focus()
    }, [])

    const creaCliente = async () => {
      const norm = normalizzaTelefono(telNuovo, imp.prefissoPredefinito)
      if (!nomeNuovo.trim() || !norm) {
        setErrore('Nome e telefono validi richiesti')
        return
      }
      let c
      try {
        c = await trovaOCreaCliente(nomeNuovo.trim(), telNuovo)
      } catch {
        setErrore('Telefono non valido')
        return
      }
      setClienteSel(c)
      setQueryCliente(c.nome)
      setMostraNuovo(false)
      setErrore('')
    }

    const salva = useCallback(async () => {
      if (!clienteSel) {
        setErrore('Scegli un cliente')
        return
      }
      const cent = leggiEuro(importo)
      if (cent === null) {
        setErrore("Scrivi l'importo, per esempio 15 o 12,50")
        return
      }
      setInSalvataggio(true)
      try {
        const debito = await segnaDaPagare({
          clienteId: clienteSel.id,
          importoCent: cent,
          data,
          nota: nota.trim() || undefined,
          appuntamentoId: iniziale?.appuntamentoId,
        })
        onToast({
          messaggio: 'Segnato da pagare',
          annulla: () => eliminaDebito(debito.id),
        })
        onChiudi()
      } catch {
        setErrore("Scrivi l'importo, per esempio 15 o 12,50")
      } finally {
        setInSalvataggio(false)
      }
    }, [clienteSel, importo, data, nota, iniziale?.appuntamentoId, onToast, onChiudi])

    useImperativeHandle(ref, () => ({ salva }), [salva])

    return (
      <div
        className="modulo-debito"
        role={daPannello ? undefined : 'dialog'}
        aria-labelledby={daPannello ? undefined : 'modulo-debito-titolo'}
      >
        {!daPannello ? <h3 id="modulo-debito-titolo">Segna da pagare</h3> : null}

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

        <label className="campo">
          Importo
          <input
            type="text"
            inputMode="decimal"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            placeholder="es. 15 o 12,50"
          />
        </label>

        <label className="campo">
          Nota <span className="opzionale">(facoltativa)</span>
          <input value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>

        <label className="campo">
          Giorno del servizio
          <input
            type="date"
            value={inputDateVal(data)}
            onChange={(e) => setData(e.target.value as ISODate)}
          />
        </label>

        {errore ? (
          <p className="errore-debito" role="alert">
            {errore}
          </p>
        ) : null}

        {!daPannello ? (
          <div className="modulo-debito-azioni">
            <button
              type="button"
              className="btn-primario"
              disabled={inSalvataggio}
              onClick={() => void salva()}
            >
              Salva da pagare
            </button>
            <button type="button" onClick={onChiudi}>
              Annulla
            </button>
          </div>
        ) : null}
      </div>
    )
  },
)
