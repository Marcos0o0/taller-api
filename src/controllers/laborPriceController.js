// controllers/laborPrice.controller.js

const { LaborPrice, ServiceCategory } = require('../models/LaborPrice');

// ==========================================
// CATEGORÍAS
// ==========================================

/**
 * Obtener todas las categorías con sus servicios
 */
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true })
      .sort({ order: 1 })
      .populate({
        path: 'services',
        match: { isActive: true },
      });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías',
      error: error.message,
    });
  }
};

/**
 * Obtener una categoría por ID
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ServiceCategory.findById(id).populate({
      path: 'services',
      match: { isActive: true },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada',
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categoría',
      error: error.message,
    });
  }
};

/**
 * Crear nueva categoría
 */
exports.createCategory = async (req, res) => {
  try {
    const category = await ServiceCategory.create(req.body);

    res.status(201).json({
      success: true,
      data: category,
      message: 'Categoría creada exitosamente',
    });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(400).json({
      success: false,
      message: 'Error al crear categoría',
      error: error.message,
    });
  }
};

/**
 * Actualizar categoría
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ServiceCategory.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada',
      });
    }

    res.status(200).json({
      success: true,
      data: category,
      message: 'Categoría actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(400).json({
      success: false,
      message: 'Error al actualizar categoría',
      error: error.message,
    });
  }
};

/**
 * Eliminar categoría (soft delete)
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ServiceCategory.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Categoría eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar categoría',
      error: error.message,
    });
  }
};

// ==========================================
// SERVICIOS
// ==========================================

/**
 * Obtener todos los servicios
 */
exports.getAllServices = async (req, res) => {
  try {
    const services = await LaborPrice.find({ isActive: true }).populate('categoryId');

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicios',
      error: error.message,
    });
  }
};

/**
 * Obtener un servicio por ID
 */
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await LaborPrice.findById(id).populate('categoryId');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('Error al obtener servicio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicio',
      error: error.message,
    });
  }
};

/**
 * Buscar servicios
 */
exports.searchServices = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro de búsqueda requerido',
      });
    }

    const services = await LaborPrice.find({
      $text: { $search: q },
      isActive: true,
    }).populate('categoryId');

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Error al buscar servicios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar servicios',
      error: error.message,
    });
  }
};

/**
 * Crear nuevo servicio
 */
exports.createService = async (req, res) => {
  try {
    const service = await LaborPrice.create(req.body);

    res.status(201).json({
      success: true,
      data: service,
      message: 'Servicio creado exitosamente',
    });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(400).json({
      success: false,
      message: 'Error al crear servicio',
      error: error.message,
    });
  }
};

/**
 * Actualizar servicio
 */
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await LaborPrice.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: service,
      message: 'Servicio actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(400).json({
      success: false,
      message: 'Error al actualizar servicio',
      error: error.message,
    });
  }
};

/**
 * Eliminar servicio (soft delete)
 */
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await LaborPrice.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Servicio eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar servicio',
      error: error.message,
    });
  }
};

/**
 * Obtener estadísticas
 */
exports.getStats = async (req, res) => {
  try {
    const totalServices = await LaborPrice.countDocuments({ isActive: true });
    const totalCategories = await ServiceCategory.countDocuments({ isActive: true });

    const services = await LaborPrice.find({ isActive: true });

    let totalPrice = 0;
    let minPrice = Infinity;
    let maxPrice = 0;

    services.forEach((service) => {
      const avgPrice = (service.priceRange.min + service.priceRange.max) / 2;
      totalPrice += avgPrice;

      if (service.priceRange.min < minPrice) {
        minPrice = service.priceRange.min;
      }
      if (service.priceRange.max > maxPrice) {
        maxPrice = service.priceRange.max;
      }
    });

    const averagePrice = totalServices > 0 ? totalPrice / totalServices : 0;

    res.status(200).json({
      success: true,
      data: {
        totalServices,
        totalCategories,
        averagePrice: Math.round(averagePrice),
        priceRange: {
          min: minPrice === Infinity ? 0 : minPrice,
          max: maxPrice,
        },
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message,
    });
  }
};