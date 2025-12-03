require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Client = require("../models/Client");
const Mechanic = require("../models/Mechanic");
const Quote = require("../models/Quote");

const seedData = async () => {
  try {
    // Conectar a MongoDB
    console.log("Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Conectado a MongoDB");

    // Preguntar si desea limpiar datos existentes
    console.log("\nEste script eliminará TODOS los datos existentes.");
    console.log("Limpiando datos anteriores...\n");

    // Limpiar colecciones
    await User.deleteMany({});
    await Client.deleteMany({});
    await Mechanic.deleteMany({});
    await Quote.deleteMany({});
    console.log("Datos anteriores eliminados\n");

    // 1. CREAR USUARIOS

    console.log("Creando usuarios...");

    const admin = await User.create({
      username: "admin",
      password: "admin123",
      role: "admin",
    });
    console.log("Admin creado");

    const mechanicUser1 = await User.create({
      username: "mechanic1",
      password: "mech123",
      role: "mechanic",
    });
    console.log("Mecánico 1 creado");

    const mechanicUser2 = await User.create({
      username: "mechanic2",
      password: "mech123",
      role: "mechanic",
    });
    console.log("Mecánico 2 creado\n");

    // 2. CREAR PERFILES DE MECÁNICOS

    console.log("Creando perfiles de mecánicos...");

    const mechanic1 = await Mechanic.create({
      userId: mechanicUser1._id,
      firstName: "Carlos",
      lastName1: "Rodríguez",
      lastName2: "Silva",
      phone: "+56912345678",
      isActive: true,
    });
    console.log("  Carlos Rodríguez");

    const mechanic2 = await Mechanic.create({
      userId: mechanicUser2._id,
      firstName: "Miguel",
      lastName1: "Sánchez",
      lastName2: "Torres",
      phone: "+56923456789",
      isActive: true,
    });
    console.log("Miguel Sánchez\n");

    // 3. CREAR CLIENTES

    console.log("Creando clientes...");

    const clients = await Client.create([
      {
        firstName: "Juan",
        lastName1: "Pérez",
        lastName2: "González",
        email: "juan.perez@email.com",
        phone: "+56912345678",
      },
      {
        firstName: "María",
        lastName1: "López",
        lastName2: "Martínez",
        email: "maria.lopez@email.com",
        phone: "+56987654321",
      },
      {
        firstName: "Pedro",
        lastName1: "Ramírez",
        email: "pedro.ramirez@email.com",
        phone: "+56923456789",
      },
      {
        firstName: "Ana",
        lastName1: "Torres",
        lastName2: "Muñoz",
        email: "ana.torres@email.com",
        phone: "+56934567890",
      },
      {
        firstName: "Luis",
        lastName1: "Fernández",
        email: "luis.fernandez@email.com",
        phone: "+56945678901",
      },
      {
        firstName: "Carmen",
        lastName1: "Vega",
        lastName2: "Rojas",
        email: "carmen.vega@email.com",
        phone: "+56956789012",
      },
    ]);
    console.log(` ${clients.length} clientes creados\n`);

    // 4. CREAR PRESUPUESTOS

    console.log("Creando presupuestos...");

    // Presupuesto pendiente
    const quote1 = await Quote.create({
      clientId: clients[0]._id,
      vehicle: {
        brand: "Toyota",
        model: "Corolla",
        year: 2020,
        licensePlate: "ABCD12",
        mileage: 50000,
      },
      description:
        "El vehículo presenta ruidos extraños en el motor al acelerar y la luz de check engine está encendida",
      proposedWork:
        "Revisión completa del motor, diagnóstico con scanner, cambio de aceite y filtros, revisión del sistema de inyección",
      estimatedCost: 150000,
      status: "pending",
    });
    console.log("Presupuesto 1 (Pendiente - sin orden)");

    // Presupuesto aprobado con orden en progreso
    const quote2 = await Quote.create({
      clientId: clients[1]._id,
      vehicle: {
        brand: "Chevrolet",
        model: "Spark",
        year: 2019,
        licensePlate: "WXYZ34",
        mileage: 35000,
      },
      description:
        "Problemas con el sistema de frenos, pedal esponjoso y ruido al frenar",
      proposedWork:
        "Cambio de pastillas y discos de freno, purga del sistema hidráulico, revisión de cilindros",
      estimatedCost: 180000,
      status: "approved",
    });

    // Crear orden de trabajo para quote2
    await quote2.createWorkOrder();
    await quote2.assignMechanic(mechanic1._id, admin._id);
    await quote2.changeWorkOrderStatus(
      "en_progreso",
      admin._id,
      "Iniciando reparación"
    );
    quote2.workOrder.additionalNotes = "Cliente aprobó trabajos adicionales";
    quote2.workOrder.finalCost = 185000;
    await quote2.save();
    console.log("Presupuesto 2 (Aprobado - orden en progreso)");

    // Presupuesto aprobado con orden lista
    const quote3 = await Quote.create({
      clientId: clients[2]._id,
      vehicle: {
        brand: "Hyundai",
        model: "Accent",
        year: 2021,
        licensePlate: "EFGH56",
        mileage: 25000,
      },
      description: "Falla en el aire acondicionado, no enfría adecuadamente",
      proposedWork:
        "Recarga de gas refrigerante, revisión del compresor, limpieza del sistema",
      estimatedCost: 120000,
      status: "approved",
    });

    await quote3.createWorkOrder();
    await quote3.assignMechanic(mechanic2._id, admin._id);
    await quote3.changeWorkOrderStatus("en_progreso", admin._id);
    await quote3.changeWorkOrderStatus(
      "listo",
      admin._id,
      "Reparación completada"
    );
    quote3.workOrder.finalCost = 125000;
    await quote3.save();
    console.log("Presupuesto 3 (Aprobado - orden lista)");

    // Presupuesto aprobado con orden entregada
    const quote4 = await Quote.create({
      clientId: clients[3]._id,
      vehicle: {
        brand: "Nissan",
        model: "Versa",
        year: 2018,
        licensePlate: "IJKL78",
        mileage: 60000,
      },
      description: "Mantenimiento preventivo de los 60,000 km",
      proposedWork:
        "Cambio de aceite, filtros, bujías, revisión general, alineación y balanceo",
      estimatedCost: 200000,
      status: "approved",
    });

    await quote4.createWorkOrder();
    await quote4.assignMechanic(mechanic1._id, admin._id);
    await quote4.changeWorkOrderStatus("en_progreso", admin._id);
    await quote4.changeWorkOrderStatus("listo", admin._id);
    await quote4.changeWorkOrderStatus(
      "entregado",
      admin._id,
      "Vehículo entregado al cliente"
    );
    quote4.workOrder.finalCost = 195000;
    await quote4.save();
    console.log("Presupuesto 4 (Aprobado - orden entregada)");

    // Presupuesto rechazado
    const quote5 = await Quote.create({
      clientId: clients[4]._id,
      vehicle: {
        brand: "Kia",
        model: "Rio",
        year: 2022,
        licensePlate: "MNOP90",
        mileage: 15000,
      },
      description: "Ruido en la suspensión delantera",
      proposedWork:
        "Reemplazo de amortiguadores delanteros y brazos de suspensión",
      estimatedCost: 300000,
      status: "rejected",
    });
    console.log("Presupuesto 5 (Rechazado)");

    // RESUMEN

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║   DATOS DE PRUEBA CREADOS EXITOSAMENTE     ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    console.log("RESUMEN:\n");
    console.log("Usuarios creados: 3");
    console.log("  • admin / admin123 (Administrador)");
    console.log("  • mechanic1 / mech123 (Mecánico)");
    console.log("  • mechanic2 / mech123 (Mecánico)\n");

    console.log("Mecánicos: 2");
    console.log("  • Carlos Rodríguez Silva");
    console.log("  • Miguel Sánchez Torres\n");

    console.log("Clientes: " + clients.length + "\n");

    console.log("Presupuestos: 5");
    console.log("  • 1 Pendiente (sin orden)");
    console.log("  • 1 Aprobado - Orden en Progreso (asignada a Carlos)");
    console.log("  • 1 Aprobado - Orden Lista (asignada a Miguel)");
    console.log("  • 1 Aprobado - Orden Entregada (asignada a Carlos)");
    console.log("  • 1 Rechazado\n");

    console.log("API disponible en: http://localhost:3001");
    console.log("Usa Postman para probar los endpoints\n");

    console.log("NOTAS:");
    console.log("   • WorkOrder ahora es SUBDOCUMENTO de Quote");
    console.log('   • No existe colección "workorders" separada');
    console.log("   • Cada Quote.workOrder contiene la orden completa\n");

    process.exit(0);
  } catch (error) {
    console.error("Error al crear datos de prueba:", error);
    process.exit(1);
  }
};

// Ejecutar seed
seedData();
