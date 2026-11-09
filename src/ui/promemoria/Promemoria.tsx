import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { EsitoPromemoria, ISODate, RigaPromemoria, Riepilogo, StatoAppuntamento } from '../../core'
import {
  blocchiDelGiorno,
  formattaOra,
  fraseDelMomento,
  impostaEsitoPromemoria,
  impostaStato,
  impostaTestoPromemoria,
  leggiImpostazioni,
  oggi,
  prossimoGiornoApertura,
  riepilogo,
  righePromemoria,
} from '../../core'
import type { ToastAzione } from '../components/Toast'
import { Caricamento } from '../components/Caricamento'
import { PaloBarbiere } from '../components/PaloBarbiere'
import { formattaDataBreve, inputDateVal } from '../utils/dateUi'
import './Promemoria.css'

interface Props {
  onToast: (t: ToastAzione) => void
}

export function Promemoria({ onToast }: Props) {
  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const [data, setData] = useState<ISODate | null>(null)

  useEffect(() => {
    if (!imp || data) return
    void (async () => {
      const o = oggi()
      const blocchi = await blocchiDelGiorno(o)
      setData(prossimoGiornoApertura(o, imp, blocchi))
    })()
  }, [imp, data])

  const righe = useLiveQuery(() => (data ? righePromemoria(data) : Promise.resolve([])), [data])
  const riep = useLiveQuery(() => (data ? riepilogo(data) : Promise.resolve(null)), [data])

  const festa = useMemo(() => {
    if (!riep || !imp || !data) return null
    if (riep.totale === 0) return null
    if (riep.daInviare > 0 || riep.inAttesa > 0) return null
    return fraseDelMomento('promemoria_finiti', { data }, imp)
  }, [riep, imp, data])

  if (!imp || !data) {
    return <Caricamento className="prom-caricamento" />
  }

  return (
    <div className="promemoria">
      <header className="prom-intestazione">
        <h1 className="font-titolo">
          Promemoria per <strong>{formattaDataBreve(data)}</strong>
        </h1>
        <label className="prom-data">
          <span className="sr-only">Cambia giorno</span>
          <input
            type="date"
            value={inputDateVal(data)}
            onChange={(e) => setData(e.target.value as ISODate)}
          />
        </label>
      </header>

      {riep ? <RiepilogoBar riepilogo={riep} /> : null}

      {festa ? (
        <div className="prom-festa">
          <PaloBarbiere variant="festa" />
          <p className="prom-festa-frase font-titolo">{festa}</p>
        </div>
      ) : (
        <ul className="prom-lista">
          {(righe ?? []).map((r) => (
            <RigaRow key={r.appuntamento.id} riga={r} onToast={onToast} />
          ))}
        </ul>
      )}
    </div>
  )
}

function etichettaConteggio(n: number, singolare: string, plurale: string): string | null {
  if (!n) return null
  return n === 1 ? `1 ${singolare}` : `${n} ${plurale}`
}

function RiepilogoBar({ riepilogo: r }: { riepilogo: Riepilogo }) {
  const parti = [
    etichettaConteggio(r.confermati, 'confermato', 'confermati'),
    etichettaConteggio(r.inAttesa, 'in attesa', 'in attesa'),
    etichettaConteggio(r.daInviare, 'da inviare', 'da inviare'),
    etichettaConteggio(r.inviati, 'inviato', 'inviati'),
    etichettaConteggio(r.avvisatiTelefono, 'avvisato al telefono', 'avvisati al telefono'),
    etichettaConteggio(r.nonServe, 'non serve', 'non serve'),
    etichettaConteggio(r.disdetti, 'disdetto', 'disdetti'),
  ].filter(Boolean)

  const fatto =
    r.totale > 0
      ? ((r.confermati + r.disdetti + r.nonServe + r.avvisatiTelefono) / r.totale) * 100
      : 0

  return (
    <div className="prom-riepilogo">
      <p>{parti.join(' · ') || 'Nessun appuntamento'}</p>
      <div className="prom-barra" role="progressbar" aria-valuenow={fatto} aria-valuemin={0} aria-valuemax={100}>
        <div className="prom-barra-fill" style={{ width: `${fatto}%` }} />
      </div>
    </div>
  )
}

