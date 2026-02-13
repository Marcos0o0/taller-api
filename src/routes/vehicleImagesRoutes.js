const express = require('express');
const axios = require('axios');
const router = express.Router();

const AUTO_DEV_API_KEY = 'sk_ad_0DYAXzp4UAkCuoT7sritaPLY';
const AUTO_DEV_BASE_URL = 'https://api.auto.dev/v2';

/**
 * GET /api/vehicle-images/search
 * Busca y retorna la imagen de un vehículo
 */
router.get('/search', async (req, res) => {
  try {
    const { marca, modelo, año, angle = 'side' } = req.query;

    // Validación
    if (!marca || !modelo || !año) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos: marca, modelo, año' 
      });
    }

    // 1. Buscar el vehículo en Auto.dev
    const searchResponse = await axios.get(
      `${AUTO_DEV_BASE_URL}/vehicles`,
      {
        params: { 
          make: marca, 
          model: modelo, 
          year: año 
        },
        headers: { 
          'Authorization': `Bearer ${AUTO_DEV_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const vehicles = searchResponse.data;
    
    if (!vehicles.data || vehicles.data.length === 0) {
      return res.status(404).json({ 
        error: 'Vehículo no encontrado',
        placeholder: true 
      });
    }

    const vehicleId = vehicles.data[0].id;

    // 2. Obtener fotos del vehículo
    const photosResponse = await axios.get(
      `${AUTO_DEV_BASE_URL}/vehicles/${vehicleId}/photos`,
      {
        headers: { 
          'Authorization': `Bearer ${AUTO_DEV_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const photos = photosResponse.data;

    if (!photos.data || photos.data.length === 0) {
      return res.status(404).json({ 
        error: 'No se encontraron fotos',
        placeholder: true 
      });
    }

    // 3. Filtrar por ángulo preferido
    const angleMap = {
      front: ['front', 'front-angle'],
      side: ['side', 'profile'],
      rear: ['rear', 'back'],
      interior: ['interior', 'dashboard']
    };

    const preferredAngles = angleMap[angle] || ['side'];
    
    let selectedPhoto = photos.data.find(photo =>
      preferredAngles.some(a => 
        photo.angle?.toLowerCase().includes(a)
      )
    );

    // Si no encuentra el ángulo específico, usa la primera foto
    if (!selectedPhoto) {
      selectedPhoto = photos.data[0];
    }

    res.json({ 
      url: selectedPhoto.url,
      angle: selectedPhoto.angle,
      vehicleId: vehicleId
    });

  } catch (error) {
    console.error('Error fetching vehicle image:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'Vehículo no encontrado en Auto.dev',
        placeholder: true 
      });
    }

    res.status(500).json({ 
      error: 'Error al buscar imagen del vehículo',
      placeholder: true 
    });
  }
});

/**
 * GET /api/vehicle-images/angles/:vehicleId
 * Obtiene múltiples ángulos de un vehículo
 */
router.get('/angles/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const photosResponse = await axios.get(
      `${AUTO_DEV_BASE_URL}/vehicles/${vehicleId}/photos`,
      {
        headers: { 
          'Authorization': `Bearer ${AUTO_DEV_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const photos = photosResponse.data;

    if (!photos.data || photos.data.length === 0) {
      return res.status(404).json({ error: 'No se encontraron fotos' });
    }

    // Organizar fotos por ángulo
    const angles = {
      front: null,
      side: null,
      rear: null,
      interior: null,
      all: photos.data.map(p => ({ url: p.url, angle: p.angle }))
    };

    photos.data.forEach(photo => {
      const angle = photo.angle?.toLowerCase() || '';
      
      if (angle.includes('front') && !angles.front) {
        angles.front = photo.url;
      } else if (angle.includes('side') || angle.includes('profile') && !angles.side) {
        angles.side = photo.url;
      } else if (angle.includes('rear') || angle.includes('back') && !angles.rear) {
        angles.rear = photo.url;
      } else if (angle.includes('interior') && !angles.interior) {
        angles.interior = photo.url;
      }
    });

    res.json(angles);

  } catch (error) {
    console.error('Error fetching vehicle angles:', error.message);
    res.status(500).json({ error: 'Error al obtener ángulos del vehículo' });
  }
});

module.exports = router;