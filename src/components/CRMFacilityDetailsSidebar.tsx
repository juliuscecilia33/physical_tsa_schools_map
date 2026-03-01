"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Phone,
  Globe,
  Mail,
  Clock,
  Star,
  StarHalf,
  CheckCircle2,
  XCircle,
  StickyNote,
  Plus,
  Edit2,
  Trash2,
  Save,
  XCircle as XIcon,
  Camera,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Tag,
  Map,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  updateFacilityNotesFlag,
  updateFacilityTags,
} from "@/utils/facilityCache";
import { useFacilityDetails } from "@/hooks/useFacilityDetails";
import { Note, FacilityTag } from "@/types/facility";
import SportDetailModal from "@/components/SportDetailModal";
import TagManagerModal from "@/components/TagManagerModal";

interface CRMFacilityDetailsSidebarProps {
  placeId: string | null;
  onClose: () => void;
}

// Sport emoji mapping
const SPORT_EMOJIS: { [key: string]: string } = {
  // Core Sports
  Basketball: "🏀",
  Soccer: "⚽",
  Baseball: "⚾",
  Football: "🏈",
  Tennis: "🎾",
  Volleyball: "🏐",
  Swimming: "🏊",
  "Track & Field": "🏃",

  // Extended Sports
  Golf: "⛳",
  Hockey: "🏒",
  Lacrosse: "🥍",
  Softball: "🥎",
  Wrestling: "🤼",
  Gymnastics: "🤸",
  Pickleball: "🏓",
  Racquetball: "🎾",
  Squash: "🎾",
  Badminton: "🏸",

  // Fitness Activities
  "Gym/Fitness": "💪",
  CrossFit: "🏋️",
  Yoga: "🧘",
  Pilates: "🧘‍♀️",
  "Martial Arts": "🥋",
  Boxing: "🥊",

  // Other Sports
  Bowling: "🎳",
  Skating: "⛸️",
  Climbing: "🧗",
  "Water Sports": "🚣",
};

// Facility type emoji mapping
const FACILITY_TYPE_EMOJIS: { [key: string]: string } = {
  // Facilities
  gym: "💪",
  stadium: "🏟️",
  park: "🏞️",
  sports_complex: "🏢",
  recreation_center: "🎯",
  swimming_pool: "🏊",
  aquatic_center: "🌊",

  // Courts
  basketball_court: "🏀",
  tennis_court: "🎾",
  volleyball_court: "🏐",
  racquetball_court: "🎾",
  squash_court: "🎾",

  // Fields
  soccer_field: "⚽",
  baseball_field: "⚾",
  football_field: "🏈",
  athletic_field: "🏃",
  track: "🏃",

  // Other
  bowling_alley: "🎳",
  golf_course: "⛳",
  skating_rink: "⛸️",
  ice_rink: "⛸️",
  climbing_gym: "🧗",
  fitness_center: "🏋️",
  health_club: "🏋️",
  school: "🏫",
  university: "🎓",
};

