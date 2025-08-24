import fetch from 'node-fetch';
import { getNearestServiceLocation, getServiceLocationsInRange, getLocationById } from '../config/locations.js';

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
    
    console.log('🔍 Geocoding address:', { street, city, state, pincode });
    
    // Try multiple query formats for maximum accuracy
    const queries = [
      `${street}, ${city}, ${state} ${pincode}, India`,
      `${street}, ${city}, ${state}, India`,
      `${city}, ${state} ${pincode}, India`,
      `${street}, ${city}, India`,
      `${city}, ${state}, India`,
      `${city} ${pincode}, ${state}, India`,
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
          console.log(`📍 Found ${data.length} results for query: "${query}"`);
          
          // Find the most accurate result
          for (const result of data) {
            const accuracy = calculateAccuracy(result, address);
            console.log(`📍 Result accuracy: ${Math.round(accuracy * 100)}% - ${result.display_name}`);
            
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
        } else {
          console.log(`📍 No results found for query: "${query}"`);
        }
      } catch (error) {
        console.warn(`Geocoding failed for query "${query}":`, error.message);
        continue; // Try next query
      }
    }
    
    if (bestResult && bestResult.accuracy > 0.3) { // Minimum 30% accuracy
      console.log(`✅ Geocoding successful with ${Math.round(bestResult.accuracy * 100)}% accuracy:`, bestResult.displayName);
      return {
        latitude: bestResult.latitude,
        longitude: bestResult.longitude,
        displayName: bestResult.displayName,
        accuracy: bestResult.accuracy
      };
    }
    
    // Fallback: Try with just city and state if detailed geocoding failed
    if (bestResult && bestResult.accuracy > 0.1) { // Lower threshold for fallback
      console.log(`⚠️ Using fallback geocoding with ${Math.round(bestResult.accuracy * 100)}% accuracy:`, bestResult.displayName);
      return {
        latitude: bestResult.latitude,
        longitude: bestResult.longitude,
        displayName: bestResult.displayName,
        accuracy: bestResult.accuracy
      };
    }
    
    // If no accurate result found, return null
    console.warn('❌ No accurate geocoding result found for address:', address);
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
  } else if (address.postcode && targetAddress.pincode && 
             address.postcode.includes(targetAddress.pincode.substring(0, 3))) {
    // Partial pincode match (first 3 digits)
    score += 0.2;
  }
  
  // Check city match (case insensitive)
  const targetCity = targetAddress.city.toLowerCase();
  if (address.city && address.city.toLowerCase() === targetCity) {
    score += 0.3;
  } else if (address.town && address.town.toLowerCase() === targetCity) {
    score += 0.3;
  } else if (address.city && address.city.toLowerCase().includes(targetCity)) {
    score += 0.15;
  }
  
  // Check state match (case insensitive)
  const targetState = targetAddress.state.toLowerCase();
  if (address.state && address.state.toLowerCase() === targetState) {
    score += 0.2;
  } else if (address.state && address.state.toLowerCase().includes(targetState)) {
    score += 0.1;
  }
  
  // Check street match (partial, case insensitive)
  if (address.road && targetAddress.street) {
    const roadLower = address.road.toLowerCase();
    const streetLower = targetAddress.street.toLowerCase();
    if (roadLower.includes(streetLower) || streetLower.includes(roadLower)) {
      score += 0.1;
    }
  }
  
  // Bonus for exact display name match
  if (result.display_name && result.display_name.toLowerCase().includes(targetCity)) {
    score += 0.05;
  }
  
  return Math.min(score, 1.0); // Cap at 100%
}

// Calculate distance charge based on distance (10 rupees per km)
export function calculateDistanceCharge(distanceInKm) {
  return Math.round(distanceInKm * 10);
}

// Main function to calculate distance and charge from nearest service location to customer address
export async function calculateDistanceFromNearestServiceLocation(customerAddress) {
  try {
    // Geocode customer address
    const customerCoords = await geocodeAddress(customerAddress);
    
    if (!customerCoords) {
      console.warn('Could not geocode customer address, using default distance');
      // Return a reasonable default distance
      const defaultDistance = 15; // Default 15 km
      return {
        distance: defaultDistance,
        distanceCharge: calculateDistanceCharge(defaultDistance),
        customerCoordinates: null,
        baseLocation: null,
        serviceLocation: null,
        error: 'Could not geocode address, using default distance'
      };
    }
    
    // Find nearest service location
    const nearestLocation = getNearestServiceLocation(
      customerCoords.latitude,
      customerCoords.longitude
    );
    
    if (!nearestLocation) {
      console.warn('No service location found within range for customer address');
      return {
        distance: 50, // Default 50 km if no service location found
        distanceCharge: calculateDistanceCharge(50),
        customerCoordinates: customerCoords,
        baseLocation: null,
        serviceLocation: null,
        error: 'No service location found within range'
      };
    }
    
    // Calculate distance from nearest service location
    const distance = calculateDistance(
      nearestLocation.coordinates.latitude,
      nearestLocation.coordinates.longitude,
      customerCoords.latitude,
      customerCoords.longitude
    );
    
    // Calculate distance charge
    const distanceCharge = calculateDistanceCharge(distance);
    
    return {
      distance: distance,
      distanceCharge: distanceCharge,
      customerCoordinates: customerCoords,
      baseLocation: nearestLocation.coordinates,
      serviceLocation: nearestLocation
    };
  } catch (error) {
    console.error('Distance calculation error:', error);
    // Return default values if geocoding fails
    return {
      distance: 15, // Default 15 km
      distanceCharge: 150, // Default charge
      customerCoordinates: null,
      baseLocation: null,
      serviceLocation: null,
      error: error.message
    };
  }
}

// Legacy function for backward compatibility
export async function calculateDistanceFromJanghaiBazar(customerAddress) {
  return calculateDistanceFromNearestServiceLocation(customerAddress);
}

// Function to calculate distance from specific service location
export async function calculateDistanceFromServiceLocation(customerAddress, locationId) {
  try {
    const serviceLocation = getLocationById(locationId);
    if (!serviceLocation) {
      throw new Error(`Service location ${locationId} not found`);
    }
    
    // Geocode customer address
    const customerCoords = await geocodeAddress(customerAddress);
    
    if (!customerCoords) {
      console.warn('Could not geocode customer address');
      return {
        distance: serviceLocation.serviceRadius,
        distanceCharge: calculateDistanceCharge(serviceLocation.serviceRadius),
        customerCoordinates: null,
        baseLocation: serviceLocation.coordinates,
        serviceLocation: serviceLocation,
        error: 'Could not geocode address'
      };
    }
    
    // Calculate distance
    const distance = calculateDistance(
      serviceLocation.coordinates.latitude,
      serviceLocation.coordinates.longitude,
      customerCoords.latitude,
      customerCoords.longitude
    );
    
    // Calculate distance charge
    const distanceCharge = calculateDistanceCharge(distance);
    
    return {
      distance: distance,
      distanceCharge: distanceCharge,
      customerCoordinates: customerCoords,
      baseLocation: serviceLocation.coordinates,
      serviceLocation: serviceLocation
    };
  } catch (error) {
    console.error('Distance calculation error:', error);
    return {
      distance: 15,
      distanceCharge: 150,
      customerCoordinates: null,
      baseLocation: null,
      serviceLocation: null,
      error: error.message
    };
  }
} 