import type { Impostazioni } from '../core/tipi.ts'

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
}
