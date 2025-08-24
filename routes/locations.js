import express from 'express';
import { getActiveLocations, getServiceLocationsInRange, getLocationById } from '../config/locations.js';

const router = express.Router();

// Get all active service locations
router.get('/service-locations', async (req, res) => {
  try {
    const locations = getActiveLocations();
    
    res.json({
      success: true,
      locations: locations.map(location => ({
        id: location.id,
        name: location.name,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        description: location.description,
        serviceRadius: location.serviceRadius
      }))
    });
  } catch (error) {
    console.error('Error fetching service locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service locations',
      error: error.message
    });
  }
});

// Get service locations within range of customer coordinates
router.post('/service-locations-in-range', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 100 } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const locationsInRange = getServiceLocationsInRange(latitude, longitude, maxDistance);
    
    res.json({
      success: true,
      locations: locationsInRange.map(location => ({
        id: location.id,
        name: location.name,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        description: location.description,
        serviceRadius: location.serviceRadius,
        distance: location.distance
      }))
    });
  } catch (error) {
    console.error('Error fetching locations in range:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations in range',
      error: error.message
    });
  }
});

// Get specific service location by ID
router.get('/service-locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const location = getLocationById(locationId);
    
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Service location not found'
      });
    }

    res.json({
      success: true,
      location: {
        id: location.id,
        name: location.name,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        description: location.description,
        serviceRadius: location.serviceRadius,
        coordinates: location.coordinates
      }
    });
  } catch (error) {
    console.error('Error fetching service location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service location',
      error: error.message
    });
  }
});

export default router;
