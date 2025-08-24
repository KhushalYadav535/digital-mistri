// Multi-location configuration for Digital Mistri services
export const SERVICE_LOCATIONS = {
  // Janghai Bazar, Prayagraj (212401)
  'janghai-bazar': {
    id: 'janghai-bazar',
    name: 'Janghai Bazar',
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
    pincode: '212401',
    coordinates: {
      latitude: 25.541297129300112,
      longitude: 82.31064807968316
    },
    serviceRadius: 50, // km
    isActive: true,
    description: 'Janghai Bazar, Prayagraj - Main service center'
  },

  // Machhli Shahar, Jaunpur
  'machhli-shahar': {
    id: 'machhli-shahar',
    name: 'Machhli Shahar',
    city: 'Jaunpur',
    state: 'Uttar Pradesh',
    pincode: '222143',
    coordinates: {
      latitude: 25.4560,
      longitude: 81.8560
    },
    serviceRadius: 40, // km
    isActive: true,
    description: 'Machhli Shahar, Jaunpur - Service center'
  },

  // Badshahpur, Jaunpur
  'badshahpur': {
    id: 'badshahpur',
    name: 'Badshahpur',
    city: 'Jaunpur',
    state: 'Uttar Pradesh',
    pincode: '222202',
    coordinates: {
      latitude: 25.4650,
      longitude: 81.8450
    },
    serviceRadius: 35, // km
    isActive: true,
    description: 'Badshahpur, Jaunpur - Service center'
  },

  // Handia, Prayagraj
  'handia': {
    id: 'handia',
    name: 'Handia',
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
    pincode: '212401',
    coordinates: {
      latitude: 25.3800,
      longitude: 82.1800
    },
    serviceRadius: 45, // km
    isActive: true,
    description: 'Handia, Prayagraj - Service center'
  },

  // Suriawan, Bhadohi
  'suriawan': {
    id: 'suriawan',
    name: 'Suriawan',
    city: 'Bhadohi',
    state: 'Uttar Pradesh',
    pincode: '221404',
    coordinates: {
      latitude: 25.4200,
      longitude: 82.1500
    },
    serviceRadius: 40, // km
    isActive: true,
    description: 'Suriawan, Bhadohi - Service center'
  },

  // Banaras (Varanasi)
  'banaras': {
    id: 'banaras',
    name: 'Banaras',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    pincode: '221001',
    coordinates: {
      latitude: 25.3176,
      longitude: 82.9739
    },
    serviceRadius: 60, // km
    isActive: true,
    description: 'Banaras (Varanasi) - Service center'
  },

  // Bhadohi
  'bhadohi': {
    id: 'bhadohi',
    name: 'Bhadohi',
    city: 'Bhadohi',
    state: 'Uttar Pradesh',
    pincode: '221401',
    coordinates: {
      latitude: 25.4080,
      longitude: 82.5700
    },
    serviceRadius: 50, // km
    isActive: true,
    description: 'Bhadohi - Service center'
  },

  // Jaunpur
  'jaunpur': {
    id: 'jaunpur',
    name: 'Jaunpur',
    city: 'Jaunpur',
    state: 'Uttar Pradesh',
    pincode: '222001',
    coordinates: {
      latitude: 25.7500,
      longitude: 82.6800
    },
    serviceRadius: 55, // km
    isActive: true,
    description: 'Jaunpur - Service center'
  },

  // Pratapgarh
  'pratapgarh': {
    id: 'pratapgarh',
    name: 'Pratapgarh',
    city: 'Pratapgarh',
    state: 'Uttar Pradesh',
    pincode: '230001',
    coordinates: {
      latitude: 25.9000,
      longitude: 81.9500
    },
    serviceRadius: 45, // km
    isActive: true,
    description: 'Pratapgarh - Service center'
  }
};

// Function to get nearest service location for given coordinates
export function getNearestServiceLocation(customerLat, customerLon) {
  let nearestLocation = null;
  let shortestDistance = Infinity;

  for (const [locationId, location] of Object.entries(SERVICE_LOCATIONS)) {
    if (!location.isActive) continue;

    const distance = calculateDistance(
      location.coordinates.latitude,
      location.coordinates.longitude,
      customerLat,
      customerLon
    );

    if (distance <= location.serviceRadius && distance < shortestDistance) {
      shortestDistance = distance;
      nearestLocation = location;
    }
  }

  return nearestLocation;
}

// Function to get all service locations within range
export function getServiceLocationsInRange(customerLat, customerLon, maxDistance = 100) {
  const locationsInRange = [];

  for (const [locationId, location] of Object.entries(SERVICE_LOCATIONS)) {
    if (!location.isActive) continue;

    const distance = calculateDistance(
      location.coordinates.latitude,
      location.coordinates.longitude,
      customerLat,
      customerLon
    );

    if (distance <= maxDistance) {
      locationsInRange.push({
        ...location,
        distance: distance
      });
    }
  }

  // Sort by distance (nearest first)
  return locationsInRange.sort((a, b) => a.distance - b.distance);
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

// Function to get location by ID
export function getLocationById(locationId) {
  return SERVICE_LOCATIONS[locationId] || null;
}

// Function to get all active locations
export function getActiveLocations() {
  return Object.values(SERVICE_LOCATIONS).filter(location => location.isActive);
}

// Function to check if customer is in service area
export function isCustomerInServiceArea(customerLat, customerLon, locationId) {
  const location = getLocationById(locationId);
  if (!location || !location.isActive) return false;

  const distance = calculateDistance(
    location.coordinates.latitude,
    location.coordinates.longitude,
    customerLat,
    customerLon
  );

  return distance <= location.serviceRadius;
}
