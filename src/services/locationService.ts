import { GeoLocation, Listing } from "../types";

// Default neighborhood center: Heritage Oaks / Shanthi Nagar district
export const DEFAULT_USER_LOCATION: GeoLocation = {
  lat: 13.0827,
  lng: 80.2707,
  address: "14 Palm Grove Ave",
  neighborhood: "Heritage District",
  city: "Metro West",
};

/**
 * Calculates great-circle distance between two points using the Haversine formula
 * Returns distance in kilometers (km)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // 1 decimal place
}

/**
 * Convenience helper to calculate distance between two GeoLocation objects or coordinate tuples
 */
export function calculateDistance(
  lat1OrLoc1: number | GeoLocation | { lat: number; lng: number },
  lng1OrLoc2?: number | GeoLocation | { lat: number; lng: number },
  lat2?: number,
  lng2?: number
): number {
  if (typeof lat1OrLoc1 === "object" && typeof lng1OrLoc2 === "object") {
    return calculateHaversineDistance(lat1OrLoc1.lat, lat1OrLoc1.lng, lng1OrLoc2.lat, lng1OrLoc2.lng);
  }
  if (
    typeof lat1OrLoc1 === "number" &&
    typeof lng1OrLoc2 === "number" &&
    typeof lat2 === "number" &&
    typeof lng2 === "number"
  ) {
    return calculateHaversineDistance(lat1OrLoc1, lng1OrLoc2, lat2, lng2);
  }
  return 0;
}

export function calculateDistanceKm(
  loc1: GeoLocation | { lat: number; lng: number },
  loc2: GeoLocation | { lat: number; lng: number }
): number {
  return calculateHaversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Requests real browser geolocation with reverse geocoding and precision tracking
 */
export async function getDetailedSystemLocation(): Promise<{
  location: GeoLocation;
  isGpsAccurate: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        location: DEFAULT_USER_LOCATION,
        isGpsAccurate: false,
        error: "Geolocation is not supported by your browser.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        let address = "Workshop / Studio Location";
        let neighborhood = "Heritage District";
        let city = "Local District";

        // Try reverse geocoding via public OpenStreetMap Nominatim API with 3s timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" }, signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const road =
                data.address.road ||
                data.address.pedestrian ||
                data.address.suburb ||
                "Main Road Studio";
              const suburb =
                data.address.suburb ||
                data.address.neighbourhood ||
                data.address.residential ||
                data.address.city_district ||
                "Artisan Quarter";
              const cityName =
                data.address.city ||
                data.address.town ||
                data.address.state_district ||
                "Metro Area";
              address = road;
              neighborhood = suburb;
              city = cityName;
            }
          }
        } catch {
          // Keep clean descriptive default if Nominatim times out
          address = `GPS Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
          neighborhood = "Current Neighborhood";
          city = "Nearby";
        }

        resolve({
          location: {
            lat: Math.round(lat * 10000) / 10000,
            lng: Math.round(lng * 10000) / 10000,
            address,
            neighborhood,
            city,
          },
          isGpsAccurate: true,
        });
      },
      (err) => {
        let msg = "Could not retrieve GPS location.";
        if (err.code === 1) {
          msg =
            "Location permission was denied. Please allow location access in your browser or set your workshop address manually.";
        } else if (err.code === 2) {
          msg = "GPS signal is currently unavailable. You can choose your neighborhood manually.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please retry.";
        }
        resolve({
          location: DEFAULT_USER_LOCATION,
          isGpsAccurate: false,
          error: msg,
        });
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 10000 }
    );
  });
}

export const POPULAR_NEIGHBORHOOD_PRESETS = [
  { name: "Mylapore (மயிலாப்பூர்)", city: "Chennai", lat: 13.0336, lng: 80.2676 },
  { name: "T. Nagar (தி. நகர்)", city: "Chennai", lat: 13.0418, lng: 80.2341 },
  { name: "Anna Nagar (அண்ணா நகர்)", city: "Chennai", lat: 13.0850, lng: 80.2101 },
  { name: "Adyar (அடையாறு)", city: "Chennai", lat: 13.0012, lng: 80.2565 },
  { name: "Indiranagar", city: "Bengaluru", lat: 12.9784, lng: 77.6408 },
  { name: "Koramangala", city: "Bengaluru", lat: 12.9352, lng: 77.6245 },
  { name: "Malleshwaram", city: "Bengaluru", lat: 13.0031, lng: 77.5643 },
  { name: "Heritage Quarter", city: "Metro West", lat: 13.0855, lng: 80.2730 },
  { name: "Clocktower Square", city: "Metro West", lat: 13.0780, lng: 80.2650 },
  { name: "Riverside Garden", city: "Metro West", lat: 13.0890, lng: 80.2780 },
  { name: "Bandra West", city: "Mumbai", lat: 19.0596, lng: 72.8295 },
  { name: "Old Delhi Heritage Lane", city: "Delhi", lat: 28.6562, lng: 77.2410 },
];

/**
 * Requests real browser geolocation with fallback
 */
export async function getCurrentSystemLocation(): Promise<GeoLocation> {
  const result = await getDetailedSystemLocation();
  return result.location;
}

/**
 * Continuous background GPS tracking for real-time location watching
 */
export function startWatchingSystemLocation(
  onLocationUpdate: (location: GeoLocation) => void
): () => void {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = Math.round(position.coords.latitude * 10000) / 10000;
      const lng = Math.round(position.coords.longitude * 10000) / 10000;
      onLocationUpdate({
        lat,
        lng,
        address: `Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        neighborhood: "My Current Location",
        city: "Live GPS",
      });
    },
    (err) => {
      console.warn("Continuous GPS watch notice:", err.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

/**
 * Attaches computed distance to listings and filters within max distance
 */
export function filterListingsByProximity(
  listings: Listing[],
  userLocation: GeoLocation,
  maxRadiusKm: number
): Listing[] {
  return listings
    .map((item) => {
      const distance = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        item.location.lat,
        item.location.lng
      );
      return {
        ...item,
        distanceKm: distance,
      };
    })
    .filter((item) => (item.distanceKm ?? 0) <= maxRadiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/**
 * Formats distance display nicely (e.g. "0.8 km away" or "400 m away")
 */
export function formatDistance(distanceKm?: number): string {
  if (distanceKm === undefined || distanceKm === null) return "Nearby";
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}
