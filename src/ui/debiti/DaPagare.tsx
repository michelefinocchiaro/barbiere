import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { RigaDebito } from '../../core'
import {
  debitiAperti,
  eliminaDebito,
  formattaEuro,
  leggiEuro,
  leggiImpostazioni,
  modificaDebito,
  segnaDaPagare,
  segnaPagato,
  totaleDaPagare,
} from '../../core'
import { PaloBarbiere } from '../components/PaloBarbiere'
import type { ToastAzione } from '../components/Toast'
import { Caricamento } from '../components/Caricamento'
import { formattaDataLunga } from '../utils/dateUi'
import { ModuloSegnaDaPagare } from './ModuloSegnaDaPagare'
import './DaPagare.css'

interface Props {
  onToast: (t: ToastAzione) => void
}

export function DaPagare({ onToast }: Props) {
  const [mostraModulo, setMostraModulo] = useState(false)
  const [modifica, setModifica] = useState<RigaDebito | null>(null)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [importoMod, setImportoMod] = useState('')
  const [notaMod, setNotaMod] = useState('')
  const [erroreMod, setErroreMod] = useState('')

  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const righe = useLiveQuery(() => debitiAperti(), [])
  const totale = useLiveQuery(() => totaleDaPagare(), [])

  if (!imp || righe === undefined || totale === undefined) {
    return <Caricamento className="debiti-caricamento" />
  }

  const apriModifica = (r: RigaDebito) => {
    setModifica(r)
    setImportoMod(formattaEuro(r.debito.importoCent).replace(' €', ''))
    setNotaMod(r.debito.nota ?? '')
    setConfermaElimina(false)
    setErroreMod('')
  }

  const chiudiModifica = () => {
    setModifica(null)
    setConfermaElimina(false)
    setErroreMod('')
  }

  const salvaModifica = async () => {
    if (!modifica) return
    const cent = leggiEuro(importoMod)
    if (cent === null) {
      setErroreMod("Scrivi l'importo, per esempio 15 o 12,50")
      return
    }
    await modificaDebito(modifica.debito.id, {
      importoCent: cent,
      nota: notaMod.trim() || undefined,
    })
    onToast({ messaggio: 'Modifica salvata' })
    chiudiModifica()
  }

  const elimina = async () => {
    if (!modifica) return
    const copia = modifica.debito
    await eliminaDebito(modifica.debito.id)
    onToast({
      messaggio: 'Voce eliminata',
      annulla: () => {
        void segnaDaPagare({
          clienteId: copia.clienteId,
          importoCent: copia.importoCent,
          data: copia.data,
          nota: copia.nota,
          appuntamentoId: copia.appuntamentoId,
        })
      },
    })
    chiudiModifica()
  }

  const haPagato = async (r: RigaDebito) => {
    await segnaPagato(r.debito.id, true)
    onToast({
      messaggio: `${r.cliente.nome} ha pagato`,
      annulla: () => segnaPagato(r.debito.id, false),
    })
  }

  const etichettaClienti =
    totale.clienti === 0
      ? null
      : totale.clienti === 1
        ? 'da 1 cliente'
        : `da ${totale.clienti} clienti`

  return (
    <div className="da-pagare">
      <header className="debiti-intestazione">
        <h1 className="font-titolo">Da pagare</h1>
        {totale.voci > 0 ? (
          <div className="debiti-totale">
            <p className="debiti-etichetta-incassare">Da incassare</p>
            <p className="debiti-importo-grande font-titolo tabular-nums">
              {formattaEuro(totale.totaleCent)}
            </p>
            {etichettaClienti ? <p className="debiti-sotto-totale">{etichettaClienti}</p> : null}
          </div>
        ) : null}
      </header>

      {righe.length === 0 ? (
        <div className="debiti-vuoto">
          <PaloBarbiere variant="festa" />
          <p className="debiti-vuoto-frase font-titolo">Tutti in regola. Nessuno deve niente 💈</p>
        </div>
      ) : (
        <ul className="debiti-lista">
          {righe.map((r) => (
            <li key={r.debito.id} className="debiti-riga">
              <button type="button" className="debiti-riga-tap" onClick={() => apriModifica(r)}>
                <div className="debiti-riga-info">
                  <span className="debiti-cliente-nome">{r.cliente.nome}</span>
                  <span className="debiti-data-servizio">{formattaDataLunga(r.debito.data)}</span>
                  {r.debito.nota ? <span className="debiti-nota">{r.debito.nota}</span> : null}
                </div>
                <span className="debiti-importo tabular-nums">{formattaEuro(r.debito.importoCent)}</span>
              </button>
              <button type="button" className="btn-ha-pagato" onClick={() => void haPagato(r)}>
                Ha pagato
              </button>
            </li>
          ))}
        </ul>
      )}

      {!mostraModulo && !modifica ? (
        <div className="debiti-piede">
          <button type="button" className="btn-primario btn-segna-debito" onClick={() => setMostraModulo(true)}>
            + Segna da pagare
          </button>
        </div>
      ) : null}

      {mostraModulo ? (
        <div className="debiti-modulo-wrap">
          <ModuloSegnaDaPagare
            imp={imp}
            onChiudi={() => setMostraModulo(false)}
            onToast={onToast}
          />
        </div>
      ) : null}

      {modifica ? (
        <div className="debiti-modifica" role="dialog" aria-labelledby="debiti-modifica-titolo">
          <h3 id="debiti-modifica-titolo">{modifica.cliente.nome}</h3>
          <label className="campo">
            Importo
            <input
              type="text"
              inputMode="decimal"
              value={importoMod}
              onChange={(e) => setImportoMod(e.target.value)}
            />
          </label>
          <label className="campo">
            Nota
            <input value={notaMod} onChange={(e) => setNotaMod(e.target.value)} />
          </label>
          {erroreMod ? <p className="errore-debito" role="alert">{erroreMod}</p> : null}
          <div className="debiti-modifica-azioni">
            <button type="button" className="btn-primario" onClick={() => void salvaModifica()}>
              Salva
            </button>
            <button type="button" onClick={chiudiModifica}>
              Chiudi
            </button>
          </div>
          {!confermaElimina ? (
            <button type="button" className="btn-pericolo" onClick={() => setConfermaElimina(true)}>
              Elimina
            </button>
          ) : (
            <div className="conferma-elimina-debito">
              <span>Eliminare questa voce?</span>
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
    </div>
  )
}
