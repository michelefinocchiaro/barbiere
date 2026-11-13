import { expect, test } from '@playwright/test'
import { impostazioni as negozioDefault } from '../src/negozi/tomacapelli.ts'

const SABATO = new Date('2026-11-14T12:00:00+01:00')
const SLOT_H_PX = 48
const PASSO_MIN = 15

const TESTO_PROMEMORIA_ATTESO = `Ciao friend ti ricordiamo l’appuntamento di martedì
RESTIAMO IN ATTESA DI CONFERMA !! 😉💈💇🏻‍♂️👋🏻
Ci vediamo alle 8.15`

function minutiDaEtichettaOra(etichetta: string): number {
  const [h, m] = etichetta.split('.').map((x) => parseInt(x, 10))
  return h * 60 + (m || 0)
}

async function esciBenvenutoVuoto(page: import('@playwright/test').Page) {
  const vuoto = page.getByRole('button', { name: 'Comincia da vuoto' })
  const nav = page.getByRole('navigation', { name: 'Menu principale' })
  const stato = await Promise.race([
    vuoto.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'benvenuto' as const),
    nav.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'app' as const),
  ]).catch(() => null)
  if (stato === 'benvenuto') {
    await vuoto.click()
    await expect(page.locator('.agenda-titolo')).toBeVisible({ timeout: 20_000 })
  }
}

async function impostaDataAgenda(page: import('@playwright/test').Page, iso: string) {
  await expect(page.locator('.agenda-titolo')).toBeVisible({ timeout: 20_000 })
  const input = page.locator('.agenda input[type="date"]')
  for (let i = 0; i < 14; i++) {
    if ((await input.inputValue()) === iso) return
    const cur = await input.inputValue()
    if (cur < iso) await page.getByRole('button', { name: 'Giorno successivo' }).click()
    else await page.getByRole('button', { name: 'Giorno precedente' }).click()
  }
}

async function caricaDemoEApriAgenda(page: import('@playwright/test').Page) {
  const benvenutoDemo = page.getByRole('button', { name: 'Guarda con appuntamenti di esempio' })
  const fascia = page.getByText(/Appuntamenti di esempio/)
  const modo = await Promise.race([
    benvenutoDemo.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'benvenuto' as const),
    fascia.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'gia-demo' as const),
  ]).catch(() => null)
  if (modo === 'benvenuto') {
    await benvenutoDemo.click()
    await expect(fascia).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('.agenda-titolo')).toBeVisible({ timeout: 20_000 })
    return
  }
  if (modo === 'gia-demo') {
    await page.getByRole('button', { name: 'Agenda' }).click()
    await expect(page.locator('.agenda-titolo')).toBeVisible()
    return
  }
  await page.getByRole('button', { name: 'Impostazioni' }).click()
  await page.getByRole('button', { name: 'Carica dati demo' }).click()
  await page.getByRole('button', { name: 'Sì' }).click()
  await page.getByRole('button', { name: 'Agenda' }).click()
  await expect(page.locator('.agenda-titolo')).toBeVisible()
}

async function verificaTestateOperatori(page: import('@playwright/test').Page) {
  const nomiAttesi = negozioDefault.operatori.filter((o) => o.attivo).map((o) => o.nome)
  const testate = page.locator('.agenda-operatore-nome')
  await expect(testate).toHaveCount(nomiAttesi.length)
  for (let i = 0; i < nomiAttesi.length; i++) {
    const testata = testate.nth(i)
    await expect(testata).toHaveText(nomiAttesi[i]!)
    const dims = await testata.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      height: el.getBoundingClientRect().height,
    }))
    expect(dims.scrollHeight, nomiAttesi[i]).toBeLessThanOrEqual(dims.clientHeight + 1)
    expect(dims.height, nomiAttesi[i]).toBeGreaterThanOrEqual(24)
    const testoInBox = await testata.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(el)
      const cr = range.getBoundingClientRect()
      return cr.top >= r.top - 0.5 && cr.bottom <= r.bottom + 0.5
    })
    expect(testoInBox, nomiAttesi[i]).toBe(true)
  }
}

async function etichettaOraDaBlocco(
  blocco: import('@playwright/test').Locator,
): Promise<string> {
  const isBreve = await blocco.evaluate((el) => el.classList.contains('app-blocco-breve'))
  if (isBreve) {
    const riga = (await blocco.locator('.app-blocco-riga').textContent())?.trim() ?? ''
    return riga.split(/\s+/)[0] ?? ''
  }
  return (await blocco.locator('.app-blocco-ora').textContent())?.trim() ?? ''
}

async function verificaBlocchiConEtichetteOra(page: import('@playwright/test').Page) {
  const blocchi = page.locator('.app-blocco')
  const count = await blocchi.count()
  for (let i = 0; i < count; i++) {
    const blocco = blocchi.nth(i)
    const etichettaOra = await etichettaOraDaBlocco(blocco)
    const label = page.locator('.agenda-ora-label').filter({ hasText: etichettaOra }).first()
    await expect(label, etichettaOra).toBeVisible()
    const tops = await Promise.all([
      blocco.evaluate((el) => el.getBoundingClientRect().top),
      label.evaluate((el) => el.getBoundingClientRect().top),
    ])
    expect(Math.abs(tops[0] - tops[1]), `${etichettaOra} ↔ etichetta`).toBeLessThanOrEqual(2)
  }
}

