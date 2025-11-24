import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Treatment from "../../../models/Treatment";
import axios from "axios";

export default async function handler(req, res) {
  await dbConnect();
  const { lat, lng, service } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ message: "Latitude and longitude required" });
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  const locationInfo = await checkLocationInfo(latitude, longitude);

  const query = {
    isApproved: true,
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: locationInfo.isInternational ? 200000 : 100000,
      },
    },
  };

  if (service) {
    // Parse the service string to extract sub-treatment and main treatment
    let subTreatmentName = service;
    let mainTreatmentName = null;

    // Check if service is in format "Sub Treatment (Main Treatment)"
    const match = service.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      subTreatmentName = match[1].trim();
      mainTreatmentName = match[2].trim();
    }

    console.log("Parsed service:", {
      subTreatmentName,
      mainTreatmentName,
      originalService: service,
    });

    // First, try to find the exact treatment in the global Treatment model
    let foundTreatment = null;
    let foundSubTreatment = null;

    try {
      // Search for main treatment first
      if (mainTreatmentName) {
        foundTreatment = await Treatment.findOne({
          name: { $regex: new RegExp(mainTreatmentName, "i") },
        }).lean();
      }

      // If main treatment not found or not provided, search by sub-treatment
      if (!foundTreatment) {
        foundTreatment = await Treatment.findOne({
          "subcategories.name": { $regex: new RegExp(subTreatmentName, "i") },
        }).lean();
      }

      if (foundTreatment) {
        // Find the specific sub-treatment
        foundSubTreatment = foundTreatment.subcategories?.find((sub) =>
          sub.name.toLowerCase().includes(subTreatmentName.toLowerCase())
        );

        if (foundSubTreatment) {
          console.log(
            "Found sub-treatment:",
            foundSubTreatment.name,
            "in main treatment:",
            foundTreatment.name
          );

          // Search for clinics that have this specific sub-treatment
          query.$or = [
            { "treatments.subTreatments.name": foundSubTreatment.name },
            { "treatments.mainTreatment": foundTreatment.name },
            { name: { $regex: new RegExp(service, "i") } },
          ];
        } else {
          // If sub-treatment not found, search by main treatment
          console.log(
            "Sub-treatment not found, searching by main treatment:",
            foundTreatment.name
          );
          query.$or = [
            { "treatments.mainTreatment": foundTreatment.name },
            { name: { $regex: new RegExp(service, "i") } },
          ];
        }
      } else {
        // Fallback to regex search if treatment not found in global model
        console.log(
          "Treatment not found in global model, using fallback search"
        );
        query.$or = [
          { "treatments.mainTreatment": { $regex: new RegExp(service, "i") } },
          {
            "treatments.subTreatments.name": {
              $regex: new RegExp(service, "i"),
            },
          },
          { name: { $regex: new RegExp(service, "i") } },
        ];
      }
    } catch (error) {
      console.error("Error searching for treatment:", error);
      // Fallback to regex search with proper regex patterns
      query.$or = [
        { "treatments.mainTreatment": { $regex: new RegExp(service, "i") } },
        {
          "treatments.subTreatments.name": { $regex: new RegExp(service, "i") },
        },
        { name: { $regex: new RegExp(service, "i") } },
      ];
    }
  }

  try {
    console.log("Final query:", JSON.stringify(query, null, 2));

    // First, let's test if we can find any clinics at all
    const allClinics = await Clinic.find({ isApproved: true }).limit(5).lean();
    console.log("Total approved clinics found:", allClinics.length);
    if (allClinics.length > 0) {
      console.log("Sample clinic treatments:", allClinics[0].treatments);
    }

    let clinics = await Clinic.find(query)
      .select(
        "name address treatments servicesName location pricing timings photos phone rating reviews verified"
      )
      .limit(locationInfo.isInternational ? 100 : 50)
      .lean();

    console.log("Found clinics count:", clinics.length);

    // If no clinics found and we have a service, try without location constraint
    if (clinics.length === 0 && service) {
      console.log(
        "No clinics found with location constraint, trying without location..."
      );

      const queryWithoutLocation = { ...query };
      delete queryWithoutLocation.location;

      console.log(
        "Query without location:",
        JSON.stringify(queryWithoutLocation, null, 2)
      );
      const clinicsWithoutLocation = await Clinic.find(queryWithoutLocation)
        .select(
          "name address treatments servicesName location pricing timings photos phone rating reviews verified"
        )
        .limit(10)
        .lean();

      console.log(
        "Clinics found without location constraint:",
        clinicsWithoutLocation.length
      );
      if (clinicsWithoutLocation.length > 0) {
        console.log(
          "Sample clinic without location:",
          clinicsWithoutLocation[0].name,
          clinicsWithoutLocation[0].treatments
        );
        // Use these results instead
        clinics = clinicsWithoutLocation;
      }

      // Test: Check if the specific clinic exists and has location
      const testClinic = await Clinic.findById(
        "6889d13363b3ba38a2318a6a"
      ).lean();
      if (testClinic) {
        console.log("Test clinic found:", testClinic.name);
        console.log("Test clinic location:", testClinic.location);
        console.log("Test clinic has location field:", !!testClinic.location);
        if (testClinic.location) {
          console.log("Location coordinates:", testClinic.location.coordinates);

          // Calculate distance between search location and clinic
          const searchLat = latitude;
          const searchLng = longitude;
          const clinicLat = testClinic.location.coordinates[1];
          const clinicLng = testClinic.location.coordinates[0];

          // Simple distance calculation (approximate)
          const R = 6371; // Earth's radius in km
          const dLat = ((clinicLat - searchLat) * Math.PI) / 180;
          const dLng = ((clinicLng - searchLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((searchLat * Math.PI) / 180) *
              Math.cos((clinicLat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          console.log(
            "Distance from search location to clinic:",
            distance.toFixed(2),
            "km"
          );
          console.log("Search location:", searchLat, searchLng);
          console.log("Clinic location:", clinicLat, clinicLng);
        }

        // Test: Try to find clinics with exact sub-treatment name
        const exactSubTreatmentQuery = {
          isApproved: true,
          "treatments.subTreatments.name": "Root Canal Treatment",
        };

        console.log(
          "Exact sub-treatment query:",
          JSON.stringify(exactSubTreatmentQuery, null, 2)
        );
        const exactResults = await Clinic.find(exactSubTreatmentQuery)
          .limit(5)
          .lean();
        console.log("Exact sub-treatment results count:", exactResults.length);
        if (exactResults.length > 0) {
          console.log(
            "Exact sub-treatment sample clinic:",
            exactResults[0].name,
            exactResults[0].treatments
          );
        }

        // Test: Try with case-insensitive regex
        const regexSubTreatmentQuery = {
          isApproved: true,
          "treatments.subTreatments.name": {
            $regex: new RegExp("Root Canal Treatment", "i"),
          },
        };

        console.log(
          "Regex sub-treatment query:",
          JSON.stringify(regexSubTreatmentQuery, null, 2)
        );
        const regexResults = await Clinic.find(regexSubTreatmentQuery)
          .limit(5)
          .lean();
        console.log("Regex sub-treatment results count:", regexResults.length);
        if (regexResults.length > 0) {
          console.log(
            "Regex sub-treatment sample clinic:",
            regexResults[0].name,
            regexResults[0].treatments
          );
        }

        // Test: Try with larger search radius
        const largeRadiusQuery = {
          isApproved: true,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [longitude, latitude],
              },
              $maxDistance: 500000, // 500km instead of 100km
            },
          },
          "treatments.subTreatments.name": {
            $regex: new RegExp("Root Canal Treatment", "i"),
          },
        };

        console.log(
          "Large radius query:",
          JSON.stringify(largeRadiusQuery, null, 2)
        );
        const largeRadiusResults = await Clinic.find(largeRadiusQuery)
          .limit(5)
          .lean();
        console.log("Large radius results count:", largeRadiusResults.length);
        if (largeRadiusResults.length > 0) {
          console.log(
            "Large radius sample clinic:",
            largeRadiusResults[0].name,
            largeRadiusResults[0].treatments
          );
        }
      }
    }

    // ✅ Add photo path handling (local + live)
    clinics = clinics.map((clinic) => ({
      ...clinic,
      photos:
        clinic.photos?.map((photo) => {
          if (!photo) return null;

          if (photo.startsWith("http")) return photo; // Already full URL
          if (photo.startsWith("/uploads/clinic/")) return photo; // Local dev

          const filename = photo.split("uploads/clinic/").pop();
          return `https://zeva360.com/uploads/clinic/${filename}`;
        }) || [],
    }));

    // Dubai prioritization logic
    if (locationInfo.isDubai) {
      let ramacareClinic = clinics.find(
        (clinic) =>
          clinic.name.toLowerCase().includes("ramacare") ||
          clinic.name.toLowerCase().includes("rama care") ||
          clinic.name.toLowerCase().includes("ramacare polyclinic") ||
          clinic.name.toLowerCase().includes("rama care polyclinic")
      );

      if (!ramacareClinic) {
        ramacareClinic = await Clinic.findOne({
          name: {
            $regex:
              /ramacare|rama care|ramacare polyclinic|rama care polyclinic/i,
          },
          address: { $regex: /dubai/i },
        }).lean();
      }

      if (ramacareClinic) {
        ramacareClinic.photos =
          ramacareClinic.photos?.map((photo) => {
            if (!photo) return null;

            if (photo.startsWith("http")) return photo;
            if (photo.startsWith("/uploads/clinic/")) return photo;

            const filename = photo.split("uploads/clinic/").pop();
            return `https://zeva360.com/uploads/clinic/${filename}`;
          }) || [];

        clinics = clinics.filter(
          (clinic) =>
            !(
              clinic.name.toLowerCase().includes("ramacare") ||
              clinic.name.toLowerCase().includes("rama care") ||
              clinic.name.toLowerCase().includes("ramacare polyclinic") ||
              clinic.name.toLowerCase().includes("rama care polyclinic")
            )
        );

        ramacareClinic.isDubaiPrioritized = true;
        clinics = [ramacareClinic, ...clinics];
      }
    }

    clinics = clinics.slice(0, locationInfo.isInternational ? 30 : 20);

    res.status(200).json({ success: true, clinics });
  } catch (error) {
    console.error("Error fetching clinics:", error);
    res
      .status(500)
      .json({ message: "Error fetching clinics", error: error.message });
  }
}

