document.addEventListener("DOMContentLoaded", () => {
    // Verificar que ipcRenderer está disponible
    console.log("ipcRenderer disponible:", !!window.electronAPI)
  
    // Elementos de la interfaz
    const formulario = document.getElementById("vlsm-form")
    const resultado = document.getElementById("result")
    const contenedorHosts = document.getElementById("hosts-container")
    const botonCalcular = document.getElementById("calculate-btn")
    const indicadorCarga = document.getElementById("loading-spinner")
    const inputSubredes = document.getElementById("subnets")
    const botonEnviarServidor = document.getElementById("enviar-servidor")
    const estadoServidor = document.getElementById("estado-servidor")
    const formularioServidor = document.getElementById("server-form")
    const estadoConfigServidor = document.getElementById("server-status")
    const botonGenerarPdf = document.getElementById("generar-pdf")
  
    // Elementos de pestañas
    const botonesPestanas = document.querySelectorAll(".tab-btn")
    const contenidosPestanas = document.querySelectorAll(".tab-content")
  
    // Variables globales para almacenar datos
    window.subredes = []
  
    // Gestión de pestañas
    botonesPestanas.forEach((boton) => {
      boton.addEventListener("click", () => {
        // Desactivar todas las pestañas
        botonesPestanas.forEach((b) => b.classList.remove("active"))
        contenidosPestanas.forEach((c) => c.classList.remove("active"))
  
        // Activar la pestaña seleccionada
        boton.classList.add("active")
        const pestanaSeleccionada = boton.getAttribute("data-tab")
        document.getElementById(`${pestanaSeleccionada}-tab`).classList.add("active")
      })
    })
  
    // Escuchar cambios en el campo de número de subredes
    inputSubredes.addEventListener("change", () => {
      generarCamposHost()
    })
  
    // Generar campos de host basados en el número de subredes
    function generarCamposHost() {
      const numSubredes = Number.parseInt(inputSubredes.value) || 0
  
      // Limpiar los campos de host existentes
      contenedorHosts.innerHTML = ""
  
      // Generar nuevos campos de host basados en el número de subredes
      for (let i = 1; i <= numSubredes; i++) {
        const itemHost = document.createElement("div")
        itemHost.className = "host-item"
        itemHost.innerHTML = `
          <label class="subnet-label">Subred ${i}:</label>
          <input type="number" class="host-input" placeholder="Número de hosts" min="1" required>
        `
        contenedorHosts.appendChild(itemHost)
      }
  
      // Mostrar mensaje si no hay subredes
      if (numSubredes <= 0) {
        contenedorHosts.innerHTML = '<p class="no-subnets">Ingresa el número de subredes primero</p>'
      }
    }
  
    // Envío del formulario VLSM
    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault()
  
      try {
        // Mostrar indicador de carga
        indicadorCarga.classList.remove("hidden")
        resultado.textContent = ""
  
        const red = document.getElementById("network").value
        const subredes = document.getElementById("subnets").value
  
        // Obtener todos los inputs de host
        const inputsHost = document.querySelectorAll(".host-input")
        const hosts = Array.from(inputsHost)
          .map((input) => Number.parseInt(input.value.trim()))
          .filter((value) => !isNaN(value) && value > 0)
  
        if (!red || !subredes || hosts.length === 0) {
          throw new Error("Por favor, completa todos los campos requeridos")
        }
  
        // Validar formato de dirección de red (validación simple)
        if (!esDireccionIpValida(red)) {
          throw new Error("Formato de dirección de red inválido")
        }
  
        // Construir la URL con parámetros de consulta
        const url = new URL("http://localhost:3001/vlsm/calculate")
        url.searchParams.append("network", red)
        url.searchParams.append("subnets", subredes)
  
        // Agregar cada host como un parámetro 'hosts' separado
        hosts.forEach((host) => {
          url.searchParams.append("hosts", host)
        })
  
        console.log("Consultando API local:", url.toString())
  
        const respuesta = await fetch(url.toString())
  
        if (!respuesta.ok) {
          throw new Error(`Error de API local: ${respuesta.status} ${respuesta.statusText}`)
        }
  
        // Obtener la respuesta como texto ya que la API devuelve texto formateado
        const datos = await respuesta.text()
  
        // Mostrar el resultado en un bloque preformateado
        resultado.innerHTML = `<pre>${datos}</pre>`
  
        // Habilitar el botón para enviar al servidor
        botonEnviarServidor.disabled = false
        botonGenerarPdf.disabled = false
  
        // Guardar los datos para enviar al servidor
        window.configuracionVLSM = datos
      } catch (error) {
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          resultado.innerHTML = `<div class="error">Error de conexión: No se pudo conectar a la API local. Asegúrate de que el servidor VLSM API esté ejecutándose en http://localhost:3001/vlsm/calculate</div>`
        } else {
          resultado.innerHTML = `<div class="error">${error.message}</div>`
        }
        console.error("Error al consultar API local:", error)
  
        // Deshabilitar el botón para enviar al servidor
        botonEnviarServidor.disabled = true
        botonGenerarPdf.disabled = true
      } finally {
        // Ocultar indicador de carga
        indicadorCarga.classList.add("hidden")
      }
    })
  
    // Generar PDF con los datos VLSM
    botonGenerarPdf.addEventListener("click", async () => {
      try {
        if (!window.electronAPI) {
          throw new Error("Error de comunicación con el proceso principal")
        }
  
        // Mostrar información de generación
        estadoServidor.innerHTML = `<div class="loading">
          <p>Generando PDF con la información VLSM...</p>
          <p>Esto puede tardar unos momentos. Por favor, espera...</p>
          <div class="spinner"></div>
        </div>`
  
        // Obtener los datos en formato JSON desde la API
        const red = document.getElementById("network").value
        const subredes = document.getElementById("subnets").value
        const inputsHost = document.querySelectorAll(".host-input")
        const hosts = Array.from(inputsHost)
          .map((input) => Number.parseInt(input.value.trim()))
          .filter((value) => !isNaN(value) && value > 0)
  
        // Construir la URL para obtener los datos en formato JSON
        const url = new URL("http://localhost:3001/vlsm/calculate-json")
        url.searchParams.append("network", red)
        url.searchParams.append("subnets", subredes)
        hosts.forEach((host) => {
          url.searchParams.append("hosts", host)
        })
  
        console.log("Consultando API JSON:", url.toString())
  
        const respuesta = await fetch(url.toString())
  
        if (!respuesta.ok) {
          throw new Error(`Error de API: ${respuesta.status} ${respuesta.statusText}`)
        }
  
        // Obtener los datos JSON
        const vlsmData = await respuesta.json()
        console.log("Datos VLSM recibidos:", vlsmData)
  
        // Enviar los datos al proceso principal para generar el PDF
        const resultado = await window.electronAPI.sendToMain("generar-pdf", vlsmData)
  
        if (resultado && resultado.exito) {
          estadoServidor.innerHTML = `<div class="success">
            <p>PDF generado correctamente</p>
            <p>Guardado en: ${resultado.ruta}</p>
          </div>`
        } else {
          estadoServidor.innerHTML = `<div class="error">
            <p>Error al generar PDF: ${resultado ? resultado.mensaje : "Error desconocido"}</p>
          </div>`
        }
      } catch (error) {
        estadoServidor.innerHTML = `<div class="error">Error: ${error.message}</div>`
        console.error("Error al generar PDF:", error)
      }
    })
  
    // Enviar configuración al servidor
    botonEnviarServidor.addEventListener("click", async () => {
      try {
        if (!window.electronAPI) {
          throw new Error("Error de comunicación con el proceso principal")
        }
  
        // Mostrar información de conexión
        estadoServidor.innerHTML = `<div class="loading">
          <p>Intentando conectar al servidor...</p>
          <p>Esto puede tardar unos momentos. Por favor, espera...</p>
          <div class="spinner"></div>
        </div>`
  
        // La configuración DHCP ya viene formateada directamente desde la API
        const configuracionDHCP = window.configuracionVLSM
  
        // Enviar la configuración al proceso principal
        const resultado = await window.electronAPI.sendToMain("enviar-configuracion", configuracionDHCP)
  
        if (resultado && resultado.exito) {
          estadoServidor.innerHTML = '<div class="success">Configuración aplicada correctamente en el servidor</div>'
        } else {
          estadoServidor.innerHTML = `<div class="error">
            <p>Error al aplicar configuración: ${resultado ? resultado.mensaje : "Error desconocido"}</p>
            <p>Verifica que:</p>
            <ul>
              <li>La dirección IP del servidor es correcta</li>
              <li>El servidor está encendido y accesible en la red</li>
              <li>El servicio SSH está activo en el servidor</li>
              <li>No hay firewalls bloqueando la conexión</li>
            </ul>
          </div>`
        }
      } catch (error) {
        estadoServidor.innerHTML = `<div class="error">Error: ${error.message}</div>`
        console.error("Error al enviar configuración:", error)
      }
    })
  
    // Guardar configuración del servidor
    formularioServidor.addEventListener("submit", async (evento) => {
      evento.preventDefault()
  
      try {
        if (!window.electronAPI) {
          throw new Error("Error de comunicación con el proceso principal")
        }
  
        // Obtener valores del formulario HTML
        const ip = document.getElementById("server-ip").value
        const usuario = document.getElementById("server-user").value
        const contrasena = document.getElementById("server-password").value
  
        // Validar campos
        if (!ip || !usuario || !contrasena) {
          throw new Error("Por favor, completa todos los campos")
        }
  
        // Validar formato de IP
        if (!esDireccionIpValida(ip)) {
          throw new Error("Formato de dirección IP inválido")
        }
  
        // Mostrar indicador de carga
        estadoConfigServidor.innerHTML = '<div class="loading">Guardando configuración...</div>'
  
        // Enviar datos al proceso principal para cifrar y guardar
        const resultado = await window.electronAPI.sendToMain("guardar-configuracion-servidor", {
          ip,
          usuario,
          contrasena,
        })
  
        if (resultado && resultado.exito) {
          estadoConfigServidor.innerHTML = '<div class="success">Configuración guardada correctamente</div>'
  
          // Limpiar contraseña por seguridad
          document.getElementById("server-password").value = ""
        } else {
          throw new Error(resultado ? resultado.mensaje : "Error al guardar la configuración")
        }
      } catch (error) {
        estadoConfigServidor.innerHTML = `<div class="error">${error.message}</div>`
        console.error("Error al guardar configuración:", error)
      }
    })
  
    // Cargar configuración del servidor si existe
    async function cargarConfiguracionServidor() {
      try {
        if (!window.electronAPI) {
          throw new Error("ipcRenderer no está disponible")
        }
  
        const configuracion = await window.electronAPI.sendToMain("obtener-configuracion-servidor")
  
        if (configuracion) {
          document.getElementById("server-ip").value = configuracion.ip || ""
          document.getElementById("server-user").value = configuracion.usuario || ""
          // No cargar la contraseña por seguridad
        }
      } catch (error) {
        console.error("Error al cargar configuración del servidor:", error)
      }
    }
  
    function esDireccionIpValida(ip) {
      // Validación simple de dirección IP
      const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
      if (!regex.test(ip)) return false
  
      const partes = ip.split(".")
      return partes.every((parte) => Number.parseInt(parte) >= 0 && Number.parseInt(parte) <= 255)
    }
  
    // Inicializar con un mensaje de instrucción
    contenedorHosts.innerHTML = '<p class="no-subnets">Ingresa el número de subredes primero</p>'
  
    // Deshabilitar el botón para enviar al servidor inicialmente
    botonEnviarServidor.disabled = true
    botonGenerarPdf.disabled = true
  
    // Cargar configuración del servidor si existe
    cargarConfiguracionServidor()
  })
  