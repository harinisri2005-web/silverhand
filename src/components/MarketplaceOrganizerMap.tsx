/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MarketplaceEvent, RegisteredShopParticipant } from "../types";
import { calculateDistanceKm } from "../services/locationService";
import {
  MapPin,
  Compass,
  Navigation,
  ExternalLink,
  MessageCircle,
  Phone,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Store,
} from "lucide-react";

interface MarketplaceOrganizerMapProps {
  event: MarketplaceEvent;
  selectedParticipant?: RegisteredShopParticipant | null;
  onSelectParticipant?: (participant: RegisteredShopParticipant) => void;
  onContactArtisan?: (participant: RegisteredShopParticipant) => void;
}

export const MarketplaceOrganizerMap: React.FC<MarketplaceOrganizerMapProps> = ({
  event,
  selectedParticipant,
  onSelectParticipant,
  onContactArtisan,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const linesGroupRef = useRef<L.LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<"voyager" | "osm" | "satellite">("voyager");
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const tileUrls = {
    voyager: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
    osm: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
    },
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const centerLat = event.location?.lat || 13.0827;
    const centerLng = event.location?.lng || 80.2707;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    const tileConfig = tileUrls[activeLayer];
    const tiles = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tiles;
    mapInstanceRef.current = map;

    linesGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);

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

  // Update tile layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileConfig = tileUrls[activeLayer];
    tileLayerRef.current.setUrl(tileConfig.url);
  }, [activeLayer]);

  // Update Markers, Route Lines, and Venue Anchor
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    const linesGroup = linesGroupRef.current;
    if (!map || !markersGroup || !linesGroup) return;

    markersGroup.clearLayers();
    linesGroup.clearLayers();

    const venueLat = event.location.lat;
    const venueLng = event.location.lng;

    const bounds = L.latLngBounds([[venueLat, venueLng]]);

    // 1. Render Central Venue Gold Anchor Marker
    const venueHtml = `
      <div class="relative cursor-pointer -translate-x-1/2 -translate-y-full z-50 animate-bounce">
        <div class="flex flex-col items-center">
          <div class="relative px-3 py-1.5 rounded-2xl shadow-[0_8px_30px_rgba(245,158,11,0.6)] flex items-center space-x-2 border-2 border-amber-300 text-slate-950 font-black bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400">
            <span class="text-lg leading-none">🎪</span>
            <div class="flex flex-col text-left leading-none">
              <span class="text-[12px] font-black text-slate-950 truncate max-w-[130px]">
                ${event.locationName}
              </span>
              <span class="text-[9px] font-bold text-amber-950 mt-0.5">
                VENUE • ${event.registeredShops.length} Registered
              </span>
            </div>
          </div>
          <div class="w-3.5 h-3.5 rotate-45 -mt-2 border-r-2 border-b-2 border-amber-300 bg-amber-300"></div>
        </div>
      </div>
    `;

    const venueIcon = L.divIcon({
      className: "venue-anchor-pin",
      html: venueHtml,
      iconSize: [0, 0],
    });

    const venueMarker = L.marker([venueLat, venueLng], {
      icon: venueIcon,
      zIndexOffset: 1000,
    });

    venueMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px 6px; min-width: 180px;">
        <div style="font-weight: 800; color: #b45309; font-size: 13px; display: flex; align-items: center; gap: 4px;">
          <span>🎪 ${event.title}</span>
        </div>
        <div style="font-size: 11px; color: #1e293b; font-weight: 600; margin-top: 4px;">
          📍 ${event.locationName}
        </div>
        <div style="font-size: 10px; color: #64748b;">
          ${event.location.address}
        </div>
        <div style="margin-top: 6px; font-size: 11px; font-weight: 700; color: #059669;">
          Capacity: ${event.registeredShops.length} of ${event.stallsCapacity} stalls booked
        </div>
      </div>
    `);

    markersGroup.addLayer(venueMarker);

    // 2. Render each Registered Artisan Pin & Route Line
    event.registeredShops.forEach((participant, idx) => {
      // Get artisan coordinate or deterministic fallback relative to venue
      const artLat =
        participant.artisanLocation?.lat ??
        venueLat + 0.005 * Math.sin(idx * 1.8 + 0.5);
      const artLng =
        participant.artisanLocation?.lng ??
        venueLng + 0.007 * Math.cos(idx * 1.8 + 0.5);

      bounds.extend([artLat, artLng]);

      const isSelected = selectedParticipant?.artisanId === participant.artisanId;
      const distKm = calculateDistanceKm(
        { lat: artLat, lng: artLng, address: "" },
        event.location
      );

      // Route Line from Artisan to Venue
      const routeLine = L.polyline(
        [
          [artLat, artLng],
          [venueLat, venueLng],
        ],
        {
          color: isSelected ? "#F59E0B" : "#3B82F6",
          weight: isSelected ? 4 : 2,
          opacity: isSelected ? 0.95 : 0.6,
          dashArray: isSelected ? "8, 6" : "6, 6",
        }
      );

      routeLine.bindTooltip(
        `🛣️ ${participant.artisanName}: ${distKm} km to Venue`,
        { sticky: true }
      );

      linesGroup.addLayer(routeLine);

      // Artisan Pin HTML
      const artisanHtml = `
        <div class="relative cursor-pointer transition-transform duration-200 hover:scale-110 -translate-x-1/2 -translate-y-full ${
          isSelected ? "scale-110 z-50" : "z-30"
        }">
          ${
            isSelected
              ? `<div class="absolute -inset-3 bg-amber-400/50 rounded-full animate-ping"></div>`
              : ""
          }
          <div class="flex flex-col items-center">
            <div class="relative px-2.5 py-1.5 rounded-2xl shadow-xl flex items-center space-x-1.5 border-2 text-slate-950 font-bold bg-white"
                 style="border-color: ${isSelected ? "#F59E0B" : "#3B82F6"};">
              <img src="${
                participant.artisanAvatar ||
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80"
              }" 
                   class="w-6 h-6 rounded-full object-cover border border-slate-300 shrink-0" 
                   referrerpolicy="no-referrer" />
              <div class="flex flex-col text-left leading-tight">
                <span class="text-[11px] font-bold text-slate-900 truncate max-w-[110px]">
                  ${participant.artisanName.split(" ")[0]}
                </span>
                <span class="text-[9px] font-semibold text-blue-700 truncate max-w-[110px]">
                  ${distKm}km • ${participant.stallNumber || `Stall #${idx + 1}`}
                </span>
              </div>
            </div>
            <div class="w-3 h-3 rotate-45 -mt-1.5 border-r-2 border-b-2 bg-white"
                 style="border-color: ${isSelected ? "#F59E0B" : "#3B82F6"};">
            </div>
          </div>
        </div>
      `;

      const artisanIcon = L.divIcon({
        className: `artisan-origin-pin-${participant.artisanId}`,
        html: artisanHtml,
        iconSize: [0, 0],
      });

      const artisanMarker = L.marker([artLat, artLng], {
        icon: artisanIcon,
        zIndexOffset: isSelected ? 800 : 400,
      });

      artisanMarker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px 6px; min-width: 200px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 13px;">
            ${participant.artisanName}
          </div>
          <div style="font-size: 11px; color: #d97706; font-weight: 700; margin-top: 2px;">
            🏪 ${participant.shopTitle}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            📍 Origin: ${
              participant.artisanLocation?.neighborhood ||
              participant.artisanLocation?.address ||
              "Local Neighborhood"
            }
          </div>
          <div style="font-size: 11px; color: #2563eb; font-weight: 700; margin-top: 4px;">
            🚗 Travel Distance: ${distKm} km to ${event.locationName}
          </div>
          <div style="font-size: 10px; color: #475569; margin-top: 4px; background: #f1f5f9; padding: 4px; rounded: 4px;">
            🎪 Assigned: <strong>${participant.stallNumber || `Stall #${idx + 1}`}</strong><br/>
            📝 Requirement: ${participant.stallRequirement || "Standard table"}
          </div>
        </div>
      `);

      artisanMarker.on("click", () => {
        if (onSelectParticipant) {
          onSelectParticipant(participant);
        }
        map.panTo([artLat, artLng], { animate: true, duration: 0.5 });
      });

      markersGroup.addLayer(artisanMarker);
    });

    // Fit map bounds if there are participants
    if (event.registeredShops.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
    }
  }, [event, selectedParticipant, onSelectParticipant]);

  // Pan to selected participant if changed externally
  useEffect(() => {
    if (!selectedParticipant || !mapInstanceRef.current) return;
    const artLat = selectedParticipant.artisanLocation?.lat;
    const artLng = selectedParticipant.artisanLocation?.lng;
    if (artLat && artLng) {
      mapInstanceRef.current.flyTo([artLat, artLng], 15, {
        animate: true,
        duration: 0.7,
      });
    }
  }, [selectedParticipant]);

  // Fit all participants + venue
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds([[event.location.lat, event.location.lng]]);
    event.registeredShops.forEach((p, idx) => {
      const lat =
        p.artisanLocation?.lat ?? event.location.lat + 0.005 * Math.sin(idx * 1.8 + 0.5);
      const lng =
        p.artisanLocation?.lng ?? event.location.lng + 0.007 * Math.cos(idx * 1.8 + 0.5);
      bounds.extend([lat, lng]);
    });
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
  };

  return (
    <div className="relative w-full h-[360px] sm:h-[420px] bg-slate-950 rounded-2xl overflow-hidden border border-amber-500/30 shadow-xl flex flex-col">
      {/* Top Map Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg pointer-events-auto flex items-center space-x-2 text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold text-amber-200">
            {event.registeredShops.length} Artisan Origins Pinned
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            • Connecting to {event.locationName}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 pointer-events-auto">
          {/* Layer switcher */}
          <div className="bg-slate-900/95 border border-slate-700/80 p-1 rounded-xl shadow-lg flex items-center space-x-1">
            {(["voyager", "osm", "satellite"] as const).map((layer) => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  activeLayer === layer
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {layer === "voyager" ? "Artisan" : layer === "osm" ? "Street" : "Satellite"}
              </button>
            ))}
          </div>

          <button
            onClick={handleFitAll}
            title="Fit All Vendors & Venue"
            className="p-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-amber-300 hover:text-white shadow-lg cursor-pointer transition-all hover:bg-slate-800"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leaflet DOM container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col space-y-1.5">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-slate-900/95 border border-slate-700 text-amber-200 hover:text-white flex items-center justify-center shadow-lg cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-slate-900/95 border border-slate-700 text-amber-200 hover:text-white flex items-center justify-center shadow-lg cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Artisan Floating Quick Card Overlay */}
      {selectedParticipant && (
        <div className="absolute bottom-3 left-3 right-14 z-[1000] bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-2.5 shadow-2xl flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center space-x-2 min-w-0">
            <img
              src={
                selectedParticipant.artisanAvatar ||
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80"
              }
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-amber-400 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {selectedParticipant.artisanName}
              </div>
              <div className="text-[10px] text-amber-300 truncate">
                {selectedParticipant.shopTitle} •{" "}
                <span className="text-blue-300">
                  {calculateDistanceKm(
                    selectedParticipant.artisanLocation || event.location,
                    event.location
                  )}{" "}
                  km from Venue
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {selectedParticipant.artisanPhone && (
              <a
                href={`tel:${selectedParticipant.artisanPhone}`}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs"
                title="Call Artisan"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
            {onContactArtisan && (
              <button
                onClick={() => onContactArtisan(selectedParticipant)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center space-x-1 cursor-pointer transition-all shadow-md"
              >
                <MessageCircle className="w-3 h-3" />
                <span>Message</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
