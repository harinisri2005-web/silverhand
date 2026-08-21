/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, Listing, GeoLocation, MarketplaceEvent, RegisteredShopParticipant } from "./types";
import {
  getCurrentUser,
  getStoredListings,
  getStoredUsers,
  getStoredEvents,
  setCurrentUser,
  resetAllToDefaults,
  initializeFirestoreSync,
  subscribeToListings,
  subscribeToUsers,
  subscribeToEvents,
} from "./services/storageService";
import {
  getCurrentSystemLocation,
  DEFAULT_USER_LOCATION,
} from "./services/locationService";
import { Navbar } from "./components/Navbar";
import { CustomerHome } from "./components/CustomerHome";
import { ProviderDashboard } from "./components/ProviderDashboard";
import { AuthModal } from "./components/AuthModal";
import { ChatModal } from "./components/ChatModal";
import { MeetupModal } from "./components/MeetupModal";
import { ClientMessagesPanel } from "./components/ClientMessagesPanel";
import {
  getUnreadMessageCount,
  subscribeToMessages,
} from "./services/storageService";
import { Sparkles, HeartHandshake, MapPin, Compass, ShieldCheck, X } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [activePortal, setActivePortal] = useState<"customer" | "provider">("customer");
  const [listings, setListings] = useState<Listing[]>([]);
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [userLocation, setUserLocation] = useState<GeoLocation>(DEFAULT_USER_LOCATION);

  // Modals & Drawers
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [selectedMeetupEventId, setSelectedMeetupEventId] = useState<string | null>(null);
  const [meetupModalTab, setMeetupModalTab] = useState<"explore" | "organizer" | "create">("explore");
  const [chatTarget, setChatTarget] = useState<{
    targetUser: User | { id: string; fullName: string; preferredLanguage: string; avatarUrl?: string };
    listing?: Listing | null;
    initialVoiceMode?: boolean;
  } | null>(null);

  // Accessibility State
  const [largeTextMode, setLargeTextMode] = useState(false);

  // Initialize App Data, System Geolocation, and Real-Time Firebase Firestore Subscriptions
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUserState(user);
    if (user) {
      setActivePortal(user.role === "provider" ? "provider" : "customer");
      setUnreadMessagesCount(getUnreadMessageCount(user.id));
    }

    // Connect and synchronize with Firebase Firestore
    initializeFirestoreSync().catch((e) => console.warn("Init sync:", e));

    // Live continuous subscription to neighbor listings across all tabs & Firestore
    const unsubscribeListings = subscribeToListings((updatedListings) => {
      setListings(updatedListings);
    });

    // Live continuous subscription to Marketplace Events across all tabs & Firestore
    const unsubscribeEvents = subscribeToEvents((updatedEvents) => {
      setEvents(updatedEvents);
    });

    // Live continuous subscription to Client Messages & Inquiries
    const unsubscribeMessages = subscribeToMessages(() => {
      const activeUser = getCurrentUser();
      if (activeUser) {
        setUnreadMessagesCount(getUnreadMessageCount(activeUser.id));
      }
    });

    // Request system geolocation
    getCurrentSystemLocation().then((loc) => {
      setUserLocation(loc);
    });

    return () => {
      unsubscribeListings();
      unsubscribeEvents();
      unsubscribeMessages();
    };
  }, []);

  const handleAuthenticated = (user: User) => {
    setCurrentUserState(user);
    setActivePortal(user.role === "provider" ? "provider" : "customer");
    setIsAuthOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setIsAuthOpen(true);
  };

  const handleResetData = () => {
    resetAllToDefaults().then(() => {
      const user = getCurrentUser();
      setCurrentUserState(user);
      setListings(getStoredListings());
      setEvents(getStoredEvents());
      if (user) {
        setActivePortal(user.role === "provider" ? "provider" : "customer");
      }
    });
  };

  const handleOpenMeetup = (
    eventId?: string,
    tab: "explore" | "organizer" | "create" = "explore"
  ) => {
    if (eventId) {
      setSelectedMeetupEventId(eventId);
    } else {
      setSelectedMeetupEventId(null);
    }
    setMeetupModalTab(tab);
    setIsMeetupModalOpen(true);
  };

  const handleContactProvider = (listing: Listing, startWithVoice = false) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const allUsers = getStoredUsers();
    const target = allUsers.find((u) => u.id === listing.providerId) || {
      id: listing.providerId,
      fullName: listing.providerName,
      preferredLanguage: listing.providerLanguage || "Hindi",
      avatarUrl: listing.providerAvatar,
    };

    setChatTarget({
      targetUser: target,
      listing,
      initialVoiceMode: startWithVoice,
    });
  };

  const handleContactArtisanParticipant = (
    participant: RegisteredShopParticipant,
    eventTitle: string
  ) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const allUsers = getStoredUsers();
    const target = allUsers.find((u) => u.id === participant.artisanId) || {
      id: participant.artisanId,
      fullName: participant.artisanName,
      preferredLanguage: participant.preferredLanguage || "English",
      avatarUrl: participant.artisanAvatar,
    };

    const associatedListing = participant.shopId
      ? listings.find((l) => l.id === participant.shopId)
      : undefined;

    setChatTarget({
      targetUser: target,
      listing: associatedListing || {
        id: `event_shop_${participant.artisanId}`,
        providerId: participant.artisanId,
        providerName: participant.artisanName,
        providerAvatar: participant.artisanAvatar,
        providerLanguage: participant.preferredLanguage || "English",
        title: participant.shopTitle,
        description: `Stall at "${eventTitle}" (${participant.stallNumber || "Confirmed Stall"}). ${participant.stallRequirement || ""}`,
        category: (participant.category as any) || "handmade_goods",
        price: 0,
        isBarter: false,
        digitalApprenticeEligible: false,
        tags: ["Marketplace Stall", eventTitle],
        imageUrl: participant.artisanAvatar,
        location: participant.artisanLocation || userLocation,
        available: true,
        createdAt: participant.registeredAt,
      },
    });
  };

  return (
    <div
      className={`min-h-screen bg-[#070B14] text-amber-50 flex flex-col font-sans transition-all selection:bg-amber-500 selection:text-slate-950 ${
        largeTextMode ? "text-lg" : "text-base"
      }`}
    >
      {/* Top Accessible Navbar */}
      <Navbar
        currentUser={currentUser}
        activePortal={activePortal}
        onSwitchPortal={setActivePortal}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onResetData={handleResetData}
        largeTextMode={largeTextMode}
        onToggleLargeText={() => setLargeTextMode(!largeTextMode)}
        onOpenMeetupModal={() => handleOpenMeetup()}
        eventsCount={events.length}
        onOpenMessages={currentUser ? () => setIsMessagesModalOpen(true) : undefined}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Main Content View */}
      <main className="flex-1 pb-16">
        {activePortal === "provider" && currentUser ? (
          <ProviderDashboard
            currentUser={currentUser}
            listings={listings}
            onListingCreatedOrUpdated={() => setListings(getStoredListings())}
            largeTextMode={largeTextMode}
            onUpdateUserLocation={setUserLocation}
            onUpdateCurrentUser={setCurrentUser}
            onOpenMeetupModal={() => handleOpenMeetup()}
            eventsCount={events.length}
          />
        ) : (
          <CustomerHome
            listings={listings}
            userLocation={userLocation}
            onContactProvider={handleContactProvider}
            onEditListing={(listing) => {
              // Switch to provider portal to edit
              setActivePortal("provider");
            }}
            currentUserId={currentUser?.id}
            currentUser={currentUser}
            largeTextMode={largeTextMode}
            onUpdateUserLocation={setUserLocation}
            events={events}
            onOpenMeetupModal={() => handleOpenMeetup()}
            onSelectEvent={(event) => handleOpenMeetup(event.id)}
            onOpenMessages={() => setIsMessagesModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-amber-900/30 py-8 px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-amber-200/80">
            <HeartHandshake className="w-5 h-5 text-amber-400" />
            <span className="font-serif font-bold text-sm text-amber-100">SilverHands</span>
            <span>— Firebase Firestore Powered Hyperlocal Marketplace</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleOpenMeetup()}
              className="text-amber-300 hover:text-amber-200 font-semibold cursor-pointer flex items-center space-x-1"
            >
              <span>🎪 Meetups & Bazaars ({events.length})</span>
            </button>
            <span>•</span>
            <button
              onClick={handleResetData}
              className="text-slate-400 hover:text-amber-300 cursor-pointer"
            >
              Reset Demo Data
            </button>
          </div>
        </div>
      </footer>

      {/* Community Marketplace Meetup & Flea Bazaars Modal */}
      <MeetupModal
        isOpen={isMeetupModalOpen}
        onClose={() => {
          setIsMeetupModalOpen(false);
          setSelectedMeetupEventId(null);
        }}
        events={events}
        currentUser={currentUser}
        userListings={listings}
        onOpenAuth={() => setIsAuthOpen(true)}
        selectedEventId={selectedMeetupEventId}
        initialTab={meetupModalTab}
        onContactArtisan={handleContactArtisanParticipant}
        onSelectEventLocationOnMap={(event) => {
          setUserLocation({
            lat: event.location.lat,
            lng: event.location.lng,
            address: event.location.address,
            neighborhood: event.location.neighborhood,
            city: event.location.city,
          });
        }}
      />

      {/* Accessible Username + Passcode Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />

      {/* Real-Time Multilingual Chat Modal */}
      {chatTarget && currentUser && (
        <ChatModal
          isOpen={Boolean(chatTarget)}
          onClose={() => setChatTarget(null)}
          currentUser={currentUser}
          targetUser={chatTarget.targetUser}
          listing={chatTarget.listing}
          initialVoiceMode={chatTarget.initialVoiceMode}
        />
      )}

      {/* Received Client Messages & Inquiries Modal */}
      {isMessagesModalOpen && currentUser && (
        <div
          id="client-messages-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
        >
          <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col my-auto">
            <ClientMessagesPanel
              currentUser={currentUser}
              onClose={() => setIsMessagesModalOpen(false)}
              largeTextMode={largeTextMode}
              onViewListing={(listingId) => {
                setIsMessagesModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
