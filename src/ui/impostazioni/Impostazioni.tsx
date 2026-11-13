import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Blocco, HHMM, Impostazioni, ISODate, Operatore, Servizio } from '../../core'
import {
  blocchiDelGiorno,
  caricaDatiDemo,
  componiPromemoria,
  eliminaBlocco,
  esportaBackup,
  formattaOra,
  importaBackup,
  leggiImpostazioni,
  oggi,
  prossimoGiornoApertura,
  quando,
  salvaBlocco,
  salvaImpostazioni,
  svuotaTutto,
} from '../../core'
import { Caricamento } from '../components/Caricamento'
import { inputDateVal } from '../utils/dateUi'
import './Impostazioni.css'

function slugBackup(nomeNegozio: string): string {
  return nomeNegozio
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'backup'
}

const SEGNAPOSTO = ['{quando}', '{ora}', '{nome}', '{operatore}', '{servizio}'] as const

export function ImpostazioniSchermata() {
  const impDb = useLiveQuery(() => leggiImpostazioni(), [])
  const [imp, setImp] = useState<Impostazioni | null>(null)
  const [bloccoData, setBloccoData] = useState<ISODate>(() => oggi())
  const blocchi = useLiveQuery(() => blocchiDelGiorno(bloccoData), [bloccoData])
  const fileRef = useRef<HTMLInputElement>(null)
  const [confermaImport, setConfermaImport] = useState<File | null>(null)
  const [erroreImport, setErroreImport] = useState<string | null>(null)
  const [confermaDemo, setConfermaDemo] = useState<'demo' | 'svuota' | null>(null)

  useEffect(() => {
    if (impDb) setImp(structuredClone(impDb))
  }, [impDb])

  const blocchiOggi = useLiveQuery(() => blocchiDelGiorno(oggi()), [])

  if (!imp) {
    return <Caricamento className="imp-caricamento" />
  }

  const primoOperatore = [...imp.operatori]
    .filter((o) => o.attivo)
    .sort((a, b) => a.ordine - b.ordine)[0]
  const dataAnteprima =
    blocchiOggi !== undefined
      ? prossimoGiornoApertura(oggi(), imp, blocchiOggi ?? [])
      : prossimoGiornoApertura(oggi(), imp, [])
  const anteprima = componiPromemoria(imp.testoPromemoria, {
    quando: quando(dataAnteprima, oggi()),
    ora: formattaOra('08:15'),
    nome: 'Cliente Esempio',
    operatore: primoOperatore?.nome ?? '',
    servizio: imp.servizi[0]?.nome ?? '',
  })

  const inserisciSegnaposto = (seg: string) => {
    setImp((i) => (i ? { ...i, testoPromemoria: i.testoPromemoria + seg } : i))
  }

  const salva = async () => {
    await salvaImpostazioni(imp)
  }

  const esporta = async () => {
    const blob = await esportaBackup()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-${slugBackup(imp.nomeNegozio)}-${oggi()}.json`
    a.click()
    URL.revokeObjectURL(url)
    if (navigator.canShare?.({ files: [new File([blob], 'backup.json')] })) {
      try {
        const file = new File([blob], `backup-${oggi()}.json`, { type: 'application/json' })
        await navigator.share({ files: [file], title: 'Backup agenda' })
      } catch {
        /* utente ha annullato */
      }
    }
  }

  const importa = async (file: File) => {
    setErroreImport(null)
    try {
      await importaBackup(file)
      setConfermaImport(null)
      setImp(await leggiImpostazioni())
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import non riuscito'
      setErroreImport(msg)
    }
  }

  const nuovoBlocco = async () => {
    await salvaBlocco({
      operatoreId: null,
      data: bloccoData,
      motivo: 'Chiusura',
    })
  }

  const aggiornaOperatore = (id: string, patch: Partial<Operatore>) => {
    setImp((i) =>
      i
        ? {
            ...i,
            operatori: i.operatori.map((o) => (o.id === id ? { ...o, ...patch } : o)),
          }
        : i,
    )
  }

  const aggiornaServizio = (id: string, patch: Partial<Servizio>) => {
    setImp((i) =>
      i ? { ...i, servizi: i.servizi.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : i,
    )
  }

  return (
    <div className="impostazioni">
      <header className="imp-intestazione">
        <h1>Impostazioni</h1>
        <button type="button" className="btn-salva-imp" onClick={() => void salva()}>
          Salva impostazioni
        </button>
      </header>

      <div className="imp-sezioni">
        <section className="imp-sezione">
          <h2>Testo del promemoria</h2>
          <textarea
            className="imp-testo"
            rows={5}
            value={imp.testoPromemoria}
            onChange={(e) => setImp({ ...imp, testoPromemoria: e.target.value })}
          />
          <div className="imp-segnaposto">
            {SEGNAPOSTO.map((s) => (
              <button key={s} type="button" onClick={() => inserisciSegnaposto(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="imp-anteprima">
            <span className="imp-anteprima-etichetta">Anteprima WhatsApp</span>
            <pre>{anteprima}</pre>
          </div>
        </section>

        <section className="imp-sezione">
          <h2>Messaggi rapidi</h2>
          <p className="imp-nota">Dal pannello appuntamento. Segnaposto: {'{nome}'}, {'{ora}'}, {'{ora_dopo}'}, {'{quando}'}.</p>
          <ul className="imp-lista-messaggi">
            {(imp.messaggiRapidi ?? []).map((m) => (
              <li key={m.id}>
                <label>
                  Etichetta
                  <input
                    value={m.etichetta}
                    onChange={(e) => {
                      const lista = (imp.messaggiRapidi ?? []).map((x) =>
                        x.id === m.id ? { ...x, etichetta: e.target.value } : x,
                      )
                      setImp({ ...imp, messaggiRapidi: lista })
                    }}
                  />
                </label>
                <label>
                  Testo WhatsApp
                  <textarea
                    rows={3}
                    value={m.testo}
                    onChange={(e) => {
                      const lista = (imp.messaggiRapidi ?? []).map((x) =>
                        x.id === m.id ? { ...x, testo: e.target.value } : x,
                      )
                      setImp({ ...imp, messaggiRapidi: lista })
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="imp-sezione">
          <h2>Testo riepilogo appuntamenti</h2>
          <p className="imp-nota">Per clienti con almeno 2 appuntamenti futuri. Segnaposto: {'{elenco}'}.</p>
          <textarea
            className="imp-testo"
            rows={5}
            value={imp.testoRiepilogo ?? ''}
            onChange={(e) => setImp({ ...imp, testoRiepilogo: e.target.value })}
          />
        </section>

        <section className="imp-sezione">
          <h2>Testo auguri di compleanno</h2>
          <p className="imp-nota">Segnaposto: {'{nome}'}.</p>
          <textarea
            className="imp-testo"
            rows={4}
            value={imp.testoAuguri ?? ''}
            onChange={(e) => setImp({ ...imp, testoAuguri: e.target.value })}
          />
        </section>

        <section className="imp-sezione">
          <h2>Orari</h2>
          <div className="imp-riga">
            <label>
              Apre
              <input
                type="time"
                value={imp.apre}
                onChange={(e) => setImp({ ...imp, apre: e.target.value as HHMM })}
              />
            </label>
            <label>
              Chiude
              <input
                type="time"
                value={imp.chiude}
                onChange={(e) => setImp({ ...imp, chiude: e.target.value as HHMM })}
              />
            </label>
            <label>
              Passo griglia (min)
              <input
                type="number"
                min={5}
                step={5}
                value={imp.passoGrigliaMin}
                onChange={(e) => setImp({ ...imp, passoGrigliaMin: Number(e.target.value) })}
              />
            </label>
          </div>
          <fieldset className="imp-giorni">
            <legend>Giorni di apertura</legend>
            {[
              [0, 'Dom'],
              [1, 'Lun'],
              [2, 'Mar'],
              [3, 'Mer'],
              [4, 'Gio'],
              [5, 'Ven'],
              [6, 'Sab'],
            ].map(([d, etichetta]) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={imp.giorniApertura.includes(d as number)}
                  onChange={(e) => {
                    const set = new Set(imp.giorniApertura)
                    if (e.target.checked) set.add(d as number)
                    else set.delete(d as number)
                    setImp({ ...imp, giorniApertura: [...set].sort() })
                  }}
                />
                {etichetta}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="imp-sezione">
          <h2>Operatori</h2>
          <ul className="imp-lista-edit">
            {imp.operatori.map((o) => (
              <li key={o.id}>
                <input value={o.nome} onChange={(e) => aggiornaOperatore(o.id, { nome: e.target.value })} />
                <label className="imp-check">
                  <input
                    type="checkbox"
                    checked={o.attivo}
                    onChange={(e) => aggiornaOperatore(o.id, { attivo: e.target.checked })}
                  />
                  Attivo
                </label>
                <input
                  type="number"
                  className="imp-ordine"
                  value={o.ordine}
                  onChange={(e) => aggiornaOperatore(o.id, { ordine: Number(e.target.value) })}
                  aria-label="Ordine"
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="imp-aggiungi"
            onClick={() =>
              setImp({
                ...imp,
                operatori: [
                  ...imp.operatori,
                  {
                    id: crypto.randomUUID(),
                    nome: 'Nuovo operatore',
                    attivo: true,
                    ordine: imp.operatori.length,
                  },
                ],
              })
            }
          >
            Aggiungi operatore
          </button>
        </section>

        <section className="imp-sezione">
          <h2>Servizi</h2>
          <ul className="imp-lista-edit">
            {imp.servizi.map((s) => (
              <li key={s.id}>
                <input value={s.nome} onChange={(e) => aggiornaServizio(s.id, { nome: e.target.value })} />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={s.durataMin}
                  onChange={(e) => aggiornaServizio(s.id, { durataMin: Number(e.target.value) })}
                  aria-label="Durata minuti"
                />
                <span className="imp-min">min</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="imp-aggiungi"
            onClick={() =>
              setImp({
                ...imp,
                servizi: [
                  ...imp.servizi,
                  {
                    id: crypto.randomUUID(),
                    nome: 'Nuovo servizio',
                    durataMin: 30,
                    ordine: imp.servizi.length,
                  },
                ],
              })
            }
          >
            Aggiungi servizio
          </button>
        </section>

        <section className="imp-sezione">
          <h2>Pause e assenze</h2>
          <label>
            Giorno
            <input
              type="date"
              value={inputDateVal(bloccoData)}
              onChange={(e) => setBloccoData(e.target.value as ISODate)}
            />
          </label>
          <button type="button" className="imp-aggiungi" onClick={() => void nuovoBlocco()}>
            Aggiungi blocco (tutto il negozio)
          </button>
          <ul className="imp-blocchi">
            {(blocchi ?? []).map((b) => (
              <BloccoRiga key={b.id} blocco={b} onElimina={() => void eliminaBlocco(b.id)} />
            ))}
          </ul>
        </section>

        <section className="imp-sezione">
          <h2>Backup</h2>
          <div className="imp-backup-azioni">
            <button type="button" className="btn-salva-imp" onClick={() => void esporta()}>
              Esporta
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Importa
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setErroreImport(null)
                  setConfermaImport(f)
                }
              }}
            />
          </div>
          {erroreImport ? <p className="imp-errore-import">{erroreImport}</p> : null}
          {confermaImport ? (
            <div className="imp-conferma">
              <p>Importare sostituisce tutti i dati. Continuare?</p>
              <button type="button" onClick={() => void importa(confermaImport)}>
                Sì, importa
              </button>
              <button type="button" onClick={() => setConfermaImport(null)}>
                Annulla
              </button>
            </div>
          ) : null}
        </section>

        <section className="imp-sezione imp-pericolo">
          <h2>Dati di prova</h2>
          {!confermaDemo ? (
            <div className="imp-backup-azioni">
              <button type="button" onClick={() => setConfermaDemo('demo')}>
                Carica dati demo
              </button>
              <button type="button" className="btn-pericolo" onClick={() => setConfermaDemo('svuota')}>
                Svuota tutto
              </button>
            </div>
          ) : (
            <div className="imp-conferma">
              <p>{confermaDemo === 'demo' ? 'Caricare i dati inventati?' : 'Eliminare tutti i dati?'}</p>
              <button
                type="button"
                onClick={() =>
                  void (confermaDemo === 'demo' ? caricaDatiDemo() : svuotaTutto()).then(() =>
                    setConfermaDemo(null),
                  )
                }
              >
                Sì
              </button>
              <button type="button" onClick={() => setConfermaDemo(null)}>
                No
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function BloccoRiga({ blocco, onElimina }: { blocco: Blocco; onElimina: () => void }) {
  const [dalle, setDalle] = useState(blocco.dalle ?? '')
  const [alle, setAlle] = useState(blocco.alle ?? '')
  const [motivo, setMotivo] = useState(blocco.motivo ?? '')

  const salva = () =>
    void salvaBlocco({
      ...blocco,
      dalle: dalle ? (dalle as HHMM) : undefined,
      alle: alle ? (alle as HHMM) : undefined,
      motivo: motivo || undefined,
    })

  return (
    <li className="imp-blocco-riga">
      <span>{blocco.operatoreId ?? 'Tutto il negozio'}</span>
      <input type="time" value={dalle} onChange={(e) => setDalle(e.target.value)} aria-label="Dalle" />
      <input type="time" value={alle} onChange={(e) => setAlle(e.target.value)} aria-label="Alle" />
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" />
      <button type="button" onClick={salva}>
        Salva
      </button>
      <button type="button" className="btn-pericolo" onClick={onElimina}>
        Elimina
      </button>
    </li>
  )
}
