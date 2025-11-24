// pages/api/clinics/geocode.js
import axios from 'axios';

export default async function handler(req, res) {
  const { place } = req.query;
  if (!place) return res.status(400).json({ message: 'Place is required' });

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { 
        address: place, 
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
      }
    });

    const result = response.data.results?.[0];
    const location = result?.geometry?.location;

    if (!location) return res.status(404).json({ message: 'Location not found' });

    // Enhanced international location detection
    const locationInfo = analyzeLocation(result, place);

    res.status(200).json({
      lat: location.lat,
      lng: location.lng,
      isDubai: locationInfo.isDubai,
      isInternational: locationInfo.isInternational,
      country: locationInfo.country,
      formattedAddress: result.formatted_address
    });
  } catch (err) {
    console.error('Geocoding error:', err);
    res.status(500).json({ message: 'Geocoding failed', error: err.message });
  }
}

// Enhanced function to analyze location for international support
function analyzeLocation(result, originalPlace) {
  const addressComponents = result.address_components || [];
  const formattedAddress = result.formatted_address?.toLowerCase() || '';
  const searchQuery = originalPlace.toLowerCase();
  
  // Extract country information
  const countryComponent = addressComponents.find(component => 
    component.types.includes('country')
  );
  const country = countryComponent ? countryComponent.long_name : 'Unknown';
  
  // Check if location is outside India
  const isInternational = country !== 'India';
  
  // Dubai-specific detection
  const dubaiKeywords = [
    'dubai', 'دبي', 'uae', 'united arab emirates', 
    'emirate', 'burj', 'sheikh zayed', 'marina', 
    'downtown dubai', 'jumeirah', 'deira', 'bur dubai'
  ];
  
  const isDubai = dubaiKeywords.some(keyword => 
    searchQuery.includes(keyword) ||
    formattedAddress.includes(keyword) ||
    addressComponents.some(component => 
      component.long_name.toLowerCase().includes(keyword) ||
      component.short_name.toLowerCase().includes(keyword)
    )
  );
  
  // Check coordinates bounds for Dubai
  const lat = result.geometry.location.lat;
  const lng = result.geometry.location.lng;
  
  const dubaiBounds = {
    north: 25.5000,
    south: 24.8000,
    east: 55.6000,
    west: 54.8000,
  };

  const isWithinDubaiBounds = 
    lat >= dubaiBounds.south &&
    lat <= dubaiBounds.north &&
    lng >= dubaiBounds.west &&
    lng <= dubaiBounds.east;

  return {
    isDubai: isDubai || isWithinDubaiBounds,
    isInternational,
    country
  };
}