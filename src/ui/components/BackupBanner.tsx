import { useLiveQuery } from 'dexie-react-hooks'
import { giorniDallUltimoBackup } from '../../core'
import './BackupBanner.css'

export function BackupBanner() {
  const giorni = useLiveQuery(() => giorniDallUltimoBackup(), [])

  if (giorni === undefined) return null
  if (giorni !== null && giorni <= 7) return null

  const testo =
    giorni === null
      ? 'Non hai ancora fatto un backup dei dati.'
      : `Ultimo backup ${giorni} giorni fa — conviene esportarne uno nuovo.`

  return (
    <div className="backup-banner" role="status">
      {testo}{' '}
      <span className="backup-banner-hint">Vai in Impostazioni → Backup.</span>
    </div>
  )
}
