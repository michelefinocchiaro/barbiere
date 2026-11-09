import './Sidebar.css'

export type VoceNav = 'agenda' | 'promemoria' | 'clienti' | 'debiti' | 'impostazioni'

interface Props {
  attiva: VoceNav
  onNaviga: (v: VoceNav) => void
  badgePromemoria: number | undefined
  badgeDebiti: number | undefined
  logo: string
}

const VOCI: { id: VoceNav; etichetta: string }[] = [
  { id: 'agenda', etichetta: 'Agenda' },
  { id: 'promemoria', etichetta: 'Promemoria' },
  { id: 'clienti', etichetta: 'Clienti' },
  { id: 'debiti', etichetta: 'Da pagare' },
  { id: 'impostazioni', etichetta: 'Impostazioni' },
]

function IconaVoce({ voce }: { voce: VoceNav }) {
  switch (voce) {
    case 'agenda':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
      )
    case 'promemoria':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5H9l-4 3v-6.5A8.5 8.5 0 0110.5 3 8.5 8.5 0 0121 11.5z" />
        </svg>
      )
    case 'clienti':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )
    case 'debiti':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="13" rx="2" />
          <path d="M2 10h20M16 14h2" />
        </svg>
      )
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )
  }
}

export function Sidebar({ attiva, onNaviga, badgePromemoria, badgeDebiti, logo }: Props) {
  return (
    <nav className="sidebar" aria-label="Menu principale">
      {logo ? (
        <img className="sidebar-logo" src={logo} alt="" width={160} height={48} />
      ) : null}
      <ul className="sidebar-voci">
        {VOCI.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={`sidebar-voce${attiva === v.id ? ' attiva' : ''}`}
              onClick={() => onNaviga(v.id)}
              aria-current={attiva === v.id ? 'page' : undefined}
            >
              <span className="sidebar-icona" aria-hidden>
                <IconaVoce voce={v.id} />
              </span>
              <span className="sidebar-etichetta">{v.etichetta}</span>
              {v.id === 'promemoria' && badgePromemoria !== undefined && badgePromemoria > 0 ? (
                <span className="sidebar-badge" aria-label={`${badgePromemoria} da inviare`}>
                  {badgePromemoria}
                </span>
              ) : null}
              {v.id === 'debiti' && badgeDebiti !== undefined && badgeDebiti > 0 ? (
                <span className="sidebar-badge" aria-label={`${badgeDebiti} da incassare`}>
                  {badgeDebiti}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
