import { useState } from 'react'
import { svuotaTutto } from '../../core'
import './DemoFascia.css'

interface Props {
  onSvuotato?: () => void
}

export function DemoFascia({ onSvuotato }: Props) {
  const [conferma, setConferma] = useState(false)

  const svuota = async () => {
    await svuotaTutto()
    setConferma(false)
    onSvuotato?.()
  }

  return (
    <div className="demo-fascia" role="status">
      {conferma ? (
        <div className="demo-fascia-conferma">
          <span>Svuotare tutti i dati di esempio?</span>
          <button type="button" onClick={() => void svuota()}>
            Sì, svuota
          </button>
          <button type="button" onClick={() => setConferma(false)}>
            Annulla
          </button>
        </div>
      ) : (
        <>
          <span>Appuntamenti di esempio ·</span>
          <button type="button" className="demo-fascia-azione" onClick={() => setConferma(true)}>
            Svuota e comincia
          </button>
        </>
      )}
    </div>
  )
}
