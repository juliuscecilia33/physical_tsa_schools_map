"use client";

import { Facility, Note } from "@/types/facility";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Phone,
  Globe,
  Clock,
  Star,
  StarHalf,
  CheckCircle2,
  XCircle,
  EyeOff,
  Eye,
  StickyNote,
  Plus,
  Edit2,
  Trash2,
  Save,
  XCircle as XIcon,
  Home,
  Camera,
  MessageSquare
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

type TabId = 'overview' | 'photos' | 'notes' | 'reviews';

interface Tab {
  id: TabId;
  label: string;
  icon: any;
  badge?: number;
}

interface FacilitySidebarProps {
  facility: Facility | null;
  onClose: () => void;
  onUpdateFacility: (place_id: string, hidden: boolean) => void;
}

// Sport emoji mapping
const SPORT_EMOJIS: { [key: string]: string } = {
  // Core Sports
  "Basketball": "🏀",
  "Soccer": "⚽",
  "Baseball": "⚾",
  "Football": "🏈",
  "Tennis": "🎾",
  "Volleyball": "🏐",
  "Swimming": "🏊",
  "Track & Field": "🏃",

  // Extended Sports
  "Golf": "⛳",
  "Hockey": "🏒",
  "Lacrosse": "🥍",
  "Softball": "🥎",
  "Wrestling": "🤼",
  "Gymnastics": "🤸",
  "Pickleball": "🏓",
  "Racquetball": "🎾",
  "Squash": "🎾",
  "Badminton": "🏸",

  // Fitness Activities
  "Gym/Fitness": "💪",
  "CrossFit": "🏋️",
  "Yoga": "🧘",
  "Pilates": "🧘‍♀️",
  "Martial Arts": "🥋",
  "Boxing": "🥊",

  // Other Sports
  "Bowling": "🎳",
  "Skating": "⛸️",
  "Climbing": "🧗",
  "Water Sports": "🚣",
};

