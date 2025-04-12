const fs = require("fs")
const path = require("path")
const { createCanvas } = require("canvas")

// Asegúrate de instalar el paquete canvas:
// npm install canvas

// Función para crear un logo simple
function generateSimpleLogo() {
  // Crear un canvas
  const size = 200
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")

  // Fondo
  ctx.fillStyle = "#3498db"
  ctx.fillRect(0, 0, size, size)

  // Dibujar un círculo
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2)
  ctx.fill()

  // Dibujar texto "VLSM"
  ctx.fillStyle = "#2c3e50"
  ctx.font = `bold ${size / 5}px Arial`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("VLSM", size / 2, size / 2)

  // Guardar como PNG
  const buffer = canvas.toBuffer("image/png")

  // Crear directorio de assets si no existe
  const assetsDir = path.join(__dirname, "../assets")
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }

  const logoPath = path.join(assetsDir, "logo.png")
  fs.writeFileSync(logoPath, buffer)

  console.log(`Logo generado en: ${logoPath}`)
}

// Generar el logo
generateSimpleLogo()