test.describe('flusso tablet agenda', () => {
  test.describe.configure({ timeout: 45_000 })

  test.beforeEach(async ({ page, context }) => {
    await context.route('https://api.whatsapp.com/**', (route) => route.abort())
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await esciBenvenutoVuoto(page)
    await page.getByRole('button', { name: 'Impostazioni' }).click()
    await page.getByRole('button', { name: 'Svuota tutto' }).click()
    await page.getByRole('button', { name: 'Sì' }).click()
    await page.getByRole('button', { name: 'Agenda' }).click()
  })

  test('dalla telefonata al promemoria — nuovo appuntamento martedì 17/11', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: /Nuovo appuntamento 08:15/i }).first().click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cliente Prova')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Prova')
    await page.getByLabel('Telefono').fill('333 000 0001')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByRole('button', { name: 'Salva', exact: true }).click()
    await expect(page.getByText('Cliente Prova').first()).toBeVisible()
  })

  test('il link WhatsApp del promemoria', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: /Nuovo appuntamento 08:15/i }).first().click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cli')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Prova')
    await page.getByLabel('Telefono').fill('333 000 0001')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByRole('button', { name: 'Salva', exact: true }).click()

    await page.getByRole('button', { name: 'Promemoria' }).click()
    await page.locator('.prom-data input[type="date"]').fill('2026-11-17')

    const invia = page.locator('a.btn-invia').first()
    await expect(invia).toBeVisible()
    const link = await invia.getAttribute('href')
    expect(link).toMatch(/^https:\/\/api\.whatsapp\.com\/send\/\?phone=393330000001&text=/)
    const testo = new URL(link!).searchParams.get('text')!
    expect(testo).toBe(TESTO_PROMEMORIA_ATTESO)
    await invia.click()
    await expect(page.getByRole('button', { name: 'Ha confermato' }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Invia produce una sola richiesta WhatsApp e resta su Promemoria', async ({ page, context }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: /Nuovo appuntamento 08:15/i }).first().click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cliente Prova')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Prova')
    await page.getByLabel('Telefono').fill('333 000 0001')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByRole('button', { name: 'Salva', exact: true }).click()

    await page.getByRole('button', { name: 'Promemoria' }).click()
    await page.locator('.prom-data input[type="date"]').fill('2026-11-17')

    let richiesteWa = 0
    await context.unroute('https://api.whatsapp.com/**')
    await context.route('https://api.whatsapp.com/**', (route) => {
      richiesteWa += 1
      route.abort()
    })

    const urlPrima = page.url()
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('a.btn-invia').first().click(),
    ])
    await expect.poll(() => richiesteWa, { timeout: 5000 }).toBe(1)
    await popup.close().catch(() => {})
    expect(page.url()).toBe(urlPrima)
    await expect(page.getByRole('heading', { name: /Promemoria per/ })).toBeVisible()
  })

  test('Ha confermato e Annulla', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: /Nuovo appuntamento 08:15/i }).first().click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cliente Prova')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Prova')
    await page.getByLabel('Telefono').fill('333 000 0001')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByRole('button', { name: 'Salva', exact: true }).click()

    await page.getByRole('button', { name: 'Promemoria' }).click()
    await page.locator('.prom-data input[type="date"]').fill('2026-11-17')

    await page.locator('a.btn-invia').first().click()
    await expect(page.getByRole('button', { name: 'Ha confermato' }).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Ha confermato' }).first().click()
    await expect(page.getByText('1 confermato')).toBeVisible()

    await page.getByRole('button', { name: 'Annulla' }).click()
    await expect(page.getByText('1 in attesa')).toBeVisible()
  })

  test('avvisa ma non blocca — sovrapposizione', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    const primaColonna = page.locator('.agenda-colonna').first()
    await primaColonna.locator('.agenda-slot').nth(1).click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cliente Uno')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Uno')
    await page.getByLabel('Telefono').fill('333 000 0002')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByRole('button', { name: 'Salva', exact: true }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await primaColonna.locator('.agenda-slot').nth(4).click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cliente Due')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Due')
    await page.getByLabel('Telefono').fill('333 000 0003')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByLabel('Ora').fill('08:30')
    await page.getByRole('button', { name: 'Salva', exact: true }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: 'Salva comunque' }).click()
    await expect(page.getByText('Cliente Uno').first()).toBeVisible()
    await expect(page.getByText('Cliente Due').first()).toBeVisible()
  })

  test('giorno chiuso — lunedì 16/11', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-16')
    await expect(page.getByText('Chiuso')).toBeVisible()
    await expect(page.locator('.agenda-griglia-wrap')).toBeVisible()
    const testata = page.getByRole('button', { name: '+ Nuovo' })
    if ((await testata.count()) > 0) await testata.click()
    else await page.locator('.agenda-fab-nuovo').click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('agenda dati demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('ricerca cliente: il suggerimento si vede davvero e si sceglie', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: /Nuovo appuntamento 12:00/i }).first().click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Lui')
    const voce = page.locator('.suggerimenti li').first()
    await expect(voce).toBeVisible()
    const box = await voce.boundingBox()
    // toBeVisible è vero anche per una lista schiacciata a 2 px: serve l'altezza vera
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(30)
    await voce.getByRole('button').first().click()
    await expect(page.locator('.suggerimenti')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Cliente' })).toHaveValue('Luigi Bianchi')
  })

  test('martedì 17/11 — blocchi demo visibili e allineati alla griglia', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    const blocchi = page.locator('.app-blocco')
    await expect(blocchi).toHaveCount(6)

    await verificaTestateOperatori(page)
    await verificaBlocchiConEtichetteOra(page)

    const apreMin = 8 * 60
    const count = await blocchi.count()
    for (let i = 0; i < count; i++) {
      const blocco = blocchi.nth(i)
      const isBreve = await blocco.evaluate((el) => el.classList.contains('app-blocco-breve'))
      const durataMin = isBreve ? 20 : 30
      const etichettaOra = await etichettaOraDaBlocco(blocco)

      const dims = await blocco.evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          top: parseFloat(s.top),
          height: parseFloat(s.height),
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }
      })

      const minutiOra = minutiDaEtichettaOra(etichettaOra)
      const righeDaCima = (minutiOra - apreMin) / PASSO_MIN
      const righeAltezza = durataMin / PASSO_MIN
      const topAtteso = righeDaCima * SLOT_H_PX
      const altezzaAttesa = righeAltezza * SLOT_H_PX

      expect(dims.top, `${etichettaOra} top`).toBeGreaterThanOrEqual(topAtteso - 2)
      expect(dims.top, `${etichettaOra} top`).toBeLessThanOrEqual(topAtteso + 2)
      expect(dims.height, `${etichettaOra} height`).toBeGreaterThanOrEqual(altezzaAttesa - 2)
      expect(dims.height, `${etichettaOra} height`).toBeLessThanOrEqual(altezzaAttesa + 2)
      expect(dims.scrollHeight, `${etichettaOra} scrollHeight`).toBeLessThanOrEqual(
        dims.clientHeight + 1,
      )
    }
  })
})

