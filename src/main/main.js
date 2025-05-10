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
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const totalHosts = vlsmData.subnets.reduce((sum, s) => sum + s.hosts, 0);
      const totalAddresses = vlsmData.subnets.reduce((sum, s) => {
        const maskParts = s.netmask.split(".");
        let hostBits = 0;
        maskParts.forEach((part) => {
          const num = parseInt(part);
          for (let i = 7; i >= 0; i--) {
            if (!(num & (1 << i))) hostBits++;
          }
        });
        return sum + Math.pow(2, hostBits);
      }, 0);

      const networkParts = vlsmData.subnets[0].subnet.split(".");
      const networkBase = `${networkParts[0]}.${networkParts[1]}.0.0`;
      const cidr = maskToCidr(vlsmData.subnets[0].netmask);

      const headers = ['#', 'Hosts', 'Subred', 'Máscara', 'Primer Host', 'Último Host', 'Broadcast'];
      const columnWidths = [30, 50, 120, 110, 120, 120, 120];
      const rowHeight = 24;
      const startX = 40;

      let y;

      const drawHeader = () => {
        doc
          .fillColor('#1D3557')
          .fontSize(20)
          .text('📄 Reporte de Subredes VLSM', { align: 'center' })
          .moveDown(0.5)
          .fontSize(10)
          .fillColor('#457B9D')
          .text(`Generado: ${new Date().toLocaleString()}`, { align: 'center' })
          .moveDown(1.5);

        doc
          .fontSize(12)
          .fillColor('#333')
          .text(`📍 Dirección IP Base: `, { continued: true })
          .fillColor('#000')
          .text(`${networkBase}/${cidr}`)
          .moveDown(0.3)
          .fillColor('#333')
          .text(`📋 Número de Subredes: `, { continued: true })
          .fillColor('#000')
          .text(`${vlsmData.subnets.length}`)
          .moveDown(0.3)
          .fillColor('#333')
          .text(`👥 Número Total de Hosts: `, { continued: true })
          .fillColor('#000')
          .text(`${totalHosts}`)
          .moveDown(1.5);

        y = doc.y;
        doc.rect(startX, y, 700, rowHeight).fill('#4CAF50');
        drawRow(headers, y, true);
        y += rowHeight;
      };

      const drawRow = (row, y, isHeader = false, bgColor = null) => {
        let x = startX;
        if (bgColor) {
          doc.rect(x, y, 700, rowHeight).fill(bgColor);
        }

        row.forEach((text, i) => {
          doc
            .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(9)
            .fillColor(isHeader ? '#ffffff' : '#333333')
            .text(String(text), x + 5, y + 7, {
              width: columnWidths[i] - 10,
              align: 'center',
              ellipsis: true,
            });
          x += columnWidths[i];
        });
      };

      const ensureSpace = (spaceNeeded) => {
        if (doc.y + spaceNeeded > doc.page.height - 60) {
          doc.addPage();
          doc.y = 40;
          drawHeader();
        }
      };

      drawHeader();

      vlsmData.subnets.forEach((subnet, index) => {
        ensureSpace(rowHeight + 20);
        const row = [
          `${index + 1}`,
          subnet.hosts,
          `${subnet.subnet}/${maskToCidr(subnet.netmask)}`,
          subnet.netmask,
          subnet.firstHost,
          subnet.lastHost,
          subnet.broadcast,
        ];
        const bgColor = index % 2 === 0 ? '#f5f5f5' : '#ffffff';
        drawRow(row, y, false, bgColor);
        y += rowHeight;
      });

      doc.moveDown(2);

      const stats = [
        ['Direcciones posibles:', totalAddresses],
        ['Hosts solicitados:', totalHosts],
        ['Porcentaje utilizado:', `${Math.round((totalHosts / totalAddresses) * 100)}%`],
      ];

      stats.forEach(([label, value]) => {
        ensureSpace(30);
        doc
          .fontSize(10)
          .fillColor('#555')
          .text(label, 400, doc.y, { width: 200, align: 'right' })
          .text(value.toString(), 620, doc.y, { width: 60, align: 'right' })
          .moveDown(0.8);
      });

      doc.end();
      doc.on('end', () => {
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
          doc.switchToPage(i);
          doc
            .fontSize(8)
            .fillColor('#aaaaaa')
            .text(`Página ${i + 1} de ${range.count} • Calculadora VLSM - © 2025`, 40, doc.page.height - 30, {
              align: 'center',
            });
        }
        resolve(outputPath);
      });

      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
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
