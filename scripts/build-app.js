const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

console.log("🚀 Iniciando proceso de construcción de VLSM Calculator V.2...")

// Verificar que exista el logo
const logoPath = path.join(__dirname, "../assets/logo.png")
if (!fs.existsSync(logoPath)) {
  console.log("⚠️ No se encontró el archivo logo.png en la carpeta assets.")
  console.log("Generando un logo temporal...")

  try {
    // Intentar ejecutar el script para crear el logo
    execSync("node scripts/create-logo.js", { stdio: "inherit" })
    console.log("✅ Logo generado correctamente.")
  } catch (error) {
    console.error("❌ Error al generar el logo:", error.message)
    process.exit(1)
  }
}

// Verificar que todas las dependencias estén instaladas
console.log("📦 Verificando dependencias...")
try {
  execSync("npm list electron electron-builder ssh2 pdfkit", { stdio: "inherit" })
} catch (error) {
  console.log("⚠️ Algunas dependencias pueden faltar. Instalando dependencias...")
  try {
    execSync("npm install", { stdio: "inherit" })
    console.log("✅ Dependencias instaladas correctamente.")
  } catch (installError) {
    console.error("❌ Error al instalar dependencias:", installError.message)
    process.exit(1)
  }
}

// Construir la aplicación
console.log("🔨 Construyendo VLSM Calculator V.2 para Windows...")
try {
  execSync("npm run build", { stdio: "inherit" })
  console.log("✅ Aplicación construida correctamente.")
  console.log('📁 El instalador se encuentra en la carpeta "dist" con el nombre "VLSM Calculator V.2-Setup-4.5.0.exe"')
} catch (error) {
  console.error("❌ Error al construir la aplicación:", error.message)
  process.exit(1)
}