test.describe('telefono 390', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'telefono-390', 'solo 390×844')
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('martedì in agenda — entrambi gli operatori e tutti i blocchi visibili', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await expect(page.locator('.app-blocco')).toHaveCount(6)
    await verificaTestateOperatori(page)
    await verificaBlocchiConEtichetteOra(page)
    for (const nome of negozioDefault.operatori.filter((o) => o.attivo).map((o) => o.nome)) {
      await expect(page.getByRole('heading', { name: nome, level: 2 })).toBeVisible()
    }
    const vw = page.viewportSize()!.width
    for (const blocco of await page.locator('.app-blocco').all()) {
      const box = await blocco.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1)
    }
  })

  test('Promemoria — Invia della prima riga dentro lo schermo', async ({ page }) => {
    await page.getByRole('button', { name: 'Promemoria' }).click()
    await page.locator('.prom-data input[type="date"]').fill('2026-11-17')
    const invia = page.locator('a.btn-invia').first()
    await expect(invia).toBeVisible()
    const vw = page.viewportSize()!.width
    const box = await invia.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1)
  })
})

async function screenshotSchermate(page: import('@playwright/test').Page, suffisso: string) {
  await impostaDataAgenda(page, '2026-11-17')
  await expect(page.locator('.app-blocco').first()).toBeVisible()
  await expect(page.locator('.caricamento-palo')).toHaveCount(0)
  await page.screenshot({ path: `e2e/screenshot/agenda${suffisso}.png`, fullPage: true })

  await page.getByText('Mario Rossi').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Cliente')).toHaveValue('Mario Rossi')
  await page.screenshot({ path: `e2e/screenshot/pannello-appuntamento${suffisso}.png`, fullPage: true })
  await page.getByLabel('Chiudi').click()

  await page.getByRole('button', { name: 'Promemoria' }).click()
  await page.locator('.prom-data input[type="date"]').fill('2026-11-17')
  await expect(page.locator('a.btn-invia').first()).toBeVisible()
  await expect(page.locator('.caricamento-palo')).toHaveCount(0)
  await page.screenshot({ path: `e2e/screenshot/promemoria${suffisso}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Clienti' }).click()
  await page.getByRole('button', { name: /Mario Rossi/ }).click()
  await expect(page.locator('.storico-lista li').first()).toBeVisible()
  await expect(page.locator('.caricamento-palo')).toHaveCount(0)
  await page.screenshot({ path: `e2e/screenshot/clienti${suffisso}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Impostazioni' }).click()
  await expect(page.getByRole('button', { name: 'Carica dati demo' })).toBeVisible()
  await expect(page.locator('.caricamento-palo')).toHaveCount(0)
  await page.screenshot({ path: `e2e/screenshot/impostazioni${suffisso}.png`, fullPage: true })
}

test.describe('design benvenuto e battute', () => {
  test.describe.configure({ timeout: 45_000 })

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await page.getByRole('button', { name: 'Comincia da vuoto' }).waitFor({ state: 'visible', timeout: 25_000 })
  })

  test('primo avvio benvenuto e demo porta all agenda', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Guarda con appuntamenti di esempio' })).toBeVisible()
    await page.getByRole('button', { name: 'Guarda con appuntamenti di esempio' }).click()
    await page.getByRole('button', { name: 'Agenda' }).click()
    await impostaDataAgenda(page, '2026-11-17')
    await expect(page.locator('.app-blocco').first()).toBeVisible({ timeout: 10_000 })
  })

  test('demo attiva: fascia e niente banner backup', async ({ page }) => {
    await page.getByRole('button', { name: 'Guarda con appuntamenti di esempio' }).click()
    await expect(page.getByText(/Appuntamenti di esempio/)).toBeVisible()
    await expect(page.getByText(/Backup consigliato/)).toHaveCount(0)
  })

  test('Svuota e comincia con conferma', async ({ page }) => {
    await page.getByRole('button', { name: 'Guarda con appuntamenti di esempio' }).click()
    await page.getByRole('button', { name: 'Svuota e comincia' }).click()
    await page.getByRole('button', { name: 'Sì, svuota' }).click()
    await expect(page.getByText(/Appuntamenti di esempio/)).toHaveCount(0)
    await expect(page.locator('.app-blocco')).toHaveCount(0)
  })

  test('lunedì vista chiuso con frase', async ({ page }) => {
    await page.getByRole('button', { name: 'Comincia da vuoto' }).click()
    await expect(page.locator('.agenda-titolo')).toBeVisible({ timeout: 20_000 })
    await impostaDataAgenda(page, '2026-11-16')
    await expect(page.getByText('Chiuso')).toBeVisible()
    await expect(page.locator('.agenda-fascia-chiuso .agenda-frase-momento')).toBeVisible()
    await expect(page.locator('.agenda-griglia-wrap')).toBeVisible()
  })

  test('testata agenda con frase del negozio', async ({ page }) => {
    await caricaDemoEApriAgenda(page)
    await impostaDataAgenda(page, '2026-11-17')
    const battuta = page.locator('.agenda-battuta')
    await expect(battuta).toBeVisible()
    await expect(battuta).not.toHaveText('')
  })

  test('anteprima impostazioni senza mese in quando', async ({ page }) => {
    await caricaDemoEApriAgenda(page)
    await page.getByRole('button', { name: 'Impostazioni' }).click()
    const testo = await page.locator('.imp-anteprima pre').textContent()
    expect(testo).toBeTruthy()
    expect(testo).toMatch(/domani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|oggi/i)
    expect(testo).not.toMatch(
      /\d{1,2}\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i,
    )
  })

  test('font Alfa Slab One caricato', async ({ page }) => {
    await caricaDemoEApriAgenda(page)
    const ok = await page.evaluate(async () => {
      await document.fonts.ready
      return document.fonts.check('16px "Alfa Slab One"')
    })
    expect(ok).toBe(true)
  })
})

