import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MembroSquadra } from '../../core'
import './SquadraRitratti.css'

const NASCONDI_MS = 2500

interface PosNuvoletta {
  top: number
  left: number
  allinea: 'sinistra' | 'centro' | 'destra'
}

interface Props {
  membri: MembroSquadra[]
  baseUrl: string
}

function calcolaPos(btn: HTMLButtonElement, idx: number, tot: number): PosNuvoletta {
  const r = btn.getBoundingClientRect()
  const margine = 8
  const vw = window.innerWidth
  const top = r.top - 10
  if (idx === 0) {
    return { top, left: Math.max(margine, r.left), allinea: 'sinistra' }
  }
  if (idx === tot - 1) {
    return { top, left: Math.min(vw - margine, r.right), allinea: 'destra' }
  }
  return { top, left: r.left + r.width / 2, allinea: 'centro' }
}

export function SquadraRitratti({ membri, baseUrl }: Props) {
  const [attivo, setAttivo] = useState<number | null>(null)
  const [pos, setPos] = useState<PosNuvoletta | null>(null)
  const [salto, setSalto] = useState<number | null>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chiudi = useCallback(() => {
    setAttivo(null)
    setPos(null)
    setSalto(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const aggiornaPos = useCallback(
    (idx: number) => {
      const btn = btnRefs.current[idx]
      if (!btn) return
      setPos(calcolaPos(btn, idx, membri.length))
    },
    [membri.length],
  )

  const apri = useCallback(
    (idx: number) => {
      if (attivo === idx) {
        chiudi()
        return
      }
      setAttivo(idx)
      setSalto(idx)
      aggiornaPos(idx)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(chiudi, NASCONDI_MS)
    },
    [attivo, aggiornaPos, chiudi],
  )

  useLayoutEffect(() => {
    if (attivo === null) return
    aggiornaPos(attivo)
    const onRiposiziona = () => aggiornaPos(attivo)
    window.addEventListener('resize', onRiposiziona)
    window.addEventListener('scroll', onRiposiziona, true)
    return () => {
      window.removeEventListener('resize', onRiposiziona)
      window.removeEventListener('scroll', onRiposiziona, true)
    }
  }, [attivo, aggiornaPos])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  if (!membri.length) return null

  const nuvoletta =
    attivo !== null && pos
      ? createPortal(
          <div
            className={`squadra-nuvoletta squadra-nuvoletta--${pos.allinea}`}
            style={{ top: pos.top, left: pos.left }}
            role="status"
          >
            <span className="squadra-nuvoletta-testo">{membri[attivo]!.frase}</span>
            <span className="squadra-nuvoletta-coda" aria-hidden />
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className="sidebar-squadra">
        {membri.map((m, i) => (
          <button
            key={m.nome}
            type="button"
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            className={`sidebar-squadra-ritratto${attivo === i ? ' attivo' : ''}${salto === i ? ' saltello' : ''}`}
            aria-label={m.nome}
            onClick={() => apri(i)}
            onAnimationEnd={() => {
              if (salto === i) setSalto(null)
            }}
          >
            <img
              className="sidebar-squadra-img"
              src={`${baseUrl}${m.immagine}`}
              alt=""
              width={88}
              height={88}
            />
          </button>
        ))}
      </div>
      {nuvoletta}
    </>
  )
}
