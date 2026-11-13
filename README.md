# Agenda e promemoria WhatsApp per barbieri

PWA per il tablet del negozio: agenda per operatore e promemoria del giorno prima su WhatsApp,
inviati con un tocco per cliente tramite link `api.whatsapp.com` (zero costi, nessun rischio di ban: il
messaggio lo invia la persona, dal WhatsApp del negozio). Nessun backend: i dati restano nel
browser del tablet (IndexedDB), con backup esportabile.

**Demo:** https://michelefinocchiaro.github.io/barbiere/ — in *Impostazioni* tocca
*Carica dati demo*, poi guarda *Agenda* e *Promemoria* (clienti e numeri sono inventati).
Sul tablet: menu del browser → *Installa app* / *Aggiungi a schermata Home*.

Ogni negozio è un file in `src/negozi/`. Regole e contratto per chi ci lavora:
[AGENTS.md](AGENTS.md) e [CONTRATTO.md](CONTRATTO.md).

## Comandi

```bash
npm install
npm run dev          # sviluppo, http://localhost:5173
npm test             # test unitari del core (vitest, TZ=Europe/Rome)
npm run typecheck
npm run e2e          # Playwright a 1280x800 e 1024x768, rigenera e2e/screenshot/
npm run build        # produzione in dist/ (PWA installabile)
```

## Un nuovo negozio

1. Copia il file di un negozio esistente in `src/negozi/` come `<nome>.ts` e cambia nome, logo, operatori,
   orari, servizi e testo del promemoria (segnaposto `{quando}` `{ora}` `{nome}` `{operatore}` `{servizio}`).
2. Aggiungilo all'elenco in `src/negozi/index.ts`, logo e palette in `public/brand/`.
3. `VITE_NEGOZIO=<nome> npm run build`.

## Pubblicazione (gratis)

`dist/` è un sito statico: va su qualsiasi hosting HTTPS gratuito (Cloudflare Pages, GitHub
Pages). L'HTTPS serve perché il tablet possa installarla come app. I dati non passano dal server.

## Stato (9 novembre 2026)

Prototipo completo e collaudato: 31 test unitari, 15 e2e, verificato dal vivo. Prima dell'uso
reale: provarlo sul tablet vero, collegare il WhatsApp **del negozio** al tablet come dispositivo
secondario, e concordare col negozio servizi e durate.