test.describe('Da pagare', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('badge, totali, Ha pagato, Annulla e nuova voce', async ({ page }) => {
    const navDebiti = page.getByRole('button', { name: /^Da pagare/ })
    await expect(navDebiti).toBeVisible()
    const badge = navDebiti.locator('.sidebar-badge')
    await expect(badge).toHaveText('2')
    const badgeBox = await badge.boundingBox()
    expect(badgeBox?.height ?? 0).toBeGreaterThanOrEqual(10)

    await navDebiti.click()
    await expect(page.getByRole('heading', { name: 'Da pagare', level: 1 })).toBeVisible()
    const totaleGrande = page.locator('.debiti-importo-grande').first()
    await expect(totaleGrande).toHaveText('23,50 €')
    const totBox = await totaleGrande.boundingBox()
    expect(totBox?.height ?? 0).toBeGreaterThanOrEqual(28)

    const rigaMario = page.locator('.debiti-riga').filter({ hasText: 'Mario Rossi' })
    await expect(rigaMario).toBeVisible()
    const rigaBox = await rigaMario.boundingBox()
    expect(rigaBox?.height ?? 0).toBeGreaterThanOrEqual(60)

    await rigaMario.getByRole('button', { name: 'Ha pagato' }).click()
    await expect(page.locator('.debiti-riga')).toHaveCount(1)
    await expect(totaleGrande).toHaveText('8,50 €')
    await expect(badge).toHaveText('1')

    await page.locator('.toast').getByRole('button', { name: 'Annulla' }).click()
    await expect(page.locator('.debiti-riga')).toHaveCount(2)
    await expect(totaleGrande).toHaveText('23,50 €')
    await expect(badge).toHaveText('2')

    await page.getByRole('button', { name: '+ Segna da pagare' }).click()
    const modulo = page.locator('.modulo-debito')
    await modulo.getByPlaceholder('Nome o ultime cifre del telefono').fill('Zzz Cliente Nuovo')
    await modulo.locator('.link-nuovo').click()
    await modulo.getByLabel('Nome').fill('Cliente Debito')
    await modulo.getByLabel('Telefono').fill('333 000 0003')
    await modulo.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await modulo.locator('input[placeholder="es. 15 o 12,50"]').fill('12,50')
    await modulo.getByRole('button', { name: 'Salva da pagare', exact: true }).click()
    await expect(page.getByText('12,50 €').first()).toBeVisible()
    await expect(totaleGrande).toHaveText('36,00 €')

    await page.getByRole('button', { name: '+ Segna da pagare' }).click()
    const modulo2 = page.locator('.modulo-debito')
    await modulo2.getByPlaceholder('Nome o ultime cifre del telefono').fill('Luigi')
    await modulo2.locator('.suggerimenti button').first().click()
    await modulo2.locator('input[placeholder="es. 15 o 12,50"]').fill('abc')
    await modulo2.getByRole('button', { name: 'Salva da pagare', exact: true }).click()
    await expect(modulo2.getByRole('alert')).toContainText(/importo/i)
    await expect(modulo2).toBeVisible()
  })

  test('un importo sopra i mille euro si riapre e si salva', async ({ page }) => {
    await page.getByRole('button', { name: /^Da pagare/ }).click()
    await page.getByRole('button', { name: '+ Segna da pagare' }).click()
    const modulo = page.locator('.modulo-debito')
    await modulo.getByPlaceholder('Nome o ultime cifre del telefono').fill('Luigi')
    await modulo.locator('.suggerimenti button').first().click()
    await modulo.locator('input[placeholder="es. 15 o 12,50"]').fill('1250')
    await modulo.getByRole('button', { name: 'Salva da pagare', exact: true }).click()
    await page.locator('.debiti-riga-tap').filter({ hasText: '1.250,00 €' }).click()
    const dialog = page.locator('.debiti-modifica')
    await dialog.locator('.btn-primario').click()
    await expect(page.locator('.toast').filter({ hasText: 'Modifica salvata' })).toBeVisible()
    await expect(page.locator('.debiti-riga-tap').filter({ hasText: '1.250,00 €' })).toBeVisible()
  })

  test('dal pannello appuntamento apre il modulo col cliente scelto', async ({ page }) => {
    test.setTimeout(30_000)
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: '9.00 Mario Rossi Taglio' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const segnaNelPannello = dialog.getByRole('button', { name: 'Segna da pagare' })
    await segnaNelPannello.scrollIntoViewIfNeeded()
    await segnaNelPannello.click()
    await expect(dialog.getByRole('heading', { name: 'Segna da pagare', level: 2 })).toBeVisible()
    const campoCliente = dialog.locator('.modulo-debito input[type="search"]')
    await expect(campoCliente).toHaveValue('Mario Rossi')
    const modBox = await dialog.locator('.modulo-debito').boundingBox()
    expect(modBox?.height ?? 0).toBeGreaterThanOrEqual(100)

    const salvaNelDialog = dialog.getByRole('button', { name: /^Salva/ })
    await expect(salvaNelDialog).toHaveCount(1)
    await expect(salvaNelDialog).toHaveAccessibleName('Salva da pagare')

    await dialog.locator('.modulo-debito input[placeholder="es. 15 o 12,50"]').fill('7')
    await dialog.getByRole('button', { name: 'Salva da pagare', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'Modifica appuntamento', level: 2 })).toBeVisible()

    await page.getByLabel('Chiudi').click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: /^Da pagare/ }).click()
    const rigaSette = page
      .locator('.debiti-riga')
      .filter({ hasText: 'Mario Rossi' })
      .filter({ hasText: '7,00 €' })
    await expect(rigaSette).toHaveCount(1)

    await page.getByRole('button', { name: /^Agenda/ }).click()
    await page.getByRole('button', { name: '9.00 Mario Rossi Taglio' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Segna da pagare' }).scrollIntoViewIfNeeded()
    await dialog.getByRole('button', { name: 'Segna da pagare' }).click()
    await dialog.locator('.modulo-debito input[placeholder="es. 15 o 12,50"]').fill('7')
    await dialog.getByRole('button', { name: 'Salva da pagare', exact: true }).click()
    const toast = page.locator('.toast').filter({ hasText: 'Segnato da pagare' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Annulla' }).click({ force: true })

    await page.getByLabel('Chiudi').click()
    await page.getByRole('button', { name: /^Da pagare/ }).click()
    await expect(rigaSette).toHaveCount(1)
  })
})

