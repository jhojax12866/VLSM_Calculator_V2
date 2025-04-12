# VLSM Calculator V.2

![VLSM Calculator Logo](assets/logo.png)

## Descripción

VLSM Calculator V.2 es una aplicación de escritorio que te permite calcular subredes de tamaño variable (VLSM - Variable Length Subnet Masking) y aplicar automáticamente la configuración a servidores Ubuntu mediante SSH. La aplicación facilita la planificación y configuración de redes IP, generando reportes en PDF y automatizando la configuración del servidor DHCP.

## Características Principales

- **Cálculo VLSM**: Calcula subredes de tamaño variable basadas en los requisitos de hosts.
- **Detección de IPs**: Conecta con servidores Ubuntu para detectar interfaces de red disponibles.
- **Configuración Automática**: Aplica configuraciones DHCP directamente al servidor Ubuntu.
- **Generación de Reportes**: Crea informes PDF detallados de las subredes calculadas.
- **Seguridad**: Almacena credenciales de forma segura mediante cifrado.
- **Interfaz Intuitiva**: Diseño simple y fácil de usar con pestañas organizadas.

## Requisitos del Sistema

- **Sistema Operativo**: Windows 10/11
- **Espacio en Disco**: 200 MB mínimo
- **Memoria RAM**: 4 GB recomendado
- **Conexión a Internet**: Requerida para conectar con servidores remotos
- **Servidor Ubuntu**: Para aplicar configuraciones (opcional)
- **API VLSM**: Servicio API local en puerto 3001 (incluido)

## Instalación

### Método 1: Instalador

1. Descarga el archivo `VLSM Calculator V.2-Setup-4.5.0.exe` desde la carpeta de releases.
2. Ejecuta el instalador y sigue las instrucciones en pantalla.
3. Selecciona la ubicación de instalación deseada.
4. Completa la instalación y ejecuta la aplicación desde el acceso directo creado.

### Método 2: Desarrollo

Para ejecutar la aplicación en modo desarrollo:

1. Clona el repositorio:
   \`\`\`
   git clone https://github.com/tu-usuario/vlsm-calculator.git
   \`\`\`

2. Instala las dependencias:
   \`\`\`
   cd vlsm-calculator
   npm install
   \`\`\`

3. Inicia la aplicación:
   \`\`\`
   npm start
   \`\`\`

## Guía de Uso

### Calculadora VLSM

1. En la pestaña "Calculadora", ingresa la dirección de red base (ej. 172.18.0.0).
2. Especifica el número de subredes necesarias.
3. Ingresa la cantidad de hosts requeridos para cada subred.
4. Haz clic en "Calcular VLSM" para obtener los resultados.
5. Opcionalmente, genera un PDF con los resultados haciendo clic en "Generar PDF".

### Configuración del Servidor

1. En la pestaña "Configuración del Servidor", ingresa la dirección IP, usuario y contraseña del servidor Ubuntu.
2. Alternativamente, usa "Detectar IPs del Servidor" para encontrar las interfaces disponibles.
3. Guarda la configuración haciendo clic en "Guardar Configuración".
4. Regresa a la pestaña "Calculadora" y haz clic en "Enviar al Servidor" para aplicar la configuración DHCP.

## Estructura del Proyecto

\`\`\`
vlsm-calculator/
├── app.js                  # Punto de entrada principal
├── package.json            # Configuración del proyecto
├── assets/                 # Recursos gráficos
│   └── logo.png            # Logo de la aplicación
├── scripts/                # Scripts de utilidad
│   ├── build-app.js        # Script para construir la aplicación
│   └── create-logo.js      # Generador de logo
├── src/
│   ├── main/               # Proceso principal
│   ├── preload/            # Script de precarga
│   │   └── preload.js      # API segura para el renderer
│   ├── renderer/           # Interfaz de usuario
│   │   ├── css/            # Estilos
│   │   ├── js/             # Lógica de la interfaz
│   │   └── index.html      # Estructura HTML
│   └── utils/              # Utilidades
└── dist/                   # Archivos de distribución generados
\`\`\`

## Tecnologías Utilizadas

- **Electron**: Framework para crear aplicaciones de escritorio con tecnologías web
- **Node.js**: Entorno de ejecución para JavaScript
- **SSH2**: Biblioteca para conexiones SSH
- **PDFKit**: Generación de documentos PDF
- **Crypto**: Cifrado de credenciales
- **HTML/CSS/JavaScript**: Interfaz de usuario

## Solución de Problemas

### La API no responde
- Asegúrate de que el servicio API esté ejecutándose en http://localhost:3001
- Verifica que los endpoints `/vlsm/calculate` y `/vlsm/calculate-json` estén disponibles

### Error de conexión SSH
- Verifica que el servidor esté encendido y accesible en la red
- Confirma que el servicio SSH esté activo en el servidor
- Asegúrate de que las credenciales sean correctas
- Comprueba si hay firewalls bloqueando la conexión

## Licencia

Este proyecto está licenciado bajo [Licencia MIT](LICENSE).

## Créditos

Desarrollado por [Tu Nombre/Equipo].

Para soporte o consultas: [jhojanfer12@gmail.com]
