const Product = require('../models/Product');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar productos
// @route   GET /api/inventory/products
// @access  Admin
const listProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    lowStock = false,
    isActive,
    sort = '-createdAt'
  } = req.query;

  // Construir query
  const query = { isDeleted: false };

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (category) {
    query.category = category;
  }

  if (lowStock === 'true') {
    query.$expr = { $lte: ['$stock', '$minStock'] };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Product.countDocuments(query)
  ]);

  const result = {
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };

  res.json({
    success: true,
    data: result
  });
});

// @desc    Obtener producto por ID
// @route   GET /api/inventory/products/:id
// @access  Admin
const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  res.json({
    success: true,
    data: { product }
  });
});

// @desc    Buscar producto por código de barras
// @route   GET /api/inventory/products/barcode/:barcode
// @access  Admin
const getProductByBarcode = asyncHandler(async (req, res) => {
  const { barcode } = req.params;

  const product = await Product.findOne({
    barcode,
    isDeleted: false
  });

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  res.json({
    success: true,
    data: { product }
  });
});

// @desc    Crear producto
// @route   POST /api/inventory/products
// @access  Admin
const createProduct = asyncHandler(async (req, res) => {
  const {
    barcode,
    name,
    description,
    category,
    price,
    costPrice,
    stock,
    minStock,
    location,
    supplier,
    specifications,
    imageUrl
  } = req.body;

  // Verificar si el código de barras ya existe en productos ACTIVOS
  const existingProduct = await Product.findOne({
    barcode,
    isDeleted: false
  });

  if (existingProduct) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'BARCODE_EXISTS',
        message: 'Ya existe un producto activo con ese código de barras. Si lo eliminaste, restáuralo desde Administración.'
      }
    });
  }

  // Verificar si existe un producto eliminado con ese código
  const deletedProduct = await Product.findOne({
    barcode,
    isDeleted: true
  });

  if (deletedProduct) {
    // Si existe un producto eliminado, restaurarlo y actualizarlo
    deletedProduct.isDeleted = false;
    deletedProduct.isActive = true;
    deletedProduct.deletedAt = null;
    deletedProduct.deletedBy = null;
    
    // Actualizar con los nuevos datos
    deletedProduct.name = name.trim();
    deletedProduct.description = description?.trim();
    deletedProduct.category = category.trim();
    deletedProduct.price = price;
    deletedProduct.costPrice = costPrice;
    deletedProduct.stock = stock || 0;
    deletedProduct.minStock = minStock || 0;
    deletedProduct.location = location?.trim();
    deletedProduct.supplier = supplier?.trim();
    deletedProduct.specifications = specifications || {};
    deletedProduct.imageUrl = imageUrl;

    await deletedProduct.save();

    // Si se restauró con stock, agregar movimiento
    if (stock > 0) {
      deletedProduct.stockMovements.push({
        type: 'entrada',
        quantity: stock,
        reason: 'Producto restaurado con stock inicial',
        notes: 'Producto restaurado y actualizado',
        userId: req.userId,
        createdAt: new Date()
      });
      await deletedProduct.save();
    }

    return res.status(201).json({
      success: true,
      data: { product: deletedProduct },
      message: 'Producto restaurado y actualizado exitosamente'
    });
  }

  // Crear producto
  const product = await Product.create({
    barcode: barcode.trim(),
    name: name.trim(),
    description: description?.trim(),
    category: category.trim(),
    price,
    costPrice,
    stock: stock || 0,
    minStock: minStock || 0,
    location: location?.trim(),
    supplier: supplier?.trim(),
    specifications: specifications || {},
    imageUrl
  });

  // Si se creó con stock inicial, registrar movimiento
  if (stock > 0) {
    product.stockMovements.push({
      type: 'entrada',
      quantity: stock,
      reason: 'Stock inicial',
      notes: 'Creación del producto',
      userId: req.userId,
      createdAt: new Date()
    });
    await product.save();
  }

  res.status(201).json({
    success: true,
    data: { product },
    message: 'Producto creado exitosamente'
  });
});

// @desc    Actualizar producto
// @route   PUT /api/inventory/products/:id
// @access  Admin
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    price,
    costPrice,
    minStock,
    location,
    supplier,
    isActive,
    specifications,
    imageUrl
  } = req.body;

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  if (product.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PRODUCT_DELETED',
        message: 'No se puede actualizar un producto eliminado'
      }
    });
  }

  // Actualizar campos
  if (name) product.name = name.trim();
  if (description !== undefined) product.description = description?.trim();
  if (category) product.category = category.trim();
  if (price !== undefined) product.price = price;
  if (costPrice !== undefined) product.costPrice = costPrice;
  if (minStock !== undefined) product.minStock = minStock;
  if (location !== undefined) product.location = location?.trim();
  if (supplier !== undefined) product.supplier = supplier?.trim();
  if (isActive !== undefined) product.isActive = isActive;
  if (specifications !== undefined) product.specifications = specifications;
  if (imageUrl !== undefined) product.imageUrl = imageUrl;

  await product.save();

  res.json({
    success: true,
    data: { product },
    message: 'Producto actualizado exitosamente'
  });
});