test.describe('barra del turno', () => {
  async function apriAgendaOggi(page: import('@playwright/test').Page, quando: Date) {
    await page.clock.setFixedTime(quando)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: 'Oggi' }).click()
    await expect(page.locator('.agenda input[type="date"]')).toHaveValue('2026-11-17')
  }

  async function rapportoRiempimentoBarra(page: import('@playwright/test').Page): Promise<number> {
    return page.locator('.agenda-barra-turno-traccia').evaluate((traccia) => {
      const pieno = traccia.querySelector('.agenda-barra-turno-pieno') as HTMLElement | null
      if (!pieno) return 0
      const tw = traccia.getBoundingClientRect().width
      if (tw <= 0) return 0
      return pieno.getBoundingClientRect().width / tw
    })
  }

  test('martedì 17/11 alle 14:00 — barra ~50%, testo fine turno, niente linea ora', async ({ page }) => {
    await apriAgendaOggi(page, new Date('2026-11-17T14:00:00+01:00'))
    await expect(page.locator('.agenda-barra-turno')).toBeVisible()
    await expect(page.locator('.agenda-barra-turno-testo')).toContainText('fine turno alle 20.00')
    await expect(page.locator('.agenda-linea-ora')).toHaveCount(0)

    const rapporto = await rapportoRiempimentoBarra(page)
    expect(rapporto).toBeGreaterThanOrEqual(0.48)
    expect(rapporto).toBeLessThanOrEqual(0.52)
  })

  test('mercoledì 18/11 — la barra non c\'è (non è oggi)', async ({ page }) => {
    await apriAgendaOggi(page, new Date('2026-11-17T10:00:00+01:00'))
    await impostaDataAgenda(page, '2026-11-18')
    await expect(page.locator('.agenda-barra-turno')).toHaveCount(0)
  })

  test('martedì 7:30 — barra vuota, si apre alle 8.00', async ({ page }) => {
    await apriAgendaOggi(page, new Date('2026-11-17T07:30:00+01:00'))
    await expect(page.locator('.agenda-barra-turno-testo')).toHaveText('si apre alle 8.00')
    expect(await rapportoRiempimentoBarra(page)).toBeLessThanOrEqual(0.02)
  })

  test('martedì 20:30 — barra piena, turno finito', async ({ page }) => {
    await apriAgendaOggi(page, new Date('2026-11-17T20:30:00+01:00'))
    await expect(page.locator('.agenda-barra-turno-testo')).toHaveText('turno finito')
    expect(await rapportoRiempimentoBarra(page)).toBeGreaterThanOrEqual(0.98)
  })

  test('etichetta chiusura 20.00 allineata al fondo griglia, senza slot 20:00', async ({ page }) => {
    await apriAgendaOggi(page, new Date('2026-11-17T14:00:00+01:00'))
    const chiusura = page.locator('.agenda-ora-chiusura')
    await expect(chiusura).toHaveText('20.00')
    const scartoPx = await page.evaluate(() => {
      const wrap = document.querySelector('.agenda-griglia-wrap') as HTMLElement | null
      if (wrap) wrap.scrollTop = wrap.scrollHeight
      const etichetta = document.querySelector('.agenda-ora-chiusura')
      const corpo = document.querySelector('.agenda-colonna-body')
      if (!etichetta || !corpo) return null
      const rc = etichetta.getBoundingClientRect()
      const rg = corpo.getBoundingClientRect()
      return Math.abs(rc.top - rg.bottom)
    })
    expect(scartoPx).not.toBeNull()
    expect(scartoPx!).toBeLessThanOrEqual(2)
    await expect(page.getByRole('button', { name: /Nuovo appuntamento 20:00/i })).toHaveCount(0)
  })
})