async function checkLocationInfo(lat, lng) {
  try {
    const dubaiBounds = {
      north: 25.5,
      south: 24.8,
      east: 55.6,
      west: 54.8,
    };

    const isWithinDubaiBounds =
      lat >= dubaiBounds.south &&
      lat <= dubaiBounds.north &&
      lng >= dubaiBounds.west &&
      lng <= dubaiBounds.east;

    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            latlng: `${lat},${lng}`,
            key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          },
        }
      );

      const results = response.data.results;
      if (results && results.length > 0) {
        const addressComponents = results[0].address_components;

        const countryComponent = addressComponents.find((component) =>
          component.types.includes("country")
        );
        const country = countryComponent
          ? countryComponent.long_name
          : "Unknown";

        const isDubai =
          addressComponents.some(
            (component) =>
              component.long_name.toLowerCase().includes("dubai") ||
              component.short_name.toLowerCase().includes("dubai") ||
              component.long_name.toLowerCase().includes("دبي") ||
              component.long_name.toLowerCase().includes("uae") ||
              component.long_name.toLowerCase().includes("united arab emirates")
          ) || isWithinDubaiBounds;

        return {
          isDubai,
          isInternational: country !== "India",
          country,
        };
      }
    } catch (geocodeError) {
      console.log(
        "Geocoding error, falling back to bounds check:",
        geocodeError.message
      );
      return {
        isDubai: isWithinDubaiBounds,
        isInternational: false,
        country: "Unknown",
      };
    }

    return {
      isDubai: isWithinDubaiBounds,
      isInternational: false,
      country: "Unknown",
    };
  } catch (error) {
    console.error("Error checking location:", error);
    return {
      isDubai: false,
      isInternational: false,
      country: "Unknown",
    };
  }
}