// @desc    Eliminar producto (soft delete)
// @route   DELETE /api/inventory/products/:id
// @access  Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  if (product.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PRODUCT_ALREADY_DELETED',
        message: 'El producto ya está eliminado'
      }
    });
  }

  await product.softDelete(req.userId);

  res.json({
    success: true,
    message: 'Producto eliminado exitosamente'
  });
});

// @desc    Restaurar producto
// @route   PUT /api/inventory/products/:id/restore
// @access  Admin
const restoreProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  if (!product.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_DELETED',
        message: 'El producto no está eliminado'
      }
    });
  }

  await product.restore();

  res.json({
    success: true,
    data: { product },
    message: 'Producto restaurado exitosamente'
  });
});

// @desc    Agregar movimiento de stock
// @route   POST /api/inventory/products/:id/movements
// @access  Admin
const addStockMovement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, quantity, reason, notes } = req.body;

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  if (product.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PRODUCT_DELETED',
        message: 'No se puede agregar movimiento a un producto eliminado'
      }
    });
  }

  try {
    const movement = await product.addStockMovement(
      { type, quantity, reason, notes },
      req.userId
    );

    res.json({
      success: true,
      data: { movement, product },
      message: 'Movimiento de stock registrado exitosamente'
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'STOCK_MOVEMENT_ERROR',
        message: error.message
      }
    });
  }
});

// @desc    Obtener historial de movimientos
// @route   GET /api/inventory/products/:id/movements
// @access  Admin
const getStockMovements = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const product = await Product.findById(id).populate('stockMovements.userId', 'username');

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado'
      }
    });
  }

  // Paginar movimientos
  const movements = product.stockMovements
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice((page - 1) * limit, page * limit);

  const total = product.stockMovements.length;

  res.json({
    success: true,
    data: {
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Obtener productos con stock bajo
// @route   GET /api/inventory/products/alerts/low-stock
// @access  Admin
const getLowStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isDeleted: false,
    isActive: true,
    $expr: { $lte: ['$stock', '$minStock'] }
  }).sort('stock');

  res.json({
    success: true,
    data: { products }
  });
});

// @desc    Obtener estadísticas de inventario
// @route   GET /api/inventory/stats
// @access  Admin
const getInventoryStats = asyncHandler(async (req, res) => {
  const [
    totalProducts,
    activeProducts,
    lowStockProducts,
    outOfStockProducts,
    totalValue,
    categoryStats
  ] = await Promise.all([
    Product.countDocuments({ isDeleted: false }),
    Product.countDocuments({ isDeleted: false, isActive: true }),
    Product.countDocuments({
      isDeleted: false,
      isActive: true,
      $expr: { $lte: ['$stock', '$minStock'] }
    }),
    Product.countDocuments({
      isDeleted: false,
      isActive: true,
      stock: 0
    }),
    Product.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
          totalCost: { $sum: { $multiply: ['$stock', '$costPrice'] } }
        }
      }
    ]),
    Product.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$stock' }
        }
      },
      { $sort: { count: -1 } }
    ])
  ]);

  const stats = {
    totalProducts,
    activeProducts,
    lowStockProducts,
    outOfStockProducts,
    totalValue: totalValue[0]?.totalValue || 0,
    totalCost: totalValue[0]?.totalCost || 0,
    categories: categoryStats
  };

  res.json({
    success: true,
    data: stats
  });
});

// @desc    Exportar inventario
// @route   GET /api/inventory/export
// @access  Admin
const exportInventory = asyncHandler(async (req, res) => {
  const { format = 'csv' } = req.query;

  const products = await Product.find({
    isDeleted: false
  }).sort('category name');

  if (format === 'csv') {
    // Generar CSV
    const csv = [
      'Código de Barras,Nombre,Categoría,Precio,Costo,Stock,Stock Mínimo,Ubicación,Proveedor,Activo'
    ];

    products.forEach(product => {
      csv.push([
        product.barcode,
        `"${product.name}"`,
        product.category,
        product.price,
        product.costPrice || '',
        product.stock,
        product.minStock,
        product.location || '',
        product.supplier || '',
        product.isActive ? 'Sí' : 'No'
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventario-${Date.now()}.csv"`);
    res.send(csv.join('\n'));
  } else {
    // JSON por defecto
    res.json({
      success: true,
      data: { products }
    });
  }
});

module.exports = {
  listProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  addStockMovement,
  getStockMovements,
  getLowStockProducts,
  getInventoryStats,
  exportInventory
};