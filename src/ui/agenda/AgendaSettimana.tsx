import { useMemo, useState } from 'react'
import type { Appuntamento, Blocco, Cliente, Impostazioni, ISODate, Operatore } from '../../core'
import { compleannoNelGiorno, formattaOra, giornoAperto, settimanaDi } from '../../core'
import { formattaDataBreve } from '../utils/dateUi'
import { coloreOperatore } from '../utils/coloreOperatore'
import './AgendaSettimana.css'

interface Props {
  imp: Impostazioni
  ancora: ISODate
  oggiIso: ISODate
  appuntamenti: Appuntamento[]
  blocchi: Blocco[]
  nascondiDisdetti: boolean
  mappaClienti: Map<string, Cliente>
  onGiorno: (data: ISODate) => void
  onAppuntamento: (a: Appuntamento) => void
  onImpegno: (b: Blocco) => void
  onNuovoAppuntamento: (data: ISODate) => void
  onNuovoImpegno: (data: ISODate) => void
}

type Voce =
  | { tipo: 'app'; app: Appuntamento; sort: string }
  | { tipo: 'impegno'; blocco: Blocco; sort: string }

function siglaOperatore(operatori: Operatore[], id: string): string {
  const nome = operatori.find((o) => o.id === id)?.nome ?? ''
  return nome.slice(0, 2).toUpperCase()
}

function vociGiorno(
  data: ISODate,
  appuntamenti: Appuntamento[],
  blocchi: Blocco[],
  nascondiDisdetti: boolean,
): Voce[] {
  const apps = appuntamenti
    .filter((a) => a.data === data)
    .filter((a) => (nascondiDisdetti ? a.stato !== 'disdetto' : true))
    .map((a) => ({ tipo: 'app' as const, app: a, sort: a.ora }))
  const imps = blocchi
    .filter((b) => b.data === data && b.tipo === 'impegno')
    .map((b) => ({ tipo: 'impegno' as const, blocco: b, sort: b.dalle ?? '00:00' }))
  return [...apps, ...imps].sort((x, y) => x.sort.localeCompare(y.sort))
}

function ColonnaGiorno({
  giorno,
  apertoNegozio,
  voci,
  oggi,
  nomeGiorno,
  operatori,
  imp,
  mappaClienti,
  onGiorno,
  onAppuntamento,
  onImpegno,
  onNuovoAppuntamento,
  onNuovoImpegno,
}: {
  giorno: ISODate
  apertoNegozio: boolean
  voci: Voce[]
  oggi: boolean
  nomeGiorno: string
  operatori: Operatore[]
  imp: Impostazioni
  mappaClienti: Map<string, Cliente>
  onGiorno: (data: ISODate) => void
  onAppuntamento: (a: Appuntamento) => void
  onImpegno: (b: Blocco) => void
  onNuovoAppuntamento: (data: ISODate) => void
  onNuovoImpegno: (data: ISODate) => void
}) {
  const [menuAperto, setMenuAperto] = useState(false)

  return (
    <section
      className={`agenda-sett-col${!apertoNegozio ? ' chiuso' : ''}${oggi ? ' oggi' : ''}`}
    >
      <header className="agenda-sett-intestazione">
        <div className="agenda-sett-intestazione-riga">
          <button type="button" className="agenda-sett-giorno-btn" onClick={() => onGiorno(giorno)}>
            <span className="agenda-sett-nome">{nomeGiorno}</span>
            <span className="agenda-sett-data font-tabular">{giorno.slice(8, 10)}</span>
          </button>
          <button
            type="button"
            className="agenda-sett-piu"
            aria-expanded={menuAperto}
            aria-label="Aggiungi"
            onClick={() => setMenuAperto((v) => !v)}
          >
            +
          </button>
        </div>
        {!apertoNegozio ? <span className="agenda-sett-chiuso">Chiuso</span> : null}
      </header>
      {menuAperto ? (
        <div className="agenda-sett-scelte" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuAperto(false)
              onNuovoAppuntamento(giorno)
            }}
          >
            Appuntamento
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuAperto(false)
              onNuovoImpegno(giorno)
            }}
          >
            Impegno
          </button>
        </div>
      ) : null}
      <ul className="agenda-sett-lista">
        {voci.map((v) => {
          if (v.tipo === 'app') {
            const a = v.app
            const record = mappaClienti.get(a.clienteId)
            const cliente = record?.nome ?? '…'
            const torta =
              record && compleannoNelGiorno(record.compleanno, giorno) ? ' 🎂' : ''
            const sigla = siglaOperatore(operatori, a.operatoreId)
            const colore = coloreOperatore(a.operatoreId, imp)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className={`agenda-sett-voce app${a.stato === 'disdetto' ? ' disdetto' : ''}${a.serieId ? ' serie' : ''}`}
                  style={{ borderLeft: `4px solid ${colore}` }}
                  onClick={() => onAppuntamento(a)}
                >
                  <span className="agenda-sett-ora font-tabular">{formattaOra(a.ora)}</span>
                  <span className="agenda-sett-cliente">
                    {a.serieId ? <span className="agenda-sett-serie-mark" aria-hidden>↻ </span> : null}
                    {cliente}
                    {torta}
                  </span>
                  <span className="agenda-sett-op" title={operatori.find((o) => o.id === a.operatoreId)?.nome}>
                    {sigla}
                  </span>
                </button>
              </li>
            )
          }
          const b = v.blocco
          return (
            <li key={b.id}>
              <button
                type="button"
                className="agenda-sett-voce impegno"
                onClick={() => onImpegno(b)}
              >
                <span className="agenda-sett-ora font-tabular">
                  {b.dalle ? formattaOra(b.dalle) : '—'}
                </span>
                <span className="agenda-sett-cliente">{b.motivo ?? 'Impegno'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function AgendaSettimana({
  imp,
  ancora,
  oggiIso,
  appuntamenti,
  blocchi,
  nascondiDisdetti,
  mappaClienti,
  onGiorno,
  onAppuntamento,
  onImpegno,
  onNuovoAppuntamento,
  onNuovoImpegno,
}: Props) {
  const giorni = useMemo(() => settimanaDi(ancora), [ancora])
  const operatori = useMemo(
    () => [...imp.operatori].filter((o) => o.attivo).sort((a, b) => a.ordine - b.ordine),
    [imp.operatori],
  )

  return (
    <div className="agenda-settimana">
      {giorni.map((giorno) => {
        const nomeGiorno = formattaDataBreve(giorno).split(' ')[0] ?? giorno
        return (
          <ColonnaGiorno
            key={giorno}
            giorno={giorno}
            nomeGiorno={nomeGiorno}
            apertoNegozio={giornoAperto(giorno, imp, blocchi)}
            voci={vociGiorno(giorno, appuntamenti, blocchi, nascondiDisdetti)}
            oggi={giorno === oggiIso}
            operatori={operatori}
            imp={imp}
            mappaClienti={mappaClienti}
            onGiorno={onGiorno}
            onAppuntamento={onAppuntamento}
            onImpegno={onImpegno}
            onNuovoAppuntamento={onNuovoAppuntamento}
            onNuovoImpegno={onNuovoImpegno}
          />
        )
      })}
    </div>
  )
}
