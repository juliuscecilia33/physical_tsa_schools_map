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
  XCircle as XIcon
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface FacilitySidebarProps {
  facility: Facility | null;
  onClose: () => void;
  onUpdateFacility: (place_id: string, hidden: boolean) => void;
}

export default function FacilitySidebar({ facility, onClose, onUpdateFacility }: FacilitySidebarProps) {
  const [loadingImages, setLoadingImages] = useState<{ [key: number]: boolean }>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

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
    if (!newNoteText.trim()) return;

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

  const handleToggleHidden = () => {
    const newHiddenValue = !facility.hidden;

    // Optimistically update local state immediately
    onUpdateFacility(facility.place_id, newHiddenValue);

    // Close sidebar immediately
    onClose();

    // Sync to database in background (no await needed)
    supabase
      .from("sports_facilities")
      .update({ hidden: newHiddenValue })
      .eq("place_id", facility.place_id)
      .then(({ error }) => {
        if (error) {
          console.error("Error updating facility hidden status:", error);
          // Revert optimistic update on error
          onUpdateFacility(facility.place_id, !newHiddenValue);
          alert("Failed to update facility. The change has been reverted.");
        }
      })
      .catch((err) => {
        console.error("Error updating facility:", err);
        // Revert optimistic update on error
        onUpdateFacility(facility.place_id, !newHiddenValue);
        alert("Failed to update facility. The change has been reverted.");
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
        className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto"
      >
        {/* Header with gradient */}
        <div className="sticky top-0 bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-sm border-b border-gray-100 p-6 flex justify-between items-start shadow-sm z-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 pr-4"
          >
            <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
              {facility.name}
            </h2>
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

        <div className="p-6 space-y-6">
          {/* Sport Types */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Sport Types
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
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-all cursor-default"
                  >
                    {formatSportType(type)}
                  </motion.span>
                ))}
            </div>
          </motion.div>

          {/* Business Status */}
          {facility.business_status && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-sm ${
                  facility.business_status === "OPERATIONAL"
                    ? "bg-gradient-to-r from-green-50 to-emerald-100/50 text-green-800"
                    : "bg-gradient-to-r from-red-50 to-red-100/50 text-red-800"
                }`}
              >
                {facility.business_status === "OPERATIONAL" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {facility.business_status.replace("_", " ")}
              </span>
            </motion.div>
          )}

          {/* Hide/Unhide Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToggleHidden}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm shadow-sm transition-all ${
                facility.hidden
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
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
          </motion.div>

          {/* Notes Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
                  className="flex-1 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  disabled={addingNote}
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddNote}
                disabled={!newNoteText.trim() || addingNote}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>{addingNote ? "Adding..." : "Add Note"}</span>
              </motion.button>
            </div>

            {/* Notes List */}
            {loadingNotes ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
                    transition={{ delay: 0.35 + idx * 0.05 }}
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
                              className="p-1 hover:bg-blue-100 rounded text-blue-600"
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

          {/* Photos */}
          {facility.photo_references && facility.photo_references.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Photos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {facility.photo_references.slice(0, 10).map((photoRef, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + idx * 0.05 }}
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
          )}

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-4"
          >
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Contact Information
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm leading-relaxed">{facility.address}</p>
              </div>

              {facility.phone && (
                <motion.a
                  href={`tel:${facility.phone}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <Phone className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors" />
                  <span className="text-blue-600 group-hover:text-blue-700 font-medium text-sm">
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
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <Globe className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors flex-shrink-0" />
                  <span className="text-blue-600 group-hover:text-blue-700 font-medium text-sm truncate">
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
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 shadow-sm"
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
                      transition={{ delay: 0.45 + idx * 0.03 }}
                      className="text-sm text-gray-700 font-medium"
                    >
                      {day}
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {/* Reviews */}
          {facility.reviews && facility.reviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
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
                    transition={{ delay: 0.5 + idx * 0.05 }}
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
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
