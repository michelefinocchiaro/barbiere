import { expect, test } from '@playwright/test'

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

async function caricaDemoEApriAgenda(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Impostazioni' }).click()
  await page.getByRole('button', { name: 'Carica dati demo' }).click()
  await page.getByRole('button', { name: 'Sì' }).click()
  await page.getByRole('button', { name: 'Agenda' }).click()
}

test.describe('flusso tablet agenda', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.route('https://wa.me/**', (route) => route.abort())
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await page.getByRole('button', { name: 'Impostazioni' }).click()
    await page.getByRole('button', { name: 'Svuota tutto' }).click()
    await page.getByRole('button', { name: 'Sì' }).click()
    await page.getByRole('button', { name: 'Agenda' }).click()
  })

  test('dalla telefonata al promemoria — nuovo appuntamento martedì 17/11', async ({ page }) => {
    await page.locator('input[type="date"]').first().fill('2026-11-17')
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
    await page.locator('input[type="date"]').first().fill('2026-11-17')
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
    expect(link).toMatch(/^https:\/\/wa\.me\/393330000001\?text=/)
    const testo = decodeURIComponent(link!.split('?text=')[1] ?? '')
    expect(testo).toBe(TESTO_PROMEMORIA_ATTESO)
    await invia.click()
    await expect(page.getByRole('button', { name: 'Ha confermato' }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Invia produce una sola richiesta wa.me e resta su Promemoria', async ({ page, context }) => {
    await page.locator('input[type="date"]').first().fill('2026-11-17')
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
    await context.unroute('https://wa.me/**')
    await context.route('https://wa.me/**', (route) => {
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
    await page.locator('input[type="date"]').first().fill('2026-11-17')
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
    await page.locator('input[type="date"]').first().fill('2026-11-17')
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
    await page.locator('input[type="date"]').first().fill('2026-11-16')
    await expect(page.getByText('Chiuso')).toBeVisible()
    await page.getByRole('button', { name: /Nuovo appuntamento/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('agenda dati demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('martedì 17/11 — blocchi demo visibili e allineati alla griglia', async ({ page }) => {
    await page.locator('input[type="date"]').first().fill('2026-11-17')
    const blocchi = page.locator('.app-blocco')
    await expect(blocchi).toHaveCount(5)

    const apreMin = 8 * 60
    const count = await blocchi.count()
    for (let i = 0; i < count; i++) {
      const blocco = blocchi.nth(i)
      const isBreve = await blocco.evaluate((el) => el.classList.contains('app-blocco-breve'))
      const durataMin = isBreve ? 20 : 30
      let etichettaOra = ''
      if (isBreve) {
        const riga = (await blocco.locator('.app-blocco-riga').textContent())?.trim() ?? ''
        etichettaOra = riga.split(/\s+/)[0] ?? ''
      } else {
        etichettaOra = (await blocco.locator('.app-blocco-ora').textContent())?.trim() ?? ''
      }

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

test.describe('screenshot collaterale', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-1280', 'solo 1280×800')
    await page.clock.setFixedTime(SABATO)
    await page.goto('/')
    await caricaDemoEApriAgenda(page)
  })

  test('genera screenshot delle cinque schermate', async ({ page }) => {
    await page.locator('input[type="date"]').first().fill('2026-11-17')
    await expect(page.locator('.app-blocco').first()).toBeVisible()
    await expect(page.getByText('Caricamento')).toHaveCount(0)
    await page.screenshot({ path: 'e2e/screenshot/agenda.png', fullPage: true })

    await page.getByText('Mario Rossi').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Cliente')).toHaveValue('Mario Rossi')
    await page.screenshot({ path: 'e2e/screenshot/pannello-appuntamento.png', fullPage: true })
    await page.getByLabel('Chiudi').click()

    await page.getByRole('button', { name: 'Promemoria' }).click()
    await page.locator('.prom-data input[type="date"]').fill('2026-11-17')
    await expect(page.locator('a.btn-invia').first()).toBeVisible()
    await expect(page.getByText('Caricamento')).toHaveCount(0)
    await page.screenshot({ path: 'e2e/screenshot/promemoria.png', fullPage: true })

    await page.getByRole('button', { name: 'Clienti' }).click()
    await page.getByRole('button', { name: /Mario Rossi/ }).click()
    await expect(page.locator('.storico-lista li').first()).toBeVisible()
    await expect(page.getByText('Caricamento')).toHaveCount(0)
    await page.screenshot({ path: 'e2e/screenshot/clienti.png', fullPage: true })

    await page.getByRole('button', { name: 'Impostazioni' }).click()
    await expect(page.getByRole('button', { name: 'Carica dati demo' })).toBeVisible()
    await expect(page.getByText('Caricamento')).toHaveCount(0)
    await page.screenshot({ path: 'e2e/screenshot/impostazioni.png', fullPage: true })
  })
})
