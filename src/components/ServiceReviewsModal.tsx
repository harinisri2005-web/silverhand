import React, { useState, useEffect } from "react";
import {
  Star,
  Sparkles,
  Building2,
  UserCheck,
  ThumbsUp,
  MessageSquare,
  Send,
  X,
  CheckCircle,
  PlusCircle,
  Clock,
  ShieldCheck,
  Award,
  Filter,
} from "lucide-react";
import { Listing, ServiceReview, User, ReviewerRole } from "../types";
import {
  getReviewsForListing,
  saveReview,
  addProviderReplyToReview,
  getStoredReviews,
} from "../services/storageService";

interface ServiceReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing;
  currentUser: User;
  onReviewAdded?: () => void;
}

export const ServiceReviewsModal: React.FC<ServiceReviewsModalProps> = ({
  isOpen,
  onClose,
  listing,
  currentUser,
  onReviewAdded,
}) => {
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "recruiter" | "customer">("all");
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Form State
  const [reviewerRole, setReviewerRole] = useState<ReviewerRole>(
    currentUser.role === "customer" ? "customer" : "recruiter"
  );
  const [reviewerName, setReviewerName] = useState(currentUser.fullName || "");
  const [reviewerOrganization, setReviewerOrganization] = useState(
    currentUser.role === "customer" ? `${listing.location.neighborhood} Client` : "Heritage Crafts & Artisan Talent Guild"
  );
  const [rating, setRating] = useState(5);
  const [craftsmanshipRating, setCraftsmanshipRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [serviceTypeTag, setServiceTypeTag] = useState(listing.tags?.[0] || "Artisan Service");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Provider reply input state per review
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [providerReplyText, setProviderReplyText] = useState("");

  const isProvider = currentUser.id === listing.providerId;

  // Load Reviews for this Listing or Provider
  const loadReviews = () => {
    const list = getStoredReviews(listing.id, undefined);
    if (list.length === 0) {
      // Fallback to provider reviews if listing-specific is empty
      const providerList = getStoredReviews(undefined, listing.providerId);
      setReviews(providerList);
    } else {
      setReviews(list);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReviews();
      setShowReviewForm(false);
      setReplyingReviewId(null);
    }
  }, [isOpen, listing.id, listing.providerId]);

  if (!isOpen) return null;

  const filteredReviews = reviews.filter((r) => {
    if (activeFilter === "recruiter") return r.reviewerRole === "recruiter";
    if (activeFilter === "customer") return r.reviewerRole === "customer";
    return true;
  });

  const recruiterCount = reviews.filter((r) => r.reviewerRole === "recruiter").length;
  const customerCount = reviews.filter((r) => r.reviewerRole === "customer").length;

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "5.0";

  const craftsmanshipAvg =
    reviews.length > 0
      ? (
          reviews.reduce((s, r) => s + (r.craftsmanshipRating || r.rating), 0) /
          reviews.length
        ).toFixed(1)
      : "5.0";

  const communicationAvg =
    reviews.length > 0
      ? (
          reviews.reduce((s, r) => s + (r.communicationRating || r.rating), 0) /
          reviews.length
        ).toFixed(1)
      : "5.0";

  const punctualityAvg =
    reviews.length > 0
      ? (
          reviews.reduce((s, r) => s + (r.punctualityRating || r.rating), 0) /
          reviews.length
        ).toFixed(1)
      : "5.0";

  // Handle Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      const newReview: ServiceReview = {
        id: `rev_${Date.now()}`,
        listingId: listing.id,
        listingTitle: listing.titleEnglish || listing.title,
        providerId: listing.providerId,
        providerName: listing.providerName,
        reviewerId: currentUser.id,
        reviewerName: reviewerName.trim() || currentUser.fullName || "Neighborhood Client",
        reviewerRole,
        reviewerOrganization: reviewerOrganization.trim() || undefined,
        reviewerAvatar:
          currentUser.avatarUrl ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        rating,
        craftsmanshipRating,
        communicationRating,
        punctualityRating,
        title: title.trim() || `${rating} Star ${reviewerRole === "recruiter" ? "Endorsement" : "Review"}`,
        comment: comment.trim(),
        verifiedHire: true,
        serviceTypeTag: serviceTypeTag.trim() || "Artisan Service",
        helpfulCount: 1,
        createdAt: new Date().toISOString(),
      };

      await saveReview(newReview);
      loadReviews();
      setShowReviewForm(false);
      setTitle("");
      setComment("");
      setToastMessage("✨ Review & endorsement published successfully!");
      if (onReviewAdded) onReviewAdded();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Save review error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Provider Reply
  const handleSaveProviderReply = async (reviewId: string) => {
    if (!providerReplyText.trim()) return;
    try {
      await addProviderReplyToReview(reviewId, providerReplyText.trim());
      loadReviews();
      setReplyingReviewId(null);
      setProviderReplyText("");
      setToastMessage("✨ Your reply was posted to the review!");
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      id="service-reviews-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden text-amber-50 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 px-6 py-5 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={listing.providerAvatar || listing.imageUrl}
              alt={listing.providerName}
              className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold uppercase tracking-wider">
                  Verified Reviews & Endorsements
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {listing.providerName}
                </span>
              </div>
              <h2 className="text-xl font-bold font-serif text-amber-100 mt-0.5 line-clamp-1">
                {listing.titleEnglish || listing.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-amber-500 text-slate-950 px-6 py-2.5 text-xs font-bold text-center">
            {toastMessage}
          </div>
        )}

        {/* Rating Metrics Banner */}
        <div className="p-6 bg-slate-950/60 border-b border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Main Average Score */}
          <div className="flex items-center space-x-3 bg-amber-950/40 border border-amber-500/30 p-4 rounded-2xl">
            <div className="text-4xl font-bold text-amber-300 font-serif">
              {averageRating}
            </div>
            <div>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <div className="text-xs text-slate-300 font-medium mt-1">
                {reviews.length} Verified {reviews.length === 1 ? "Review" : "Reviews"}
              </div>
            </div>
          </div>

          {/* Craftsmanship Rating */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Craftsmanship</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-200 mt-1">
              {craftsmanshipAvg} / 5.0
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-amber-400 h-full rounded-full"
                style={{ width: `${(Number(craftsmanshipAvg) / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Communication Rating */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Communication & Warmth</span>
              <MessageSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-200 mt-1">
              {communicationAvg} / 5.0
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-amber-400 h-full rounded-full"
                style={{ width: `${(Number(communicationAvg) / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Punctuality Rating */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Punctuality & Care</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-200 mt-1">
              {punctualityAvg} / 5.0
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-amber-400 h-full rounded-full"
                style={{ width: `${(Number(punctualityAvg) / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter Controls & Write Feedback Trigger */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveFilter("all")}
              id="filter-reviews-all"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All Feedback ({reviews.length})
            </button>
            <button
              onClick={() => setActiveFilter("recruiter")}
              id="filter-reviews-recruiter"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeFilter === "recruiter"
                  ? "bg-blue-500 text-slate-950 shadow-md font-bold"
                  : "bg-slate-800 text-blue-300 hover:bg-slate-700"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Recruiter Endorsements ({recruiterCount})</span>
            </button>
            <button
              onClick={() => setActiveFilter("customer")}
              id="filter-reviews-customer"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeFilter === "customer"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                  : "bg-slate-800 text-emerald-300 hover:bg-slate-700"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer Reviews ({customerCount})</span>
            </button>
          </div>

          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            id="btn-toggle-write-review"
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showReviewForm ? "Close Review Form" : "Write a Review / Endorsement"}</span>
          </button>
        </div>

        {/* WRITE A REVIEW / ENDORSEMENT FORM */}
        {showReviewForm && (
          <form
            onSubmit={handleSubmitReview}
            className="p-6 bg-slate-950/90 border-b-2 border-amber-500/40 space-y-4 animate-in fade-in duration-300"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-200 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Submit Feedback or Guild Endorsement</span>
              </h3>
              <span className="text-xs text-slate-400">
                Helping elder artisans build verified reputation
              </span>
            </div>

            {/* Role Switcher */}
            <div>
              <label className="block text-xs font-bold text-amber-300 mb-2">
                I am reviewing as:
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setReviewerRole("customer");
                    setReviewerOrganization(`${listing.location.neighborhood} Client`);
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer transition-all ${
                    reviewerRole === "customer"
                      ? "bg-emerald-950/70 border-emerald-400 text-emerald-200 shadow-md"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Customer / Client</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewerRole("recruiter");
                    setReviewerOrganization("Heritage Crafts & Artisan Talent Guild");
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer transition-all ${
                    reviewerRole === "recruiter"
                      ? "bg-blue-950/70 border-blue-400 text-blue-200 shadow-md"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Recruiter / Talent Scout</span>
                </button>
              </div>
            </div>

            {/* Reviewer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-amber-200 mb-1">
                  Your Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Priya Sharma or Marcus Vance"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-200 mb-1">
                  {reviewerRole === "recruiter" ? "Organization / Agency / Guild:" : "Neighborhood / City:"}
                </label>
                <input
                  type="text"
                  value={reviewerOrganization}
                  onChange={(e) => setReviewerOrganization(e.target.value)}
                  placeholder={
                    reviewerRole === "recruiter"
                      ? "e.g. Heritage Crafts Foundation"
                      : "e.g. T. Nagar Resident"
                  }
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100"
                />
              </div>
            </div>

            {/* Star Rating Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1">
                  Overall Score:
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onClick={() => setRating(star)}
                      className={`w-5 h-5 cursor-pointer transition-colors ${
                        star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-amber-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1">
                  Craftsmanship:
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onClick={() => setCraftsmanshipRating(star)}
                      className={`w-5 h-5 cursor-pointer transition-colors ${
                        star <= craftsmanshipRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-amber-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1">
                  Communication:
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onClick={() => setCommunicationRating(star)}
                      className={`w-5 h-5 cursor-pointer transition-colors ${
                        star <= communicationRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-amber-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1">
                  Punctuality:
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onClick={() => setPunctualityRating(star)}
                      className={`w-5 h-5 cursor-pointer transition-colors ${
                        star <= punctualityRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-amber-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Review Title & Comments */}
            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1">
                Review Headline:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master-class Zari repair - totally invisible mending!"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1">
                Detailed Feedback / Professional Endorsement:
              </label>
              <textarea
                required
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience working with this elder artisan, quality of the handcraft, punctuality, and recommendations..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                id="btn-submit-review"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/30 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Publish Feedback</span>
              </button>
            </div>
          </form>
        )}

        {/* Reviews List */}
        <div className="p-6 max-h-96 overflow-y-auto space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">
                No feedback matching this category yet.
              </p>
              <p className="text-xs text-slate-500">
                Be the first customer or recruiter to leave a review for {listing.providerName}!
              </p>
            </div>
          ) : (
            filteredReviews.map((rev) => (
              <div
                key={rev.id}
                id={`review-card-${rev.id}`}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/30 transition-all space-y-3"
              >
                {/* Reviewer Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <img
                      src={rev.reviewerAvatar}
                      alt={rev.reviewerName}
                      className="w-10 h-10 rounded-full object-cover border border-amber-400/50"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-amber-100 leading-none">
                          {rev.reviewerName}
                        </h4>
                        {rev.reviewerRole === "recruiter" ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-bold flex items-center space-x-1">
                            <Building2 className="w-3 h-3" />
                            <span>Recruiter Endorsement</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center space-x-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Verified Customer</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {rev.reviewerOrganization || "Local Client"} •{" "}
                        {new Date(rev.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center space-x-1 bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-500/30">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-amber-200">
                      {rev.rating}.0
                    </span>
                  </div>
                </div>

                {/* Review Headline & Body */}
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-amber-100 font-serif">
                    {rev.title}
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rev.comment}
                  </p>
                </div>

                {/* Sub-ratings Pills */}
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-400">
                  {rev.craftsmanshipRating && (
                    <span className="px-2 py-0.5 bg-slate-900 rounded-lg border border-slate-800">
                      Craftsmanship: <strong className="text-amber-300">{rev.craftsmanshipRating}/5</strong>
                    </span>
                  )}
                  {rev.communicationRating && (
                    <span className="px-2 py-0.5 bg-slate-900 rounded-lg border border-slate-800">
                      Communication: <strong className="text-amber-300">{rev.communicationRating}/5</strong>
                    </span>
                  )}
                  {rev.punctualityRating && (
                    <span className="px-2 py-0.5 bg-slate-900 rounded-lg border border-slate-800">
                      Punctuality: <strong className="text-amber-300">{rev.punctualityRating}/5</strong>
                    </span>
                  )}
                  {rev.serviceTypeTag && (
                    <span className="px-2 py-0.5 bg-amber-950/40 text-amber-300 rounded-lg border border-amber-500/30">
                      #{rev.serviceTypeTag}
                    </span>
                  )}
                </div>

                {/* Provider Reply Box (if present) */}
                {rev.providerReply && (
                  <div className="mt-3 p-3.5 bg-amber-950/30 border-l-2 border-amber-400 rounded-r-xl space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                      <span>Response from {rev.providerName} (Artisan):</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(rev.providerReply.repliedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-amber-100/90 italic">
                      "{rev.providerReply.text}"
                    </p>
                  </div>
                )}

                {/* Provider Reply Form (if currentUser is the provider and no reply yet) */}
                {isProvider && !rev.providerReply && (
                  <div className="pt-2">
                    {replyingReviewId === rev.id ? (
                      <div className="space-y-2 bg-slate-900 p-3 rounded-xl border border-amber-500/30">
                        <label className="block text-xs font-bold text-amber-300">
                          Reply to {rev.reviewerName}:
                        </label>
                        <textarea
                          rows={2}
                          value={providerReplyText}
                          onChange={(e) => setProviderReplyText(e.target.value)}
                          placeholder="Thank the reviewer or provide helpful context..."
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-amber-100"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setReplyingReviewId(null);
                              setProviderReplyText("");
                            }}
                            className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveProviderReply(rev.id)}
                            className="px-4 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Post Reply</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingReviewId(rev.id);
                          setProviderReplyText("");
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Reply to this review as {listing.providerName}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            SilverHands verified elder craftsmanship endorsement system
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Close Reviews
          </button>
        </div>
      </div>
    </div>
  );
};
