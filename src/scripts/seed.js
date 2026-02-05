require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const seedData = async () => {
  try {
    console.log("Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Conectado a MongoDB");

    console.log("\n🧹 Eliminando datos existentes...");
    await User.deleteMany({});
    console.log("Usuarios eliminados\n");

    console.log("👤 Creando usuario admin...");

    const admin = await User.create({
      username: "marcos",
      password: "199616", // ⚠️ el modelo debe hashearla
      role: "admin",
      active: true,
    });

    console.log("✅ Admin creado correctamente");
    console.log("──────────────────────────");
    console.log("Usuario: marcos");
    console.log("Rol: admin");
    console.log("──────────────────────────\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error ejecutando seed:", error);
    process.exit(1);
  }
};

seedData();
