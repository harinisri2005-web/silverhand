/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MarketplaceEvent, User, Listing, RegisteredShopParticipant } from "../types";
import { saveEvent, registerShopForEvent, removeShopFromEvent } from "../services/storageService";
import { MarketplaceOrganizerPanel } from "./MarketplaceOrganizerPanel";
import {
  Calendar,
  Clock,
  MapPin,
  Store,
  Plus,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Share2,
  Navigation,
  Compass,
  Crown,
  Layers,
} from "lucide-react";

interface MeetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: MarketplaceEvent[];
  currentUser: User | null;
  userListings?: Listing[];
  onOpenAuth: () => void;
  onSelectEventLocationOnMap?: (event: MarketplaceEvent) => void;
  selectedEventId?: string | null;
  onContactArtisan?: (participant: RegisteredShopParticipant, eventTitle: string) => void;
  initialTab?: "explore" | "organizer" | "create";
}

export function MeetupModal({
  isOpen,
  onClose,
  events,
  currentUser,
  userListings = [],
  onOpenAuth,
  onSelectEventLocationOnMap,
  selectedEventId,
  onContactArtisan,
  initialTab = "explore",
}: MeetupModalProps) {
  const [mainViewTab, setMainViewTab] = useState<"explore" | "organizer" | "create">(initialTab);
  const [activeEvent, setActiveEvent] = useState<MarketplaceEvent | null>(() => {
    if (selectedEventId) {
      return events.find((e) => e.id === selectedEventId) || events[0] || null;
    }
    return events[0] || null;
  });

  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [customShopTitle, setCustomShopTitle] = useState<string>("");
  const [stallNotes, setStallNotes] = useState<string>("");
  const [registrationSuccessMsg, setRegistrationSuccessMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Event Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("Saturday, Sep 05, 2026");
  const [newTime, setNewTime] = useState("10:00 AM - 5:00 PM");
  const [newLocationName, setNewLocationName] = useState("Heritage District Market Square");
  const [newAddress, setNewAddress] = useState("18 Bazaar Road, Metro West");
  const [newCapacity, setNewCapacity] = useState(15);
  const [newBanner, setNewBanner] = useState(
    "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1000&q=80"
  );

  // Sync active event when events or selectedEventId changes
  React.useEffect(() => {
    if (selectedEventId) {
      const match = events.find((e) => e.id === selectedEventId);
      if (match) setActiveEvent(match);
    } else if (!activeEvent && events.length > 0) {
      setActiveEvent(events[0]);
    } else if (activeEvent) {
      const updated = events.find((e) => e.id === activeEvent.id);
      if (updated) setActiveEvent(updated);
    }
  }, [selectedEventId, events]);

  if (!isOpen) return null;

  // Calculate total registered vendors across all events
  const totalRegisteredVendors = events.reduce(
    (acc, ev) => acc + ev.registeredShops.length,
    0
  );

  // Check if current user already registered their shop for active event
  const isUserRegisteredForActive =
    currentUser &&
    activeEvent &&
    activeEvent.registeredShops.some((p) => p.artisanId === currentUser.id);

  const userParticipantInfo =
    currentUser && activeEvent
      ? activeEvent.registeredShops.find((p) => p.artisanId === currentUser.id)
      : null;

  // Candidate listings to choose from
  const candidateListings = currentUser
    ? userListings.filter((l) => l.providerId === currentUser.id)
    : [];

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!activeEvent) return;

    setIsSubmitting(true);

    const chosenListing = candidateListings.find((l) => l.id === selectedListingId);
    const shopTitle =
      chosenListing?.titleEnglish ||
      chosenListing?.title ||
      customShopTitle.trim() ||
      `${currentUser.fullName}'s Artisan Stall`;
    const category = chosenListing?.category || "handmade_goods";

    const participant: RegisteredShopParticipant = {
      artisanId: currentUser.id,
      artisanName: currentUser.fullName,
      artisanAvatar: currentUser.avatarUrl,
      artisanRole: currentUser.role,
      artisanPhone: currentUser.phone || "+1 (555) 321-7654",
      artisanLocation: currentUser.location,
      shopId: chosenListing?.id,
      shopTitle,
      category,
      stallNumber: `Stall #${activeEvent.registeredShops.length + 1}`,
      stallRequirement:
        stallNotes.trim() ||
        `Needs 1 display table • Registered by ${currentUser.fullName}`,
      status: "confirmed",
      preferredLanguage: currentUser.preferredLanguage || "English",
      registeredAt: new Date().toISOString(),
    };

    const updatedEvent = await registerShopForEvent(activeEvent.id, participant);
    if (updatedEvent) {
      setActiveEvent(updatedEvent);
      setRegistrationSuccessMsg(`🎉 Your shop "${shopTitle}" has been registered for this event!`);
      setTimeout(() => setRegistrationSuccessMsg(""), 4500);
    }
    setIsSubmitting(false);
  };

  const handleUnregisterShop = async () => {
    if (!currentUser || !activeEvent) return;
    setIsSubmitting(true);
    const updated = await removeShopFromEvent(activeEvent.id, currentUser.id);
    if (updated) {
      setActiveEvent(updated);
      setRegistrationSuccessMsg("Your stall registration was withdrawn.");
      setTimeout(() => setRegistrationSuccessMsg(""), 3000);
    }
    setIsSubmitting(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const organizer: User = currentUser || {
      id: "candidate_" + Date.now(),
      username: "candidate_organizer",
      passcode: "1234",
      fullName: "Community Artisan Organizer",
      role: "provider",
      preferredLanguage: "English",
      location: {
        lat: 13.0827,
        lng: 80.2707,
        address: newAddress,
        neighborhood: "Heritage District",
        city: "Metro West",
      },
      createdAt: new Date().toISOString(),
    };

    const newEvent: MarketplaceEvent = {
      id: "event_" + Date.now(),
      title: newTitle.trim(),
      description: newDescription.trim() || "Community handmade marketplace and craft meetup.",
      bannerUrl: newBanner,
      date: newDate.trim(),
      time: newTime.trim(),
      locationName: newLocationName.trim(),
      location: {
        lat: 13.0830 + (Math.random() - 0.5) * 0.01,
        lng: 80.2710 + (Math.random() - 0.5) * 0.01,
        address: newAddress.trim(),
        neighborhood: "Local District",
        city: "Metro West",
      },
      organizerId: organizer.id,
      organizerName: organizer.fullName,
      organizerAvatar: organizer.avatarUrl,
      stallsCapacity: Number(newCapacity) || 12,
      registeredShops: [],
      attendeesCount: 1,
      tags: ["Marketplace", "Artisans", "Local Meetup", "Community Event"],
      createdAt: new Date().toISOString(),
    };

    await saveEvent(newEvent);
    setActiveEvent(newEvent);
    setMainViewTab("organizer");
    setRegistrationSuccessMsg("✨ Marketplace Event created successfully! You are now in the Organizer Management Panel.");
    setTimeout(() => setRegistrationSuccessMsg(""), 5000);
  };

  return (
    <div
      id="meetup-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="meetup-modal-container"
        className="relative w-full max-w-5xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 px-5 py-3.5 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shadow-inner shrink-0">
              🎪
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-amber-100 font-serif">
                  Community Marketplace Meetups & Flea Bazaars
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-semibold hidden sm:inline">
                  {events.length} Events • {totalRegisteredVendors} Registered Stalls
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Discover artisan pop-ups, check locations & timings, register stalls, or manage your marketplaces
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-close-meetup-modal"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Switcher Bar (Explore vs Organizer Dashboard vs Create) */}
        <div className="bg-slate-950/70 px-5 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMainViewTab("explore")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                mainViewTab === "explore"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>🎪 Explore Bazaars & Register</span>
            </button>

            <button
              onClick={() => setMainViewTab("organizer")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                mainViewTab === "organizer"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>👑 My Marketplaces & Registered Artisans</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-300 text-[10px] font-mono">
                {activeEvent?.registeredShops.length ?? 0}
              </span>
            </button>
          </div>

          <button
            id="btn-create-event-top"
            onClick={() => {
              if (!currentUser) {
                onOpenAuth();
              } else {
                setMainViewTab("create");
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer ${
              mainViewTab === "create"
                ? "bg-amber-500 text-slate-950"
                : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Host New Marketplace Event</span>
          </button>
        </div>

        {/* Success Alert Banner */}
        {registrationSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2.5 flex items-center space-x-2 text-emerald-200 text-xs animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{registrationSuccessMsg}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {mainViewTab === "organizer" && activeEvent ? (
            /* Dedicated Organizer Panel: View All Registered Vendors, Stall Assignments, and Origin Map */
            <MarketplaceOrganizerPanel
              events={events}
              currentUser={currentUser}
              activeEvent={activeEvent}
              onSelectEvent={(ev) => setActiveEvent(ev)}
              onContactArtisan={(p, eventTitle) => {
                if (onContactArtisan) {
                  onContactArtisan(p, eventTitle);
                }
              }}
              onOpenAuth={onOpenAuth}
              allListings={userListings}
              onEventUpdated={(ev) => setActiveEvent(ev)}
            />
          ) : mainViewTab === "create" ? (
            /* Create New Marketplace Event View */
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-amber-200">Host a New Marketplace Meetup</h3>
                  <p className="text-xs text-slate-400">
                    Registered candidates and organizers can invite local artisans to set up shops
                  </p>
                </div>
                <button
                  onClick={() => setMainViewTab("explore")}
                  className="text-xs text-slate-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-amber-200 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Artisan Weekend Craft Bazaar & Sari Mending Hub"
                    required
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Event Date *
                    </label>
                    <input
                      type="text"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      placeholder="e.g. Saturday, Aug 29, 2026"
                      required
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Event Timing *
                    </label>
                    <input
                      type="text"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      placeholder="e.g. 10:00 AM - 6:00 PM"
                      required
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Venue / Location Name *
                    </label>
                    <input
                      type="text"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="e.g. Heritage Town Hall Lawn"
                      required
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Address / Street *
                    </label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="e.g. 14 Palm Grove Ave, Metro West"
                      required
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Total Artisan Stalls Available
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(Number(e.target.value))}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Banner Image URL
                    </label>
                    <input
                      type="url"
                      value={newBanner}
                      onChange={(e) => setNewBanner(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-200 mb-1">
                    Event Description & Notes
                  </label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe the meetup theme, craft types invited, available tables/power, refreshments..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setMainViewTab("explore")}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg cursor-pointer"
                  >
                    Publish Marketplace Meetup
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Explore View: Split Event List (Left) + Selected Event & Shop Registration (Right) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Events Navigation Pills */}
              <div className="lg:col-span-4 space-y-3">
                <div className="text-xs font-semibold text-amber-300/90 tracking-wide uppercase px-1">
                  Active Bazaars & Pop-Ups
                </div>

                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {events.map((ev) => {
                    const isSelected = activeEvent?.id === ev.id;
                    const isRegistered =
                      currentUser && ev.registeredShops.some((p) => p.artisanId === currentUser.id);

                    return (
                      <div
                        key={ev.id}
                        onClick={() => setActiveEvent(ev)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-amber-950/40 border-amber-500/60 shadow-[0_4px_16px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/40"
                            : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600"
                        }`}
                      >
                        {isRegistered && (
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                            ✓ Shop In
                          </span>
                        )}

                        <div className="flex items-start space-x-2.5">
                          <img
                            src={ev.bannerUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-xs text-white truncate group-hover:text-amber-200">
                              {ev.title}
                            </h4>
                            <div className="flex items-center text-[11px] text-amber-300/80 mt-1">
                              <Calendar className="w-3 h-3 mr-1 shrink-0" />
                              <span className="truncate">{ev.date}</span>
                            </div>
                            <div className="flex items-center text-[11px] text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3 mr-1 shrink-0 text-slate-500" />
                              <span className="truncate">{ev.locationName}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                🎪 <strong className="text-slate-200">{ev.registeredShops.length}</strong> / {ev.stallsCapacity} Stalls
                              </span>
                              <span className="text-amber-400 font-medium flex items-center">
                                Details <ChevronRight className="w-3 h-3 ml-0.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Event Detail Message & Shop Registration Action */}
              {activeEvent && (
                <div className="lg:col-span-8 bg-slate-950/60 border border-amber-500/20 rounded-xl p-4 sm:p-5 flex flex-col space-y-4">
                  {/* Event Banner & Header Card */}
                  <div className="relative rounded-xl overflow-hidden border border-slate-800">
                    <img
                      src={activeEvent.bannerUrl}
                      alt={activeEvent.title}
                      className="w-full h-36 sm:h-44 object-cover brightness-[0.75]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide">
                            MARKETPLACE EVENT
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-amber-200 text-[10px]">
                            Organized by {activeEvent.organizerName}
                          </span>
                        </div>

                        {/* Quick link to Organizer Panel */}
                        <button
                          onClick={() => setMainViewTab("organizer")}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1 shadow-md cursor-pointer transition-all"
                        >
                          <Crown className="w-3 h-3 text-slate-950" />
                          <span>Organizer Panel & Map</span>
                        </button>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white font-serif leading-snug">
                        {activeEvent.title}
                      </h3>
                    </div>
                  </div>

                  {/* Date, Timing & Location Details Message Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/20 flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Date & Timing
                        </div>
                        <div className="text-xs font-bold text-amber-100 mt-0.5">
                          {activeEvent.date}
                        </div>
                        <div className="text-xs text-amber-300/90 font-medium">
                          {activeEvent.time}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/20 flex items-start justify-between space-x-2">
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Event Location
                          </div>
                          <div className="text-xs font-bold text-blue-100 truncate mt-0.5">
                            {activeEvent.locationName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {activeEvent.location.address}
                          </div>
                        </div>
                      </div>

                      {onSelectEventLocationOnMap && (
                        <button
                          onClick={() => {
                            onSelectEventLocationOnMap(activeEvent);
                            onClose();
                          }}
                          className="shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-700 text-[10px] font-semibold flex items-center space-x-1 cursor-pointer transition-all"
                          title="View on Radar Map"
                        >
                          <Compass className="w-3.5 h-3.5 text-amber-400" />
                          <span>Map</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    {activeEvent.description}
                  </p>

                  {/* Registered Stalls Progress Bar */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-200 flex items-center">
                        <Store className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                        Artisan Shops & Stalls Capacity
                      </span>
                      <span className="text-slate-300">
                        <strong className="text-amber-400 font-bold">
                          {activeEvent.registeredShops.length}
                        </strong>{" "}
                        of {activeEvent.stallsCapacity} occupied
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (activeEvent.registeredShops.length / activeEvent.stallsCapacity) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    {/* Participant Avatars & Shops */}
                    {activeEvent.registeredShops.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-medium text-slate-400">
                            Registered Artisan Shops ({activeEvent.registeredShops.length}):
                          </div>
                          <button
                            onClick={() => setMainViewTab("organizer")}
                            className="text-[10px] text-amber-400 hover:underline font-semibold flex items-center space-x-0.5 cursor-pointer"
                          >
                            <span>Manage All in Organizer Panel</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeEvent.registeredShops.map((shop, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2.5 text-xs"
                            >
                              <img
                                src={
                                  shop.artisanAvatar ||
                                  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80"
                                }
                                alt=""
                                className="w-7 h-7 rounded-full object-cover border border-amber-500/40 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-white truncate text-[11px]">
                                  {shop.shopTitle}
                                </div>
                                <div className="text-[10px] text-amber-300/80 truncate">
                                  {shop.artisanName} • {shop.stallNumber || `Stall #${idx + 1}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* THE CORE PROMPT: "Are you interested in putting your shop in that event?" */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/40 shadow-lg space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-100">
                          Are you interested in putting your shop in this event?
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Set up your artisan stall, demonstrate traditional craftsmanship, and sell directly to neighbors at the {activeEvent.locationName}.
                        </p>
                      </div>
                    </div>

                    {isUserRegisteredForActive ? (
                      /* Already Registered State */
                      <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-emerald-200">
                              Your Shop is Registered for this Meetup!
                            </div>
                            <div className="text-[11px] text-emerald-300/80">
                              Stall: {userParticipantInfo?.shopTitle} ({userParticipantInfo?.stallNumber || "Confirmed"})
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleUnregisterShop}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/60 text-xs font-semibold cursor-pointer transition-all self-end sm:self-center"
                        >
                          Withdraw Stall
                        </button>
                      </div>
                    ) : !currentUser ? (
                      /* Unauthenticated Candidate State */
                      <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-xs text-slate-300">
                            Sign in with your artisan or candidate profile to reserve your stall.
                          </span>
                        </div>
                        <button
                          onClick={onOpenAuth}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer transition-all shrink-0"
                        >
                          Sign In / Select Profile
                        </button>
                      </div>
                    ) : (
                      /* Register Shop Form */
                      <form onSubmit={handleRegisterShop} className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-amber-200 mb-1">
                              Select Your Shop / Craft Listing
                            </label>
                            {candidateListings.length > 0 ? (
                              <select
                                value={selectedListingId}
                                onChange={(e) => setSelectedListingId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                              >
                                <option value="">-- Choose Listing or Custom --</option>
                                {candidateListings.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.titleEnglish || l.title}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={customShopTitle}
                                onChange={(e) => setCustomShopTitle(e.target.value)}
                                placeholder="e.g. Master Needlework & Zari Stall"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-amber-200 mb-1">
                              Stall Setup Note / Requirement
                            </label>
                            <input
                              type="text"
                              value={stallNotes}
                              onChange={(e) => setStallNotes(e.target.value)}
                              placeholder="e.g. 1 display table, 1 power plug, shaded stall"
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 pt-1">
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg flex items-center space-x-2 transition-all cursor-pointer"
                          >
                            <Store className="w-4 h-4" />
                            <span>Confirm & Register My Shop In This Event</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