export default function FacilitySidebar({ facility, onClose, onUpdateFacility }: FacilitySidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [direction, setDirection] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [loadingImages, setLoadingImages] = useState<{ [key: number]: boolean }>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [selectedSportDetail, setSelectedSportDetail] = useState<string | null>(null);

  // Fetch notes when facility changes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!facility) return;

      setLoadingNotes(true);
      try {
        const { data, error } = await supabase
          .from("facility_notes")
          .select("*")
          .eq("place_id", facility.place_id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotes(data || []);
      } catch (error) {
        console.error("Error fetching notes:", error);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchNotes();
  }, [facility]);

  // Add new note
  const handleAddNote = async () => {
    if (!newNoteText.trim() || !facility) return;

    setAddingNote(true);
    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      place_id: facility.place_id,
      note_text: newNoteText,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    setNotes(prev => [tempNote, ...prev]);
    setNewNoteText("");

    try {
      const { data, error } = await supabase
        .from("facility_notes")
        .insert({
          place_id: facility.place_id,
          note_text: newNoteText,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp note with real note from database
      setNotes(prev => prev.map(n => n.id === tempNote.id ? data : n));
    } catch (error) {
      console.error("Error adding note:", error);
      // Revert optimistic update
      setNotes(prev => prev.filter(n => n.id !== tempNote.id));
      alert("Failed to add note. Please try again.");
    } finally {
      setAddingNote(false);
    }
  };

  // Start editing a note
  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.note_text);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditNoteText("");
  };

  // Save edited note
  const handleSaveEdit = async (noteId: string) => {
    if (!editNoteText.trim()) return;

    const oldNote = notes.find(n => n.id === noteId);
    if (!oldNote) return;

    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, note_text: editNoteText, updated_at: new Date().toISOString() }
        : n
    ));
    setEditingNoteId(null);

    try {
      const { error } = await supabase
        .from("facility_notes")
        .update({ note_text: editNoteText })
        .eq("id", noteId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating note:", error);
      // Revert optimistic update
      setNotes(prev => prev.map(n => n.id === noteId ? oldNote : n));
      alert("Failed to update note. Please try again.");
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    const deletedNote = notes.find(n => n.id === noteId);
    if (!deletedNote) return;

    // Optimistic update
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
      const { error } = await supabase
        .from("facility_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting note:", error);
      // Revert optimistic update
      setNotes(prev => [...prev, deletedNote].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      alert("Failed to delete note. Please try again.");
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Tab configuration
  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: notes.length },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
  ];

  const tabOrder: TabId[] = ['overview', 'photos', 'notes', 'reviews'];

  // Handle tab change with direction for animation
  const handleTabChange = (tabId: TabId) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    const newIndex = tabOrder.indexOf(tabId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(tabId);
    // Scroll content to top
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleHidden = () => {
    if (!facility) return;
    const newHiddenValue = !facility.hidden;
    const placeId = facility.place_id;

    // Optimistically update local state immediately
    onUpdateFacility(placeId, newHiddenValue);

    // Close sidebar immediately
    onClose();

    // Sync to database in background (no await needed)
    supabase
      .from("sports_facilities")
      .update({ hidden: newHiddenValue })
      .eq("place_id", placeId)
      .then(({ error }) => {
        if (error) {
          console.error("Error updating facility hidden status:", error);
          // Revert optimistic update on error
          onUpdateFacility(placeId, !newHiddenValue);
          alert("Failed to update facility. The change has been reverted.");
        }
      });
  };

  const getPhotoUrl = (photoReference: string) => {
    const maxWidth = 400;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  };

  const formatSportType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star key={`full-${i}`} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      );
    }
    if (hasHalfStar) {
      stars.push(
        <StarHalf key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      );
    }
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
      );
    }
    return stars;
  };

  const handleImageLoad = (idx: number) => {
    setLoadingImages(prev => ({ ...prev, [idx]: false }));
  };

  const handleImageLoadStart = (idx: number) => {
    setLoadingImages(prev => ({ ...prev, [idx]: true }));
  };

  // Early return after all hooks are declared (Rules of Hooks)
  if (!facility) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* Header with gradient */}
        <div className="sticky top-0 bg-gradient-to-br from-white via-white to-[#004aad]/5 backdrop-blur-sm border-b border-[#E8E9EB] shadow-sm z-20">
          {/* TSA Logo */}
          <div className="flex justify-center pt-6 pb-4">
            <motion.img
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              src="/assets/TSA.png"
              alt="TSA Logo"
              className="h-12 w-auto"
            />
          </div>
          <div className="px-6 pb-6 flex justify-between items-start">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 pr-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                  {facility.name}
                </h2>
                {facility.business_status && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      facility.business_status === "OPERATIONAL"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {facility.business_status === "OPERATIONAL" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>OPEN</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>CLOSED</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              {facility.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">{renderStars(facility.rating)}</div>
                  <span className="text-sm font-medium text-gray-700">
                    {facility.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({facility.user_ratings_total} reviews)
                  </span>
                </div>
              )}
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Hide/Unhide Button */}
          <div className="px-6 pb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToggleHidden}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm shadow-sm transition-all ${
                facility.hidden
                  ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 hover:from-[#004aad]/90 hover:to-[#004aad]/80 text-white"
                  : "bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700"
              }`}
            >
              {facility.hidden ? (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Unhide Facility</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>Hide from Map</span>
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-[165px] bg-white border-b border-gray-200 z-10 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-6 py-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-[#004aad] to-[#004aad]/90 text-white shadow-lg shadow-[#004aad]/20"
                      : "bg-[#E8E9EB] text-gray-600 hover:bg-[#E8E9EB]/80"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive ? "bg-white/20" : "bg-gray-200"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Tab Content with Animations */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              initial={{ x: direction > 0 ? 100 : -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -100 : 100, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="p-6 space-y-6"
            >
              {activeTab === 'overview' && (
                <>
                  {/* Facility Types */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Facility Types
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {facility.sport_types
                        .filter(
                          (type) =>
                            !["establishment", "point_of_interest", "health", "locality", "political", "tourist_attraction"].includes(type)
                        )
                        .map((type, idx) => (
                          <motion.span
                            key={type}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                            whileHover={{ scale: 1.05 }}
                            className="px-4 py-2 bg-gradient-to-r from-[#004aad]/5 to-[#004aad]/10 text-[#004aad] rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-all cursor-default"
                          >
                            {formatSportType(type)}
                          </motion.span>
                        ))}
                    </div>
                  </motion.div>

                  {/* Identified Sports with Confidence Scores */}
                  {facility.identified_sports && facility.identified_sports.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 }}
                    >
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                        Sports Scraped
                        <span className="text-xs font-normal text-gray-500 normal-case">(with confidence scores)</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {facility.identified_sports.map((sport, idx) => {
                          const metadata = facility.sport_metadata?.[sport];
                          const score = metadata?.score || 0;
                          const confidence = metadata?.confidence || 'unknown';

                          // Color coding based on confidence
                          let bgColor = 'from-gray-50 to-gray-100/50';
                          let textColor = 'text-gray-700';
                          let borderColor = 'border-gray-300';

                          if (confidence === 'high') {
                            bgColor = 'from-green-50 to-green-100/50';
                            textColor = 'text-green-700';
                            borderColor = 'border-green-300';
                          } else if (confidence === 'medium') {
                            bgColor = 'from-yellow-50 to-yellow-100/50';
                            textColor = 'text-yellow-700';
                            borderColor = 'border-yellow-300';
                          } else if (confidence === 'low') {
                            bgColor = 'from-red-50 to-red-100/50';
                            textColor = 'text-red-700';
                            borderColor = 'border-red-300';
                          }

                          // Get confidence icon
                          let confidenceIcon = '?';
                          if (confidence === 'high') {
                            confidenceIcon = '✓';
                          } else if (confidence === 'medium') {
                            confidenceIcon = '~';
                          } else if (confidence === 'low') {
                            confidenceIcon = '⚠';
                          }

                          const tooltipContent = metadata ?
                            `Score: ${score}/100 | Sources: ${metadata.sources.join(', ') || 'unknown'}\nKeywords: ${metadata.keywords_matched.join(', ')}\nMatched: "${metadata.matched_text}"` :
                            'No confidence data available - run audit script';

                          return (
                            <motion.div
                              key={sport}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.12 + idx * 0.05 }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="group relative"
                              title={tooltipContent}
                            >
                              <button
                                onClick={() => setSelectedSportDetail(sport)}
                                className={`px-4 py-2 bg-gradient-to-r ${bgColor} ${textColor} rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 border ${borderColor}`}
                              >
                                <span className="text-lg">{SPORT_EMOJIS[sport] || "🏅"}</span>
                                <span className="font-semibold">{sport}</span>
                                {metadata ? (
                                  <>
                                    <span className="text-xs opacity-75">{confidenceIcon}</span>
                                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-white/60">
                                      {score}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs opacity-75">?</span>
                                )}
                              </button>

                              {/* Tooltip on hover - appears below badge */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 hidden group-hover:block z-[100] pointer-events-none">
                                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl max-w-xs whitespace-pre-wrap">
                                  {/* Arrow pointing up */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-[-1px]">
                                    <div className="border-8 border-transparent border-b-gray-900"></div>
                                  </div>
                                  {metadata ? (
                                    <>
                                      <div className="font-semibold mb-1">Confidence: {score}/100 ({confidence})</div>
                                      <div className="text-gray-300">
                                        <div><strong>Sources:</strong> {metadata.sources.join(', ') || 'unknown'}</div>
                                        <div><strong>Keywords:</strong> {metadata.keywords_matched.join(', ')}</div>
                                        {metadata.matched_text && (
                                          <div className="mt-1 italic border-t border-gray-700 pt-1">
                                            "{metadata.matched_text.substring(0, 100)}{metadata.matched_text.length > 100 ? '...' : ''}"
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div>No confidence data available - run audit script</div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* Contact Information */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Contact Information
                    </h3>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <MapPin className="w-5 h-5 text-[#004aad] flex-shrink-0 mt-0.5" />
                        <p className="text-gray-700 text-sm leading-relaxed">{facility.address}</p>
                      </div>

                      {facility.phone && (
                        <motion.a
                          href={`tel:${facility.phone}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#004aad]/5 transition-colors group"
                        >
                          <Phone className="w-5 h-5 text-[#004aad] group-hover:text-[#004aad]/80 transition-colors" />
                          <span className="text-[#004aad] group-hover:text-[#004aad]/80 font-medium text-sm">
                            {facility.phone}
                          </span>
                        </motion.a>
                      )}

                      {facility.website && (
                        <motion.a
                          href={facility.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#004aad]/5 transition-colors group"
                        >
                          <Globe className="w-5 h-5 text-[#004aad] group-hover:text-[#004aad]/80 transition-colors flex-shrink-0" />
                          <span className="text-[#004aad] group-hover:text-[#004aad]/80 font-medium text-sm truncate">
                            {facility.website.replace(/^https?:\/\//, "")}
                          </span>
                        </motion.a>
                      )}
                    </div>
                  </motion.div>

                  {/* Opening Hours */}
                  {facility.opening_hours && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-gradient-to-br from-[#E8E9EB]/30 to-[#E8E9EB]/50 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Hours
                        </h3>
                        {facility.opening_hours.open_now !== undefined && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              facility.opening_hours.open_now
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {facility.opening_hours.open_now ? "Open Now" : "Closed"}
                          </span>
                        )}
                      </div>
                      {facility.opening_hours.weekday_text && (
                        <ul className="space-y-2">
                          {facility.opening_hours.weekday_text.map((day, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + idx * 0.03 }}
                              className="text-sm text-gray-700 font-medium"
                            >
                              {day}
                            </motion.li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  )}
                </>
              )}

              {activeTab === 'photos' && (
                <>
                  {/* Photos */}
                  {facility.photo_references && facility.photo_references.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Photos ({facility.photo_references.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {facility.photo_references.slice(0, 10).map((photoRef, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                            whileHover={{ scale: 1.05 }}
                            className="relative overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer group"
                          >
                            {loadingImages[idx] !== false && (
                              <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                            )}
                            <img
                              src={getPhotoUrl(photoRef)}
                              alt={`${facility.name} photo ${idx + 1}`}
                              className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-110"
                              onLoadStart={() => handleImageLoadStart(idx)}
                              onLoad={() => handleImageLoad(idx)}
                              onError={() => handleImageLoad(idx)}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-center py-12">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No photos available</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'notes' && (
                <>
                  {/* Notes Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <StickyNote className="w-4 h-4" />
                        Notes ({notes.length})
                      </h3>
                    </div>

                    {/* Add New Note Form */}
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <textarea
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-[#E8E9EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004aad] resize-none"
                          rows={2}
                          disabled={addingNote}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim() || addingNote}
                        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-[#004aad] to-[#004aad]/90 hover:from-[#004aad]/90 hover:to-[#004aad]/80 text-white rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{addingNote ? "Adding..." : "Add Note"}</span>
                      </motion.button>
                    </div>

                    {/* Notes List */}
                    {loadingNotes ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004aad] mx-auto"></div>
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="text-center py-6 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-100">
                        <StickyNote className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No notes yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note, idx) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                            className="bg-gradient-to-br from-white to-gray-50/50 rounded-xl p-3 shadow-sm border border-gray-100"
                          >
                            {editingNoteId === note.id ? (
                              // Edit Mode
                              <div className="space-y-2">
                                <textarea
                                  value={editNoteText}
                                  onChange={(e) => setEditNoteText(e.target.value)}
                                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleSaveEdit(note.id)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium"
                                  >
                                    <Save className="w-3 h-3" />
                                    Save
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleCancelEdit}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium"
                                  >
                                    <XIcon className="w-3 h-3" />
                                    Cancel
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <>
                                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                                  {note.note_text}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    {formatRelativeTime(note.created_at)}
                                    {note.updated_at !== note.created_at && " (edited)"}
                                  </span>
                                  <div className="flex gap-2">
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleStartEdit(note)}
                                      className="p-1 hover:bg-[#004aad]/10 rounded text-[#004aad]"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleDeleteNote(note.id)}
                                      className="p-1 hover:bg-red-100 rounded text-red-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </motion.button>
                                  </div>
                                </div>
                              </>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </>
              )}

              {activeTab === 'reviews' && (
                <>
                  {/* Reviews */}
                  {facility.reviews && facility.reviews.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                        Reviews ({facility.reviews.length})
                      </h3>
                      <div className="space-y-4">
                        {facility.reviews.map((review, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                            whileHover={{ scale: 1.01 }}
                            className="bg-gradient-to-br from-white to-gray-50/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-semibold text-gray-900 text-sm">
                                {review.author_name}
                              </span>
                              <div className="flex gap-0.5">
                                {renderStars(review.rating)}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed mb-2">
                              {review.text}
                            </p>
                            <span className="text-xs text-gray-500 font-medium">
                              {review.relative_time_description}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No reviews available</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sport Detail Modal - Rendered as Portal for Full-Screen Overlay */}
        {selectedSportDetail && facility.sport_metadata?.[selectedSportDetail] && createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]"
              onClick={() => setSelectedSportDetail(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const sport = selectedSportDetail;
                  const metadata = facility.sport_metadata![sport];
                  const score = metadata.score;
                  const confidence = metadata.confidence;

                  // Color scheme based on confidence
                  let accentColor = 'gray';
                  let bgGradient = 'from-gray-50 to-gray-100';
                  let textColor = 'text-gray-700';
                  let iconColor = 'text-gray-600';

                  if (confidence === 'high') {
                    accentColor = 'green';
                    bgGradient = 'from-green-50 to-green-100';
                    textColor = 'text-green-800';
                    iconColor = 'text-green-600';
                  } else if (confidence === 'medium') {
                    accentColor = 'yellow';
                    bgGradient = 'from-yellow-50 to-yellow-100';
                    textColor = 'text-yellow-800';
                    iconColor = 'text-yellow-600';
                  } else if (confidence === 'low') {
                    accentColor = 'red';
                    bgGradient = 'from-red-50 to-red-100';
                    textColor = 'text-red-800';
                    iconColor = 'text-red-600';
                  }

                  return (
                    <>
                      {/* Header */}
                      <div className={`bg-gradient-to-br ${bgGradient} p-6 border-b ${
                        confidence === 'high' ? 'border-green-200' :
                        confidence === 'medium' ? 'border-yellow-200' :
                        confidence === 'low' ? 'border-red-200' :
                        'border-gray-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl">{SPORT_EMOJIS[sport] || "🏅"}</span>
                            <div>
                              <h3 className={`text-2xl font-bold ${textColor}`}>{sport}</h3>
                              <p className="text-sm text-gray-600 mt-1">Confidence Analysis</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedSportDetail(null)}
                            className="p-2 hover:bg-white/50 rounded-full transition-colors"
                          >
                            <X className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>

                        {/* Score Display */}
                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={`text-4xl font-bold ${textColor}`}>{score}</span>
                              <span className="text-gray-500 text-sm">/100</span>
                            </div>
                            <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  confidence === 'high' ? 'bg-green-500' :
                                  confidence === 'medium' ? 'bg-yellow-500' :
                                  confidence === 'low' ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                          <div className={`px-4 py-2 bg-white rounded-lg border-2 ${
                            confidence === 'high' ? 'border-green-300' :
                            confidence === 'medium' ? 'border-yellow-300' :
                            confidence === 'low' ? 'border-red-300' :
                            'border-gray-300'
                          }`}>
                            <div className="text-xs text-gray-500 uppercase">Confidence</div>
                            <div className={`text-lg font-bold ${textColor} capitalize`}>{confidence}</div>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-6 space-y-4 overflow-y-auto max-h-[50vh]">
                        {/* Sources */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                            Identified From
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {metadata.sources.map((source) => {
                              const sourceLabels: Record<string, string> = {
                                name: '📛 Facility Name',
                                review: '💬 Reviews',
                                api: '🔌 API Data',
                              };
                              return (
                                <span
                                  key={source}
                                  className="px-3 py-1.5 bg-[#004aad]/5 text-[#004aad] rounded-lg text-sm font-medium border border-[#004aad]/20"
                                >
                                  {sourceLabels[source] || source}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Keywords */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                            Matched Keywords
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {metadata.keywords_matched.map((keyword) => (
                              <span
                                key={keyword}
                                className="px-3 py-1 bg-[#c9472b]/10 text-[#c9472b] rounded-full text-xs font-mono border border-[#c9472b]/20"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Matched Text */}
                        {metadata.matched_text && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                              Text Evidence
                            </h4>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <p className="text-sm text-gray-700 italic leading-relaxed">
                                "{metadata.matched_text}"
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Recommendation */}
                        <div className={`border-2 rounded-lg p-4 ${
                          confidence === 'high' ? 'border-green-200 bg-green-50/50' :
                          confidence === 'medium' ? 'border-yellow-200 bg-yellow-50/50' :
                          confidence === 'low' ? 'border-red-200 bg-red-50/50' :
                          'border-gray-200 bg-gray-50/50'
                        }`}>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <span>💡</span>
                            Recommendation
                          </h4>
                          <p className={`text-sm ${textColor}`}>
                            {confidence === 'high' && (
                              <>
                                <strong>Keep this sport.</strong> High confidence score indicates reliable identification from facility name or verified sources.
                              </>
                            )}
                            {confidence === 'medium' && (
                              <>
                                <strong>Review recommended.</strong> Medium confidence suggests this sport was identified from reviews, which may contain context that doesn't reflect what's actually offered.
                              </>
                            )}
                            {confidence === 'low' && (
                              <>
                                <strong>Consider removing.</strong> Low confidence score indicates this is likely a false positive from review mentions that don't reflect actual offerings.
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <button
                          onClick={() => setSelectedSportDetail(null)}
                          className="w-full py-2.5 px-4 bg-gradient-to-r from-[#004aad] to-[#004aad]/90 hover:from-[#004aad]/90 hover:to-[#004aad]/80 text-white rounded-lg font-medium shadow-sm transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
      </motion.div>
    </AnimatePresence>
  );
}
