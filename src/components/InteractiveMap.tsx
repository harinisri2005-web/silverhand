import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import {
  MapPin,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Navigation,
  Sparkles,
  Phone,
  MessageSquare,
  Mic,
  Volume2,
  X,
  Store,
  ExternalLink,
  LocateFixed,
  Maximize2,
  Repeat,
  GraduationCap,
  ChevronRight,
  Radio,
  Check,
} from "lucide-react";
import { Listing, GeoLocation, MarketplaceEvent } from "../types";
import { formatDistance } from "../services/locationService";
import { AudioPlayerButton } from "./AudioPlayerButton";
import { useLanguage } from "../context/LanguageContext";

interface InteractiveMapProps {
  userLocation: GeoLocation;
  listings: Listing[];
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing | null) => void;
  onContactProvider: (listing: Listing, startWithVoice?: boolean) => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  onUpdateUserLocation?: (newLoc: GeoLocation) => void;
  events?: MarketplaceEvent[];
  onSelectEvent?: (event: MarketplaceEvent) => void;
  onOpenMeetupModal?: () => void;
}

type MapLayerType = "voyager" | "osm" | "satellite" | "dark";

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  userLocation,
  listings,
  selectedListing,
  onSelectListing,
  onContactProvider,
  radiusKm,
  onRadiusChange,
  onUpdateUserLocation,
  events = [],
  onSelectEvent,
  onOpenMeetupModal,
}) => {
  const { t, translateCategory, translateListing } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>("voyager");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showNeighborDrawer, setShowNeighborDrawer] = useState(true);
  const [mapCustomRadius, setMapCustomRadius] = useState<string>("");

  // Category Color Map & Emoji for artisan markers
  const getCategoryMeta = (cat: string) => {
    const translated = translateCategory(cat);
    switch (cat) {
      case "repairs_mending":
        return { color: "#F59E0B", icon: "🧵", label: translated };
      case "home_cooking":
        return { color: "#EF4444", icon: "🍲", label: translated };
      case "gardening_botanicals":
        return { color: "#10B981", icon: "🌿", label: translated };
      case "traditional_skills":
        return { color: "#8B5CF6", icon: "🕰️", label: translated };
      case "barter_request":
        return { color: "#EC4899", icon: "📱", label: translated };
      case "handmade_goods":
        return { color: "#3B82F6", icon: "🪵", label: translated };
      default:
        return { color: "#3B82F6", icon: "✨", label: translated || "Artisan Craft" };
    }
  };

  // Helper to extract short craft title
  const getShortCraftLabel = (listing: Listing) => {
    if (listing.titleEnglish) {
      const parts = listing.titleEnglish.split("&")[0].split("(")[0].trim();
      return parts.length > 20 ? parts.substring(0, 18) + "…" : parts;
    }
    const clean = listing.title.split("(")[0].trim();
    return clean.length > 20 ? clean.substring(0, 18) + "…" : clean;
  };

  // Free Tile Providers (100% Free & Open)
  const tileUrls: Record<MapLayerType, { url: string; attribution: string }> = {
    voyager: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    osm: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
  };

  // Initialize Real Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = userLocation?.lat || 13.0827;
    const initialLng = userLocation?.lng || 80.2707;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Add Free Tile Layer
    const tileConfig = tileUrls[activeLayer];
    const tiles = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tiles;
    mapInstanceRef.current = map;

    // Layer Group for markers
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Invalidate size on resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileConfig = tileUrls[activeLayer];
    tileLayerRef.current.setUrl(tileConfig.url);
  }, [activeLayer]);

  // Update User Marker & Proximity Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const userPos: [number, number] = [userLocation.lat, userLocation.lng];

    // Create / Update User Icon Marker with exact "🏠 Me" pill badge
    const userHtml = `
      <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
        <div class="px-3.5 py-1.5 rounded-full bg-[#1877F2] border-2 border-white shadow-[0_8px_20px_rgba(24,119,242,0.45)] flex items-center space-x-1.5 text-white font-bold text-xs whitespace-nowrap">
          <span class="text-sm leading-none">🏠</span>
          <span class="tracking-wide">Me</span>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: userHtml,
      iconSize: [0, 0],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userPos);
      userMarkerRef.current.setIcon(userIcon);
    } else {
      userMarkerRef.current = L.marker(userPos, {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      userMarkerRef.current.bindPopup(`
        <div style="padding: 6px 8px; font-family: sans-serif; min-width: 140px;">
          <div style="font-weight: 800; color: #1877F2; font-size: 13px; display: flex; align-items: center; gap: 4px;">
            <span>🏠 Me (My Current Location)</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 3px; font-weight: 500;">
            ${userLocation.neighborhood || userLocation.address || "Current Neighborhood"}
          </div>
          <div style="font-size: 10px; color: #d97706; margin-top: 4px; font-weight: 700;">
            • Active Search Radius: ${radiusKm} km
          </div>
        </div>
      `);
    }

    // Create / Update Real Proximity Radius Circle centered on "Me"
    const radiusMeters = radiusKm * 1000;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng(userPos);
      radiusCircleRef.current.setRadius(radiusMeters);
      radiusCircleRef.current.setStyle({
        color: "#F59E0B",
        weight: 2,
        dashArray: "10, 8",
        fillColor: "#F59E0B",
        fillOpacity: 0.08,
      });
    } else {
      radiusCircleRef.current = L.circle(userPos, {
        radius: radiusMeters,
        color: "#F59E0B",
        weight: 2,
        dashArray: "10, 8",
        fillColor: "#F59E0B",
        fillOpacity: 0.08,
      }).addTo(map);

      radiusCircleRef.current.bindTooltip(
        `🧭 ${radiusKm} km Radius from Me`,
        { permanent: false, direction: "top", className: "radius-tooltip" }
      );
    }
  }, [userLocation, radiusKm]);

  // Update Dynamic Neighbor Pins & Marketplace Event Pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Render Marketplace / Meetup Event Pins
    events.forEach((ev) => {
      const eventHtml = `
        <div class="relative cursor-pointer transition-transform duration-200 hover:scale-110 -translate-x-1/2 -translate-y-full z-40">
          <div class="flex flex-col items-center">
            <div class="relative px-3 py-1.5 rounded-2xl shadow-[0_8px_25px_rgba(245,158,11,0.5)] flex items-center space-x-1.5 border-2 border-amber-400 text-slate-950 font-bold bg-gradient-to-r from-amber-400 to-amber-300">
              <span class="text-base leading-none">🎪</span>
              <div class="flex flex-col text-left leading-none">
                <span class="text-[11px] font-black text-slate-950 truncate max-w-[120px]">
                  ${ev.title.split("&")[0].substring(0, 16)}…
                </span>
                <span class="text-[9px] font-bold text-amber-950 truncate">
                  ${ev.registeredShops.length}/${ev.stallsCapacity} Stalls
                </span>
              </div>
            </div>
            <div class="w-3 h-3 rotate-45 -mt-1.5 border-r-2 border-b-2 border-amber-400 bg-amber-300"></div>
          </div>
        </div>
      `;

      const eventIcon = L.divIcon({
        className: `event-pin-${ev.id}`,
        html: eventHtml,
        iconSize: [0, 0],
      });

      const eventMarker = L.marker([ev.location.lat, ev.location.lng], {
        icon: eventIcon,
        zIndexOffset: 600,
      });

      eventMarker.on("click", () => {
        if (onSelectEvent) {
          onSelectEvent(ev);
        } else if (onOpenMeetupModal) {
          onOpenMeetupModal();
        }
        map.panTo([ev.location.lat, ev.location.lng], {
          animate: true,
          duration: 0.5,
        });
      });

      group.addLayer(eventMarker);
    });

    // 2. Render Neighbor Artisan Pins
    listings.forEach((listing) => {
      const isSelected = selectedListing?.id === listing.id;
      const meta = getCategoryMeta(listing.category);
      const isInside = (listing.distanceKm ?? 0) <= radiusKm;
      const shortCraft = getShortCraftLabel(listing);

      const markerHtml = `
        <div class="relative cursor-pointer transition-transform duration-200 hover:scale-110 -translate-x-1/2 -translate-y-full ${
          isSelected ? "scale-110 z-50" : ""
        }" style="opacity: ${isInside ? "1" : "0.7"};">
          ${
            isSelected
              ? `<div class="absolute -inset-3 bg-amber-400/40 rounded-2xl animate-ping"></div>`
              : ""
          }
          <div class="flex flex-col items-center">
            <!-- Pin Badge with Avatar + What they do + Price/Barter -->
            <div class="relative px-2.5 py-1.5 rounded-2xl shadow-2xl flex items-center space-x-1.5 border-2 text-slate-950 font-bold bg-white"
                 style="border-color: ${isSelected ? "#F59E0B" : meta.color};">
              <span class="text-sm leading-none">${meta.icon}</span>
              <img src="${listing.providerAvatar || listing.imageUrl}" 
                   class="w-5 h-5 rounded-full object-cover border border-slate-300" 
                   referrerpolicy="no-referrer" />
              <div class="flex flex-col text-left leading-none">
                <span class="text-[11px] font-bold text-slate-900 truncate max-w-[100px]">
                  ${listing.providerName.split(" ")[0]}
                </span>
                <span class="text-[9px] font-medium text-slate-600 truncate max-w-[100px]">
                  ${shortCraft}
                </span>
              </div>
              <span class="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
                listing.price > 0
                  ? "bg-slate-100 text-slate-900 border border-slate-300"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }">
                ${listing.price > 0 ? `₹${listing.price}` : "🤝"}
              </span>
            </div>
            <!-- Pin Pointer Arrow -->
            <div class="w-3 h-3 rotate-45 -mt-1.5 border-r-2 border-b-2 bg-white"
                 style="border-color: ${isSelected ? "#F59E0B" : meta.color};">
            </div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: `neighbor-pin-${listing.id}`,
        html: markerHtml,
        iconSize: [0, 0],
      });

      const marker = L.marker([listing.location.lat, listing.location.lng], {
        icon,
        zIndexOffset: isSelected ? 500 : 100,
      });

      marker.on("click", () => {
        onSelectListing(listing);
        map.panTo([listing.location.lat, listing.location.lng], {
          animate: true,
          duration: 0.5,
        });
      });

      group.addLayer(marker);
    });
  }, [listings, events, selectedListing, radiusKm, onSelectListing, onSelectEvent, onOpenMeetupModal]);

  // Pan to selected listing if changed externally
  useEffect(() => {
    if (selectedListing && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(
        [selectedListing.location.lat, selectedListing.location.lng],
        { animate: true, duration: 0.6 }
      );
    }
  }, [selectedListing]);

  // Handle Real GPS Geolocation Locate Me
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const newLoc: GeoLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "Your Current GPS Location",
          neighborhood: "Live GPS Position",
          city: "Local",
        };
        if (onUpdateUserLocation) {
          onUpdateUserLocation(newLoc);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([newLoc.lat, newLoc.lng], 15, {
            animate: true,
            duration: 1,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn("Could not get GPS location:", err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Center on Me Location
  const handleCenterOnMe = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 14, {
      animate: true,
      duration: 0.8,
    });
  };

  // Fit view to entire radius circle around Me
  const handleFitRadius = () => {
    if (!mapInstanceRef.current || !radiusCircleRef.current) {
      handleCenterOnMe();
      return;
    }
    const bounds = radiusCircleRef.current.getBounds();
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
  };

  // Generate Real Google Maps Directions Universal Link (100% Free)
  const getGoogleMapsDirectionsUrl = (listing: Listing) => {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${listing.location.lat},${listing.location.lng}&travelmode=walking`;
  };

  return (
    <div className="relative w-full h-[580px] bg-slate-950 rounded-3xl border-2 border-amber-900/40 overflow-hidden shadow-2xl flex flex-col">
      {/* Real-time Map Control Header */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Live Neighbor Radar Status Badge */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-2xl shadow-xl pointer-events-auto flex items-center space-x-2.5 text-white">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-100 flex items-center space-x-1.5">
              <span>Neighbor Radar & Live Map</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-[11px] text-slate-300">
              Radius: <span className="text-amber-300 font-bold">{radiusKm} km</span> •{" "}
              <span className="text-emerald-300 font-semibold">{listings.length} neighbors active</span>
            </div>
          </div>
        </div>

        {/* Action Controls: Radius + Layer Switcher + Locate GPS + Fit Radius */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {/* Radius selector pills & custom enter option */}
          <div className="bg-[#0F172A]/95 backdrop-blur-md border border-slate-700/80 p-1 rounded-full shadow-2xl flex items-center space-x-1">
            {[1, 3, 5, 10, 20].map((r) => (
              <button
                key={r}
                onClick={() => {
                  onRadiusChange(r);
                  setMapCustomRadius("");
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  radiusKm === r
                    ? "bg-[#FFA500] text-slate-950 shadow-md font-extrabold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                }`}
              >
                {r}{t("common_km", "km")}
              </button>
            ))}

            {/* Custom Distance Input Field */}
            <div className="flex items-center bg-slate-900/90 rounded-full px-2 py-0.5 border border-slate-700/80 focus-within:border-amber-400">
              <input
                id="map-custom-radius-input"
                type="number"
                min="0.5"
                max="500"
                step="any"
                value={mapCustomRadius}
                onChange={(e) => setMapCustomRadius(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseFloat(mapCustomRadius);
                    if (!isNaN(val) && val > 0) {
                      onRadiusChange(Math.min(500, Math.max(0.5, Math.round(val * 10) / 10)));
                    }
                  }
                }}
                placeholder={![1, 3, 5, 10, 20].includes(radiusKm) ? `${radiusKm}` : t("search_enter_distance_placeholder", "km")}
                className={`w-12 bg-transparent text-amber-200 text-xs font-mono font-bold outline-none text-center ${
                  ![1, 3, 5, 10, 20].includes(radiusKm) ? "text-amber-300 font-extrabold" : ""
                }`}
                title={t("search_enter_distance", "Enter km distance")}
              />
              <button
                type="button"
                id="btn-map-apply-custom-radius"
                onClick={() => {
                  const val = parseFloat(mapCustomRadius);
                  if (!isNaN(val) && val > 0) {
                    onRadiusChange(Math.min(500, Math.max(0.5, Math.round(val * 10) / 10)));
                  }
                }}
                disabled={!mapCustomRadius || isNaN(parseFloat(mapCustomRadius)) || parseFloat(mapCustomRadius) <= 0}
                className="p-1 rounded-full text-amber-400 hover:text-amber-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                title={t("search_apply", "Set Radius")}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </button>
            </div>
          </div>

          {/* Layer Selector Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              title="Change Map Style"
              className="w-9 h-9 rounded-full bg-[#0F172A]/95 border border-slate-700/80 text-amber-300 hover:text-white shadow-2xl flex items-center justify-center cursor-pointer transition-all hover:bg-slate-800"
            >
              <Layers className="w-4 h-4" />
            </button>

            {showLayerMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-2xl p-1.5 shadow-2xl text-xs z-[1100] animate-fadeIn">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Real Map Layers
                </div>
                {[
                  { id: "voyager", label: "🗺️ Artisan Voyager", sub: "Clean & High Contrast" },
                  { id: "osm", label: "🚦 OpenStreetMap", sub: "Full Street Names & Lanes" },
                  { id: "satellite", label: "🛰️ Satellite Aerial", sub: "Real Aerial Imagery" },
                  { id: "dark", label: "🌙 Dark Matter", sub: "Night & Low Light" },
                ].map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => {
                      setActiveLayer(layer.id as MapLayerType);
                      setShowLayerMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-all flex flex-col cursor-pointer ${
                      activeLayer === layer.id
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{layer.label}</span>
                    <span className="text-[10px] text-slate-400">{layer.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Locate GPS Button */}
          <button
            onClick={handleLocateMe}
            title="Locate my position"
            className={`w-9 h-9 rounded-full border shadow-2xl transition-all cursor-pointer flex items-center justify-center ${
              isLocating
                ? "bg-blue-600 text-white animate-pulse border-blue-400"
                : "bg-[#0F172A]/95 border-slate-700/80 text-blue-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <LocateFixed className="w-4 h-4" />
          </button>

          {/* Fit Radius Circle Button */}
          <button
            onClick={handleFitRadius}
            title={`Fit ${radiusKm}km Radius Area`}
            className="w-9 h-9 rounded-full bg-[#0F172A]/95 border border-slate-700/80 text-amber-300 hover:text-white shadow-2xl cursor-pointer hover:bg-slate-800 transition-all flex items-center justify-center"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real Map Container for Leaflet Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 cursor-grab active:cursor-grabbing"
      />

      {/* Floating Meetup & Marketplace Quick Button on Map */}
      {onOpenMeetupModal && (
        <button
          onClick={onOpenMeetupModal}
          className="absolute bottom-4 left-4 z-[1000] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-2xl border-2 border-slate-900 flex items-center space-x-2 transition-all hover:scale-105 cursor-pointer"
        >
          <span className="text-base leading-none">🎪</span>
          <span>Meetups & Bazaars ({events.length})</span>
        </button>
      )}

      {/* Zoom In/Out Floating Controls */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col space-y-2">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-10 h-10 rounded-full bg-[#0F172A]/95 border border-slate-700/80 text-amber-200 hover:text-white flex items-center justify-center shadow-2xl cursor-pointer hover:bg-slate-800 transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-10 h-10 rounded-full bg-[#0F172A]/95 border border-slate-700/80 text-amber-200 hover:text-white flex items-center justify-center shadow-2xl cursor-pointer hover:bg-slate-800 transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Top Quick Neighbor Navigation Carousel / Jump Tray */}
      {showNeighborDrawer && listings.length > 0 && (
        <div className="absolute top-16 left-3.5 right-3.5 z-[950] pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2 shadow-xl flex items-center space-x-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider px-2 whitespace-nowrap flex items-center space-x-1">
              <span>📍 Neighbors:</span>
            </span>
            {listings.map((l) => {
              const meta = getCategoryMeta(l.category);
              const isSelected = selectedListing?.id === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => {
                    onSelectListing(l);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([l.location.lat, l.location.lng], 15, {
                        animate: true,
                        duration: 0.8,
                      });
                    }
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all border cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-md scale-105"
                      : "bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span className="font-semibold">{l.providerName.split(" ")[0]}</span>
                  <span className="opacity-75 text-[10px]">({formatDistance(l.distanceKm)})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Real Map Attribution Badge */}
      <div className="absolute bottom-1 left-2 z-[900] text-[9px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded backdrop-blur pointer-events-none">
        OpenStreetMap • CARTO • Esri (100% Free Live Map)
      </div>

      {/* Selected Neighbor Detail Popup on Map: Where & What Details */}
      {selectedListing && (() => {
        const localized = translateListing(selectedListing);
        return (
        <div className="absolute bottom-4 left-4 right-16 md:left-6 md:right-auto md:w-[420px] z-[1000] bg-slate-900/98 backdrop-blur-md border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl text-amber-50 animate-slideUp">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <img
                src={selectedListing.providerAvatar || selectedListing.imageUrl}
                alt={selectedListing.providerName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                    {getCategoryMeta(selectedListing.category).icon}{" "}
                    {getCategoryMeta(selectedListing.category).label}
                  </span>
                  {selectedListing.digitalApprenticeEligible && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center space-x-0.5">
                      <GraduationCap className="w-3 h-3" />
                      <span>Mentor</span>
                    </span>
                  )}
                </div>

                {/* WHAT THEY DO */}
                <h4 className="text-base font-bold text-amber-100 font-serif leading-tight mt-1">
                  {localized.title || selectedListing.titleEnglish || selectedListing.title}
                </h4>

                {/* WHO & WHERE */}
                <div className="text-xs text-amber-300 font-medium mt-1 flex items-center space-x-1">
                  <span className="font-bold">{selectedListing.providerName}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{formatDistance(selectedListing.distanceKm)} {t("card_distance_away", "away")}</span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center space-x-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{selectedListing.location.address || selectedListing.location.neighborhood}, {selectedListing.location.city}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onSelectListing(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mt-2.5 line-clamp-2 leading-relaxed bg-slate-950/40 p-2 rounded-xl border border-slate-800">
            {localized.description || selectedListing.descriptionEnglish || selectedListing.description}
          </p>

          {/* Barter Exchange info if applicable */}
          {selectedListing.isBarter && (localized.barterDetails || selectedListing.barterDetails) && (
            <div className="mt-2 text-xs bg-amber-500/10 border border-amber-400/30 text-amber-200 p-2 rounded-xl flex items-start space-x-2">
              <Repeat className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">{t("card_trade_for", "Neighbor Swap Wish:")} </span>
                <span>{localized.barterDetails || selectedListing.barterDetails}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center space-x-2">
              <AudioPlayerButton
                voiceNote={selectedListing.voiceNote}
                fallbackText={selectedListing.description}
                language={selectedListing.providerLanguage}
                size="sm"
                label={t("card_artisan_voice", "Artisan Voice")}
              />
              {selectedListing.price > 0 ? (
                <span className="text-xs font-bold text-amber-300 font-mono bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                  ₹{selectedListing.price.toLocaleString("en-IN")}
                </span>
              ) : (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1">
                  <Repeat className="w-3 h-3" />
                  <span>{t("card_pure_barter", "Neighbor Barter")}</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Free Google Maps Walking Directions */}
              <a
                href={getGoogleMapsDirectionsUrl(selectedListing)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Google Maps Walking Navigation"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-blue-200 border border-slate-700 font-semibold text-xs transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-400" />
                <span>{t("card_directions", "Directions")}</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>

              {/* Connect & Message Button */}
              <button
                onClick={() => onContactProvider(selectedListing, false)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t("nav_messages", "Connect")}</span>
              </button>

              {/* Voice Input Button */}
              <button
                type="button"
                onClick={() => onContactProvider(selectedListing, true)}
                className="flex items-center space-x-1 px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-bold text-xs transition-colors cursor-pointer"
                title="Send Voice Message to Artisan"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("card_voice_input", "Voice")}</span>
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
