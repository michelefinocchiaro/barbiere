import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fraseDelMomento, leggiImpostazioni, oggi } from '../../core'
import { PaloBarbiere } from './PaloBarbiere'

interface Props {
  className?: string
}

export function Caricamento({ className }: Props) {
  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const frase = useMemo(() => {
    if (!imp) return 'Un attimo…'
    return fraseDelMomento('caricamento', { data: oggi() }, imp)
  }, [imp])

  return (
    <div className={`caricamento-palo${className ? ` ${className}` : ''}`} role="status">
      <PaloBarbiere variant="verticale" />
      <p className="caricamento-frase">{frase}</p>
    </div>
  )
}