test.describe('nuovo appuntamento e ricerca', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
    await impostaDataAgenda(page, '2026-11-17')
  })

  test('+ Nuovo apre il primo slot libero, salva e compare in griglia', async ({ page }, testInfo) => {
    const isPhone = testInfo.project.name === 'telefono-390'
    if (isPhone) {
      await page.locator('.agenda-fab-nuovo').click()
    } else {
      await page.locator('.agenda-btn-nuovo-testata').click()
    }
    await expect(page.getByRole('heading', { name: 'Nuovo appuntamento' })).toBeVisible()
    await expect(page.locator('.avvisi-fascia')).toHaveCount(0)
    const oraValue = await page.locator('.pannello-corpo input[type="time"]').inputValue()
    expect(oraValue).toBe('08:00')

    const nomeCliente = 'Cliente E2E Nuovo'
    const campoCliente = page.getByPlaceholder('Nome o ultime cifre del telefono')
    await campoCliente.fill('99100')
    await page.locator('.link-nuovo').click()
    await page.getByLabel('Nome').fill(nomeCliente)
    await page.getByLabel('Telefono').fill('333 000 0100')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Salva' }).click()
    await expect(page.getByRole('heading', { name: 'Nuovo appuntamento' })).toHaveCount(0)
    await expect(page.locator('.app-blocco').filter({ hasText: nomeCliente })).toBeVisible()
    const etichettaOra = oraValue.replace(':', '.').replace(/^0/, '')
    await expect(
      page.locator('.app-blocco').filter({ hasText: nomeCliente }).filter({ hasText: etichettaOra }),
    ).toBeVisible()
  })

  test('telefono — il pulsante + sta sopra la barra di navigazione', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'telefono-390', 'solo telefono-390')
    const fab = page.getByRole('button', { name: 'Nuovo appuntamento', exact: true })
    const nav = page.getByRole('navigation', { name: 'Menu principale' })
    const fabBox = await fab.boundingBox()
    const navBox = await nav.boundingBox()
    expect(fabBox).not.toBeNull()
    expect(navBox).not.toBeNull()
    expect(fabBox!.y + fabBox!.height).toBeLessThanOrEqual(navBox!.y + 1)
  })

  test('ricerca per nome, telefono e risultato vuoto', async ({ page }) => {
    await page.getByRole('button', { name: 'Cerca appuntamento' }).click()
    const campo = page.getByPlaceholder('Nome o ultime cifre del telefono')
    await campo.fill('mar')
    await expect(page.getByRole('heading', { name: 'Prossimi', level: 3 })).toBeVisible()
    await expect(page.locator('.ricerca-riga').filter({ hasText: 'Mario Rossi' }).first()).toBeVisible()

    await campo.fill('0002')
    await expect(page.locator('.ricerca-riga').filter({ hasText: 'Luigi Bianchi' }).first()).toBeVisible()

    await campo.fill('mar')
    await page
      .locator('.ricerca-riga')
      .filter({ hasText: '9.00' })
      .filter({ hasText: 'Mario Rossi' })
      .first()
      .click()
    await expect(page.locator('.agenda-titolo')).toContainText('17 novembre')
    await expect(page.getByRole('heading', { name: 'Modifica appuntamento' })).toBeVisible()
    await expect(page.getByPlaceholder('Nome o ultime cifre del telefono')).toHaveValue('Mario Rossi')

    await page.getByRole('button', { name: 'Chiudi' }).click()
    await page.getByRole('button', { name: 'Cerca appuntamento' }).click()
    await campo.fill('zzz')
    await expect(page.getByText('Nessun appuntamento per "zzz"')).toBeVisible()
  })
})

test.describe('giro 1A — scambio, messaggi, riepilogo', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('scambia due appuntamenti', async ({ page }) => {
    await page.locator('.app-blocco').filter({ hasText: 'Mario Rossi' }).first().click()
    await page.getByRole('button', { name: 'Scambia con…' }).click()
    await expect(page.getByText(/Tocca l.appuntamento con cui scambiare/)).toBeVisible()
    await page.locator('.app-blocco').filter({ hasText: 'Luigi Bianchi' }).first().click()
    await expect(page.getByRole('heading', { name: 'Confermi lo scambio?' })).toBeVisible()
    await page.locator('.agenda-scambio-conferma').getByRole('button', { name: 'Scambia' }).click()
    await expect(page.locator('.agenda-scambio-fascia')).toHaveCount(0)
    await expect(page.locator('.toast')).toContainText('Scambiati')
  })

  test('messaggio rapido con link WhatsApp', async ({ page }) => {
    await page.locator('.app-blocco').filter({ hasText: 'Mario Rossi' }).first().click()
    const link = page.getByRole('link', { name: 'Sii puntuale' })
    await expect(link).toHaveAttribute('href', /api\.whatsapp\.com/)
    await expect(link).toHaveAttribute('href', /phone=393330000001/)
  })

  test('riepilogo per cliente con due appuntamenti', async ({ page }) => {
    await page.locator('.app-blocco').filter({ hasText: 'Mario Rossi' }).first().click()
    const riepilogo = page.getByRole('button', { name: /Invia riepilogo \(\d+ appuntamenti\)/ })
    await expect(riepilogo).toBeVisible()
    const n = parseInt((await riepilogo.textContent())?.match(/\d+/)?.[0] ?? '0', 10)
    expect(n).toBeGreaterThanOrEqual(2)
    await riepilogo.click()
    await expect(page.locator('.invia-riepilogo-anteprima')).toBeVisible()
    const wa = page.getByRole('link', { name: 'Apri WhatsApp' })
    await expect(wa).toHaveAttribute('href', /api\.whatsapp\.com/)
  })
})

test.describe('squadra in sidebar', () => {
  test('tablet — ritratti, nuvoletta e timeout', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'telefono-390', 'solo tablet')
    await page.clock.install({ time: SABATO })
    await page.goto('/')
    await esciBenvenutoVuoto(page)

    const giuseppe = page.getByRole('button', { name: 'Giuseppe' })
    const alfio = page.getByRole('button', { name: 'Alfio' })
    const mattia = page.getByRole('button', { name: 'Mattia' })
    await expect(giuseppe).toBeVisible()
    await expect(alfio).toBeVisible()
    await expect(mattia).toBeVisible()

    const [boxG, boxA, boxM] = await Promise.all([
      giuseppe.boundingBox(),
      alfio.boundingBox(),
      mattia.boundingBox(),
    ])
    expect(boxG!.x).toBeLessThan(boxA!.x)
    expect(boxA!.x).toBeLessThan(boxM!.x)

    for (const btn of [giuseppe, alfio, mattia]) {
      const w = await btn.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)
      expect(w).toBeGreaterThan(0)
    }

    await alfio.click()
    const nuvoletta = page.locator('.squadra-nuvoletta')
    await expect(nuvoletta).toHaveText('Travagghiati')
    const vp = page.viewportSize()!
    const bubble = await nuvoletta.boundingBox()
    expect(bubble).not.toBeNull()
    expect(bubble!.x).toBeGreaterThanOrEqual(0)
    expect(bubble!.y).toBeGreaterThanOrEqual(0)
    expect(bubble!.x + bubble!.width).toBeLessThanOrEqual(vp.width + 1)
    expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(vp.height + 1)

    await mattia.click()
    await expect(nuvoletta).toHaveText('Saddato')
    await expect(page.getByRole('status')).not.toContainText('Travagghiati')

    await page.clock.fastForward(3000)
    await expect(nuvoletta).toHaveCount(0)
  })

  test('telefono 390 — nessun ritratto', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'telefono-390', 'solo telefono-390')
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await esciBenvenutoVuoto(page)
    await expect(page.getByRole('button', { name: 'Giuseppe' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Alfio' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mattia' })).toHaveCount(0)
  })
})

