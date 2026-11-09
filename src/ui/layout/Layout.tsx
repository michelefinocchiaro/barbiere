import type { ReactNode } from 'react'
import type { ISODate } from '../../core'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  blocchiDelGiorno,
  leggiImpostazioni,
  oggi,
  prossimoGiornoApertura,
  riepilogo,
} from '../../core'
import { BackupBanner } from '../components/BackupBanner'
import { DemoFascia } from '../components/DemoFascia'
import { Sidebar, type VoceNav } from './Sidebar'
import './Layout.css'

interface Props {
  voce: VoceNav
  onNaviga: (v: VoceNav) => void
  children: ReactNode
}

export function Layout({ voce, onNaviga, children }: Props) {
  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const oggiIso: ISODate | null = imp ? oggi() : null

  const badge = useLiveQuery(async () => {
    if (!imp || !oggiIso) return 0
    const blocchi = await blocchiDelGiorno(oggiIso)
    const prossimo = prossimoGiornoApertura(oggiIso, imp, blocchi)
    const r = await riepilogo(prossimo)
    return r.daInviare
  }, [imp, oggiIso])

  const logoUrl = imp?.logo ? `${import.meta.env.BASE_URL}${imp.logo}` : ''

  return (
    <div className="app-shell">
      {logoUrl ? (
        <header className="app-topbar">
          <img className="app-topbar-logo" src={logoUrl} alt="" width={120} height={36} />
        </header>
      ) : null}
      <Sidebar
        attiva={voce}
        onNaviga={onNaviga}
        badgePromemoria={badge}
        logo={logoUrl}
      />
      <main className="app-main">
        {imp?.demoAttiva ? <DemoFascia /> : null}
        <BackupBanner />
        {children}
      </main>
    </div>
  )
}
