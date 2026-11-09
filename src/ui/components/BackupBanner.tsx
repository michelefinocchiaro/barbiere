import { useLiveQuery } from 'dexie-react-hooks'
import { giorniDallUltimoBackup, leggiImpostazioni, tuttiIClienti } from '../../core'
import './BackupBanner.css'

export function BackupBanner() {
  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const giorni = useLiveQuery(() => giorniDallUltimoBackup(), [])
  const nClienti = useLiveQuery(async () => (await tuttiIClienti()).length, [])

  if (imp?.demoAttiva) return null
  if (!nClienti) return null // niente da salvare ancora
  if (giorni === undefined) return null
  if (giorni !== null && giorni <= 7) return null

  const testo =
    giorni === null
      ? 'Non hai ancora fatto un backup dei dati.'
      : `Ultimo backup ${giorni} giorni fa — conviene esportarne uno nuovo.`

  return (
    <div className="backup-banner" role="status">
      <span className="backup-banner-breve">Backup consigliato — Impostazioni.</span>
      <span className="backup-banner-completo">
        {testo} <span className="backup-banner-hint">Vai in Impostazioni → Backup.</span>
      </span>
    </div>
  )
}