test.describe('giro 1B — settimana e impegni', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('cambio vista settimana', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: 'Settimana', exact: true }).click()
    await expect(page.locator('.agenda-settimana')).toBeVisible()
    await expect(page.getByText('Corso fornitori')).toBeVisible()
    await page.getByRole('button', { name: 'Giorno', exact: true }).click()
    await expect(page.locator('.agenda-griglia-wrap')).toBeVisible()
  })

  test('impegno su lunedì creato e visibile', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: 'Settimana', exact: true }).click()
    const lundiHeader = page.locator('.agenda-sett-col').filter({ hasText: /lunedì/i })
    await lundiHeader.getByRole('button', { name: 'Aggiungi' }).click()
    await lundiHeader.getByRole('menuitem', { name: 'Impegno' }).click()
    await expect(page.getByRole('heading', { name: 'Nuovo impegno' })).toBeVisible()
    await page.getByLabel('Titolo').fill('Taglio a domicilio')
    await page.locator('.pannello-impegno').getByRole('button', { name: 'Salva' }).click()
    await expect(lundiHeader.getByText('Taglio a domicilio')).toBeVisible()
    await lundiHeader.getByRole('button', { name: /lunedì/i }).click()
    await expect(page.locator('.agenda-impegni-giorno').getByText('Taglio a domicilio')).toBeVisible()
  })

  test('appuntamento lunedì con solo avviso giorno chiuso', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-16')
    const testata = page.getByRole('button', { name: '+ Nuovo' })
    if ((await testata.count()) > 0) await testata.click()
    else await page.locator('.agenda-fab-nuovo').click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Cliente Demo')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Cliente Demo')
    await page.getByLabel('Telefono').fill('333 000 0111')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Taglio 30 min' }).click()
    await page.getByRole('button', { name: 'Salva', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(/chiuso/i)
    await page.getByRole('button', { name: 'Salva comunque' }).click()
    await expect(page.getByText('Cliente Demo').first()).toBeVisible()
  })

  test('annulla eliminazione impegno', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByRole('button', { name: 'Settimana', exact: true }).click()
    await page.getByText('Corso fornitori').click()
    await page.getByRole('button', { name: 'Elimina' }).click()
    await page.getByRole('button', { name: 'Conferma elimina' }).click()
    await expect(page.getByText('Corso fornitori')).toHaveCount(0)
    await page.getByRole('button', { name: 'Annulla' }).last().click()
    await expect(page.getByText('Corso fornitori')).toBeVisible()
  })
})

