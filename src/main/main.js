const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const { Client } = require("ssh2")
const PDFDocument = require("pdfkit")
const os = require("os")

// Mantener una referencia global del objeto window
let mainWindow

// Función para generar un PDF con los datos VLSM
async function generateVlsmPdf(vlsmData, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Crear un nuevo documento PDF
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Reporte VLSM ${vlsmData.subnets[0].subnet}`,
          Author: "Calculadora VLSM",
        },
      })

      // Pipe el PDF a un archivo
      const stream = fs.createWriteStream(outputPath)
      doc.pipe(stream)

      // Calcular totales
      const totalHosts = vlsmData.subnets.reduce((sum, subnet) => sum + subnet.hosts, 0)
      const totalAddresses = vlsmData.subnets.reduce((sum, subnet) => {
        // Calcular el número de direcciones en esta subred basado en la máscara
        const maskParts = subnet.netmask.split(".")
        let hostBits = 0
        maskParts.forEach((part) => {
          const num = Number.parseInt(part)
          for (let i = 7; i >= 0; i--) {
            if (!(num & (1 << i))) {
              hostBits++
            }
          }
        })
        return sum + Math.pow(2, hostBits)
      }, 0)

      // Encabezado (sin logo)
      doc
        .fontSize(22)
        .fillColor("#2c3e50")
        .text("Calculadora FLSM & VLSM", 50, 50)
        .fontSize(10)
        .fillColor("#7f8c8d")
        .text("Reporte de subredes", 50, 80)
        .text("Generado: " + new Date().toLocaleString(), 450, 50, { align: "right" })

      doc.moveDown(2)

      // Información de la red
      const networkParts = vlsmData.subnets[0].subnet.split(".")
      const networkBase = `${networkParts[0]}.${networkParts[1]}.0.0`
      const cidr = maskToCidr(vlsmData.subnets[0].netmask)

      doc.fontSize(14).fillColor("#0078D7").text("SUBREDES VLSM", 350, 150, { align: "right" })

      doc
        .fontSize(12)
        .fillColor("#333")
        .text(`DIRECCIÓN IP:`, 50, 150)
        .text(`${networkBase} /${cidr}`, 50, 170)
        .text(`255.255.0.0`, 50, 190)
        .text(`Subdividir otra red`, 50, 210, { color: "#0078D7", underline: true })

      doc
        .text(`Número de subredes: ${vlsmData.subnets.length}`, 350, 170, { align: "right" })
        .text(`Número total de hosts: ${totalHosts}`, 350, 190, { align: "right" })

      doc.moveDown(2)

      // Tabla de subredes
      const tableTop = 250
      const tableHeaders = ["#", "Hosts", "Subred", "Máscara", "Primer Host", "Último Host", "Broadcast"]
      const colWidths = [30, 50, 100, 100, 90, 90, 90]
      let currentY = tableTop

      // Encabezados de la tabla
      doc.fillColor("#ffffff")
      doc.rect(50, currentY, 550, 30).fill("#4CAF50")
      doc.fillColor("#ffffff")

      let currentX = 50
      tableHeaders.forEach((header, i) => {
        doc.text(header, currentX + 5, currentY + 10)
        currentX += colWidths[i]
      })

      currentY += 30

      // Filas de la tabla
      vlsmData.subnets.forEach((subnet, index) => {
        const rowHeight = 25
        const isEven = index % 2 === 0

        // Fondo de la fila
        doc.fillColor(isEven ? "#f2f2f2" : "#e6e6e6")
        doc.rect(50, currentY, 550, rowHeight).fill()

        // Número de fila con fondo verde
        doc.fillColor("#4CAF50")
        doc.rect(50, currentY, 30, rowHeight).fill()
        doc.fillColor("#ffffff")
        doc.text(index + 1, 50 + 10, currentY + 7)

        // Datos de la fila
        doc.fillColor("#333333")
        doc.text(subnet.hosts.toString(), 50 + 30 + 5, currentY + 7)

        // Calcular CIDR para la subred
        const cidr = maskToCidr(subnet.netmask)
        doc.text(`${subnet.subnet}/${cidr}`, 50 + 30 + 50 + 5, currentY + 7)
        doc.text(subnet.netmask, 50 + 30 + 50 + 100 + 5, currentY + 7)
        doc.text(subnet.firstHost, 50 + 30 + 50 + 100 + 100 + 5, currentY + 7)
        doc.text(subnet.lastHost, 50 + 30 + 50 + 100 + 100 + 90 + 5, currentY + 7)
        doc.text(subnet.broadcast, 50 + 30 + 50 + 100 + 100 + 90 + 90 + 5, currentY + 7)

        currentY += rowHeight
      })

      // Estadísticas finales
      currentY += 30

      const statsData = [
        { label: "Número direcciones proporcionadas pora la IP", value: totalAddresses },
        { label: "Número de Hosts solicitados", value: totalHosts },
        { label: "Número de Hosts encontrados", value: totalHosts },
        { label: "Porcentaje de direcciones utilizadas", value: `${Math.round((totalHosts / totalAddresses) * 100)}%` },
        {
          label: "Porcentaje de direcciones encontradas",
          value: `${Math.round((totalHosts / totalAddresses) * 100)}%`,
        },
      ]

      statsData.forEach((stat) => {
        doc.fillColor("#333333")
        doc.text(stat.label, 250, currentY, { width: 250, align: "right" })
        doc.text(stat.value.toString(), 520, currentY, { width: 80, align: "right" })

        // Línea divisoria
        doc
          .moveTo(250, currentY + 20)
          .lineTo(600, currentY + 20)
          .stroke("#e6e6e6")

        currentY += 30
      })

      // Pie de página
      const today = new Date()
      const formattedDate = `${today.getDate().toString().padStart(2, "0")}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getFullYear()}`

      doc
        .fontSize(10)
        .text(formattedDate, 50, doc.page.height - 50, { align: "left" })
        .text(`1/${doc.page.pageCount}`, doc.page.width / 2, doc.page.height - 50, { align: "center" })
        .text("Calculadora VLSM - © @arcadio", doc.page.width - 50, doc.page.height - 50, { align: "right" })

      // Finalizar el documento
      doc.end()

      // Cuando el stream se cierre, resolver la promesa
      stream.on("finish", () => {
        resolve(outputPath)
      })

      stream.on("error", (err) => {
        reject(err)
      })
    } catch (error) {
      reject(error)
    }
  })
}

// Función auxiliar para convertir máscara a CIDR
function maskToCidr(mask) {
  const parts = mask.split(".")
  let cidr = 0

  for (let i = 0; i < 4; i++) {
    const octet = Number.parseInt(parts[i])
    for (let j = 7; j >= 0; j--) {
      if (octet & (1 << j)) {
        cidr++
      } else {
        return cidr
      }
    }
  }

  return cidr
}

// Registrar manejadores IPC
setupIpcHandlers()

function createWindow() {
  console.log("Creando ventana principal...")

  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  })

  // Cargar el archivo index.html
  const indexPath = path.join(__dirname, "../renderer/index.html")
  console.log("Cargando archivo desde:", indexPath)
  mainWindow.loadFile(indexPath)

  // Abrir DevTools para depuración
  mainWindow.webContents.openDevTools()

  // Informar al renderer sobre los canales IPC registrados
  mainWindow.webContents.on("did-finish-load", () => {
    const registeredChannels = ipcMain.eventNames()
    console.log("Canales IPC registrados en main:", registeredChannels)
    mainWindow.webContents.send("ipc-ready", registeredChannels)
  })
}

// Este método se llamará cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(createWindow)

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Función para generar una clave secreta
function generateSecretKey() {
  try {
    // Generar clave aleatoria
    const key = crypto.randomBytes(32)

    // Guardar la clave en un archivo en el directorio de datos de la aplicación
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    fs.writeFileSync(keyPath, key)

    console.log("✅ Clave generada y guardada en:", keyPath)
    return key
  } catch (error) {
    console.error("❌ Error al generar la clave:", error)
    return null
  }
}

// Función para cifrar credenciales
function encryptCredentials(user, password, ipDirection) {
  try {
    // Verificar si existe la clave, si no, generarla
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    let key

    if (fs.existsSync(keyPath)) {
      key = fs.readFileSync(keyPath)
    } else {
      key = generateSecretKey()
      if (!key) throw new Error("No se pudo generar la clave")
    }

    // Crear función de cifrado
    function encrypt(text) {
      // Generar IV aleatorio
      const iv = crypto.randomBytes(16)

      // Crear cifrador
      const cipher = crypto.createCipheriv("aes-256-cbc", key.slice(0, 32), iv)

      // Cifrar datos
      let encrypted = cipher.update(text, "utf8", "base64")
      encrypted += cipher.final("base64")

      // Combinar IV y datos cifrados
      return Buffer.concat([iv, Buffer.from(encrypted, "base64")]).toString("base64")
    }

    // Cifrar credenciales
    const userEncrypted = encrypt(user)
    const passwordEncrypted = encrypt(password)
    const ipEncrypted = encrypt(ipDirection)

    // Guardar datos cifrados en el directorio de datos de la aplicación
    const credPath = path.join(app.getPath("userData"), "credenciales.enc")
    fs.writeFileSync(credPath, userEncrypted + "\n" + passwordEncrypted + "\n" + ipEncrypted)

    console.log("✅ Credenciales cifradas y guardadas en:", credPath)
    return true
  } catch (error) {
    console.error("❌ Error al cifrar credenciales:", error)
    return false
  }
}

// Función para descifrar datos
function decryptData(encryptedData, key) {
  try {
    // Convertir de base64 a buffer
    const data = Buffer.from(encryptedData, "base64")

    // Extraer IV (primeros 16 bytes)
    const iv = data.slice(0, 16)
    const encryptedText = data.slice(16).toString("base64")

    // Crear descifrador
    const decipher = crypto.createDecipheriv("aes-256-cbc", key.slice(0, 32), iv)

    // Descifrar datos
    let decrypted = decipher.update(encryptedText, "base64", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  } catch (error) {
    console.error("Error al descifrar:", error)
    return null
  }
}

// Función para automatizar la configuración de red
async function automateNetworkConfiguration(dhcpConfig) {
  try {
    // Verificar si existen los archivos necesarios
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    const credPath = path.join(app.getPath("userData"), "credenciales.enc")

    if (!fs.existsSync(keyPath) || !fs.existsSync(credPath)) {
      throw new Error("No se encontraron credenciales. Por favor, configura el servidor primero.")
    }

    // Leer la clave
    const key = fs.readFileSync(keyPath)

    // Leer y descifrar credenciales
    const credencialesCifradas = fs.readFileSync(credPath, "utf8").split("\n")

    const user = decryptData(credencialesCifradas[0], key)
    const password = decryptData(credencialesCifradas[1], key)
    const host = decryptData(credencialesCifradas[2], key)

    if (!user || !password || !host) {
      throw new Error("Error al descifrar las credenciales")
    }

    // Configuración de interfaces (valor predeterminado)
    const interfaceName = "enp0s3"
    const configureInterfaces = `INTERFACEv4=\\"${interfaceName}\\"`

    // Comandos SSH
    const comandoBackup = `echo ${password} | sudo -S cp /etc/dhcp/dhcpd.conf /etc/dhcp/dhcpd.conf.bak`
    const comandoBackupInterfaces = `echo ${password} | sudo -S cp /etc/default/isc-dhcp-server /etc/default/isc-dhcp-server.bak`
    const comandoConfInterfaces = `echo ${password} | sudo -S bash -c 'echo -e "${configureInterfaces}" > /etc/default/isc-dhcp-server'`
    const comandoEditar = `echo ${password} | sudo -S bash -c 'echo -e "\n# Configuración añadida por VLSM Calculator\n${dhcpConfig}" >> /etc/dhcp/dhcpd.conf'`
    const comandoVerificar = "cat /etc/dhcp/dhcpd.conf"
    const comandoReiniciar = `echo ${password} | sudo -S systemctl restart isc-dhcp-server`

    // Crear cliente SSH
    const ssh = new Client()

    // Agregar más eventos para depuración
    ssh.on("banner", (message) => {
      console.log("Banner SSH:", message)
    })

    ssh.on("handshake", () => {
      console.log("Handshake SSH completado")
    })

    ssh.on("error", (err) => {
      console.error("Error SSH detallado:", err)
    })

    // Conectar por SSH con timeout más largo y más información
    await new Promise((resolve, reject) => {
      console.log(`Intentando conectar a ${host}:22 con usuario ${user}...`)

      ssh
        .on("ready", () => {
          console.log("Conexión SSH establecida correctamente")
          resolve()
        })
        .connect({
          host,
          port: 22,
          username: user,
          password,
          readyTimeout: 30000, // Aumentar timeout a 30 segundos
          debug: (message) => console.log("SSH Debug:", message),
          // Aceptar claves de host desconocidas
          algorithms: {
            serverHostKey: ["ssh-rsa", "ssh-dss", "ecdsa-sha2-nistp256", "ssh-ed25519"],
          },
        })
    })

    // Función para ejecutar comandos SSH
    const ejecutarComando = (comando) => {
      return new Promise((resolve, reject) => {
        ssh.exec(comando, (err, stream) => {
          if (err) return reject(err)

          let salida = ""
          let error = ""

          stream
            .on("close", (code) => {
              if (code !== 0) {
                console.error(`Error en comando (código ${code}):`, error)
                // No rechazamos para continuar con el proceso
              }
              resolve(salida)
            })
            .on("data", (data) => {
              salida += data.toString()
            })
            .stderr.on("data", (data) => {
              error += data.toString()
            })
        })
      })
    }

    // 1️⃣ Hacer un backup antes de modificar el archivo
    console.log("📌 Creando backup del archivo DHCP...")
    await ejecutarComando(comandoBackup)
    await ejecutarComando(comandoBackupInterfaces)

    // 2️⃣ Modificar el archivo DHCP
    console.log("✍️ Escribiendo nueva configuración...")
    await ejecutarComando(comandoEditar)
    await ejecutarComando(comandoConfInterfaces)

    // 3️⃣ Verificar que el archivo realmente cambió
    console.log("🔍 Verificando contenido del archivo...")
    const contenidoActual = await ejecutarComando(comandoVerificar)
    console.log(contenidoActual)

    // 4️⃣ Reiniciar el servicio DHCP
    console.log("🔄 Reiniciando el servicio DHCP...")
    await ejecutarComando(comandoReiniciar)

    console.log("✅ Archivo DHCP modificado y servicio reiniciado correctamente.")

    // Cerrar conexión SSH
    ssh.end()

    return {
      success: true,
      message: "Configuración aplicada correctamente",
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    return {
      success: false,
      message: error.message,
    }
  }
}

// Configurar todos los manejadores IPC
function setupIpcHandlers() {
  console.log("Registrando manejadores IPC...")

  // Manejar la solicitud para guardar configuración del servidor
  ipcMain.handle("guardar-configuracion-servidor", async (event, configuracion) => {
    try {
      // Aquí es donde se reciben los datos del formulario HTML
      const { ip, usuario, contrasena } = configuracion
      console.log("Recibiendo datos del formulario:", { ip, usuario, contrasena: "***" })

      // Cifrar y guardar credenciales con los datos del formulario
      const resultado = encryptCredentials(usuario, contrasena, ip)

      if (resultado) {
        return { exito: true, mensaje: "Configuración guardada correctamente" }
      } else {
        return { exito: false, mensaje: "Error al guardar la configuración" }
      }
    } catch (error) {
      console.error("Error al guardar configuración:", error)
      return { exito: false, mensaje: error.message }
    }
  })

  // Manejar la solicitud para obtener configuración del servidor
  ipcMain.handle("obtener-configuracion-servidor", async (event) => {
    try {
      // Verificar si existen los archivos necesarios
      const keyPath = path.join(app.getPath("userData"), "secret.key")
      const credPath = path.join(app.getPath("userData"), "credenciales.enc")

      if (!fs.existsSync(keyPath) || !fs.existsSync(credPath)) {
        return null
      }

      // Leer la clave
      const key = fs.readFileSync(keyPath)

      // Leer y descifrar credenciales
      const credencialesCifradas = fs.readFileSync(credPath, "utf8").split("\n")

      const usuario = decryptData(credencialesCifradas[0], key)
      const ip = decryptData(credencialesCifradas[2], key)

      if (!usuario || !ip) {
        return null
      }

      return {
        ip,
        usuario,
        // No devolver la contraseña por seguridad
      }
    } catch (error) {
      console.error("Error al obtener configuración:", error)
      return null
    }
  })

  // Manejar la solicitud para enviar configuración al servidor
  ipcMain.handle("enviar-configuracion", async (event, configuracion) => {
    try {
      // Usar la función de automatización
      const resultado = await automateNetworkConfiguration(configuracion)

      if (resultado.success) {
        return { exito: true, mensaje: resultado.message }
      } else {
        return { exito: false, mensaje: resultado.message }
      }
    } catch (error) {
      console.error("Error al enviar configuración:", error)
      return { exito: false, mensaje: error.message }
    }
  })

  // Manejar la solicitud para generar un PDF con los datos VLSM
  ipcMain.handle("generar-pdf", async (event, vlsmData) => {
    try {
      console.log("Recibiendo solicitud para generar PDF")

      // Crear directorio de descargas si no existe
      const downloadsPath = path.join(os.homedir(), "Downloads")
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath)
      }

      // Generar nombre de archivo basado en la dirección de red
      const networkBase = vlsmData.subnets[0].subnet
      const pdfFileName = `reporte_VLSM_${networkBase.replace(/\./g, "_")}.pdf`
      const pdfPath = path.join(downloadsPath, pdfFileName)

      // Generar el PDF
      await generateVlsmPdf(vlsmData, pdfPath)

      return {
        exito: true,
        mensaje: "PDF generado correctamente",
        ruta: pdfPath,
      }
    } catch (error) {
      console.error("Error al generar PDF:", error)
      return {
        exito: false,
        mensaje: error.message,
      }
    }
  })

  // Listar todos los manejadores registrados
  console.log("Manejadores IPC registrados:", ipcMain.eventNames())
}
