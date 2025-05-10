const fs = require("fs")
const path = require("path")

// Verificar si existe el directorio assets
const assetsDir = path.join(__dirname, "./assets")
if (!fs.existsSync(assetsDir)) {
  console.log("Creando directorio assets...")
  fs.mkdirSync(assetsDir, { recursive: true })
}

// Verificar si existe el archivo logo.png
const logoPath = path.join(assetsDir, "logo1.png")
if (!fs.existsSync(logoPath)) {
  console.log("El archivo logo.png no existe en la carpeta assets.")
  console.log("Por favor, coloca un archivo logo.png en la carpeta assets.")
} else {
  console.log("El archivo logo.png existe en la carpeta assets.")
}

// Mostrar la ruta completa para verificación
console.log("Ruta completa del logo:", logoPath)