function RigaRow({ riga, onToast }: { riga: RigaPromemoria; onToast: (t: ToastAzione) => void }) {
  const [espandiTesto, setEspandiTesto] = useState(false)
  const [testoMod, setTestoMod] = useState(riga.testo)
  const [confermaDisdetto, setConfermaDisdetto] = useState(false)
  const [menuAperto, setMenuAperto] = useState(false)

  const a = riga.appuntamento
  const ritoccato = Boolean(a.testoPromemoria)

  useEffect(() => setTestoMod(riga.testo), [riga.testo])

  const segnaInviato = async () => {
    const esitoPrima = a.promemoria
    await impostaEsitoPromemoria(a.id, 'inviato')
    onToast({
      messaggio: 'Promemoria segnato come inviato',
      annulla: () => impostaEsitoPromemoria(a.id, esitoPrima),
    })
  }

  const esitoAlternativo = async (esito: EsitoPromemoria) => {
    const prima = a.promemoria
    await impostaEsitoPromemoria(a.id, esito)
    onToast({
      messaggio: esito === 'avvisato_telefono' ? 'Segnato: avvisato al telefono' : 'Segnato: non serve',
      annulla: () => impostaEsitoPromemoria(a.id, prima),
    })
    setMenuAperto(false)
  }

  const cambiaStato = async (stato: StatoAppuntamento) => {
    const prima = a.stato
    await impostaStato(a.id, stato)
    onToast({
      messaggio: stato === 'confermato' ? 'Cliente confermato' : 'Appuntamento disdetto',
      annulla: () => impostaStato(a.id, prima),
    })
    setConfermaDisdetto(false)
  }

  const riapriEsito = async (esito: EsitoPromemoria) => {
    const prima = a.promemoria
    await impostaEsitoPromemoria(a.id, esito)
    onToast({
      messaggio: 'Esito promemoria aggiornato',
      annulla: () => impostaEsitoPromemoria(a.id, prima),
    })
  }

  const salvaTesto = async () => {
    const prima = a.testoPromemoria
    await impostaTestoPromemoria(a.id, testoMod)
    onToast({
      messaggio: 'Testo promemoria salvato',
      annulla: () => impostaTestoPromemoria(a.id, prima ?? null),
    })
    setEspandiTesto(false)
  }

  const ripristina = async () => {
    const prima = a.testoPromemoria
    await impostaTestoPromemoria(a.id, null)
    onToast({
      messaggio: 'Testo standard ripristinato',
      annulla: () => impostaTestoPromemoria(a.id, prima ?? null),
    })
    setEspandiTesto(false)
  }

  const servizio = riga.servizio?.nome ?? ''
  const chiuso =
    a.stato === 'confermato' ||
    a.promemoria === 'avvisato_telefono' ||
    a.promemoria === 'non_serve'

  return (
    <li className={`prom-riga${riga.inAttesa ? ' in-attesa' : ''}${chiuso ? ' chiusa' : ''}`}>
      <div className="prom-riga-info">
        <span className="prom-ora">{formattaOra(a.ora)}</span>
        <span className="prom-cliente">{riga.cliente.nome}</span>
        <span className="prom-dettagli">
          {servizio}
          {servizio && riga.operatore.nome ? ' · ' : ''}
          {riga.operatore.nome}
        </span>
      </div>

      <div className="prom-riga-azioni">
        {a.promemoria === 'da_inviare' ? (
          <>
            <a
              href={riga.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-invia"
              onClick={() => void segnaInviato()}
            >
              <IconWhatsApp /> Invia
            </a>
            <div className="menu-wrap">
              <button
                type="button"
                className="btn-menu"
                aria-expanded={menuAperto}
                onClick={() => setMenuAperto((v) => !v)}
              >
                ⋮
              </button>
              {menuAperto ? (
                <div className="menu-dropdown">
                  <button type="button" onClick={() => void esitoAlternativo('avvisato_telefono')}>
                    Avvisato al telefono
                  </button>
                  <button type="button" onClick={() => void esitoAlternativo('non_serve')}>
                    Non serve
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {riga.inAttesa ? (
          <>
            <button type="button" className="btn-conferma" onClick={() => void cambiaStato('confermato')}>
              Ha confermato
            </button>
            {!confermaDisdetto ? (
              <button type="button" className="btn-disdetto" onClick={() => setConfermaDisdetto(true)}>
                Ha disdetto
              </button>
            ) : (
              <div className="conferma-disdetto">
                <span>Libera lo spazio?</span>
                <button type="button" onClick={() => void cambiaStato('disdetto')}>
                  Sì
                </button>
                <button type="button" onClick={() => setConfermaDisdetto(false)}>
                  No
                </button>
              </div>
            )}
          </>
        ) : null}

        {chiuso && !riga.inAttesa ? (
          <button type="button" className="etichetta-chiusa" onClick={() => void riapriEsito('da_inviare')}>
            {a.stato === 'confermato'
              ? 'Confermato'
              : a.promemoria === 'avvisato_telefono'
                ? 'Avvisato al telefono'
                : 'Non serve'}
          </button>
        ) : null}
      </div>

      <div className="prom-testo-riga">
        <button
          type="button"
          className={`btn-modifica-testo${ritoccato ? ' ritoccato' : ''}`}
          onClick={() => setEspandiTesto((v) => !v)}
        >
          Modifica testo{ritoccato ? ' ✎' : ''}
        </button>
        {espandiTesto ? (
          <div className="prom-testo-editor">
            <textarea value={testoMod} onChange={(e) => setTestoMod(e.target.value)} rows={4} />
            <div className="prom-testo-azioni">
              <button type="button" onClick={() => void salvaTesto()}>
                Salva testo
              </button>
              <button type="button" onClick={() => void ripristina()}>
                Ripristina standard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function IconWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
