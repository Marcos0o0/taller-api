const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB conectado: ${conn.connection.host}`);

    // Eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('Error de conexión MongoDB:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB desconectado');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconectado');
    });

    return conn;
  } catch (error) {
    console.error('Error al conectar MongoDB:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB desconectado correctamente');
  } catch (error) {
    console.error('Error al desconectar MongoDB:', error.message);
  }
};

module.exports = {
  connectDB,
  disconnectDB
};