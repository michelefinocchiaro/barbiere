import './Sidebar.css'

export type VoceNav = 'agenda' | 'promemoria' | 'clienti' | 'impostazioni'

interface Props {
  attiva: VoceNav
  onNaviga: (v: VoceNav) => void
  badgePromemoria: number | undefined
  logo: string
}

const VOCI: { id: VoceNav; etichetta: string }[] = [
  { id: 'agenda', etichetta: 'Agenda' },
  { id: 'promemoria', etichetta: 'Promemoria' },
  { id: 'clienti', etichetta: 'Clienti' },
  { id: 'impostazioni', etichetta: 'Impostazioni' },
]

export function Sidebar({ attiva, onNaviga, badgePromemoria, logo }: Props) {
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
              {v.etichetta}
              {v.id === 'promemoria' && badgePromemoria !== undefined && badgePromemoria > 0 ? (
                <span className="sidebar-badge" aria-label={`${badgePromemoria} da inviare`}>
                  {badgePromemoria}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
