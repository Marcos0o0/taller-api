# Actualización de presupuestos y acceso del PC

Esta entrega conecta la app de Windows con la API existente. El PC se vincula una vez con la cuenta administradora actual. La credencial del equipo se cifra con Windows y puede revocarse en Equipos vinculados. Los datos históricos permanecen en MongoDB.

## Preparar una copia

1. Verificar la ubicación real de MongoDB consultando la configuración del servidor en Railway. El repositorio admite MongoDB local y remoto. Confirmar el nombre de la base y quién conserva sus respaldos.
2. Crear un respaldo con las herramientas de MongoDB. Restaurarlo en una base de ensayo separada. Conservar también el ejecutable anterior y sus fuentes.
3. Exportar el historial local de trabajos rápidos desde el aviso que muestra Presupuestos en cada PC que lo haya usado. Esos registros están en el perfil de la aplicación, no en MongoDB.
4. Configurar MONGODB_URI para la copia. Ejecutar primero la revisión de índices.

```powershell
node src/scripts/migrateBudgets.js
node src/scripts/migrateBudgets.js --apply --database NOMBRE_DE_LA_COPIA
```

El modo de revisión no cambia índices ni registros. La aplicación exige el nombre exacto de la base al aplicar. La migración crea el índice parcial de correo antes de retirar los índices anteriores, permite clientes sin correo y añade los índices de numeración, reintentos y dispositivos. Es repetible. Conserva los importes y los textos históricos.

## Verificar y actualizar

1. Probar en la copia un presupuesto nuevo con nombre, teléfono y una línea, otro antiguo en texto, edición de un aceptado, duplicación, papelera, restauración e impresión.
2. En una ventana de mantenimiento, detener escrituras, hacer un respaldo reciente y aplicar la migración en la base real verificada. Desplegar primero la API y después el ejecutable de Windows.
3. Abrir la app nueva. En Vincular este PC, introducir una sola vez el usuario y contraseña administradores existentes. Comprobar que al cerrar y abrir vuelve a Presupuestos.
4. Guardar un PDF y revisar el resultado con la impresora del taller. WhatsApp prepara el mensaje y guarda el PDF. El usuario adjunta el archivo y pulsa Enviar en WhatsApp.
5. Para revocar un PC, usar Equipos vinculados desde otro equipo autorizado. Si se revoca el actual, será necesaria otra vinculación. La contraseña permite vincular de nuevo un equipo desde la instalación de Windows.

La API mantiene la cuenta administradora como identidad de auditoría. Las cuentas de mecánicos quedan fuera del acceso activo y sus referencias históricas se conservan. Las órdenes anteriores admiten consulta. Cambiar el cliente, los datos visibles del vehículo, los trabajos o los importes devuelve un presupuesto aceptado a pendiente e invalida sus enlaces anteriores. Cambiar solo las notas conserva la aceptación.

## Comprobaciones de desarrollo

La API usa Node y Jest. Las pruebas solo aceptan una URI de MongoDB local con puerto explícito y una base cuyo nombre termina en test o tests. Sus colecciones se borran durante las pruebas.

```powershell
npm ci --legacy-peer-deps
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/taller-test'
npm test -- --cacheDirectory temp/jest
```

En la app de Windows se conservan Electron, React y Ant Design.

```powershell
npm ci --legacy-peer-deps
npm run build:check
node --test electron/devicePolicy.test.ts electron/ipc.test.ts src/utils/quoteItems.test.ts
npm run electron:build
```

Las pruebas TypeScript con node --test usan Node 24 o posterior. El cliente de producción requiere HTTPS. TALLER_API_URL permite indicar la API desde el proceso de Windows, y VITE_API_URL establece el valor de compilación. La credencial se vincula a esa URL y nunca se entrega al código de la interfaz.

## Recuperación y límites

Los borradores se guardan localmente. Un borrador de una versión anterior se conserva y avisa del conflicto al guardar. Un presupuesto no cuenta como guardado en MongoDB hasta que el servidor confirma la operación.

Para volver a una versión anterior, detener las escrituras y restaurar el respaldo de la base y el ejecutable correspondiente. La versión antigua exige correo y restringe presupuestos aceptados, por lo que volver solo al ejecutable anterior puede impedir editar los registros nuevos.

Quedan para entregas posteriores la IA de escritura, el dictado, el bot de WhatsApp y la agenda. La impresión física y el envío a clientes deben verificarse en el taller. El texto truncado por versiones anteriores requiere otra copia o un respaldo para recuperarse.
