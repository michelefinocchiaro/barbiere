import type { Avviso } from '../../core'
import './AvvisiFascia.css'

interface Props {
  avvisi: Avviso[]
  onSalvaComunque: () => void
  onCambia: () => void
}

export function AvvisiFascia({ avvisi, onSalvaComunque, onCambia }: Props) {
  if (avvisi.length === 0) return null
  return (
    <div className="avvisi-fascia" role="alert">
      <ul>
        {avvisi.map((a, i) => (
          <li key={i}>{a.messaggio}</li>
        ))}
      </ul>
      <div className="avvisi-azioni">
        <button type="button" className="btn-secondario" onClick={onCambia}>
          Cambia
        </button>
        <button type="button" className="btn-primario" onClick={onSalvaComunque}>
          Salva comunque
        </button>
      </div>
    </div>
  )
}
