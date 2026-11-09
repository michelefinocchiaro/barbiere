import { useState } from 'react'
import type { Impostazioni, ISODate } from '../../core'
import {
  blocchiDelGiorno,
  caricaDatiDemo,
  oggi,
  prossimoGiornoApertura,
} from '../../core'
import './Benvenuto.css'

interface Props {
  imp: Impostazioni
  logoUrl: string
  onPronto: (dataAgenda: ISODate) => void
}

export function Benvenuto({ imp, logoUrl, onPronto }: Props) {
  const [caricando, setCaricando] = useState(false)

  const cominciaVuoto = () => {
    onPronto(prossimoGiornoApertura(oggi(), imp, []))
  }

  const caricaDemo = () => {
    setCaricando(true)
    void (async () => {
      const o = oggi()
      const blocchi = await blocchiDelGiorno(o)
      await caricaDatiDemo()
      onPronto(prossimoGiornoApertura(o, imp, blocchi))
    })()
  }

  return (
    <div className="benvenuto">
      {logoUrl ? <img className="benvenuto-logo" src={logoUrl} alt="" width={200} height={60} /> : null}
      <h1 className="benvenuto-nome font-titolo">{imp.nomeNegozio}</h1>
      <p className="benvenuto-testo">
        La vostra agenda, sul tablet. I promemoria partono da WhatsApp con un tocco.
      </p>
      <div className="benvenuto-azioni">
        <button type="button" className="btn-primario" disabled={caricando} onClick={caricaDemo}>
          Guarda con appuntamenti di esempio
        </button>
        <button type="button" className="btn-secondario" disabled={caricando} onClick={cominciaVuoto}>
          Comincia da vuoto
        </button>
      </div>
    </div>
  )
}