test.describe('giro 2 — pc 1440×900', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc-1440', 'solo pc-1440')
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await esciBenvenutoVuoto(page)
    await page.getByRole('button', { name: 'Impostazioni' }).click()
    await page.getByRole('button', { name: 'Carica dati demo' }).click()
    await page.getByRole('button', { name: 'Sì' }).click()
    await page.getByRole('button', { name: 'Agenda' }).click()
    await expect(page.locator('.agenda-titolo')).toBeVisible()
  })

  test('testata agenda con Giorno, Settimana e + Nuovo visibili in entrambe le viste', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Settimana', exact: true })).toBeVisible()
    await expect(page.locator('.agenda-btn-nuovo-testata')).toBeVisible()
    await page.getByRole('button', { name: 'Settimana', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Giorno', exact: true })).toBeVisible()
    await expect(page.locator('.agenda-btn-nuovo-testata')).toBeVisible()
    const toggle = page.locator('.agenda-vista-toggle')
    const box = await toggle.boundingBox()
    expect(box!.width).toBeGreaterThan(120)
    expect(box!.height).toBeGreaterThan(30)
  })

  test('saluto senza cifre di conteggio appuntamenti', async ({ page }) => {
    const battuta = page.locator('.agenda-battuta')
  await expect(battuta).toBeVisible()
    const testo = (await battuta.textContent()) ?? ''
    expect(testo).not.toMatch(/\d+/)
  })

  test('crea serie con una riga esclusa e una ritoccata', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nuovo' }).click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Serie Nuova')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Serie Nuova')
    await page.getByLabel('Telefono').fill('333 000 0777')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Ripeti…' }).click()
    await page.getByRole('button', { name: 'Ogni 2 sett.' }).click()
    const righe = page.locator('.modulo-ripeti-lista li')
    await expect(righe).not.toHaveCount(0)
    await righe.nth(1).locator('.modulo-ripeti-escludi input').uncheck()
    await righe.nth(2).locator('.modulo-ripeti-data input').fill('2026-11-25')
    await righe.nth(2).locator('.modulo-ripeti-ora input').fill('10:30')
    const crea = page.getByRole('button', { name: /Crea \d+ appuntament/ })
    const label = (await crea.textContent()) ?? ''
    const n = parseInt(label.match(/\d+/)?.[0] ?? '0', 10)
    expect(n).toBeGreaterThanOrEqual(2)
    await crea.click()
    await page.getByRole('button', { name: 'Annulla' }).last().click()
    await expect(page.getByText('Serie Nuova')).toHaveCount(0)
  })

  test('pannello modifica: azioni visibili senza scroll a 1440×900', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.locator('.app-blocco-serie').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const corpo = page.locator('.pannello-corpo')
    await corpo.evaluate((el) => {
      el.scrollTop = 0
    })
    const vh = page.viewportSize()!.height
    const dentroSchermo = async (loc: import('@playwright/test').Locator) => {
      await expect(loc).toBeVisible()
      const box = await loc.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(-1)
      expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1)
    }
    await dentroSchermo(page.getByRole('button', { name: 'Ripeti…' }))
    await dentroSchermo(page.getByText(/Appuntamento fisso · \d+ di \d+/))
    await dentroSchermo(page.locator('.messaggi-rapidi .btn-messaggio-rapido').first())
    await dentroSchermo(page.getByRole('button', { name: /Invia riepilogo/ }))
    await dentroSchermo(page.getByRole('button', { name: 'Scambia con…' }))
    await dentroSchermo(page.getByRole('button', { name: 'Sposta', exact: true }))
    await dentroSchermo(page.getByRole('button', { name: 'Elimina', exact: true }))
    await dentroSchermo(page.getByRole('button', { name: 'Disdici' }))
    await dentroSchermo(page.getByRole('button', { name: 'Segna da pagare' }))
  })

  test('anteprima ripeti: righe sotto 64 px e almeno 6 visibili con 8 date', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByText('Mario Rossi').first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ripeti…' }).click()
    await page.getByRole('button', { name: 'Ogni 2 sett.' }).click()
    const lista = page.getByRole('dialog').locator('.modulo-ripeti .modulo-ripeti-lista')
    await expect(lista).toBeVisible()
    const righe = lista.locator('> li')
    await expect(righe).toHaveCount(8, { timeout: 10_000 })
    const corpo = page.locator('.pannello-corpo')
    await corpo.evaluate((el) => {
      el.scrollTop = 0
    })
    lista.evaluate((el) => {
      el.scrollTop = 0
    })
    const listaBox = await lista.boundingBox()
    expect(listaBox).not.toBeNull()
    let visibili = 0
    const n = await righe.count()
    for (let i = 0; i < n; i++) {
      const riga = righe.nth(i).locator('.modulo-ripeti-riga')
      const box = await riga.boundingBox()
      const boxLi = await righe.nth(i).boundingBox()
      if (!box || !boxLi || !listaBox) continue
      expect(box.height).toBeLessThan(64)
      if (boxLi.y >= listaBox.y - 1 && boxLi.y + boxLi.height <= listaBox.y + listaBox.height + 1) visibili++
    }
    expect(visibili).toBeGreaterThanOrEqual(6)
  })

  test('questo e i successivi su spostamento ed eliminazione con Annulla', async ({ page }) => {
    await impostaDataAgenda(page, '2026-11-17')
    await page.locator('.agenda-btn-nuovo-testata').click()
    await page.getByPlaceholder('Nome o ultime cifre del telefono').fill('Ripeti Serie')
    await page.getByRole('button', { name: 'Cliente nuovo' }).click()
    await page.getByLabel('Nome').fill('Ripeti Serie')
    await page.getByLabel('Telefono').fill('333 000 0666')
    await page.getByRole('button', { name: 'Aggiungi cliente' }).click()
    await page.getByRole('button', { name: 'Ripeti…' }).click()
    await page.getByRole('button', { name: 'Ogni settimana' }).click()
    await page.getByRole('button', { name: /Crea \d+ appuntament/ }).click()
    await page.locator('.app-blocco-serie-mark').first().click()
    await page.getByRole('button', { name: 'Sposta' }).click()
    await page.locator('.sposta-box input[type="time"]').fill('11:00')
    await page.getByRole('button', { name: 'Conferma spostamento' }).click()
    await page.getByRole('button', { name: 'Questo e i successivi' }).click()
    await page.getByRole('button', { name: 'Annulla' }).last().click()
    await page.locator('.app-blocco-serie-mark').first().click()
    await page.getByRole('button', { name: 'Elimina' }).click()
    await page.getByRole('button', { name: 'Sì, elimina' }).click()
    await page.getByRole('button', { name: 'Questo e i successivi' }).click()
    await page.getByRole('button', { name: 'Annulla' }).last().click()
    await expect(page.locator('.app-blocco-serie-mark').first()).toBeVisible()
  })
})

test.describe('giro 3 — compleanni e scheda', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc-1440', 'solo pc-1440')
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await esciBenvenutoVuoto(page)
    await page.getByRole('button', { name: 'Impostazioni' }).click()
    await page.getByRole('button', { name: 'Carica dati demo' }).click()
    await page.getByRole('button', { name: 'Sì' }).click()
  })

  test('compleanni nel riquadro clienti e cake in agenda', async ({ page }) => {
    await page.getByRole('button', { name: 'Clienti' }).click()
    await expect(page.getByRole('heading', { name: 'Compleanni' })).toBeVisible()
    await expect(page.getByText('Mario Rossi', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Agenda' }).click()
    await impostaDataAgenda(page, '2026-11-14')
    await expect(page.locator('.app-blocco-cliente').filter({ hasText: '🎂' }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('scheda cliente e apri scheda dal pannello', async ({ page }) => {
    await page.getByRole('button', { name: 'Agenda' }).click()
    await impostaDataAgenda(page, '2026-11-17')
    await page.getByText('Mario Rossi').first().click()
    await expect(page.getByText(/Taglio abituale:/)).toBeVisible()
    await page.getByRole('button', { name: 'Apri scheda' }).click()
    await expect(page.getByLabel('Taglio abituale')).toHaveValue(/Sfumatura/)
    await expect(page.getByText(/Viene ogni circa/)).toBeVisible()
  })
})

test.describe('screenshot collaterale', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const ok = testInfo.project.name === 'tablet-1280' || testInfo.project.name === 'telefono-390'
    test.skip(!ok, 'solo tablet-1280 o telefono-390')
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('genera screenshot delle cinque schermate', async ({ page }, testInfo) => {
    const suffisso = testInfo.project.name === 'telefono-390' ? '-telefono' : ''
    await screenshotSchermate(page, suffisso)
  })
})

