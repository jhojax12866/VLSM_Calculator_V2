const fs = require("fs")
const path = require("path")
const { createCanvas } = require("canvas")

// Asegúrate de instalar el paquete canvas:
// npm install canvas

// Función para crear un icono simple
function generateSampleIcon(size, outputPath) {
  // Crear un canvas del tamaño especificado
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
  fs.writeFileSync(outputPath, buffer)

  console.log(`Icono generado: ${outputPath}`)
}

// Crear directorio de assets si no existe
const assetsDir = path.join(__dirname, "../assets")
const iconsDir = path.join(assetsDir, "icons")

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir)
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir)
}

// Generar iconos para Linux en diferentes tamaños
const sizes = [16, 32, 48, 64, 128, 256, 512]
sizes.forEach((size) => {
  generateSampleIcon(size, path.join(iconsDir, `${size}x${size}.png`))
})

// Nota: Para generar .ico y .icns necesitarías herramientas adicionales
console.log("Iconos de muestra generados en la carpeta assets/icons")
console.log(
  "Nota: Para Windows (.ico) y macOS (.icns) necesitarás convertir estos PNG usando herramientas específicas.",
)
