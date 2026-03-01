"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  MapPin,
  Phone,
  Globe,
  Tag as TagIcon,
  StickyNote,
  Save,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { FacilityTag } from "@/types/facility";
import { getAllSportTypes } from "@/constants/sportKeywords";

interface AddFacilitySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (placeId: string) => void;
}

interface FormData {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  location: {
    lat: number;
    lng: number;
  } | null;
}

interface NoteData {
  text: string;
}

const FACILITY_TYPES = [
  "gym",
  "stadium",
  "park",
  "sports_complex",
  "recreation_center",
  "swimming_pool",
  "basketball_court",
  "tennis_court",
  "soccer_field",
  "baseball_field",
  "football_field",
  "athletic_field",
  "bowling_alley",
  "golf_course",
  "skating_rink",
  "climbing_gym",
  "fitness_center",
  "school",
  "university",
];

export default function AddFacilitySidebar({
  isOpen,
  onClose,
  onSuccess,
}: AddFacilitySidebarProps) {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    place_id: "",
    name: "",
    address: "",
    phone: "",
    website: "",
    location: null,
  });

  const [selectedSportTypes, setSelectedSportTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<FacilityTag[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [enableSerpApiEnrichment, setEnableSerpApiEnrichment] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showTagSection, setShowTagSection] = useState(false);
  const [showSportTypeDropdown, setShowSportTypeDropdown] = useState(false);

  // Tags
  const [allTags, setAllTags] = useState<FacilityTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Available sport types
  const allSportTypes = getAllSportTypes();

  // Fetch all tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true);
      try {
        const { data, error } = await supabase
          .from("facility_tags")
          .select("*")
          .order("name", { ascending: true });

        if (error) throw error;
        setAllTags(data || []);
      } catch (error) {
        console.error("Error fetching tags:", error);
      } finally {
        setLoadingTags(false);
      }
    };

    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        place_id: "",
        name: "",
        address: "",
        phone: "",
        website: "",
        location: null,
      });
      setSelectedSportTypes([]);
      setSelectedTags([]);
      setNotes([]);
      setNoteInput("");
      setEnableSerpApiEnrichment(false);
      setError(null);
      setEnrichmentProgress(null);
      setShowTagSection(false);
      setShowSportTypeDropdown(false);
    }
  }, [isOpen]);

  const handleGeneratePlaceId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    setFormData({ ...formData, place_id: `custom_${timestamp}_${random}` });
  };

  const handleToggleSportType = (sportType: string) => {
    setSelectedSportTypes((prev) =>
      prev.includes(sportType)
        ? prev.filter((t) => t !== sportType)
        : [...prev, sportType]
    );
  };

  const handleToggleTag = (tag: FacilityTag) => {
    setSelectedTags((prev) =>
      prev.find((t) => t.id === tag.id)
        ? prev.filter((t) => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    setNotes((prev) => [...prev, { text: noteInput.trim() }]);
    setNoteInput("");
  };

  const handleRemoveNote = (index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!formData.place_id.trim()) {
      return "Place ID is required (click Generate Place ID)";
    }
    if (!formData.name.trim()) {
      return "Facility name is required";
    }
    if (!formData.address.trim()) {
      return "Address is required";
    }
    if (!formData.location || !formData.location.lat || !formData.location.lng) {
      return "Location coordinates (latitude and longitude) are required";
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setEnrichmentProgress("Creating facility...");

      // Check if place already exists
      const { data: existing, error: existingError } = await supabase
        .from("sports_facilities")
        .select("place_id")
        .eq("place_id", formData.place_id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        setError("This facility already exists in the database");
        setIsSaving(false);
        setEnrichmentProgress(null);
        return;
      }

      // Insert facility
      const { data: facility, error: facilityError } = await supabase
        .from("sports_facilities")
        .insert({
          place_id: formData.place_id,
          name: formData.name,
          address: formData.address,
          location: formData.location
            ? `SRID=4326;POINT(${formData.location.lng} ${formData.location.lat})`
            : null,
          phone: formData.phone || null,
          website: formData.website || null,
          sport_types: selectedSportTypes,
        })
        .select()
        .single();

      if (facilityError) throw facilityError;

      // Insert tag assignments
      if (selectedTags.length > 0) {
        setEnrichmentProgress("Assigning tags...");
        const tagAssignments = selectedTags.map((tag) => ({
          place_id: facility.place_id,
          tag_id: tag.id,
        }));

        const { error: tagsError } = await supabase
          .from("facility_tag_assignments")
          .insert(tagAssignments);

        if (tagsError) throw tagsError;
      }

      // Insert notes
      if (notes.length > 0) {
        setEnrichmentProgress("Adding notes...");
        const noteInserts = notes.map((note) => ({
          place_id: facility.place_id,
          note_text: note.text,
        }));

        const { error: notesError } = await supabase
          .from("facility_notes")
          .insert(noteInserts);

        if (notesError) throw notesError;
      }

      // Optional SerpAPI Enrichment
      if (enableSerpApiEnrichment && formData.location) {
        setEnrichmentProgress("🔄 Starting SerpAPI enrichment...");

        try {
          const enrichmentResponse = await fetch("/api/enrich-facility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              facilityId: facility.id,
              placeId: facility.place_id,
              facilityName: facility.name,
              facilityAddress: facility.address,
              lat: formData.location.lat,
              lng: formData.location.lng,
            }),
          });

          const enrichmentResult = await enrichmentResponse.json();

          if (enrichmentResult.success) {
            setEnrichmentProgress(
              `✅ Enrichment complete! ${enrichmentResult.photosUploaded} photos, ${enrichmentResult.reviewsCollected} reviews collected`
            );
            // Wait a moment to show the success message
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } else {
            console.error("Enrichment failed:", enrichmentResult.error);
            setEnrichmentProgress("⚠️ Enrichment failed, but facility was created");
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (enrichError) {
          console.error("Enrichment error:", enrichError);
          setEnrichmentProgress("⚠️ Enrichment failed, but facility was created");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Invalidate queries to refresh facility list
      queryClient.invalidateQueries({ queryKey: ["facilities"] });

      // Success callback
      onSuccess(facility.place_id);
      onClose();
    } catch (error: any) {
      console.error("Error creating facility:", error);
      setError(error.message || "Failed to create facility. Please try again.");
    } finally {
      setIsSaving(false);
      setEnrichmentProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-[1vh] right-4 h-[98vh] w-full md:w-[500px] bg-white shadow-2xl rounded-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 z-20 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Add New Facility</h2>
            <p className="text-blue-100 text-sm mt-1">
              Enter facility details to add to your CRM
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Place ID Generator */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Place ID <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.place_id}
                onChange={(e) =>
                  setFormData({ ...formData, place_id: e.target.value })
                }
                placeholder="Click button to generate..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly
              />
              <button
                type="button"
                onClick={handleGeneratePlaceId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Auto-generate a unique identifier for this facility
            </p>
          </div>

          {/* Facility Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Facility Details
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter facility name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Enter full address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Website
                </label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Latitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.location?.lat || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: {
                        lat: parseFloat(e.target.value) || 0,
                        lng: formData.location?.lng || 0,
                      },
                    })
                  }
                  placeholder="e.g., 40.7128"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Longitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.location?.lng || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: {
                        lat: formData.location?.lat || 0,
                        lng: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  placeholder="e.g., -74.0060"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {formData.location && formData.location.lat !== 0 && formData.location.lng !== 0 && (
              <div className="text-xs text-slate-500">
                📍 Location: {formData.location.lat.toFixed(6)},{" "}
                {formData.location.lng.toFixed(6)}
              </div>
            )}
          </div>

          {/* Sport Types */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Sport/Facility Types
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowSportTypeDropdown(!showSportTypeDropdown)
                }
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-left bg-white hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <span className="text-slate-700">
                  {selectedSportTypes.length > 0
                    ? `${selectedSportTypes.length} selected`
                    : "Select types..."}
                </span>
                <Plus
                  className={`w-4 h-4 transition-transform ${showSportTypeDropdown ? "rotate-45" : ""}`}
                />
              </button>

              {showSportTypeDropdown && (
                <div className="absolute z-10 mt-2 w-full bg-white border border-slate-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {FACILITY_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSportTypes.includes(type)}
                        onChange={() => handleToggleSportType(type)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">
                        {type.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {selectedSportTypes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedSportTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium"
                  >
                    {type.replace(/_/g, " ")}
                    <button
                      onClick={() => handleToggleSportType(type)}
                      className="hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200"></div>

          {/* Tags Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <TagIcon className="w-4 h-4" />
                Tags
              </label>
              <button
                onClick={() => setShowTagSection(!showTagSection)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showTagSection ? "Hide" : "Show"}
              </button>
            </div>

            {showTagSection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {loadingTags ? (
                  <div className="text-sm text-slate-500">
                    Loading tags...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                    {allTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.some((t) => t.id === tag.id)}
                          onChange={() => handleToggleTag(tag)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border"
                        style={{
                          color: tag.color,
                          borderColor: tag.color,
                          backgroundColor: `${tag.color}15`,
                        }}
                      >
                        {tag.name}
                        <button
                          onClick={() => handleToggleTag(tag)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              Notes
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  placeholder="Add a note..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((note, index) => (
                    <div
                      key={index}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start justify-between gap-2"
                    >
                      <p className="text-sm text-slate-700 flex-1">
                        {note.text}
                      </p>
                      <button
                        onClick={() => handleRemoveNote(index)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200"></div>

          {/* SerpAPI Enrichment Option */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="enableSerpApi"
                checked={enableSerpApiEnrichment}
                onChange={(e) =>
                  setEnableSerpApiEnrichment(e.target.checked)
                }
                disabled={isSaving}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label
                  htmlFor="enableSerpApi"
                  className="font-medium text-sm text-slate-900 cursor-pointer"
                >
                  Scrape photos and reviews from SerpAPI
                </label>
                <p className="text-xs text-slate-600 mt-1">
                  This will fetch all available photos and reviews from
                  Google Maps, analyze them for sports, and assign the
                  "Scraped by SerpAPI" tag. This process may take 1-2
                  minutes.
                </p>
                {enableSerpApiEnrichment && (
                  <div className="mt-3 p-3 bg-white border border-blue-300 rounded-lg text-xs text-blue-900">
                    <div className="font-semibold mb-1">
                      📋 What will be scraped:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>Up to 40 high-quality photos</li>
                      <li>Up to 58 detailed reviews</li>
                      <li>Automatic sport identification from reviews</li>
                      <li>Photos will be uploaded to secure storage</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          {isSaving && enrichmentProgress && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>{enrichmentProgress}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.place_id}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Facility
              </>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
