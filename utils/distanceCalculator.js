import fetch from 'node-fetch';

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

// Geocode address to get coordinates using OpenStreetMap Nominatim API with high accuracy
export async function geocodeAddress(address) {
  try {
    const { street, city, state, pincode } = address;
    
    // Try multiple query formats for maximum accuracy
    const queries = [
      `${street}, ${city}, ${state} ${pincode}, India`,
      `${street}, ${city}, ${state}, India`,
      `${city}, ${state} ${pincode}, India`,
      `${street}, ${city}, India`,
      `${city}, ${state}, India`
    ];
    
    let bestResult = null;
    let bestAccuracy = 0;
    
    for (const query of queries) {
      try {
        const encodedQuery = encodeURIComponent(query);
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5&countrycodes=in&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'DigitalServiceApp/1.0'
            }
          }
        );
        
        if (!response.ok) {
          continue; // Try next query
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Find the most accurate result
          for (const result of data) {
            const accuracy = calculateAccuracy(result, address);
            if (accuracy > bestAccuracy) {
              bestAccuracy = accuracy;
              bestResult = {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                displayName: result.display_name,
                accuracy: accuracy
              };
            }
          }
        }
      } catch (error) {
        console.warn(`Geocoding failed for query "${query}":`, error.message);
        continue; // Try next query
      }
    }
    
    if (bestResult && bestResult.accuracy > 0.3) { // Minimum 30% accuracy
      console.log(`Geocoding successful with ${Math.round(bestResult.accuracy * 100)}% accuracy:`, bestResult.displayName);
      return {
        latitude: bestResult.latitude,
        longitude: bestResult.longitude,
        displayName: bestResult.displayName,
        accuracy: bestResult.accuracy
      };
    }
    
    // If no accurate result found, return null
    console.warn('No accurate geocoding result found for address:', address);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Calculate accuracy score for geocoding result
function calculateAccuracy(result, targetAddress) {
  let score = 0;
  const address = result.address || {};
  
  // Check pincode match (highest weight)
  if (address.postcode === targetAddress.pincode) {
    score += 0.4;
  }
  
  // Check city match
  if (address.city === targetAddress.city || address.town === targetAddress.city) {
    score += 0.3;
  }
  
  // Check state match
  if (address.state === targetAddress.state) {
    score += 0.2;
  }
  
  // Check street match (partial)
  if (address.road && targetAddress.street && 
      address.road.toLowerCase().includes(targetAddress.street.toLowerCase())) {
    score += 0.1;
  }
  
  return score;
}

// Calculate distance charge based on distance (10 rupees per km)
export function calculateDistanceCharge(distanceInKm) {
  return Math.round(distanceInKm * 10);
}

// Main function to calculate distance and charge from Janghai Bazar to customer address
export async function calculateDistanceFromJanghaiBazar(customerAddress) {
  try {
    // Janghai Bazar, Prayagraj coordinates (212401) - Corrected coordinates
    const janghaiBazarCoords = {
      latitude: 25.541297129300112, // Janghai Bazar, Prayagraj coordinates
      longitude: 82.31064807968316
    };
    
    // Geocode customer address
    const customerCoords = await geocodeAddress(customerAddress);
    
    if (!customerCoords) {
      console.warn('Could not geocode customer address, using default distance');
      // Return a reasonable default distance for Prayagraj area
      const defaultDistance = 15; // Default 15 km for Prayagraj area
      return {
        distance: defaultDistance,
        distanceCharge: calculateDistanceCharge(defaultDistance),
        customerCoordinates: null,
        baseLocation: janghaiBazarCoords,
        error: 'Could not geocode address, using default distance'
      };
    }
    
    // Calculate distance
    const distance = calculateDistance(
      janghaiBazarCoords.latitude,
      janghaiBazarCoords.longitude,
      customerCoords.latitude,
      customerCoords.longitude
    );
    
    // Calculate distance charge
    const distanceCharge = calculateDistanceCharge(distance);
    
    return {
      distance: distance,
      distanceCharge: distanceCharge,
      customerCoordinates: customerCoords,
      baseLocation: janghaiBazarCoords
    };
  } catch (error) {
    console.error('Distance calculation error:', error);
    // Return default values if geocoding fails
    return {
      distance: 15, // Default 15 km
      distanceCharge: 150, // Default charge
      customerCoordinates: null,
      baseLocation: null,
      error: error.message
    };
  }
} 