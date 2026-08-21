/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  MarketplaceEvent,
  User,
  RegisteredShopParticipant,
  Listing,
} from "../types";
import {
  updateStallAssignment,
  removeShopFromEvent,
  registerShopForEvent,
} from "../services/storageService";
import { calculateDistanceKm } from "../services/locationService";
import { MarketplaceOrganizerMap } from "./MarketplaceOrganizerMap";
import {
  Store,
  MapPin,
  Calendar,
  Clock,
  Users,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Compass,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Share2,
  Sparkles,
  ExternalLink,
  Plus,
  X,
  Languages,
} from "lucide-react";

interface MarketplaceOrganizerPanelProps {
  events: MarketplaceEvent[];
  currentUser: User | null;
  activeEvent: MarketplaceEvent;
  onSelectEvent: (event: MarketplaceEvent) => void;
  onContactArtisan?: (participant: RegisteredShopParticipant, eventTitle: string) => void;
  onOpenAuth: () => void;
  allListings?: Listing[];
  onEventUpdated?: (updatedEvent: MarketplaceEvent) => void;
}

export const MarketplaceOrganizerPanel: React.FC<MarketplaceOrganizerPanelProps> = ({
  events,
  currentUser,
  activeEvent,
  onSelectEvent,
  onContactArtisan,
  onOpenAuth,
  allListings = [],
  onEventUpdated,
}) => {
  const [organizerTab, setOrganizerTab] = useState<"roster" | "map" | "sheet">("roster");
  const [selectedParticipant, setSelectedParticipant] =
    useState<RegisteredShopParticipant | null>(
      activeEvent.registeredShops[0] || null
    );

  // Stall editing state
  const [editingArtisanId, setEditingArtisanId] = useState<string | null>(null);
  const [editStallNumber, setEditStallNumber] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"confirmed" | "pending" | "attended">("confirmed");
  const [editRequirement, setEditRequirement] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Quick invite / manual stall add state
  const [isAddingVendor, setIsAddingVendor] = useState<boolean>(false);
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorShop, setVendorShop] = useState<string>("");
  const [vendorPhone, setVendorPhone] = useState<string>("");
  const [vendorCategory, setVendorCategory] = useState<string>("handmade_goods");
  const [vendorStall, setVendorStall] = useState<string>("");
  const [vendorReq, setVendorReq] = useState<string>("");

  // Keep selected participant synced if active event changes
  React.useEffect(() => {
    if (activeEvent.registeredShops.length > 0) {
      if (
        !selectedParticipant ||
        !activeEvent.registeredShops.some(
          (p) => p.artisanId === selectedParticipant.artisanId
        )
      ) {
        setSelectedParticipant(activeEvent.registeredShops[0]);
      }
    } else {
      setSelectedParticipant(null);
    }
  }, [activeEvent]);

  // Handle start editing stall
  const handleStartEdit = (p: RegisteredShopParticipant, idx: number) => {
    setEditingArtisanId(p.artisanId);
    setEditStallNumber(p.stallNumber || `Stall #${idx + 1}`);
    setEditStatus(p.status || "confirmed");
    setEditRequirement(p.stallRequirement || "");
  };

  // Handle save stall edit
  const handleSaveStallAssignment = async (artisanId: string) => {
    setIsUpdating(true);
    const updated = await updateStallAssignment(activeEvent.id, artisanId, {
      stallNumber: editStallNumber.trim(),
      status: editStatus,
      stallRequirement: editRequirement.trim(),
    });
    if (updated) {
      onSelectEvent(updated);
      if (onEventUpdated) onEventUpdated(updated);
      setStatusMessage("✅ Stall assignment updated successfully!");
      setTimeout(() => setStatusMessage(""), 3500);
      setEditingArtisanId(null);
    }
    setIsUpdating(false);
  };

  // Handle remove participant
  const handleRemoveParticipant = async (p: RegisteredShopParticipant) => {
    if (
      !window.confirm(
        `Release stall registration for ${p.artisanName} (${p.shopTitle})?`
      )
    ) {
      return;
    }
    setIsUpdating(true);
    const updated = await removeShopFromEvent(activeEvent.id, p.artisanId);
    if (updated) {
      onSelectEvent(updated);
      if (onEventUpdated) onEventUpdated(updated);
      setStatusMessage(`Stall for ${p.artisanName} released.`);
      setTimeout(() => setStatusMessage(""), 3500);
    }
    setIsUpdating(false);
  };

  // Handle manual vendor addition / stall assignment
  const handleAddVendorManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !vendorShop.trim()) return;

    const newParticipant: RegisteredShopParticipant = {
      artisanId: "vendor_" + Date.now(),
      artisanName: vendorName.trim(),
      artisanRole: "provider",
      artisanPhone: vendorPhone.trim() || "+1 (555) 000-1234",
      artisanAvatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
      artisanLocation: {
        lat: activeEvent.location.lat + (Math.random() - 0.5) * 0.015,
        lng: activeEvent.location.lng + (Math.random() - 0.5) * 0.015,
        address: "Artisan Workshop, Local District",
        neighborhood: "Artisan Quarter",
        city: "Metro West",
      },
      shopTitle: vendorShop.trim(),
      category: vendorCategory,
      stallNumber:
        vendorStall.trim() || `Stall #${activeEvent.registeredShops.length + 1}`,
      stallRequirement: vendorReq.trim() || "1 display table & shaded space",
      status: "confirmed",
      preferredLanguage: "English",
      registeredAt: new Date().toISOString(),
    };

    const updated = await registerShopForEvent(activeEvent.id, newParticipant);
    if (updated) {
      onSelectEvent(updated);
      if (onEventUpdated) onEventUpdated(updated);
      setIsAddingVendor(false);
      setVendorName("");
      setVendorShop("");
      setVendorPhone("");
      setVendorStall("");
      setVendorReq("");
      setStatusMessage(`🎉 ${newParticipant.artisanName} added to the event!`);
      setTimeout(() => setStatusMessage(""), 3500);
    }
  };

  // Calculate stats
  const totalStalls = activeEvent.stallsCapacity || 12;
  const bookedStalls = activeEvent.registeredShops.length;
  const vacantStalls = Math.max(0, totalStalls - bookedStalls);
  const occupancyPct = Math.min(100, Math.round((bookedStalls / totalStalls) * 100));

  // Calculate average distance of registered artisans to venue
  const distances = activeEvent.registeredShops.map((p) =>
    calculateDistanceKm(p.artisanLocation || activeEvent.location, activeEvent.location)
  );
  const avgDistance =
    distances.length > 0
      ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-4">
      {/* Top Event Selector Bar for Organizers */}
      <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
            👑
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span>Organizer & Market Host Dashboard</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px]">
                {events.length} Events
              </span>
            </div>
            <div className="text-sm font-bold text-white truncate font-serif">
              {activeEvent.title}
            </div>
          </div>
        </div>

        {/* Event Switcher Dropdown */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="text-[11px] font-medium text-slate-400 whitespace-nowrap hidden md:inline">
            Select Marketplace:
          </label>
          <select
            value={activeEvent.id}
            onChange={(e) => {
              const match = events.find((ev) => ev.id === e.target.value);
              if (match) onSelectEvent(match);
            }}
            className="w-full sm:w-64 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-500"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.registeredShops.length}/{ev.stallsCapacity} Stalls)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status alert message */}
      {statusMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500/40 px-4 py-2 rounded-xl text-emerald-200 text-xs flex items-center space-x-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{statusMessage}</span>
        </div>
      )}

      {/* Event Overview Hero Card */}
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/20 bg-slate-900/90 p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide">
                🎪 MARKETPLACE VENUE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-200 text-[10px]">
                Hosted by {activeEvent.organizerName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px]">
                📍 {activeEvent.locationName}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white font-serif">
              {activeEvent.title}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <div className="flex items-center space-x-1 text-amber-300">
                <Calendar className="w-3.5 h-3.5" />
                <span>{activeEvent.date}</span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeEvent.time}</span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>{activeEvent.location.address}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Stalls Booked
              </div>
              <div className="text-base font-bold text-amber-400 mt-0.5">
                {bookedStalls} / {totalStalls}
              </div>
              <div className="text-[9px] text-slate-400">{vacantStalls} vacant</div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Avg Vendor Distance
              </div>
              <div className="text-base font-bold text-blue-400 mt-0.5">
                {avgDistance} km
              </div>
              <div className="text-[9px] text-slate-400">from venue</div>
            </div>
          </div>
        </div>

        {/* Occupancy Progress Bar */}
        <div className="mt-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Stall Allocation Progress</span>
            <span className="text-amber-400 font-bold">
              {occupancyPct}% Booked ({vacantStalls} Remaining)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full transition-all"
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sub-view Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setOrganizerTab("roster")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              organizerTab === "roster"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Registered Artisans Roster ({bookedStalls})</span>
          </button>

          <button
            onClick={() => setOrganizerTab("map")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              organizerTab === "map"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>🗺️ Artisan Locations & Travel Map</span>
          </button>

          <button
            onClick={() => setOrganizerTab("sheet")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              organizerTab === "sheet"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Event Check-in Sheet</span>
          </button>
        </div>

        <button
          onClick={() => setIsAddingVendor(!isAddingVendor)}
          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center space-x-1 cursor-pointer transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Vendor Stall</span>
        </button>
      </div>

      {/* Manual Add Vendor Modal / Form Dropdown */}
      {isAddingVendor && (
        <form
          onSubmit={handleAddVendorManual}
          className="p-4 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-amber-200">
              Assign / Register New Vendor Stall Manually
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingVendor(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Artisan Name *
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Master Meenakshi Sundaram"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Shop / Craft Title *
              </label>
              <input
                type="text"
                value={vendorShop}
                onChange={(e) => setVendorShop(e.target.value)}
                placeholder="e.g. Brass Lamp Engraving & Idol Polishing"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Phone Contact Number
              </label>
              <input
                type="text"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="e.g. +1 (555) 234-5678"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Assigned Stall Name / Number
              </label>
              <input
                type="text"
                value={vendorStall}
                onChange={(e) => setVendorStall(e.target.value)}
                placeholder="e.g. Stall #4 (Brassworks Gazebo)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Stall Requirements
              </label>
              <input
                type="text"
                value={vendorReq}
                onChange={(e) => setVendorReq(e.target.value)}
                placeholder="e.g. Heavy table for brass anvil + 1 light plug"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingVendor(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow"
            >
              Add Artisan to Roster
            </button>
          </div>
        </form>
      )}

      {/* View 1: Registered Artisans Roster & Stall Assignment */}
      {organizerTab === "roster" && (
        <div className="space-y-3">
          {activeEvent.registeredShops.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
              <Store className="w-10 h-10 text-amber-400/50 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Artisans Registered Yet</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Local artisans and candidates will register their shops for this meetup. You can also manually add stalls above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {activeEvent.registeredShops.map((participant, idx) => {
                const isEditing = editingArtisanId === participant.artisanId;
                const distKm = calculateDistanceKm(
                  participant.artisanLocation || activeEvent.location,
                  activeEvent.location
                );

                return (
                  <div
                    key={participant.artisanId}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/20 hover:border-amber-500/40 transition-all shadow-md space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      {/* Artisan Identity */}
                      <div className="flex items-start space-x-3 min-w-0">
                        <img
                          src={
                            participant.artisanAvatar ||
                            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80"
                          }
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border-2 border-amber-500/40 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-sm text-white">
                              {participant.artisanName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                              {participant.stallNumber || `Stall #${idx + 1}`}
                            </span>
                            {participant.status && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  participant.status === "confirmed"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : participant.status === "attended"
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {participant.status.toUpperCase()}
                              </span>
                            )}
                            {participant.preferredLanguage && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] flex items-center space-x-1">
                                <Languages className="w-3 h-3 text-amber-400" />
                                <span>{participant.preferredLanguage}</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-bold text-amber-200 mt-0.5">
                            {participant.shopTitle}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                            <div className="flex items-center space-x-1 text-blue-300">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {participant.artisanLocation?.neighborhood ||
                                  participant.artisanLocation?.address ||
                                  "Local District"}{" "}
                                ({distKm} km away)
                              </span>
                            </div>
                            {participant.artisanPhone && (
                              <>
                                <span>•</span>
                                <a
                                  href={`tel:${participant.artisanPhone}`}
                                  className="flex items-center space-x-1 text-emerald-400 hover:underline"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{participant.artisanPhone}</span>
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setSelectedParticipant(participant);
                            setOrganizerTab("map");
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-all"
                          title="View on Map"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>View on Map</span>
                        </button>

                        {onContactArtisan && (
                          <button
                            onClick={() =>
                              onContactArtisan(participant, activeEvent.title)
                            }
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Message Artisan</span>
                          </button>
                        )}

                        <button
                          onClick={() =>
                            isEditing
                              ? setEditingArtisanId(null)
                              : handleStartEdit(participant, idx)
                          }
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs cursor-pointer"
                          title="Edit Stall Assignment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleRemoveParticipant(participant)}
                          className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800/40 text-xs cursor-pointer"
                          title="Release Stall"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stall Requirement Box */}
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-400">
                          Stall Setup Notes:
                        </span>{" "}
                        <span className="text-slate-200">
                          {participant.stallRequirement || "Standard table and shaded space"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 whitespace-nowrap">
                        Registered: {new Date(participant.registeredAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Inline Stall Assignment Editor */}
                    {isEditing && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-in fade-in">
                        <div className="text-xs font-bold text-amber-200">
                          Edit Stall & Attendance Details for {participant.artisanName}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                              Stall Number / Bay Name
                            </label>
                            <input
                              type="text"
                              value={editStallNumber}
                              onChange={(e) => setEditStallNumber(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                              Attendance Status
                            </label>
                            <select
                              value={editStatus}
                              onChange={(e) =>
                                setEditStatus(
                                  e.target.value as "confirmed" | "pending" | "attended"
                                )
                              }
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs"
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="pending">Pending Review</option>
                              <option value="attended">Attended / Checked-in</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                              Stall Notes / Power / Table
                            </label>
                            <input
                              type="text"
                              value={editRequirement}
                              onChange={(e) => setEditRequirement(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingArtisanId(null)}
                            className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleSaveStallAssignment(participant.artisanId)
                            }
                            className="px-4 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                          >
                            Save Stall
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View 2: Live Artisan Locations & Travel Map */}
      {organizerTab === "map" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Map Canvas */}
            <div className="lg:col-span-8">
              <MarketplaceOrganizerMap
                event={activeEvent}
                selectedParticipant={selectedParticipant}
                onSelectParticipant={(p) => setSelectedParticipant(p)}
                onContactArtisan={(p) => {
                  if (onContactArtisan) {
                    onContactArtisan(p, activeEvent.title);
                  }
                }}
              />
            </div>

            {/* Sidebar: Artisan Travel Distances & Quick Jump */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="text-xs font-bold text-amber-200 flex items-center space-x-1.5">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>Artisans by Distance</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {activeEvent.registeredShops.length} Pins
                </span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1">
                {activeEvent.registeredShops.map((participant, idx) => {
                  const isSelected =
                    selectedParticipant?.artisanId === participant.artisanId;
                  const distKm = calculateDistanceKm(
                    participant.artisanLocation || activeEvent.location,
                    activeEvent.location
                  );

                  return (
                    <div
                      key={participant.artisanId}
                      onClick={() => setSelectedParticipant(participant)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/50"
                          : "bg-slate-800/60 border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={
                            participant.artisanAvatar ||
                            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80"
                          }
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-amber-400/40 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {participant.artisanName}
                          </div>
                          <div className="text-[10px] text-amber-300 truncate">
                            {participant.shopTitle}
                          </div>
                          <div className="text-[10px] text-blue-300 font-semibold mt-0.5">
                            📍 {distKm} km • {participant.stallNumber || `Stall #${idx + 1}`}
                          </div>
                        </div>
                      </div>

                      {isSelected && onContactArtisan && (
                        <div className="mt-2 pt-2 border-t border-amber-500/20 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onContactArtisan(participant, activeEvent.title);
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Message</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 3: Printable Check-in Sheet */}
      {organizerTab === "sheet" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-white font-serif">
                Day-of Event Check-in & Gate Roster
              </h4>
              <p className="text-xs text-slate-400">
                Print or export this roster for gate volunteers to check in arriving artisans
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Check-in Sheet</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-amber-300 uppercase text-[10px] tracking-wider bg-slate-950/60">
                  <th className="py-2.5 px-3">Check-in</th>
                  <th className="py-2.5 px-3">Stall #</th>
                  <th className="py-2.5 px-3">Artisan Name</th>
                  <th className="py-2.5 px-3">Shop / Craft Title</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Origin</th>
                  <th className="py-2.5 px-3">Stall Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {activeEvent.registeredShops.map((participant, idx) => (
                  <tr key={participant.artisanId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        defaultChecked={participant.status === "attended"}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-amber-300">
                      {participant.stallNumber || `Stall #${idx + 1}`}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {participant.artisanName}
                    </td>
                    <td className="py-2.5 px-3">{participant.shopTitle}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {participant.artisanPhone || "N/A"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {participant.artisanLocation?.neighborhood || "Metro West"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {participant.stallRequirement || "Standard table"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
