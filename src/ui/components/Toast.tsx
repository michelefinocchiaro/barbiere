import { useEffect, useState } from 'react'
import './Toast.css'

export interface ToastAzione {
  messaggio: string
  annulla?: () => void | Promise<void>
}

interface Props {
  azione: ToastAzione | null
  onFine: () => void
}

const DURATA_MS = 6000

export function Toast({ azione, onFine }: Props) {
  const [visibile, setVisibile] = useState(false)

  useEffect(() => {
    if (!azione) {
      setVisibile(false)
      return
    }
    setVisibile(true)
    const t = window.setTimeout(() => {
      setVisibile(false)
      onFine()
    }, DURATA_MS)
    return () => window.clearTimeout(t)
  }, [azione, onFine])

  if (!azione || !visibile) return null

  return (
    <div className="toast" role="status">
      <span>{azione.messaggio}</span>
      {azione.annulla ? (
        <button
          type="button"
          className="toast-annulla"
          onClick={() => {
            void Promise.resolve(azione.annulla?.()).finally(() => {
              setVisibile(false)
              onFine()
            })
          }}
        >
          Annulla
        </button>
      ) : null}
    </div>
  )
}
