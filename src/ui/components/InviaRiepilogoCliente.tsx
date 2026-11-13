import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { riepilogoCliente } from '../../core'
import './InviaRiepilogoCliente.css'

export function InviaRiepilogoCliente({ clienteId }: { clienteId: string }) {
  const riepilogo = useLiveQuery(() => riepilogoCliente(clienteId), [clienteId])
  const [anteprima, setAnteprima] = useState(false)

  if (!riepilogo || riepilogo.appuntamenti.length < 2) return null

  const n = riepilogo.appuntamenti.length

  return (
    <div className="invia-riepilogo">
      <button type="button" className="btn-messaggio-rapido" onClick={() => setAnteprima((v) => !v)}>
        Invia riepilogo ({n} appuntamenti)
      </button>
      {anteprima ? (
        <>
          <pre className="invia-riepilogo-anteprima">{riepilogo.testo}</pre>
          <a
            href={riepilogo.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primario invia-riepilogo-wa"
          >
            Apri WhatsApp
          </a>
        </>
      ) : null}
    </div>
  )
}
