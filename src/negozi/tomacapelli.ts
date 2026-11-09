import type { Impostazioni } from '../core/tipi.ts'
import { FRASI_PREDEFINITE } from '../core/frasi.ts'

export const impostazioni: Impostazioni = {
  nomeNegozio: 'Toma Capelli',
  logo: 'brand/logo-tomacapelli-trasparente.png',
  prefissoPredefinito: '39',
  giorniApertura: [2, 3, 4, 5, 6],
  apre: '08:00',
  chiude: '20:00',
  passoGrigliaMin: 15,
  operatori: [
    { id: 'alfio', nome: 'Alfio', attivo: true, ordine: 1 },
    { id: 'giuseppe', nome: 'Giuseppe', attivo: true, ordine: 2 },
  ],
  servizi: [
    { id: 'taglio', nome: 'Taglio', durataMin: 30, ordine: 1 },
    { id: 'barba', nome: 'Barba', durataMin: 20, ordine: 2 },
    { id: 'taglio-barba', nome: 'Taglio + Barba', durataMin: 45, ordine: 3 },
    { id: 'bambino', nome: 'Bambino', durataMin: 20, ordine: 4 },
  ],
  testoPromemoria: `Ciao friend ti ricordiamo l’appuntamento di {quando}
RESTIAMO IN ATTESA DI CONFERMA !! 😉💈💇🏻‍♂️👋🏻
Ci vediamo alle {ora}`,
  frasi: {
    mattina: [
      'Buongiorno friend! Oggi {teste} teste da sistemare 💈',
      ...FRASI_PREDEFINITE.mattina,
    ],
    fine_giornata: [
      '{teste} teste sistemate oggi. Grande squadra, friend! 💈',
      ...FRASI_PREDEFINITE.fine_giornata,
    ],
    promemoria_finiti: [
      'Tutti avvisati, friend! 👋🏻',
      ...FRASI_PREDEFINITE.promemoria_finiti,
    ],
    giornata_vuota: [
      'Agenda libera… {operatore}, è l\'ora del caffè ☕',
      ...FRASI_PREDEFINITE.giornata_vuota,
    ],
  },
}
