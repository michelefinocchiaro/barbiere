# Agenda e promemoria WhatsApp per barbieri

PWA per il tablet di un barbiere. Gli operatori tagliano, chi sta al bancone prende gli
appuntamenti (anche al telefono) e il giorno prima manda i promemoria su WhatsApp.
Sostituisce un'agenda di carta e messaggi scritti a mano uno per uno.

**Il contratto fra le parti è [CONTRATTO.md](CONTRATTO.md). Leggilo per primo.**

## Le regole di questo progetto

1. **L'app aiuta chi prende gli appuntamenti, non lo sostituisce.** Avvisa ma non blocca, non fa
   niente da sola, ogni azione si annulla. Nei casi dubbi decide questa regola.
2. **Zero costi.** Niente backend, niente API a pagamento. WhatsApp si apre con un link wa.me
   e il messaggio lo invia la persona. Niente librerie WhatsApp non ufficiali: fanno bannare il numero.
3. **Un solo codice per tutti i negozi.** Tutto quello che è di un negozio (nome, operatori,
   orari, testo del promemoria) sta in `src/negozi/<negozio>.ts` e `public/brand/`.
   Mai nomi di negozi o di persone nel codice, nei test o nei documenti.
4. **Mai dati veri.** Nomi inventati e numeri `39 333 000 0xxx` in test, demo e log.
5. **Confini.** Il core sta in `src/core/` e `src/negozi/`, l'interfaccia in `src/ui/` ed `e2e/`.
   Chi lavora su una parte non modifica `CONTRATTO.md`, `AGENTS.md` o `README.md` e non aggiunge
   dipendenze: propone il cambiamento e lo integra chi tiene il contratto.

## Comandi

```bash
npm run dev          # http://localhost:5173
npm test             # vitest, con TZ=Europe/Rome
npm run typecheck    # tsc -b
npm run build        # deve passare senza avvisi di tipo
npm run e2e          # playwright, viewport tablet
```

## "Fatto" vuol dire

Un comando lo dichiara fatto: test verdi visti con i propri occhi, non dedotti. Un rosso si
riporta rosso, con l'output.
