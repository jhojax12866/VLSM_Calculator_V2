// Archivo principal de la aplicación Electron
const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const { Client } = require("ssh2")
const PDFDocument = require("pdfkit")
const os = require("os")

// Mantener una referencia global del objeto window
let mainWindow

function createWindow() {
  console.log("Creando ventana principal...")

  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "src/preload/preload.js"),
    },
  })

  // Cargar el archivo index.html
  const indexPath = path.join(__dirname, "src/renderer/index.html")
  console.log("Cargando archivo desde:", indexPath)
  mainWindow.loadFile(indexPath)

  // Abrir DevTools para depuración
  // mainWindow.webContents.openDevTools()

  // Informar al renderer sobre los canales IPC registrados
  mainWindow.webContents.on("did-finish-load", () => {
    const registeredChannels = ipcMain.eventNames()
    console.log("Canales IPC registrados en main:", registeredChannels)
    mainWindow.webContents.send("ipc-ready", registeredChannels)
  })
}

// Este método se llamará cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(() => {
  createWindow()
  setupIpcHandlers()
})

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Función para generar un PDF con los datos VLSM
async function generateVlsmPdf(vlsmData, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Crear un nuevo documento PDF
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Reporte VLSM ${vlsmData.subnets[0].subnet}`,
          Author: "VLSM Calculator",
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

      // Colores para el diseño
      const colors = {
        primary: "#0099ff",
        secondary: "#003366",
        accent: "#00ccff",
        light: "#e6f7ff",
        text: "#333333",
        lightText: "#666666",
        headerBg: "#003366",
        headerText: "#ffffff",
        rowEven: "#f2f9ff",
        rowOdd: "#ffffff",
        border: "#cccccc",
      }

      // Obtener dimensiones de la página
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 40
      const contentWidth = pageWidth - 2 * margin

      // Encabezado con logo
      doc.rect(margin, margin, contentWidth, 80).fill(colors.headerBg)

      // Añadir logo
      try {
        doc.image(path.join(__dirname, "assets/logo1.png"), margin + 10, margin + 10, { width: 60 })
      } catch (error) {
        console.error("Error al cargar el logo:", error)
        // Si hay error, crear un espacio para el logo
        doc.rect(margin + 10, margin + 10, 60, 60).fill(colors.primary)
      }

      // Título del reporte
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(colors.headerText)
        .text("REPORTE DE SUBREDES VLSM", margin + 80, margin + 20)

      // Fecha de generación
      doc
        .fontSize(10)
        .fillColor(colors.headerText)
        .text(`Generado: ${new Date().toLocaleString()}`, margin + 80, margin + 45)

      // Información de la red
      const networkParts = vlsmData.subnets[0].subnet.split(".")
      const networkBase = `${networkParts[0]}.${networkParts[1]}.${networkParts[2]}.0`
      const cidr = maskToCidr(vlsmData.subnets[0].netmask)

      // Sección de resumen
      doc
        .rect(margin, margin + 100, contentWidth, 80)
        .fill(colors.light)
        .stroke(colors.border)

      doc
        .fillColor(colors.secondary)
        .fontSize(14)
        .text("RESUMEN DE LA RED", margin + 20, margin + 110)

      // Columna izquierda del resumen
      doc
        .fontSize(10)
        .fillColor(colors.text)
        .text(`Dirección de Red: ${networkBase}/${cidr}`, margin + 20, margin + 135)
        .text(`Máscara de Red: ${vlsmData.subnets[0].netmask}`, margin + 20, margin + 155)

      // Columna derecha del resumen
      doc
        .text(`Número de Subredes: ${vlsmData.subnets.length}`, margin + contentWidth / 2, margin + 135)
        .text(`Total de Hosts: ${totalHosts}`, margin + contentWidth / 2, margin + 155)

      // Título de la tabla
      doc
        .fontSize(14)
        .fillColor(colors.secondary)
        .text("DETALLE DE SUBREDES", margin, margin + 200)

      // Tabla de subredes
      const tableTop = margin + 230

      // Definir anchos de columnas proporcionales al contenido
      const tableHeaders = ["#", "Hosts", "Subred", "Máscara", "Primer Host", "Último Host", "Broadcast"]
      const colWidths = [
        contentWidth * 0.05, // #
        contentWidth * 0.08, // Hosts
        contentWidth * 0.17, // Subred
        contentWidth * 0.2, // Máscara
        contentWidth * 0.17, // Primer Host
        contentWidth * 0.17, // Último Host
        contentWidth * 0.16, // Broadcast
      ]

      // Encabezados de la tabla
      doc.rect(margin, tableTop, contentWidth, 25).fill(colors.primary)

      let currentX = margin
      doc.fillColor(colors.headerText).fontSize(9)

      tableHeaders.forEach((header, i) => {
        doc.text(header, currentX + 3, tableTop + 8, { width: colWidths[i], align: "center" })
        currentX += colWidths[i]
      })

      let currentY = tableTop + 25

      // Filas de la tabla
      vlsmData.subnets.forEach((subnet, index) => {
        const rowHeight = 20
        const isEven = index % 2 === 0

        // Fondo de la fila
        doc
          .rect(margin, currentY, contentWidth, rowHeight)
          .fill(isEven ? colors.rowEven : colors.rowOdd)
          .stroke(colors.border)

        // Número de fila
        doc.rect(margin, currentY, colWidths[0], rowHeight).fill(colors.primary)
        doc.fillColor(colors.headerText).text(index + 1, margin, currentY + 5, { width: colWidths[0], align: "center" })

        // Datos de la fila
        doc.fillColor(colors.text).fontSize(8)

        let colX = margin + colWidths[0]

        // Hosts
        doc.text(subnet.hosts.toString(), colX, currentY + 5, { width: colWidths[1], align: "center" })
        colX += colWidths[1]

        // Calcular CIDR para la subred
        const cidr = maskToCidr(subnet.netmask)

        // Subred
        doc.text(`${subnet.subnet}/${cidr}`, colX, currentY + 5, { width: colWidths[2], align: "center" })
        colX += colWidths[2]

        // Máscara
        doc.text(subnet.netmask, colX, currentY + 5, { width: colWidths[3], align: "center" })
        colX += colWidths[3]

        // Primer Host
        doc.text(subnet.firstHost, colX, currentY + 5, { width: colWidths[4], align: "center" })
        colX += colWidths[4]

        // Último Host
        doc.text(subnet.lastHost, colX, currentY + 5, { width: colWidths[5], align: "center" })
        colX += colWidths[5]

        // Broadcast
        doc.text(subnet.broadcast, colX, currentY + 5, { width: colWidths[6], align: "center" })

        currentY += rowHeight

        // Si llegamos al final de la página, crear una nueva
        if (currentY > pageHeight - 150) {
          doc.addPage()

          // Encabezado de la nueva página
          doc.rect(margin, margin, contentWidth, 40).fill(colors.headerBg)
          doc
            .fillColor(colors.headerText)
            .fontSize(12)
            .text("REPORTE DE SUBREDES VLSM (continuación)", margin + 20, margin + 15)

          // Reiniciar la posición Y para la nueva página
          currentY = margin + 60

          // Repetir encabezados de la tabla
          doc.rect(margin, currentY, contentWidth, 25).fill(colors.primary)

          currentX = margin
          doc.fillColor(colors.headerText).fontSize(9)

          tableHeaders.forEach((header, i) => {
            doc.text(header, currentX + 3, currentY + 8, { width: colWidths[i], align: "center" })
            currentX += colWidths[i]
          })

          currentY += 25
        }
      })

      // Estadísticas finales
      currentY += 20

      doc.rect(margin, currentY, contentWidth, 100).fill(colors.light).stroke(colors.border)

      doc
        .fillColor(colors.secondary)
        .fontSize(14)
        .text("ESTADÍSTICAS DE UTILIZACIÓN", margin + 20, currentY + 15)

      currentY += 40

      const statsData = [
        { label: "Direcciones IP disponibles en la red", value: totalAddresses },
        { label: "Hosts solicitados", value: totalHosts },
        { label: "Porcentaje de utilización", value: `${Math.round((totalHosts / totalAddresses) * 100)}%` },
      ]

      statsData.forEach((stat, index) => {
        const yPos = currentY + index * 20

        doc
          .fillColor(colors.text)
          .fontSize(10)
          .text(stat.label, margin + 20, yPos, { width: contentWidth - 120 })

        doc
          .fillColor(colors.primary)
          .fontSize(10)
          .text(stat.value.toString(), margin + contentWidth - 80, yPos, { width: 60, align: "right" })
      })

      // Pie de página
      const pageCount = doc.bufferedPageRange().count
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i)

        // Línea separadora
        doc
          .moveTo(margin, pageHeight - 50)
          .lineTo(pageWidth - margin, pageHeight - 50)
          .stroke(colors.border)

        // Información del pie de página
        doc
          .fontSize(8)
          .fillColor(colors.lightText)
          .text(`VLSM Calculator - Desarrollado por Dev-Jhojan y Dev-Jhonier`, margin, pageHeight - 40, {
            align: "left",
            width: contentWidth / 2,
          })
          .text(`Página ${i + 1} de ${pageCount}`, margin + contentWidth / 2, pageHeight - 40, {
            align: "right",
            width: contentWidth / 2,
          })
      }

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

// Función para aplicar configuración DHCP al servidor
async function applyDhcpConfig(dhcpConfig) {
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

    // Conectar por SSH con timeout más largo
    await new Promise((resolve, reject) => {
      console.log(`Intentando conectar a ${host}:22 con usuario ${user}...`)

      ssh
        .on("ready", () => {
          console.log("Conexión SSH establecida correctamente")
          resolve()
        })
        .on("error", (err) => {
          console.error("Error SSH:", err)
          reject(err)
        })
        .connect({
          host,
          port: 22,
          username: user,
          password,
          readyTimeout: 30000, // Aumentar timeout a 30 segundos
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
    console.error(`❌ Error al aplicar configuración: ${error.message}`)
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
      const { ip, usuario, contrasena } = configuracion
      console.log("Recibiendo datos del formulario:", { ip, usuario, contrasena: "***" })

      // Cifrar y guardar credenciales
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
      // Aplicar configuración DHCP
      const resultado = await applyDhcpConfig(configuracion)

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