export default function CRMFacilityDetailsSidebar({
  placeId,
  onClose,
}: CRMFacilityDetailsSidebarProps) {
  const supabase = createClient(); // SSR-compatible Supabase client
  const queryClient = useQueryClient();
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch full facility details including reviews and additional data
  const { data: facility, isLoading: isLoadingDetails } = useFacilityDetails(
    placeId || null,
    !!placeId
  );

  const [loadingImages, setLoadingImages] = useState<{
    [key: string]: boolean;
  }>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const photoScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const additionalPhotoScrollRef = useRef<HTMLDivElement>(null);
  const [showAdditionalLeftArrow, setShowAdditionalLeftArrow] = useState(false);
  const [showAdditionalRightArrow, setShowAdditionalRightArrow] =
    useState(false);
  const reviewImageScrollRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [reviewImageArrowVisibility, setReviewImageArrowVisibility] = useState<{
    [key: number]: { left: boolean; right: boolean };
  }>({});
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoViewerSource, setPhotoViewerSource] = useState<
    "regular" | "additional" | "review"
  >("regular");
  const [selectedReviewIndex, setSelectedReviewIndex] = useState(0);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [isAdditionalPhotosModalOpen, setIsAdditionalPhotosModalOpen] =
    useState(false);
  const [isAdditionalReviewsModalOpen, setIsAdditionalReviewsModalOpen] =
    useState(false);
  const [showAllAdditionalReviews, setShowAllAdditionalReviews] =
    useState(false);
  const [selectedSportDetail, setSelectedSportDetail] = useState<string | null>(
    null
  );

  // Tag-related state
  const [allTags, setAllTags] = useState<FacilityTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isTagManagementModalOpen, setIsTagManagementModalOpen] =
    useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#004aad");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [editTagDescription, setEditTagDescription] = useState("");
  const [assigningTag, setAssigningTag] = useState(false);
  const [facilityTags, setFacilityTags] = useState<FacilityTag[]>([]);
  const [showCreateTagSection, setShowCreateTagSection] = useState(false);
  const [showManageTagsSection, setShowManageTagsSection] = useState(false);

  // Current user state
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email?: string;
    display_name?: string;
    avatar_url?: string;
  } | null>(null);

  // Predefined color palette for tags
  const TAG_COLORS = [
    { name: "TSA Blue", value: "#004aad" },
    { name: "Green", value: "#10b981" },
    { name: "Yellow", value: "#f59e0b" },
    { name: "Red", value: "#ef4444" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Orange", value: "#f97316" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Gray", value: "#6b7280" },
  ];

  // Fetch current user on mount and listen to auth changes
  useEffect(() => {
    // Initial session fetch
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name,
          avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
        });
      }
    };
    initSession();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only update user state if we have a session, or if user explicitly signed out
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name,
          avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
        });
      } else if (_event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
  }, [facility?.place_id]);

  // Sync facility tags from facility when it changes
  useEffect(() => {
    if (facility) {
      setFacilityTags(facility.tags || []);
    }
  }, [facility?.place_id, !!facility]);

  // Fetch all tags on component mount
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

    fetchTags();
  }, []);

  // Add new note
  const handleAddNote = async () => {
    if (!newNoteText.trim() || !facility) return;

    setAddingNote(true);

    // Check if user is logged in
    if (!currentUser) {
      alert("You must be logged in to create a note.");
      setAddingNote(false);
      return;
    }

    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      place_id: facility.place_id,
      note_text: newNoteText,
      created_by: currentUser.id,
      user_display_name: currentUser.display_name || null,
      user_avatar_url: currentUser.avatar_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    setNotes((prev) => [tempNote, ...prev]);
    setNewNoteText("");

    try {
      const { data, error } = await supabase
        .from("facility_notes")
        .insert({
          place_id: facility.place_id,
          note_text: newNoteText,
          created_by: currentUser.id,
          user_display_name: currentUser.display_name,
          user_avatar_url: currentUser.avatar_url,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp note with real note from database
      setNotes((prev) => prev.map((n) => (n.id === tempNote.id ? data : n)));

      // Update cache to reflect that this facility now has notes
      updateFacilityNotesFlag(queryClient, facility.place_id, true);

      // Invalidate full facility details query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ["facility", "full", facility.place_id],
      });

      // Close the form after successful add
      setShowAddNoteForm(false);
    } catch (error) {
      console.error("Error adding note:", error);
      // Revert optimistic update
      setNotes((prev) => prev.filter((n) => n.id !== tempNote.id));
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
    if (!facility) return;

    const oldNote = notes.find((n) => n.id === noteId);
    if (!oldNote) return;

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              note_text: editNoteText,
              updated_at: new Date().toISOString(),
            }
          : n
      )
    );
    setEditingNoteId(null);

    try {
      const { error } = await supabase
        .from("facility_notes")
        .update({ note_text: editNoteText })
        .eq("id", noteId);

      if (error) throw error;

      // Invalidate full facility details query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ["facility", "full", facility.place_id],
      });
    } catch (error) {
      console.error("Error updating note:", error);
      // Revert optimistic update
      setNotes((prev) => prev.map((n) => (n.id === noteId ? oldNote : n)));
      alert("Failed to update note. Please try again.");
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    const deletedNote = notes.find((n) => n.id === noteId);
    if (!deletedNote || !facility) return;

    // Optimistic update
    const remainingNotes = notes.filter((n) => n.id !== noteId);
    setNotes(remainingNotes);

    // Update cache if this was the last note
    if (remainingNotes.length === 0) {
      updateFacilityNotesFlag(queryClient, facility.place_id, false);
    }

    try {
      const { error } = await supabase
        .from("facility_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      // Invalidate full facility details query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ["facility", "full", facility.place_id],
      });
    } catch (error) {
      console.error("Error deleting note:", error);
      // Revert optimistic update
      setNotes((prev) =>
        [...prev, deletedNote].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      // Revert cache update
      updateFacilityNotesFlag(queryClient, facility.place_id, true);
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

  // Create new tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setCreatingTag(true);
    const tempTag: FacilityTag = {
      id: `temp-${Date.now()}`,
      name: newTagName,
      color: newTagColor,
      description: newTagDescription,
    };

    // Optimistic update
    setAllTags((prev) =>
      [...prev, tempTag].sort((a, b) => a.name.localeCompare(b.name))
    );
    setNewTagName("");
    setNewTagDescription("");
    setNewTagColor("#004aad");

    try {
      const { data, error } = await supabase
        .from("facility_tags")
        .insert({
          name: newTagName,
          color: newTagColor,
          description: newTagDescription || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp tag with real tag
      setAllTags((prev) =>
        prev
          .map((t) => (t.id === tempTag.id ? data : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error("Error creating tag:", error);
      // Revert optimistic update
      setAllTags((prev) => prev.filter((t) => t.id !== tempTag.id));
      alert("Failed to create tag. Please try again.");
    } finally {
      setCreatingTag(false);
    }
  };

  // Start editing a tag
  const handleStartEditTag = (tag: FacilityTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || "");
  };

  // Cancel editing tag
  const handleCancelEditTag = () => {
    setEditingTagId(null);
    setEditTagName("");
    setEditTagColor("");
    setEditTagDescription("");
  };

  // Save edited tag
  const handleSaveEditTag = async (tagId: string) => {
    if (!editTagName.trim()) return;

    const oldTag = allTags.find((t) => t.id === tagId);
    if (!oldTag) return;

    // Optimistic update
    setAllTags((prev) =>
      prev
        .map((t) =>
          t.id === tagId
            ? {
                ...t,
                name: editTagName,
                color: editTagColor,
                description: editTagDescription,
              }
            : t
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingTagId(null);

    try {
      const { error } = await supabase
        .from("facility_tags")
        .update({
          name: editTagName,
          color: editTagColor,
          description: editTagDescription || null,
        })
        .eq("id", tagId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating tag:", error);
      // Revert optimistic update
      setAllTags((prev) => prev.map((t) => (t.id === tagId ? oldTag : t)));
      alert("Failed to update tag. Please try again.");
    }
  };

  // Delete tag
  const handleDeleteTag = async (tagId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this tag? It will be removed from all facilities."
      )
    )
      return;

    const deletedTag = allTags.find((t) => t.id === tagId);
    if (!deletedTag) return;

    // Optimistic update
    setAllTags((prev) => prev.filter((t) => t.id !== tagId));

    try {
      const { error } = await supabase
        .from("facility_tags")
        .delete()
        .eq("id", tagId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting tag:", error);
      // Revert optimistic update
      setAllTags((prev) =>
        [...prev, deletedTag].sort((a, b) => a.name.localeCompare(b.name))
      );
      alert("Failed to delete tag. Please try again.");
    }
  };

  // Assign tag to facility
  const handleAssignTag = async (tagId: string) => {
    if (!facility) return;

    setAssigningTag(true);
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag) return;

    // Optimistic update to local state
    setFacilityTags((prev) => [...prev, tag]);

    try {
      const { error } = await supabase.from("facility_tag_assignments").insert({
        place_id: facility.place_id,
        tag_id: tagId,
      });

      if (error) throw error;

      // Update cache with new tags
      const updatedTags = [...facilityTags, tag];
      updateFacilityTags(queryClient, facility.place_id, updatedTags);

      // Refetch full facility details query to get fresh data immediately
      await queryClient.refetchQueries({
        queryKey: ["facility", "full", facility.place_id],
        exact: true,
      });
    } catch (error) {
      console.error("Error assigning tag:", error);
      // Revert optimistic update on error
      setFacilityTags((prev) => prev.filter((t) => t.id !== tagId));
      alert("Failed to assign tag. Please try again.");
    } finally {
      setAssigningTag(false);
    }
  };

  // Remove tag from facility
  const handleRemoveTag = async (tagId: string) => {
    if (!facility) return;

    const tag = facilityTags.find((t) => t.id === tagId);
    if (!tag) return;

    // Optimistic update to local state
    setFacilityTags((prev) => prev.filter((t) => t.id !== tagId));

    // Update cache optimistically
    const updatedTags = facilityTags.filter((t) => t.id !== tagId);
    updateFacilityTags(queryClient, facility.place_id, updatedTags);

    // Refetch full facility details query to get fresh data immediately
    await queryClient.refetchQueries({
      queryKey: ["facility", "full", facility.place_id],
      exact: true,
    });

    try {
      const { error } = await supabase
        .from("facility_tag_assignments")
        .delete()
        .eq("place_id", facility.place_id)
        .eq("tag_id", tagId);

      if (error) throw error;
    } catch (error) {
      console.error("Error removing tag:", error);
      // Revert optimistic update to local state
      setFacilityTags((prev) =>
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))
      );
      // Revert cache update
      const revertedTags = updatedTags.concat(tag);
      updateFacilityTags(queryClient, facility.place_id, revertedTags);
      alert("Failed to remove tag. Please try again.");
    }
  };

  // Navigate to map view and focus on this facility
  const handleViewOnMap = () => {
    if (facility) {
      router.push(`/?focus=${facility.place_id}`);
    }
  };

  const getPhotoUrl = (photoReference: string, highRes: boolean = false) => {
    const maxWidth = highRes ? 1600 : 400;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  };

  const getPhotoDataUrl = (
    photoData: {
      image?: string;
      url?: string;
      thumbnail: string;
      video?: string;
    },
    highRes: boolean = false
  ) => {
    const fullResUrl = photoData.image || photoData.url || photoData.thumbnail;
    return highRes ? fullResUrl : photoData.thumbnail;
  };

  // Combine scraped photos with review photos
  const combinedPhotos = useMemo(() => {
    if (!facility?.serp_scraped) return [];

    const photos: Array<{
      url: string;
      type: "scraped" | "review";
      reviewIndex?: number;
      photoIndexInReview?: number;
      scrapedIndex?: number;
      data?: any;
      reviewUserThumbnail?: string;
      reviewUserName?: string;
      reviewRating?: number;
    }> = [];

    // Add all scraped photos first
    if (facility.additional_photos) {
      facility.additional_photos.forEach((photoData, idx) => {
        photos.push({
          url: getPhotoDataUrl(photoData),
          type: "scraped",
          scrapedIndex: idx,
          data: photoData,
        });
      });
    }

    // Add all review photos
    if (facility.additional_reviews) {
      facility.additional_reviews.forEach((review, reviewIdx) => {
        if (review.images && review.images.length > 0) {
          review.images.forEach((imageUrl, photoIdx) => {
            photos.push({
              url: imageUrl,
              type: "review",
              reviewIndex: reviewIdx,
              photoIndexInReview: photoIdx,
              reviewUserThumbnail: review.user?.thumbnail,
              reviewUserName: review.user?.name || review.author_name || "Anonymous",
              reviewRating: review.rating,
            });
          });
        }
      });
    }

    return photos;
  }, [facility?.additional_photos, facility?.additional_reviews]);

  const formatSportType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getCityState = (address: string): string => {
    // Typical Google Places format: "Street, City, State ZIP, Country"
    // Example: "123 Main St, Tyler, TX 75701, USA"
    const parts = address.split(", ");

    if (parts.length >= 3) {
      const city = parts[parts.length - 3];
      const stateZip = parts[parts.length - 2];

      // Extract state abbreviation (first two letters before the ZIP)
      const stateMatch = stateZip.match(/^([A-Z]{2})/);

      if (stateMatch) {
        return `${city}, ${stateMatch[1]}`;
      }
    }

    return "";
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className="w-4 h-4 fill-yellow-400 text-yellow-400"
        />
      );
    }
    if (hasHalfStar) {
      stars.push(
        <StarHalf
          key="half"
          className="w-4 h-4 fill-yellow-400 text-yellow-400"
        />
      );
    }
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <Star key={`empty-${i}`} className="w-4 h-4 text-slate-300" />
      );
    }
    return stars;
  };

  const handleImageLoad = (idx: number | string) => {
    setLoadingImages((prev) => ({ ...prev, [idx]: false }));
  };

  const handleImageLoadStart = (idx: number | string) => {
    setLoadingImages((prev) => ({ ...prev, [idx]: true }));
  };

  // Handle photo scroll
  const scrollPhotos = (direction: "left" | "right") => {
    if (!photoScrollRef.current) return;
    const scrollAmount = 300; // Approximate width of one photo
    const newScrollLeft =
      photoScrollRef.current.scrollLeft +
      (direction === "right" ? scrollAmount : -scrollAmount);
    photoScrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  // Update arrow visibility based on scroll position
  const updatePhotoArrows = () => {
    if (!photoScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = photoScrollRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // Handle additional photo scroll
  const scrollAdditionalPhotos = (direction: "left" | "right") => {
    if (!additionalPhotoScrollRef.current) return;
    const scrollAmount = 300;
    const newScrollLeft =
      additionalPhotoScrollRef.current.scrollLeft +
      (direction === "right" ? scrollAmount : -scrollAmount);
    additionalPhotoScrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  // Update additional photo arrow visibility based on scroll position
  const updateAdditionalPhotoArrows = () => {
    if (!additionalPhotoScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } =
      additionalPhotoScrollRef.current;
    setShowAdditionalLeftArrow(scrollLeft > 0);
    setShowAdditionalRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // Handle review images scroll
  const scrollReviewImages = (reviewIndex: number, direction: "left" | "right") => {
    const ref = reviewImageScrollRefs.current[reviewIndex];
    if (!ref) return;
    const scrollAmount = 200; // Smaller scroll for review images
    const newScrollLeft =
      ref.scrollLeft + (direction === "right" ? scrollAmount : -scrollAmount);
    ref.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  // Update review image arrow visibility for a specific review
  const updateReviewImageArrows = (reviewIndex: number) => {
    const ref = reviewImageScrollRefs.current[reviewIndex];
    if (!ref) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref;
    setReviewImageArrowVisibility((prev) => ({
      ...prev,
      [reviewIndex]: {
        left: scrollLeft > 0,
        right: scrollLeft < scrollWidth - clientWidth - 1,
      },
    }));
  };

  // Update all review image arrows
  const updateAllReviewImageArrows = () => {
    Object.keys(reviewImageScrollRefs.current).forEach((key) => {
      updateReviewImageArrows(parseInt(key));
    });
  };

  // Update arrows when photos are loaded or facility changes
  useEffect(() => {
    updatePhotoArrows();
    const scrollContainer = photoScrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updatePhotoArrows);
      // Also update on window resize
      window.addEventListener("resize", updatePhotoArrows);
      return () => {
        scrollContainer.removeEventListener("scroll", updatePhotoArrows);
        window.removeEventListener("resize", updatePhotoArrows);
      };
    }
  }, [facility]);

  // Update arrows for additional photos when loaded or facility changes
  useEffect(() => {
    updateAdditionalPhotoArrows();
    const scrollContainer = additionalPhotoScrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateAdditionalPhotoArrows);
      window.addEventListener("resize", updateAdditionalPhotoArrows);
      return () => {
        scrollContainer.removeEventListener(
          "scroll",
          updateAdditionalPhotoArrows
        );
        window.removeEventListener("resize", updateAdditionalPhotoArrows);
      };
    }
  }, [facility]);

  // Update arrows for review images when reviews change
  useEffect(() => {
    // Initial update for all review image galleries
    updateAllReviewImageArrows();

    // Attach scroll and resize listeners to all review image containers
    const listeners: Array<{ ref: HTMLDivElement; reviewIndex: number }> = [];
    Object.entries(reviewImageScrollRefs.current).forEach(([key, ref]) => {
      if (ref) {
        const reviewIndex = parseInt(key);
        const scrollHandler = () => updateReviewImageArrows(reviewIndex);
        ref.addEventListener("scroll", scrollHandler);
        window.addEventListener("resize", scrollHandler);
        listeners.push({ ref, reviewIndex });
      }
    });

    // Cleanup
    return () => {
      listeners.forEach(({ ref, reviewIndex }) => {
        const scrollHandler = () => updateReviewImageArrows(reviewIndex);
        ref.removeEventListener("scroll", scrollHandler);
        window.removeEventListener("resize", scrollHandler);
      });
    };
  }, [facility?.additional_reviews]);

  // Photo viewer handlers
  const openPhotoViewer = (
    index: number,
    source: "regular" | "additional" = "regular"
  ) => {
    setSelectedPhotoIndex(index);
    setPhotoViewerSource(source);
    setIsPhotoViewerOpen(true);
  };

  const openReviewPhotoViewer = (reviewIndex: number, photoIndex: number) => {
    setSelectedReviewIndex(reviewIndex);
    setSelectedPhotoIndex(photoIndex);
    setPhotoViewerSource("review");
    setIsPhotoViewerOpen(true);
  };

  const closePhotoViewer = () => {
    setIsPhotoViewerOpen(false);
  };

  const goToNextPhoto = () => {
    let photos;
    if (photoViewerSource === "regular") {
      photos = facility?.photo_references;
    } else if (photoViewerSource === "additional") {
      photos = facility?.additional_photos;
    } else if (photoViewerSource === "review") {
      photos = facility?.additional_reviews?.[selectedReviewIndex]?.images;
    }
    if (!photos) return;
    const totalPhotos = photos.length;
    setSelectedPhotoIndex((prev) => (prev < totalPhotos - 1 ? prev + 1 : prev));
  };

  const goToPrevPhoto = () => {
    setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  // Keyboard navigation for photo viewer
  useEffect(() => {
    if (!isPhotoViewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePhotoViewer();
      if (e.key === "ArrowRight") goToNextPhoto();
      if (e.key === "ArrowLeft") goToPrevPhoto();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoViewerOpen, selectedPhotoIndex, facility]);

  // Don't render if no placeId
  if (!placeId) return null;

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
        />

        {/* Sidebar */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white shadow-2xl z-[60] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between z-10">
            <div className="flex-1 pr-4">
              {isLoadingDetails ? (
                <div className="space-y-2">
                  <div className="h-6 w-48 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                </div>
              ) : facility ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900 leading-tight">
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
                  {getCityState(facility.address) && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {getCityState(facility.address)}
                      </span>
                    </div>
                  )}
                  {facility.rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {renderStars(facility.rating)}
                      </div>
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {facility.rating.toFixed(1)}
                      </span>
                      <span className="text-sm text-slate-500 tabular-nums">
                        ({facility.user_ratings_total} reviews)
                      </span>
                    </div>
                  )}

                  {/* View on Map Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleViewOnMap}
                    className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer"
                  >
                    <Map className="w-4 h-4" />
                    <span>View on Map</span>
                  </motion.button>
                </>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
          >
            {isLoadingDetails ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm text-slate-600">Loading facility details...</p>
              </div>
            ) : facility ? (
              <>
                {/* Photos - only show if no scraped photos available */}
                {facility.photo_references &&
                facility.photo_references.length > 0 &&
                (!facility.serp_scraped || combinedPhotos.length === 0) ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 tracking-wide">
                        Photos{" "}
                        <span className="text-slate-500 tabular-nums">
                          ({facility.photo_references.length})
                        </span>
                      </h3>
                      <button
                        onClick={() => setIsPhotosModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Expand
                      </button>
                    </div>
                    <div className="relative group/photos">
                      {/* Left Arrow */}
                      {showLeftArrow && (
                        <button
                          onClick={() => scrollPhotos("left")}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/photos:opacity-100 cursor-pointer"
                          aria-label="Scroll left"
                        >
                          <ChevronLeft className="w-6 h-6 text-slate-700" />
                        </button>
                      )}

                      {/* Right Arrow */}
                      {showRightArrow && (
                        <button
                          onClick={() => scrollPhotos("right")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/photos:opacity-100 cursor-pointer"
                          aria-label="Scroll right"
                        >
                          <ChevronRight className="w-6 h-6 text-slate-700" />
                        </button>
                      )}

                      {/* Scrollable Photo Container */}
                      <div
                        ref={photoScrollRef}
                        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                      >
                        {facility.photo_references.map((photoRef, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + Math.min(idx * 0.05, 0.5) }}
                            onClick={() => openPhotoViewer(idx)}
                            className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer flex-shrink-0 snap-start"
                            style={{ width: "280px", height: "180px" }}
                          >
                            {loadingImages[idx] !== false && (
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                            )}
                            <img
                              src={getPhotoUrl(photoRef)}
                              alt={`${facility.name} photo ${idx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                              onLoadStart={() => handleImageLoadStart(idx)}
                              onLoad={() => handleImageLoad(idx)}
                              onError={() => handleImageLoad(idx)}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  (!facility.serp_scraped || combinedPhotos.length === 0) && (
                    <div className="text-center py-12">
                      <Camera className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No photos available</p>
                    </div>
                  )
                )}

                {/* Scraped Photos (from SerpAPI) */}
                {facility.serp_scraped && combinedPhotos.length > 0 && (
                    <>
                      {/* Divider */}
                      <div className="border-t border-slate-200"></div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
                            Scraped Photos ({combinedPhotos.length})
                          </h3>
                          <button
                            onClick={() => setIsAdditionalPhotosModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Expand
                          </button>
                        </div>
                        <div className="relative group/additional-photos">
                          {/* Left Arrow */}
                          {showAdditionalLeftArrow && (
                            <button
                              onClick={() => scrollAdditionalPhotos("left")}
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/additional-photos:opacity-100 cursor-pointer"
                              aria-label="Scroll left"
                            >
                              <ChevronLeft className="w-6 h-6 text-slate-700" />
                            </button>
                          )}

                          {/* Right Arrow */}
                          {showAdditionalRightArrow && (
                            <button
                              onClick={() => scrollAdditionalPhotos("right")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/additional-photos:opacity-100 cursor-pointer"
                              aria-label="Scroll right"
                            >
                              <ChevronRight className="w-6 h-6 text-slate-700" />
                            </button>
                          )}

                          {/* Scrollable Photo Container */}
                          <div
                            ref={additionalPhotoScrollRef}
                            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
                            style={{
                              scrollbarWidth: "none",
                              msOverflowStyle: "none",
                            }}
                          >
                            {combinedPhotos.map((photo, idx) => (
                              <motion.div
                                key={`combined-${idx}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  delay: 0.1 + Math.min(idx * 0.05, 0.5),
                                }}
                                onClick={() => {
                                  if (photo.type === "review") {
                                    openReviewPhotoViewer(
                                      photo.reviewIndex!,
                                      photo.photoIndexInReview!
                                    );
                                  } else {
                                    openPhotoViewer(photo.scrapedIndex!, "additional");
                                  }
                                }}
                                className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer flex-shrink-0 snap-start"
                                style={{ width: "280px", height: "180px" }}
                              >
                                {loadingImages[`combined-${idx}`] !== false && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                )}
                                <img
                                  src={photo.url}
                                  alt={`${facility.name} photo ${idx + 1}`}
                                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                                  referrerPolicy="no-referrer"
                                  onLoadStart={() =>
                                    handleImageLoadStart(`combined-${idx}`)
                                  }
                                  onLoad={() => handleImageLoad(`combined-${idx}`)}
                                  onError={() => handleImageLoad(`combined-${idx}`)}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                                {photo.type === "scraped" && photo.data?.video && (
                                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5">
                                    <Camera className="w-4 h-4 text-white" />
                                  </div>
                                )}
                                {photo.type === "review" && (
                                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                                    {photo.reviewUserThumbnail ? (
                                      <img
                                        src={photo.reviewUserThumbnail}
                                        alt={photo.reviewUserName}
                                        className="w-8 h-8 rounded-full border-2 border-white shadow-lg object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg bg-slate-400 flex items-center justify-center text-white text-xs font-semibold">
                                        {photo.reviewUserName?.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    {photo.reviewRating && (
                                      <div className="bg-white/95 backdrop-blur-sm rounded-lg px-1.5 py-0.5 shadow-lg flex items-center gap-0.5">
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-semibold text-slate-900">
                                          {photo.reviewRating.toFixed(1)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Notes Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
                      <StickyNote className="w-4 h-4" />
                      Notes ({notes.length})
                    </h3>
                    <div className="flex gap-2">
                      {!showAddNoteForm && (
                        <button
                          onClick={() => setShowAddNoteForm(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Note
                        </button>
                      )}
                      {notes.length > 3 && (
                        <button
                          onClick={() => setShowAllNotes(!showAllNotes)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {showAllNotes ? "Show Less" : "See All"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add New Note Form */}
                  {showAddNoteForm && (
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <textarea
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                          rows={2}
                          disabled={addingNote}
                          autoFocus
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleAddNote}
                          disabled={!newNoteText.trim() || addingNote}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{addingNote ? "Adding..." : "Add Note"}</span>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setShowAddNoteForm(false);
                            setNewNoteText("");
                          }}
                          disabled={addingNote}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* Notes List */}
                  {loadingNotes ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : notes.length === 0 ? (
                    <div className="text-center py-6 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-100">
                      <StickyNote className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No notes yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes
                        .slice(0, showAllNotes ? notes.length : 3)
                        .map((note, idx) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                            className="bg-gradient-to-br from-white to-slate-50/50 rounded-2xl p-3 shadow-sm border border-slate-100"
                          >
                            {editingNoteId === note.id ? (
                              // Edit Mode
                              <div className="space-y-2">
                                <textarea
                                  value={editNoteText}
                                  onChange={(e) => setEditNoteText(e.target.value)}
                                  className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleSaveEdit(note.id)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-medium cursor-pointer"
                                  >
                                    <Save className="w-3 h-3" />
                                    Save
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleCancelEdit}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                                  >
                                    <XIcon className="w-3 h-3" />
                                    Cancel
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <>
                                <p className="text-sm text-slate-700 leading-relaxed mb-2">
                                  {note.note_text}
                                </p>

                                {/* Creator Info and Actions */}
                                <div className="flex items-center justify-between">
                                  {/* Avatar, name, and timestamp in one row */}
                                  <div className="flex items-center gap-2">
                                    {note.created_by ? (
                                      <>
                                        {/* Avatar */}
                                        {note.user_avatar_url ? (
                                          <img
                                            src={note.user_avatar_url}
                                            alt={note.user_display_name || "User"}
                                            className="w-6 h-6 rounded-full"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                            {(note.user_display_name?.[0] || "U").toUpperCase()}
                                          </div>
                                        )}
                                        {/* Display name */}
                                        <span className="text-xs text-slate-500">
                                          {note.user_display_name || "User"}
                                        </span>
                                        {/* Dot separator */}
                                        <span className="text-xs text-slate-400">•</span>
                                        {/* Timestamp */}
                                        <span className="text-xs text-slate-500">
                                          {formatRelativeTime(note.created_at)}
                                          {note.updated_at !== note.created_at && " (edited)"}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-slate-400 italic">
                                        Legacy note • {formatRelativeTime(note.created_at)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Edit/Delete actions */}
                                  {(currentUser && (note.created_by === currentUser.id || !note.created_by)) && (
                                    <div className="flex gap-2">
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handleStartEdit(note)}
                                          className="p-1 hover:bg-blue-100 rounded text-blue-600 cursor-pointer"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </motion.button>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handleDeleteNote(note.id)}
                                          className="p-1 hover:bg-red-100 rounded text-red-600 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </motion.button>
                                      </div>
                                    )}
                                </div>
                              </>
                            )}
                          </motion.div>
                        ))}
                    </div>
                  )}
                </motion.div>

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Tags Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center mb-3">
                    <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Tags ({facilityTags.length})
                    </h3>
                  </div>

                  {/* Assigned Tags Display */}
                  <div className="flex flex-wrap gap-2">
                    {facilityTags.map((tag, idx) => (
                      <motion.div
                        key={tag.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + idx * 0.05 }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                        style={{
                          color: tag.color,
                          borderColor: tag.color,
                        } as React.CSSProperties}
                        title={tag.description || tag.name}
                      >
                        <span>{tag.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTag(tag.id);
                          }}
                          className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                    {/* Inline Add Tag Button */}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + facilityTags.length * 0.05 }}
                      onClick={() => setIsTagManagementModalOpen(true)}
                      disabled={assigningTag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </motion.button>
                  </div>
                </motion.div>

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Facility Types */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                >
                  <h3 className="text-sm font-medium text-slate-700 mb-3 tracking-wide">
                    Facility Types
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {facility.sport_types
                      .filter(
                        (type) =>
                          ![
                            "establishment",
                            "point_of_interest",
                            "health",
                            "locality",
                            "political",
                            "tourist_attraction",
                          ].includes(type)
                      )
                      .map((type, idx) => (
                        <motion.span
                          key={type}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 + idx * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          className="px-3 py-1.5 bg-white text-blue-600 border border-blue-600 rounded-full text-xs font-medium transition-all cursor-default flex items-center gap-1.5"
                        >
                          <span className="text-sm">
                            {FACILITY_TYPE_EMOJIS[type] || "🏢"}
                          </span>
                          <span>{formatSportType(type)}</span>
                        </motion.span>
                      ))}
                  </div>
                </motion.div>

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Identified Sports with Confidence Scores */}
                {facility.identified_sports &&
                  facility.identified_sports.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <h3 className="text-sm font-medium text-slate-700 mb-3 tracking-wide flex items-center gap-2">
                        Sports Scraped
                        <span className="text-xs font-normal text-slate-500">
                          (with confidence scores)
                        </span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {facility.identified_sports.map((sport, idx) => {
                          const metadata = facility.sport_metadata?.[sport];
                          const score = metadata?.score || 0;
                          const confidence = metadata?.confidence || "unknown";

                          // Color coding based on confidence
                          let textColor = "text-slate-700";
                          let borderColor = "border-slate-300";

                          if (confidence === "high") {
                            textColor = "text-green-700";
                            borderColor = "border-green-400";
                          } else if (confidence === "medium") {
                            textColor = "text-yellow-700";
                            borderColor = "border-yellow-400";
                          } else if (confidence === "low") {
                            textColor = "text-red-700";
                            borderColor = "border-red-400";
                          }

                          // Get confidence icon
                          let confidenceIcon = "?";
                          if (confidence === "high") {
                            confidenceIcon = "✓";
                          } else if (confidence === "medium") {
                            confidenceIcon = "~";
                          } else if (confidence === "low") {
                            confidenceIcon = "⚠";
                          }

                          const tooltipContent = metadata
                            ? `Score: ${score}/100 | Sources: ${metadata.sources.join(", ") || "unknown"}\nKeywords: ${metadata.keywords_matched.join(", ")}\nMatched: "${metadata.matched_text}"`
                            : "No confidence data available - run audit script";

                          return (
                            <motion.div
                              key={sport}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.12 + idx * 0.05 }}
                              className="group relative"
                              title={tooltipContent}
                            >
                              <button
                                onClick={() => setSelectedSportDetail(sport)}
                                className={`px-3 py-1.5 bg-white ${textColor} rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${borderColor}`}
                              >
                                <span className="text-sm">
                                  {SPORT_EMOJIS[sport] || "🏅"}
                                </span>
                                <span>{sport}</span>
                                {metadata ? (
                                  <>
                                    <span className="text-xs opacity-75">
                                      {confidenceIcon}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-100">
                                      {score}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs opacity-75">?</span>
                                )}
                              </button>

                              {/* Tooltip on hover - appears below badge */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 hidden group-hover:block z-[100] pointer-events-none">
                                <div className="bg-slate-900 text-white text-xs rounded-xl py-2 px-3 shadow-xl max-w-xs whitespace-pre-wrap">
                                  {/* Arrow pointing up */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-[-1px]">
                                    <div className="border-8 border-transparent border-b-slate-900"></div>
                                  </div>
                                  {metadata ? (
                                    <>
                                      <div className="font-semibold mb-1">
                                        Confidence: {score}/100 ({confidence})
                                      </div>
                                      <div className="text-slate-300">
                                        <div>
                                          <strong>Sources:</strong>{" "}
                                          {metadata.sources.join(", ") || "unknown"}
                                        </div>
                                        <div>
                                          <strong>Keywords:</strong>{" "}
                                          {metadata.keywords_matched.join(", ")}
                                        </div>
                                        {metadata.matched_text && (
                                          <div className="mt-1 italic border-t border-slate-700 pt-1">
                                            {Array.isArray(metadata.matched_text) ? (
                                              <div>
                                                <strong>{metadata.matched_text.length} matching review(s):</strong>
                                                <div className="mt-1 space-y-2 max-h-40 overflow-y-auto">
                                                  {metadata.matched_text.map((review, idx) => (
                                                    <div key={idx} className="text-slate-300 border-l-2 border-slate-600 pl-2">
                                                      "{review.substring(0, 100)}
                                                      {review.length > 100 ? "..." : ""}"
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                "{metadata.matched_text.substring(0, 100)}
                                                {metadata.matched_text.length > 100 ? "..." : ""}"
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div>
                                      No confidence data available - run audit script
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Contact Information */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-medium text-slate-700 tracking-wide">
                    Contact Information
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700 text-sm leading-relaxed">
                        {facility.address}
                      </p>
                    </div>

                    {facility.phone && (
                      <motion.a
                        href={`tel:${facility.phone}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
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
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                      >
                        <Globe className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors flex-shrink-0" />
                        <span className="text-blue-600 group-hover:text-blue-700 font-medium text-sm truncate">
                          {facility.website.replace(/^https?:\/\//, "")}
                        </span>
                      </motion.a>
                    )}

                    {facility.email && facility.email.length > 0 && facility.email.map((emailAddress, idx) => (
                      <motion.a
                        key={idx}
                        href={`mailto:${emailAddress}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                      >
                        <Mail className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors" />
                        <span className="text-blue-600 group-hover:text-blue-700 font-medium text-sm">
                          {emailAddress}
                        </span>
                      </motion.a>
                    ))}
                  </div>
                </motion.div>

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Reviews - only show if no scraped reviews available */}
                {facility.reviews &&
                facility.reviews.length > 0 &&
                (!facility.serp_scraped ||
                  !facility.additional_reviews ||
                  facility.additional_reviews.length === 0) ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-700 tracking-wide">
                        Reviews ({facility.reviews.length})
                      </h3>
                      <button
                        onClick={() => setIsReviewsModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Expand
                      </button>
                    </div>
                    <div className="space-y-0">
                      {facility.reviews.map((review, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + idx * 0.05 }}
                          className={`py-4 ${idx !== 0 ? "border-t border-slate-200" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-slate-900 text-sm">
                              {review.author_name}
                            </span>
                            <div className="flex gap-0.5">
                              {renderStars(review.rating)}
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed mb-2">
                            {review.text}
                          </p>
                          <span className="text-xs text-slate-500 font-medium">
                            {review.relative_time_description}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  (!facility.serp_scraped ||
                    !facility.additional_reviews ||
                    facility.additional_reviews.length === 0) && (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No reviews available</p>
                    </div>
                  )
                )}

                {/* Additional Reviews from SerpAPI */}
                {facility.serp_scraped &&
                  facility.additional_reviews &&
                  facility.additional_reviews.length > 0 && (
                    <>
                      {/* Divider */}
                      <div className="border-t border-slate-200"></div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.21 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
                            Additional Reviews ({facility.additional_reviews.length})
                            <span className="text-xs font-normal text-slate-500">
                              from SerpAPI
                            </span>
                          </h3>
                          <button
                            onClick={() => setIsAdditionalReviewsModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Expand
                          </button>
                        </div>
                        <div className="space-y-0">
                          {facility.additional_reviews
                            .slice(
                              0,
                              showAllAdditionalReviews
                                ? facility.additional_reviews.length
                                : 10
                            )
                            .map((review, idx) => {
                              const authorName =
                                review.user?.name ||
                                review.author_name ||
                                "Anonymous";
                              const reviewText = review.snippet || review.text || "";
                              const timeDescription =
                                review.date || review.relative_time_description || "";

                              return (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.1 + idx * 0.05 }}
                                  className={`py-4 ${idx !== 0 ? "border-t border-slate-200" : ""}`}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      {review.user?.thumbnail && (
                                        <img
                                          src={review.user.thumbnail}
                                          alt={authorName}
                                          className="w-8 h-8 rounded-full object-cover"
                                        />
                                      )}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-slate-900 text-sm">
                                            {authorName}
                                          </span>
                                          {review.user?.local_guide && (
                                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                              Local Guide
                                            </span>
                                          )}
                                        </div>
                                        {review.user &&
                                          (review.user.reviews || review.user.photos) && (
                                            <span className="text-xs text-slate-500">
                                              {review.user.reviews &&
                                                `${review.user.reviews} reviews`}
                                              {review.user.reviews &&
                                                review.user.photos &&
                                                " • "}
                                              {review.user.photos &&
                                                `${review.user.photos} photos`}
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                    <div className="flex gap-0.5">
                                      {renderStars(review.rating)}
                                    </div>
                                  </div>
                                  <p className="text-sm text-slate-700 leading-relaxed mb-2">
                                    {reviewText}
                                  </p>

                                  {/* Review Images */}
                                  {review.images && review.images.length > 0 && (
                                    <div className="mb-3 relative group/review-images">
                                      {/* Left Arrow */}
                                      {reviewImageArrowVisibility[idx]?.left && (
                                        <button
                                          onClick={() => scrollReviewImages(idx, "left")}
                                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/review-images:opacity-100 cursor-pointer"
                                          aria-label="Scroll left"
                                        >
                                          <ChevronLeft className="w-6 h-6 text-slate-700" />
                                        </button>
                                      )}

                                      {/* Right Arrow */}
                                      {reviewImageArrowVisibility[idx]?.right && (
                                        <button
                                          onClick={() => scrollReviewImages(idx, "right")}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/review-images:opacity-100 cursor-pointer"
                                          aria-label="Scroll right"
                                        >
                                          <ChevronRight className="w-6 h-6 text-slate-700" />
                                        </button>
                                      )}

                                      <div
                                        ref={(el) => {
                                          reviewImageScrollRefs.current[idx] = el;
                                        }}
                                        className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
                                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                                      >
                                        {review.images.map((imageUrl, imgIdx) => (
                                          <div
                                            key={imgIdx}
                                            onClick={() => openReviewPhotoViewer(idx, imgIdx)}
                                            className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                                          >
                                            {loadingImages[
                                              `review-${idx}-img-${imgIdx}`
                                            ] !== false && (
                                              <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                            )}
                                            <img
                                              src={imageUrl}
                                              alt={`Review image ${imgIdx + 1}`}
                                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                              referrerPolicy="no-referrer"
                                              onLoadStart={() =>
                                                handleImageLoadStart(
                                                  `review-${idx}-img-${imgIdx}`
                                                )
                                              }
                                              onLoad={() =>
                                                handleImageLoad(
                                                  `review-${idx}-img-${imgIdx}`
                                                )
                                              }
                                              onError={() =>
                                                handleImageLoad(
                                                  `review-${idx}-img-${imgIdx}`
                                                )
                                              }
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                                              <span className="text-white text-[10px] font-medium">
                                                Click to view
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-medium">
                                      {timeDescription}
                                    </span>
                                    {review.link && (
                                      <a
                                        href={review.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        View Full
                                      </a>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                        </div>
                        {facility.additional_reviews.length > 10 && (
                          <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onClick={() =>
                              setShowAllAdditionalReviews(!showAllAdditionalReviews)
                            }
                            className="w-full mt-4 py-3 text-sm font-medium text-blue-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 hover:border-blue-600 cursor-pointer"
                          >
                            {showAllAdditionalReviews
                              ? "Show Less"
                              : `Show More (${facility.additional_reviews.length - 10} more reviews)`}
                          </motion.button>
                        )}
                      </motion.div>
                    </>
                  )}

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Opening Hours */}
                {facility.opening_hours && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
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
                            className="text-sm text-slate-700 font-medium"
                          >
                            {day}
                          </motion.li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </>
            ) : null}
          </div>
        </motion.div>

        {/* Tag Manager Modal */}
        <TagManagerModal
          isOpen={isTagManagementModalOpen}
          onClose={() => setIsTagManagementModalOpen(false)}
          facility={facility || null}
          allTags={allTags}
          facilityTags={facilityTags}
          loadingTags={loadingTags}
          assigningTag={assigningTag}
          onAssignTag={handleAssignTag}
          newTagName={newTagName}
          setNewTagName={setNewTagName}
          newTagColor={newTagColor}
          setNewTagColor={setNewTagColor}
          newTagDescription={newTagDescription}
          setNewTagDescription={setNewTagDescription}
          creatingTag={creatingTag}
          onCreateTag={handleCreateTag}
          editingTagId={editingTagId}
          editTagName={editTagName}
          setEditTagName={setEditTagName}
          editTagColor={editTagColor}
          setEditTagColor={setEditTagColor}
          editTagDescription={editTagDescription}
          setEditTagDescription={setEditTagDescription}
          onStartEditTag={handleStartEditTag}
          onCancelEditTag={handleCancelEditTag}
          onSaveEditTag={handleSaveEditTag}
          onDeleteTag={handleDeleteTag}
          showCreateTagSection={showCreateTagSection}
          setShowCreateTagSection={setShowCreateTagSection}
          showManageTagsSection={showManageTagsSection}
          setShowManageTagsSection={setShowManageTagsSection}
        />


        {/* Photos Grid Modal */}
        {isPhotosModalOpen &&
          facility?.photo_references &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]"
              onClick={() => setIsPhotosModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                  <h2 className="text-xl font-medium text-slate-900">
                    Photos ({facility.photo_references.length})
                  </h2>
                  <button
                    onClick={() => setIsPhotosModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                {/* Photos Grid */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {facility.photo_references.map((photoRef, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => openPhotoViewer(idx)}
                        className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer aspect-square group"
                      >
                        {loadingImages[idx] !== false && (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                        )}
                        <img
                          src={getPhotoUrl(photoRef)}
                          alt={`${facility.name} photo ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          onLoadStart={() => handleImageLoadStart(idx)}
                          onLoad={() => handleImageLoad(idx)}
                          onError={() => handleImageLoad(idx)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                          <span className="text-white text-xs font-medium">
                            Click to view
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>,
            document.body
          )}

        {/* Scraped Photos Grid Modal */}
        {isAdditionalPhotosModalOpen &&
          facility?.serp_scraped &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]"
              onClick={() => setIsAdditionalPhotosModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                  <div>
                    <h2 className="text-xl font-medium text-slate-900">
                      Scraped Photos ({combinedPhotos.length})
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsAdditionalPhotosModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                {/* Photos Grid */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {combinedPhotos.map((photo, idx) => (
                      <motion.div
                        key={`modal-combined-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => {
                          if (photo.type === "review") {
                            openReviewPhotoViewer(
                              photo.reviewIndex!,
                              photo.photoIndexInReview!
                            );
                          } else {
                            openPhotoViewer(photo.scrapedIndex!, "additional");
                          }
                          setIsAdditionalPhotosModalOpen(false);
                        }}
                        className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer aspect-square group"
                      >
                        {loadingImages[`modal-combined-${idx}`] !== false && (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                        )}
                        <img
                          src={photo.url}
                          alt={`${facility.name} photo ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                          onLoadStart={() => handleImageLoadStart(`modal-combined-${idx}`)}
                          onLoad={() => handleImageLoad(`modal-combined-${idx}`)}
                          onError={() => handleImageLoad(`modal-combined-${idx}`)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                          <span className="text-white text-xs font-medium">
                            Click to view
                          </span>
                        </div>
                        {photo.type === "scraped" && photo.data?.video && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5">
                            <Camera className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {photo.type === "review" && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                            {photo.reviewUserThumbnail ? (
                              <img
                                src={photo.reviewUserThumbnail}
                                alt={photo.reviewUserName}
                                className="w-8 h-8 rounded-full border-2 border-white shadow-lg object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg bg-slate-400 flex items-center justify-center text-white text-xs font-semibold">
                                {photo.reviewUserName?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {photo.reviewRating && (
                              <div className="bg-white/95 backdrop-blur-sm rounded-lg px-1.5 py-0.5 shadow-lg flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-semibold text-slate-900">
                                  {photo.reviewRating.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>,
            document.body
          )}

        {/* Photo Viewer Modal */}
        {isPhotoViewerOpen &&
          facility &&
          ((photoViewerSource === "regular" && facility.photo_references) ||
            (photoViewerSource === "additional" && facility.additional_photos) ||
            (photoViewerSource === "review" &&
              facility.additional_reviews?.[selectedReviewIndex]?.images)) && (
            <div className="fixed inset-0 bg-black z-[10000] flex items-center justify-center">
              <button
                onClick={closePhotoViewer}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              {selectedPhotoIndex > 0 && (
                <button
                  onClick={goToPrevPhoto}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}
              {(() => {
                let photos;
                if (photoViewerSource === "regular") {
                  photos = facility.photo_references;
                } else if (photoViewerSource === "additional") {
                  photos = facility.additional_photos;
                } else if (photoViewerSource === "review") {
                  photos = facility.additional_reviews?.[selectedReviewIndex]?.images;
                }
                return (
                  photos &&
                  selectedPhotoIndex < photos.length - 1 && (
                    <button
                      onClick={goToNextPhoto}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </button>
                  )
                );
              })()}
              <img
                src={
                  photoViewerSource === "regular"
                    ? getPhotoUrl(facility.photo_references![selectedPhotoIndex], true)
                    : photoViewerSource === "additional"
                      ? getPhotoDataUrl(
                          facility.additional_photos![selectedPhotoIndex],
                          true
                        )
                      : facility.additional_reviews?.[selectedReviewIndex]?.images?.[
                          selectedPhotoIndex
                        ] || ""
                }
                alt="Full size preview"
                className="max-w-[90vw] max-h-[90vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

        {/* Sport Detail Modal */}
        {facility && (
          <SportDetailModal
            isOpen={selectedSportDetail !== null}
            onClose={() => setSelectedSportDetail(null)}
            selectedSport={selectedSportDetail}
            onSelectSport={setSelectedSportDetail}
            facility={facility}
          />
        )}
      </>
    </AnimatePresence>
  );
}
