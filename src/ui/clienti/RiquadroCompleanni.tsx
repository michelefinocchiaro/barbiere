import { useLiveQuery } from 'dexie-react-hooks'
import type { RigaCompleanno } from '../../core'
import { addDays, compleanniTra, fineMese, oggi, segnaAuguri } from '../../core'
import { formattaDataLunga } from '../utils/dateUi'
import type { ToastAzione } from '../components/Toast'
import './RiquadroCompleanni.css'

export function RiquadroCompleanni({ onToast }: { onToast?: (t: ToastAzione) => void }) {
  const oggiIso = oggi()
  const fine7 = addDays(oggiIso, 7)
  const fineM = fineMese(oggiIso)

  const oggiLista = useLiveQuery(() => compleanniTra(oggiIso, oggiIso), [oggiIso])
  const prossimi7 = useLiveQuery(() => compleanniTra(addDays(oggiIso, 1), fine7), [oggiIso, fine7])
  const nelMese = useLiveQuery(
    () => compleanniTra(addDays(fine7, 1), fineM),
    [oggiIso, fine7, fineM],
  )

  const faiAuguri = async (r: RigaCompleanno) => {
    await segnaAuguri(r.cliente.id, true)
    onToast?.({
      messaggio: `Auguri segnati per ${r.cliente.nome}`,
      annulla: async () => {
        await segnaAuguri(r.cliente.id, false)
      },
    })
  }

  return (
    <section className="clienti-compleanni" aria-labelledby="clienti-compleanni-tit">
      <h2 id="clienti-compleanni-tit">Compleanni</h2>
      <Gruppo titolo="Oggi" righe={oggiLista ?? []} onAuguri={faiAuguri} />
      <Gruppo titolo="Prossimi 7 giorni" righe={prossimi7 ?? []} onAuguri={faiAuguri} />
      <Gruppo titolo="Questo mese" righe={nelMese ?? []} onAuguri={faiAuguri} />
    </section>
  )
}

function Gruppo({
  titolo,
  righe,
  onAuguri,
}: {
  titolo: string
  righe: RigaCompleanno[]
  onAuguri: (r: RigaCompleanno) => void
}) {
  if (righe.length === 0) return null
  return (
    <div className="compleanni-gruppo">
      <h3>{titolo}</h3>
      <ul>
        {righe.map((r) => (
          <li key={`${r.cliente.id}-${r.data}`} className={r.auguriFatti ? 'fatto' : ''}>
            <span className="compleanni-nome">
              {r.cliente.nome}
              {r.anni !== undefined ? ` · ${r.anni} anni` : ''}
            </span>
            <span className="compleanni-data">{formattaDataLunga(r.data)}</span>
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-auguri"
              onClick={() => void onAuguri(r)}
            >
              Fai gli auguri
            </a>
            {r.auguriFatti ? <span className="compleanni-spunta" aria-label="Auguri già fatti">✓</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
