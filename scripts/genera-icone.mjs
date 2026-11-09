import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = process.argv[2]

if (!input) {
  console.error('Uso: node scripts/genera-icone.mjs <percorso-logo.png>')
  process.exit(1)
}

const inputPath = path.resolve(input)
const outDir = path.join(__dirname, '../public/icons')

fs.mkdirSync(outDir, { recursive: true })

const background = { r: 11, g: 10, b: 11, alpha: 1 }

async function genera(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0
  const logoSize = size - padding * 2

  const logoBuf = await sharp(inputPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const nome = `${maskable ? 'maskable-' : ''}icon-${size}x${size}.png`
  const out = path.join(outDir, nome)

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(out)

  console.log(`Generata ${nome}`)
}

await genera(192)
await genera(512)
await genera(192, true)
await genera(512, true)
