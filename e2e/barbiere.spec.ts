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
    await page.getByRole('button', { name: /Aggiungi comunque un appuntamento/i }).click()
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
    await expect(blocchi).toHaveCount(5)

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
    await expect(page.locator('.app-blocco')).toHaveCount(5)
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
    await expect(page.locator('.agenda-frase-momento')).toBeVisible()
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

