"use client";

import { Facility, Note, FacilityTag } from "@/types/facility";
import NoteText from "./NoteText";
import { useRouter } from "next/navigation";
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
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Tag,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  User,
  Link2,
  Building2,
  Calendar,
  FileText,
  Sparkles,
  Loader2,
  Target,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  updateFacilityNotesFlag,
  updateFacilityTags,
} from "@/utils/facilityCache";
import { useFacilityDetails } from "@/hooks/useFacilityDetails";
import { CloseLead, CloseActivity } from "@/types/close";
import {
  useLeadFacilityLinks,
  useDeleteFacilityLeadLink,
} from "@/hooks/useFacilityLeadLinks";
import {
  useCloseLeadsBatch,
  useCloseLeadStatuses,
  useCloseLeadActivities,
} from "@/hooks/useCloseCRM";
import { CloseActivityTimeline } from "./CloseActivityTimeline";
import { CallDetailContent } from "./CallDetailContent";
import { EmailDetailContent } from "./EmailDetailContent";
import { GeneratedEmail } from "@/types/email-generation";
import { useGenerateEmail } from "@/hooks/useGenerateEmail";
import { useGeneratedEmails } from "@/hooks/useGeneratedEmails";
import { GeneratedEmailDisplay } from "./GeneratedEmailDisplay";
import { FitAssessment } from "@/types/fit-assessment";
import { useAssessFit } from "@/hooks/useAssessFit";
import { useFitAssessments } from "@/hooks/useFitAssessments";
import { FitAssessmentDisplay } from "./FitAssessmentDisplay";
import SportDetailModal from "@/components/SportDetailModal";
import TagManagerModal from "@/components/TagManagerModal";
import AddNoteModal from "@/components/AddNoteModal";
import EditNoteModal from "@/components/EditNoteModal";

interface FacilitySidebarProps {
  facility: Facility | null;
  onClose: () => void;
  onUpdateFacility: (place_id: string, hidden: boolean) => void;
  onFacilityDataLoaded?: (fullFacility: Facility) => void;
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

function FacilitySidebarInner({
  facility,
  onClose,
  onUpdateFacility,
  onFacilityDataLoaded,
}: FacilitySidebarProps) {
  const router = useRouter();
  const supabase = createClient(); // SSR-compatible Supabase client
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch full facility details including reviews and additional data
  const {
    data: fullFacility,
    isLoading: isLoadingDetails,
    truncated,
    totalReviews,
    fetchFullDetails,
  } = useFacilityDetails(facility?.place_id || null, !!facility);

  // Use full facility data if available, otherwise fall back to lightweight data
  const displayFacility = fullFacility || facility;

  // Notify parent when full facility data is loaded
  useEffect(() => {
    if (fullFacility && onFacilityDataLoaded) {
      onFacilityDataLoaded(fullFacility);
    }
  }, [fullFacility, onFacilityDataLoaded]);
  const [loadingImages, setLoadingImages] = useState<{
    [key: string]: boolean;
  }>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [selectedSportDetail, setSelectedSportDetail] = useState<string | null>(
    null,
  );
  const photoScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const additionalPhotoScrollRef = useRef<HTMLDivElement>(null);
  const hasTriggeredFullLoad = useRef(false);
  const [showAdditionalLeftArrow, setShowAdditionalLeftArrow] = useState(false);
  const [showAdditionalRightArrow, setShowAdditionalRightArrow] =
    useState(false);
  const reviewImageScrollRefs = useRef<{
    [key: number]: HTMLDivElement | null;
  }>({});
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
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isEditNoteModalOpen, setIsEditNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Tag-related state
  const [allTags, setAllTags] = useState<FacilityTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isTagManagementModalOpen, setIsTagManagementModalOpen] =
    useState(false);
  const [showCreateTagSection, setShowCreateTagSection] = useState(false);
  const [showManageTagsSection, setShowManageTagsSection] = useState(false);
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

  // Linked leads state & hooks
  const [viewMode, setViewMode] = useState<
    "facility" | "lead" | "call" | "email" | "generated-email" | "fit-assessment"
  >("facility");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(
    null,
  );
  const [fitAssessment, setFitAssessment] = useState<FitAssessment | null>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const [customFieldsExpanded, setCustomFieldsExpanded] = useState(false);
  const generateEmailMutation = useGenerateEmail();
  const { data: generatedEmails = [] } = useGeneratedEmails(selectedLeadId);
  const assessFitMutation = useAssessFit();
  const { data: fitAssessments = [] } = useFitAssessments(selectedLeadId);

  const { data: linkedLeads = [], isLoading: linkedLeadsLoading } =
    useLeadFacilityLinks(facility?.place_id || null);
  const deleteLinkMutation = useDeleteFacilityLeadLink();

  const linkedLeadIds = useMemo(
    () => linkedLeads.map((link) => link.close_lead_id),
    [linkedLeads],
  );
  const leadQueries = useCloseLeadsBatch(linkedLeadIds);
  const { data: statuses } = useCloseLeadStatuses({ enabled: !!facility });

  const {
    data: selectedLeadActivities,
    isLoading: selectedLeadActivitiesLoading,
  } = useCloseLeadActivities(selectedLeadId);

  const handleEditEmail = (instructions: string) => {
    if (!generatedEmail || !selectedLead) return;
    generateEmailMutation.mutate(
      {
        leadId: selectedLeadId!,
        leadName: selectedLead.display_name || selectedLead.name,
        leadDescription: selectedLead.description,
        contacts: selectedLead.contacts,
        activities: selectedLeadActivities?.activities || [],
        editInstructions: instructions,
        parentEmailId: generatedEmail.id,
        parentEmailSubject: generatedEmail.subject,
        parentEmailBody: generatedEmail.body_text,
      },
      {
        onSuccess: (data) => {
          setGeneratedEmail(data);
        },
      }
    );
  };

  const latestActivityDate = useMemo(() => {
    const activities = selectedLeadActivities?.activities;
    if (!activities?.length) return 0;
    return Math.max(
      ...activities.map((a: any) => new Date(a.date_created).getTime()),
    );
  }, [selectedLeadActivities?.activities]);

  const leadsMap = useMemo(() => {
    const map: Record<string, CloseLead> = {};
    leadQueries.forEach((query, idx) => {
      if (query.data) {
        map[linkedLeadIds[idx]] = query.data;
      }
    });
    return map;
  }, [leadQueries, linkedLeadIds]);

  const selectedLead = selectedLeadId ? leadsMap[selectedLeadId] : null;

  const getStatusLabel = (statusId: string) => {
    if (!statuses) return "Unknown";
    const status = statuses.find((s) => s.id === statusId);
    return status?.label || "Unknown";
  };

  const handleUnlinkLead = async (linkId: string, closeLeadId: string) => {
    if (!displayFacility) return;
    if (!confirm("Are you sure you want to unlink this lead?")) return;
    try {
      await deleteLinkMutation.mutateAsync({
        id: linkId,
        closeLeadId,
        placeId: displayFacility.place_id,
      });
    } catch (error) {
      console.error("Error unlinking lead:", error);
      alert("Failed to unlink lead. Please try again.");
    }
  };

  // Current user state
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email?: string;
    display_name?: string;
    avatar_url?: string;
  } | null>(null);

  // Fetch current user on mount and listen to auth changes
  useEffect(() => {
    // Initial session fetch
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name,
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture,
        });
      }
    };
    initSession();

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only update user state if we have a session, or if user explicitly signed out
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name,
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture,
        });
      } else if (_event === "SIGNED_OUT") {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Reset loadingImages state when facility changes to prevent unbounded growth
  useEffect(() => {
    setLoadingImages({});
  }, [facility?.place_id]);

  // Fetch notes when facility changes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!displayFacility) return;

      setLoadingNotes(true);
      try {
        const { data, error } = await supabase
          .from("facility_notes")
          .select("*")
          .eq("place_id", displayFacility.place_id)
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
  }, [displayFacility?.place_id]);

  // Reset viewMode when facility changes
  useEffect(() => {
    setViewMode("facility");
    setSelectedLeadId(null);
    setSelectedActivityId(null);
    setGeneratedEmail(null);
    setFitAssessment(null);
  }, [facility?.place_id]);

  // Reset scroll position when view mode changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [viewMode]);

  // Sync facility tags from displayFacility when it changes
  useEffect(() => {
    if (displayFacility) {
      setFacilityTags(displayFacility.tags || []);
    }
  }, [displayFacility?.place_id, !!displayFacility]);

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

  // Helper functions for photo URLs (defined before useMemo to avoid ReferenceError)
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
    highRes: boolean = false,
  ) => {
    const fullResUrl = photoData.image || photoData.url || photoData.thumbnail;
    const baseUrl = highRes ? fullResUrl : photoData.thumbnail;

    // Try to optimize Supabase Storage images with transformation API
    // If transformation fails (404), browser will fall back to original URL
    if (!highRes && baseUrl.includes("supabase.co/storage")) {
      // More aggressive compression for faster preview loading
      // width=280: Match display size exactly (280px × 180px)
      // quality=60: Lower quality but acceptable for thumbnails (~40% smaller files)
      // resize=cover: Crop to fill dimensions for consistent aspect ratio
      return `${baseUrl}?width=280&quality=60&resize=cover`;
    }

    return baseUrl;
  };

  // Combine scraped photos with review photos
  const combinedPhotos = useMemo(() => {
    if (!displayFacility?.serp_scraped) return [];

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
    if (displayFacility.additional_photos) {
      displayFacility.additional_photos.forEach((photoData, idx) => {
        photos.push({
          url: getPhotoDataUrl(photoData),
          type: "scraped",
          scrapedIndex: idx,
          data: photoData,
        });
      });
    }

    // Add all review photos
    if (displayFacility.additional_reviews) {
      displayFacility.additional_reviews.forEach((review, reviewIdx) => {
        if (review.images && review.images.length > 0) {
          review.images.forEach((imageUrl, photoIdx) => {
            photos.push({
              url: imageUrl,
              type: "review",
              reviewIndex: reviewIdx,
              photoIndexInReview: photoIdx,
              reviewUserThumbnail: review.user?.thumbnail,
              reviewUserName:
                review.user?.name || review.author_name || "Anonymous",
              reviewRating: review.rating,
            });
          });
        }
      });
    }

    return photos;
  }, [displayFacility?.additional_photos, displayFacility?.additional_reviews]);

  // Add new note
  const handleAddNote = async (noteText: string, selectedPhoto: any) => {
    if (!noteText.trim() || !displayFacility || !facility) return;

    setAddingNote(true);

    // Check if user is logged in
    if (!currentUser) {
      alert("You must be logged in to create a note.");
      setAddingNote(false);
      return;
    }

    // Build assigned_photo object if photo was selected
    let assignedPhotoData: any = null;
    if (selectedPhoto) {
      assignedPhotoData = {
        type: selectedPhoto.type,
        url: selectedPhoto.url,
        assignedAt: new Date().toISOString(),
      };

      if (selectedPhoto.type === "scraped") {
        assignedPhotoData.scrapedIndex = selectedPhoto.scrapedIndex;
        assignedPhotoData.photoData = selectedPhoto.data;
        assignedPhotoData.thumbnail = selectedPhoto.data?.thumbnail;
      } else if (selectedPhoto.type === "review") {
        assignedPhotoData.reviewIndex = selectedPhoto.reviewIndex;
        assignedPhotoData.photoIndexInReview = selectedPhoto.photoIndexInReview;
        assignedPhotoData.reviewUserName = selectedPhoto.reviewUserName;
        assignedPhotoData.reviewRating = selectedPhoto.reviewRating;
        assignedPhotoData.thumbnail = selectedPhoto.url;
      }
    }

    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      place_id: facility.place_id,
      note_text: noteText,
      assigned_photo: assignedPhotoData,
      created_by: currentUser.id,
      user_display_name: currentUser.display_name || null,
      user_avatar_url: currentUser.avatar_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    setNotes((prev) => [tempNote, ...prev]);

    try {
      const { data, error } = await supabase
        .from("facility_notes")
        .insert({
          place_id: facility.place_id,
          note_text: noteText,
          assigned_photo: assignedPhotoData,
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

      // Close the modal after successful add
      setIsAddNoteModalOpen(false);
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
    setEditingNote(note);
    setIsEditNoteModalOpen(true);
  };

  // Save edited note
  const handleSaveEdit = async (noteText: string, selectedPhoto: any) => {
    if (!noteText.trim()) return;
    if (!facility || !editingNote) return;

    const oldNote = notes.find((n) => n.id === editingNote.id);
    if (!oldNote) return;

    setAddingNote(true); // Reuse addingNote state for saving

    // Build assigned_photo object if photo was selected
    let assignedPhotoData: any = null;
    if (selectedPhoto) {
      assignedPhotoData = {
        type: selectedPhoto.type,
        url: selectedPhoto.url,
        assignedAt: new Date().toISOString(),
      };

      if (selectedPhoto.type === "scraped") {
        assignedPhotoData.scrapedIndex = selectedPhoto.scrapedIndex;
        assignedPhotoData.photoData = selectedPhoto.data;
        assignedPhotoData.thumbnail = selectedPhoto.data?.thumbnail;
      } else if (selectedPhoto.type === "review") {
        assignedPhotoData.reviewIndex = selectedPhoto.reviewIndex;
        assignedPhotoData.photoIndexInReview = selectedPhoto.photoIndexInReview;
        assignedPhotoData.reviewUserName = selectedPhoto.reviewUserName;
        assignedPhotoData.reviewRating = selectedPhoto.reviewRating;
        assignedPhotoData.thumbnail = selectedPhoto.url;
      }
    }

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === editingNote.id
          ? {
              ...n,
              note_text: noteText,
              assigned_photo: assignedPhotoData,
              updated_at: new Date().toISOString(),
            }
          : n,
      ),
    );

    try {
      const { error } = await supabase
        .from("facility_notes")
        .update({
          note_text: noteText,
          assigned_photo: assignedPhotoData,
        })
        .eq("id", editingNote.id);

      if (error) throw error;

      // Close modal
      setIsEditNoteModalOpen(false);
      setEditingNote(null);
    } catch (error) {
      console.error("Error updating note:", error);
      // Revert optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === editingNote.id ? oldNote : n)),
      );
      alert("Failed to update note. Please try again.");
    } finally {
      setAddingNote(false);
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
    } catch (error) {
      console.error("Error deleting note:", error);
      // Revert optimistic update
      setNotes((prev) =>
        [...prev, deletedNote].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
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
      [...prev, tempTag].sort((a, b) => a.name.localeCompare(b.name)),
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
          .sort((a, b) => a.name.localeCompare(b.name)),
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
            : t,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
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
        "Are you sure you want to delete this tag? It will be removed from all facilities.",
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
        [...prev, deletedTag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      alert("Failed to delete tag. Please try again.");
    }
  };

  // Assign tag to facility
  const handleAssignTag = async (tagId: string) => {
    if (!facility || !displayFacility) return;

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

      // Update facility tags in the facility object
      const updatedTags = facility.tags ? [...facility.tags, tag] : [tag];
      if (facility.tags) {
        facility.tags.push(tag);
      } else {
        facility.tags = [tag];
      }

      // Update cache with new tags
      updateFacilityTags(queryClient, facility.place_id, updatedTags);
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
    if (!facility || !displayFacility) return;

    const tag = facilityTags.find((t) => t.id === tagId);
    if (!tag) return;

    // Optimistic update to local state
    setFacilityTags((prev) => prev.filter((t) => t.id !== tagId));

    // Update cache optimistically
    const updatedTags = facility.tags
      ? facility.tags.filter((t) => t.id !== tagId)
      : [];
    if (facility.tags) {
      facility.tags = facility.tags.filter((t) => t.id !== tagId);
    }
    updateFacilityTags(queryClient, facility.place_id, updatedTags);

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
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      // Revert cache update
      const revertedTags = updatedTags.concat(tag);
      if (facility.tags && tag) {
        facility.tags.push(tag);
      }
      updateFacilityTags(queryClient, facility.place_id, revertedTags);
      alert("Failed to remove tag. Please try again.");
    }
  };

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
        />,
      );
    }
    if (hasHalfStar) {
      stars.push(
        <StarHalf
          key="half"
          className="w-4 h-4 fill-yellow-400 text-yellow-400"
        />,
      );
    }
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <Star key={`empty-${i}`} className="w-4 h-4 text-slate-300" />,
      );
    }
    return stars;
  };

  const handleActivityClick = (activity: CloseActivity) => {
    if (activity.type === "call") {
      setViewMode("call");
      setSelectedActivityId(activity.call?.id || activity.id);
    } else if (activity.type === "email") {
      setViewMode("email");
      setSelectedActivityId(activity.email?.id || activity.id);
    }
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

    // Auto-load full details when scrolled near the end
    if (truncated && !hasTriggeredFullLoad.current) {
      if (scrollLeft + clientWidth >= scrollWidth - 300) {
        hasTriggeredFullLoad.current = true;
        fetchFullDetails();
      }
    }
  };

  // Handle review images scroll
  const scrollReviewImages = (
    reviewIndex: number,
    direction: "left" | "right",
  ) => {
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
  }, [displayFacility]);

  // Update arrows for additional photos when loaded or facility changes
  useEffect(() => {
    hasTriggeredFullLoad.current = false;
    updateAdditionalPhotoArrows();
    const scrollContainer = additionalPhotoScrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateAdditionalPhotoArrows);
      window.addEventListener("resize", updateAdditionalPhotoArrows);
      return () => {
        scrollContainer.removeEventListener(
          "scroll",
          updateAdditionalPhotoArrows,
        );
        window.removeEventListener("resize", updateAdditionalPhotoArrows);
      };
    }
  }, [displayFacility]);

  // Update arrows for review images when reviews change
  useEffect(() => {
    // Initial update for all review image galleries
    updateAllReviewImageArrows();

    // Attach scroll and resize listeners to all review image containers
    const listeners: Array<{ ref: HTMLDivElement; scrollHandler: () => void }> =
      [];
    Object.entries(reviewImageScrollRefs.current).forEach(([key, ref]) => {
      if (ref) {
        const reviewIndex = parseInt(key);
        const scrollHandler = () => updateReviewImageArrows(reviewIndex);
        ref.addEventListener("scroll", scrollHandler);
        window.addEventListener("resize", scrollHandler);
        listeners.push({ ref, scrollHandler });
      }
    });

    // Cleanup - use the same handler references for proper removal
    return () => {
      listeners.forEach(({ ref, scrollHandler }) => {
        ref.removeEventListener("scroll", scrollHandler);
        window.removeEventListener("resize", scrollHandler);
      });
    };
  }, [displayFacility?.additional_reviews]);

  // Photo viewer handlers
  const openPhotoViewer = (
    index: number,
    source: "regular" | "additional" = "regular",
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
      photos = displayFacility?.photo_references;
    } else if (photoViewerSource === "additional") {
      photos = displayFacility?.additional_photos;
    } else if (photoViewerSource === "review") {
      photos =
        displayFacility?.additional_reviews?.[selectedReviewIndex]?.images;
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
  }, [isPhotoViewerOpen, selectedPhotoIndex, displayFacility]);

  // Early return after all hooks are declared (Rules of Hooks)
  if (!displayFacility) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-[1vh] left-20 h-[98vh] w-full md:w-[440px] bg-white shadow-2xl rounded-2xl z-50 flex flex-col overflow-hidden font-poppins"
      >
        {/* Header with gradient */}
        <div className="sticky top-0 bg-white border-b border-slate-200 z-20">
          <div className="px-6 py-4 flex justify-between items-start">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 pr-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  {displayFacility.name}
                </h2>
                {displayFacility.business_status && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      displayFacility.business_status === "OPERATIONAL"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {displayFacility.business_status === "OPERATIONAL" ? (
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
              {getCityState(displayFacility.address) && (
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    {getCityState(displayFacility.address)}
                  </span>
                </div>
              )}
              {displayFacility.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {renderStars(displayFacility.rating)}
                  </div>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">
                    {displayFacility.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-slate-500 tabular-nums">
                    ({displayFacility.user_ratings_total} reviews)
                  </span>
                </div>
              )}
            </motion.div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        >
          <AnimatePresence mode="wait">
            {viewMode === "facility" ? (
              <motion.div
                key="facility-view"
                initial={{ x: 0, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-6"
              >
                {/* Photos */}
                {displayFacility.photo_references &&
                displayFacility.photo_references.length > 0 &&
                (!displayFacility.serp_scraped ||
                  (displayFacility.additional_photos !== undefined &&
                    displayFacility.additional_photos.length === 0)) ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 tracking-wide">
                        Photos{" "}
                        <span className="text-slate-500 tabular-nums">
                          ({displayFacility.photo_references.length})
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
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        {displayFacility.photo_references.map(
                          (photoRef, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                delay: 0.1 + Math.min(idx * 0.05, 0.5),
                              }}
                              onClick={() => openPhotoViewer(idx)}
                              className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer flex-shrink-0 snap-start"
                              style={{ width: "280px", height: "180px" }}
                            >
                              {loadingImages[idx] !== false && (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                              )}
                              <img
                                src={getPhotoUrl(photoRef)}
                                alt={`${displayFacility.name} photo ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                                loading={idx < 5 ? "eager" : "lazy"}
                                onLoadStart={() => handleImageLoadStart(idx)}
                                onLoad={() => handleImageLoad(idx)}
                                onError={() => handleImageLoad(idx)}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                            </motion.div>
                          ),
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : isLoadingDetails &&
                  displayFacility.total_photo_count &&
                  displayFacility.total_photo_count > 0 ? (
                  // Show skeleton loader when loading and we know photos exist
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <h3 className="text-sm font-medium text-slate-700 tracking-wide mb-3">
                      Scraped Photos{" "}
                      <span className="text-slate-500 tabular-nums">
                        ({displayFacility.total_photo_count})
                      </span>
                    </h3>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 rounded-2xl animate-pulse flex-shrink-0"
                          style={{ width: "280px", height: "180px" }}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : !displayFacility.serp_scraped ||
                  !displayFacility.additional_photos ||
                  displayFacility.additional_photos.length === 0 ? (
                  <div className="text-center py-12">
                    <Camera className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">
                      No photos available
                    </p>
                  </div>
                ) : null}

                {/* Additional Photos from SerpAPI */}
                {displayFacility.serp_scraped && combinedPhotos.length > 0 && (
                  <>
                    {/* Divider - only show if regular photos were displayed above */}
                    {displayFacility.photo_references &&
                      displayFacility.photo_references.length > 0 && (
                        <div className="border-t border-slate-200"></div>
                      )}

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
                          onClick={() => {
                            if (truncated) fetchFullDetails();
                            setIsAdditionalPhotosModalOpen(true);
                          }}
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
                                    photo.photoIndexInReview!,
                                  );
                                } else {
                                  openPhotoViewer(
                                    photo.scrapedIndex!,
                                    "additional",
                                  );
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
                                alt={`${displayFacility.name} photo ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                                referrerPolicy="no-referrer"
                                loading={idx < 5 ? "eager" : "lazy"}
                                onLoadStart={() =>
                                  handleImageLoadStart(`combined-${idx}`)
                                }
                                onLoad={() =>
                                  handleImageLoad(`combined-${idx}`)
                                }
                                onError={() =>
                                  handleImageLoad(`combined-${idx}`)
                                }
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                              {photo.type === "scraped" &&
                                photo.data?.video && (
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
                                      {photo.reviewUserName
                                        ?.charAt(0)
                                        .toUpperCase()}
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

                {/* Divider - only show if photos sections were displayed above */}
                {((displayFacility.photo_references &&
                  displayFacility.photo_references.length > 0) ||
                  (displayFacility.serp_scraped &&
                    displayFacility.additional_photos &&
                    displayFacility.additional_photos.length > 0)) && (
                  <div className="border-t border-slate-200"></div>
                )}

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
                      <button
                        onClick={() => setIsAddNoteModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Note
                      </button>
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
                            <>
                              {/* Note Text */}
                              <p className="text-sm text-slate-700 leading-relaxed mb-3 break-words">
                                <NoteText text={note.note_text} />
                              </p>

                              {/* Assigned Photo */}
                              {note.assigned_photo && (
                                <div
                                  onClick={() => {
                                    if (
                                      note.assigned_photo?.type === "review"
                                    ) {
                                      openReviewPhotoViewer(
                                        note.assigned_photo.reviewIndex!,
                                        note.assigned_photo.photoIndexInReview!,
                                      );
                                    } else if (
                                      note.assigned_photo?.type === "scraped"
                                    ) {
                                      openPhotoViewer(
                                        note.assigned_photo.scrapedIndex!,
                                        "additional",
                                      );
                                    }
                                  }}
                                  className="mb-3 relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                                >
                                  <img
                                    src={
                                      note.assigned_photo.thumbnail ||
                                      note.assigned_photo.url
                                    }
                                    alt="Note photo"
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    referrerPolicy="no-referrer"
                                  />
                                  {note.assigned_photo.type === "review" &&
                                    note.assigned_photo.reviewRating && (
                                      <div className="absolute bottom-1 right-1 bg-white/95 backdrop-blur-sm rounded px-1 py-0.5 shadow-sm flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                                        <span className="text-[10px] font-semibold text-slate-900">
                                          {note.assigned_photo.reviewRating.toFixed(
                                            1,
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                                    <span className="text-white text-[10px] font-medium">
                                      Click to view
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Creator Info, Timestamp and Actions */}
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
                                          {(
                                            note.user_display_name?.[0] || "U"
                                          ).toUpperCase()}
                                        </div>
                                      )}
                                      {/* Display name */}
                                      <span className="text-xs text-slate-500">
                                        {note.user_display_name || "User"}
                                      </span>
                                      {/* Dot separator */}
                                      <span className="text-xs text-slate-400">
                                        •
                                      </span>
                                      {/* Timestamp */}
                                      <span className="text-xs text-slate-500">
                                        {formatRelativeTime(note.created_at)}
                                        {note.updated_at !== note.created_at &&
                                          " (edited)"}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">
                                      Legacy note •{" "}
                                      {formatRelativeTime(note.created_at)}
                                    </span>
                                  )}
                                </div>

                                {/* Edit/Delete actions */}
                                {currentUser &&
                                  (note.created_by === currentUser.id ||
                                    !note.created_by) && (
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
                                        onClick={() =>
                                          handleDeleteNote(note.id)
                                        }
                                        className="p-1 hover:bg-red-100 rounded text-red-600 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </motion.button>
                                    </div>
                                  )}
                              </div>
                            </>
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
                        style={
                          {
                            color: tag.color,
                            borderColor: tag.color,
                          } as React.CSSProperties
                        }
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

                {/* Linked Leads Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.11 }}
                >
                  <div className="flex items-center mb-3">
                    <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Linked Leads from Close
                    </h3>
                  </div>

                  {linkedLeadsLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : linkedLeads.length === 0 ? (
                    <div className="text-center py-6 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-100">
                      <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">
                        No leads linked to this facility yet
                      </p>
                      <button
                        onClick={() => {
                          router.push("/crm?tab=close");
                          onClose();
                        }}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer mx-auto"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Browse Leads in CRM
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedLeads.map((link, idx) => {
                        const getConfidenceBadge = () => {
                          switch (link.confidence) {
                            case 5:
                              return {
                                label: "High Match",
                                className:
                                  "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-300",
                                dotColor: "bg-green-500",
                              };
                            case 4:
                              return {
                                label: "Name + City",
                                className:
                                  "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300",
                                dotColor: "bg-blue-500",
                              };
                            case 3:
                              return {
                                label: "Name Match",
                                className:
                                  "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-800 border-yellow-300",
                                dotColor: "bg-yellow-500",
                              };
                            case 2:
                              return {
                                label: "Fuzzy Match",
                                className:
                                  "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-300",
                                dotColor: "bg-orange-500",
                              };
                            default:
                              return {
                                label: "Match",
                                className:
                                  "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border-gray-300",
                                dotColor: "bg-gray-500",
                              };
                          }
                        };

                        const confidenceBadge = getConfidenceBadge();

                        return (
                          <motion.div
                            key={link.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 shadow-sm"
                          >
                            {(() => {
                              const lead = leadsMap[link.close_lead_id];
                              const isLoadingLead = leadQueries[idx]?.isLoading;

                              return (
                                <div className="space-y-2">
                                  {/* Lead Name/Status and Badges */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      {isLoadingLead ? (
                                        <>
                                          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse mb-2"></div>
                                          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                                        </>
                                      ) : lead ? (
                                        <>
                                          <h4 className="font-bold text-gray-900 text-sm">
                                            {lead.display_name || lead.name}
                                          </h4>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                              {getStatusLabel(lead.status_id)}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              Linked{" "}
                                              {new Date(
                                                link.created_at,
                                              ).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <h4 className="font-bold text-gray-900 text-sm">
                                            Lead ID: {link.close_lead_id}
                                          </h4>
                                          <p className="text-xs text-gray-500 mt-1">
                                            Linked on{" "}
                                            {new Date(
                                              link.created_at,
                                            ).toLocaleDateString()}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold border ${confidenceBadge.className}`}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${confidenceBadge.dotColor}`}
                                        ></span>
                                        {confidenceBadge.label}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="pt-2 border-t border-blue-200 flex gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedLeadId(link.close_lead_id);
                                        setViewMode("lead");
                                      }}
                                      disabled={isLoadingLead}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View Details
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleUnlinkLead(
                                          link.id,
                                          link.close_lead_id,
                                        )
                                      }
                                      disabled={deleteLinkMutation.isPending}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                      {deleteLinkMutation.isPending
                                        ? "Unlinking..."
                                        : "Unlink"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>

                {displayFacility.sport_types.filter(
                  (type) =>
                    ![
                      "establishment",
                      "point_of_interest",
                      "health",
                      "locality",
                      "political",
                      "tourist_attraction",
                    ].includes(type),
                ).length > 0 && (
                  <>
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
                        {displayFacility.sport_types
                          .filter(
                            (type) =>
                              ![
                                "establishment",
                                "point_of_interest",
                                "health",
                                "locality",
                                "political",
                                "tourist_attraction",
                              ].includes(type),
                          )
                          .map((type, idx) => (
                            <motion.span
                              key={type}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1 + idx * 0.05 }}
                              whileHover={{ scale: 1.05 }}
                              className="px-3 py-1 bg-white text-blue-600 border border-blue-600 rounded-full text-xs font-medium transition-all cursor-default flex items-center gap-1.5"
                            >
                              <span className="text-base">
                                {FACILITY_TYPE_EMOJIS[type] || "🏢"}
                              </span>
                              <span>{formatSportType(type)}</span>
                            </motion.span>
                          ))}
                      </div>
                    </motion.div>
                  </>
                )}

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Identified Sports with Confidence Scores */}
                {displayFacility.identified_sports &&
                  displayFacility.identified_sports.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <h3 className="text-sm font-medium text-slate-700 mb-3 tracking-wide flex items-center gap-2">
                        Sports Scraped
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {displayFacility.identified_sports.map((sport, idx) => {
                          const metadata =
                            displayFacility.sport_metadata?.[sport];
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
                              whileTap={{ scale: 0.95 }}
                              className="group relative"
                              title={tooltipContent}
                            >
                              <button
                                onClick={() => setSelectedSportDetail(sport)}
                                className={`px-3 py-1 bg-white ${textColor} rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${borderColor}`}
                              >
                                <span className="text-lg">
                                  {SPORT_EMOJIS[sport] || "🏅"}
                                </span>
                                <span>{sport}</span>
                                {metadata ? (
                                  <>
                                    <span className="px-1 py-0.5 rounded text-xs font-bold bg-slate-100">
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
                                          {metadata.sources.join(", ") ||
                                            "unknown"}
                                        </div>
                                        <div>
                                          <strong>Keywords:</strong>{" "}
                                          {metadata.keywords_matched.join(", ")}
                                        </div>
                                        {metadata.matched_text && (
                                          <div className="mt-1 italic border-t border-slate-700 pt-1">
                                            {Array.isArray(
                                              metadata.matched_text,
                                            ) ? (
                                              <div>
                                                <strong>
                                                  {metadata.matched_text.length}{" "}
                                                  matching review(s):
                                                </strong>
                                                <div className="mt-1 space-y-2 max-h-40 overflow-y-auto">
                                                  {metadata.matched_text.map(
                                                    (review, idx) => (
                                                      <div
                                                        key={idx}
                                                        className="text-slate-300 border-l-2 border-slate-600 pl-2"
                                                      >
                                                        "
                                                        {review.substring(
                                                          0,
                                                          100,
                                                        )}
                                                        {review.length > 100
                                                          ? "..."
                                                          : ""}
                                                        "
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                "
                                                {metadata.matched_text.substring(
                                                  0,
                                                  100,
                                                )}
                                                {metadata.matched_text.length >
                                                100
                                                  ? "..."
                                                  : ""}
                                                "
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div>
                                      No confidence data available - run audit
                                      script
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
                        {displayFacility.address}
                      </p>
                    </div>

                    {displayFacility.phone && (
                      <motion.a
                        href={`tel:${displayFacility.phone}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                      >
                        <Phone className="w-5 h-5 text-blue-600 group-hover:text-blue-600/80 transition-colors" />
                        <span className="text-blue-600 group-hover:text-blue-600/80 font-medium text-sm">
                          {displayFacility.phone}
                        </span>
                      </motion.a>
                    )}

                    {displayFacility.website && (
                      <motion.a
                        href={displayFacility.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                      >
                        <Globe className="w-5 h-5 text-blue-600 group-hover:text-blue-600/80 transition-colors flex-shrink-0" />
                        <span className="text-blue-600 group-hover:text-blue-600/80 font-medium text-sm truncate">
                          {displayFacility.website.replace(/^https?:\/\//, "")}
                        </span>
                      </motion.a>
                    )}

                    {displayFacility.email &&
                      displayFacility.email.length > 0 &&
                      displayFacility.email.map((emailAddress, idx) => (
                        <motion.a
                          key={idx}
                          href={`mailto:${emailAddress}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                        >
                          <Mail className="w-5 h-5 text-blue-600 group-hover:text-blue-600/80 transition-colors" />
                          <span className="text-blue-600 group-hover:text-blue-600/80 font-medium text-sm">
                            {emailAddress}
                          </span>
                        </motion.a>
                      ))}
                  </div>
                </motion.div>

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Scraped Reviews from SerpAPI */}
                {displayFacility.serp_scraped &&
                  displayFacility.additional_reviews &&
                  displayFacility.additional_reviews.length > 0 && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.21 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-slate-700 tracking-wide flex items-center gap-2">
                            Scraped Reviews (
                            {displayFacility.additional_reviews.length})
                          </h3>
                          <button
                            onClick={() => {
                              if (truncated) fetchFullDetails();
                              setIsAdditionalReviewsModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Expand
                          </button>
                        </div>
                        <div className="space-y-0">
                          {displayFacility.additional_reviews
                            .slice(
                              0,
                              showAllAdditionalReviews
                                ? displayFacility.additional_reviews.length
                                : 10,
                            )
                            .map((review, idx) => {
                              const authorName =
                                review.user?.name ||
                                review.author_name ||
                                "Anonymous";
                              const reviewText =
                                review.snippet || review.text || "";
                              const timeDescription =
                                review.date ||
                                review.relative_time_description ||
                                "";

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
                                          referrerPolicy="no-referrer"
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
                                          (review.user.reviews ||
                                            review.user.photos) && (
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
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex gap-0.5">
                                        {renderStars(review.rating)}
                                      </div>
                                      {review.likes !== undefined &&
                                        review.likes > 0 && (
                                          <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <span>👍</span>
                                            <span>{review.likes}</span>
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                  <p className="text-sm text-slate-700 leading-relaxed mb-2">
                                    {reviewText}
                                  </p>

                                  {/* Review Images */}
                                  {review.images &&
                                    review.images.length > 0 && (
                                      <div className="mb-3 relative group/review-images">
                                        {/* Left Arrow */}
                                        {reviewImageArrowVisibility[idx]
                                          ?.left && (
                                          <button
                                            onClick={() =>
                                              scrollReviewImages(idx, "left")
                                            }
                                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/review-images:opacity-100 cursor-pointer"
                                            aria-label="Scroll left"
                                          >
                                            <ChevronLeft className="w-6 h-6 text-slate-700" />
                                          </button>
                                        )}

                                        {/* Right Arrow */}
                                        {reviewImageArrowVisibility[idx]
                                          ?.right && (
                                          <button
                                            onClick={() =>
                                              scrollReviewImages(idx, "right")
                                            }
                                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all opacity-0 group-hover/review-images:opacity-100 cursor-pointer"
                                            aria-label="Scroll right"
                                          >
                                            <ChevronRight className="w-6 h-6 text-slate-700" />
                                          </button>
                                        )}

                                        <div
                                          ref={(el) => {
                                            reviewImageScrollRefs.current[idx] =
                                              el;
                                          }}
                                          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
                                          style={{
                                            scrollbarWidth: "none",
                                            msOverflowStyle: "none",
                                          }}
                                        >
                                          {review.images.map(
                                            (imageUrl, imgIdx) => (
                                              <div
                                                key={imgIdx}
                                                onClick={() =>
                                                  openReviewPhotoViewer(
                                                    idx,
                                                    imgIdx,
                                                  )
                                                }
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
                                                  loading={
                                                    idx < 10 ? "eager" : "lazy"
                                                  }
                                                  onLoadStart={() =>
                                                    handleImageLoadStart(
                                                      `review-${idx}-img-${imgIdx}`,
                                                    )
                                                  }
                                                  onLoad={() =>
                                                    handleImageLoad(
                                                      `review-${idx}-img-${imgIdx}`,
                                                    )
                                                  }
                                                  onError={() =>
                                                    handleImageLoad(
                                                      `review-${idx}-img-${imgIdx}`,
                                                    )
                                                  }
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                                                  <span className="text-white text-[10px] font-medium">
                                                    Click to view
                                                  </span>
                                                </div>
                                              </div>
                                            ),
                                          )}
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
                        {displayFacility.additional_reviews.length > 10 && (
                          <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onClick={() =>
                              setShowAllAdditionalReviews(
                                !showAllAdditionalReviews,
                              )
                            }
                            className="w-full mt-4 py-3 text-sm font-medium text-blue-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 hover:border-blue-600 cursor-pointer"
                          >
                            {showAllAdditionalReviews
                              ? "Show Less"
                              : `Show More (${displayFacility.additional_reviews.length - 10} more reviews)`}
                          </motion.button>
                        )}
                        {truncated && totalReviews > 10 && (
                          <button
                            onClick={fetchFullDetails}
                            className="w-full mt-2 py-2.5 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-xl transition-colors border border-amber-200 hover:border-amber-400 cursor-pointer"
                          >
                            Load all {totalReviews} reviews
                          </button>
                        )}
                      </motion.div>

                      {/* Divider */}
                      <div className="border-t border-slate-200"></div>
                    </>
                  )}

                {/* Reviews */}
                {!(
                  displayFacility.serp_scraped &&
                  displayFacility.additional_reviews &&
                  displayFacility.additional_reviews.length > 0
                ) &&
                  (isLoadingDetails ? (
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-slate-700 tracking-wide">
                        Reviews
                      </h3>
                      {/* Loading skeleton */}
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl p-4 animate-pulse"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="h-4 w-24 bg-slate-300 rounded"></div>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((j) => (
                                <div
                                  key={j}
                                  className="w-4 h-4 bg-slate-300 rounded"
                                ></div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-slate-300 rounded w-full"></div>
                            <div className="h-3 bg-slate-300 rounded w-5/6"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : displayFacility.reviews &&
                    displayFacility.reviews.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-700 tracking-wide">
                          Reviews ({displayFacility.reviews.length})
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
                        {displayFacility.reviews.map((review, idx) => (
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
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">
                        No reviews available
                      </p>
                    </div>
                  ))}

                {/* Divider */}
                <div className="border-t border-slate-200"></div>

                {/* Opening Hours */}
                {displayFacility.opening_hours && (
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
                      {displayFacility.opening_hours.open_now !== undefined && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            displayFacility.opening_hours.open_now
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {displayFacility.opening_hours.open_now
                            ? "Open Now"
                            : "Closed"}
                        </span>
                      )}
                    </div>
                    {displayFacility.opening_hours.weekday_text && (
                      <ul className="space-y-2">
                        {displayFacility.opening_hours.weekday_text.map(
                          (day, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + idx * 0.03 }}
                              className="text-sm text-slate-700 font-medium"
                            >
                              {day}
                            </motion.li>
                          ),
                        )}
                      </ul>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ) : viewMode === "lead" && selectedLead ? (
              <motion.div
                key="lead-view"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-6"
              >
                {/* Back Button */}
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setViewMode("facility");
                    setSelectedLeadId(null);
                    setSelectedActivityId(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Facility
                </motion.button>

                {/* About Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-slate-50 rounded-lg p-5"
                >
                  <button
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <h3 className="text-sm font-semibold text-slate-900 tracking-wide flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      About
                    </h3>
                    {aboutExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {aboutExpanded && (
                    <div className="space-y-4 mt-4">
                      {selectedLead.description && (
                        <p className="text-sm text-slate-700">
                          {selectedLead.description}
                        </p>
                      )}

                      {/* Address */}
                      {selectedLead.addresses &&
                        selectedLead.addresses.length > 0 && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div className="text-sm text-slate-700">
                              {selectedLead.addresses[0].address_1}
                              {selectedLead.addresses[0].address_2 && (
                                <>, {selectedLead.addresses[0].address_2}</>
                              )}
                              {(selectedLead.addresses[0].city ||
                                selectedLead.addresses[0].state ||
                                selectedLead.addresses[0].zipcode) && (
                                <div>
                                  {selectedLead.addresses[0].city}
                                  {selectedLead.addresses[0].state &&
                                    `, ${selectedLead.addresses[0].state}`}
                                  {selectedLead.addresses[0].zipcode &&
                                    ` ${selectedLead.addresses[0].zipcode}`}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Website */}
                      {selectedLead.url && (
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <a
                            href={selectedLead.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            {selectedLead.url}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <div>
                          <div>
                            Created:{" "}
                            {new Date(
                              selectedLead.date_created,
                            ).toLocaleDateString()}
                          </div>
                          <div>
                            Updated:{" "}
                            {new Date(
                              selectedLead.date_updated,
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Contacts Section */}
                {selectedLead.contacts && selectedLead.contacts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-200 rounded-lg p-5"
                  >
                    <button
                      onClick={() => setContactsExpanded(!contactsExpanded)}
                      className="w-full flex items-center justify-between cursor-pointer"
                    >
                      <h3 className="text-sm font-semibold text-slate-900 tracking-wide flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Contacts ({selectedLead.contacts.length})
                      </h3>
                      {contactsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {contactsExpanded && (
                      <div className="space-y-4 mt-4">
                        {selectedLead.contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-4 bg-slate-50 rounded-lg space-y-2"
                          >
                            {contact.name && (
                              <p className="font-medium text-slate-900">
                                {contact.name}
                              </p>
                            )}
                            {contact.title && (
                              <p className="text-sm text-slate-600">
                                {contact.title}
                              </p>
                            )}

                            {/* Emails */}
                            {contact.emails && contact.emails.length > 0 && (
                              <div className="space-y-1">
                                {contact.emails.map((email, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <a
                                      href={`mailto:${email.email}`}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {email.email}
                                    </a>
                                    {email.type && (
                                      <span className="text-xs text-slate-500">
                                        ({email.type})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Phones */}
                            {contact.phones && contact.phones.length > 0 && (
                              <div className="space-y-1">
                                {contact.phones.map((phone, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <a
                                      href={`tel:${phone.phone}`}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      {phone.phone}
                                    </a>
                                    {phone.type && (
                                      <span className="text-xs text-slate-500">
                                        ({phone.type})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Custom Fields */}
                {selectedLead.custom &&
                  Object.keys(selectedLead.custom).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="bg-white border border-slate-200 rounded-lg p-5"
                    >
                      <button
                        onClick={() => setCustomFieldsExpanded(!customFieldsExpanded)}
                        className="w-full flex items-center justify-between cursor-pointer"
                      >
                        <h3 className="text-sm font-semibold text-slate-900 tracking-wide">
                          Custom Fields
                        </h3>
                        {customFieldsExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      {customFieldsExpanded && (
                        <div className="space-y-3 mt-4">
                          {Object.entries(selectedLead.custom).map(
                            ([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="text-slate-600 font-medium">
                                  {key}:
                                </span>
                                <p className="text-slate-900 mt-1 break-words">
                                  <NoteText text={String(value)} truncateUrls />
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                {/* Activity Timeline */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white border border-slate-200 rounded-lg p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 tracking-wide">
                      Activity Timeline
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          generateEmailMutation.mutate(
                            {
                              leadId: selectedLeadId!,
                              leadName:
                                selectedLead!.display_name || selectedLead!.name,
                              leadDescription: selectedLead!.description,
                              contacts: selectedLead!.contacts,
                              activities:
                                selectedLeadActivities?.activities || [],
                            },
                            {
                              onSuccess: (data) => {
                                setGeneratedEmail(data);
                                setViewMode("generated-email");
                              },
                            },
                          );
                        }}
                        disabled={
                          generateEmailMutation.isPending ||
                          !selectedLeadActivities
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {generateEmailMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {generateEmailMutation.isPending
                          ? generateEmailMutation.generationStatus
                          : "Generate Email"}
                      </button>
                      <button
                        onClick={() => {
                          assessFitMutation.mutate(
                            {
                              leadId: selectedLeadId!,
                              leadName:
                                selectedLead!.display_name || selectedLead!.name,
                              leadDescription: selectedLead!.description,
                              activities:
                                selectedLeadActivities?.activities || [],
                            },
                            {
                              onSuccess: (data) => {
                                setFitAssessment(data);
                                setViewMode("fit-assessment");
                              },
                            },
                          );
                        }}
                        disabled={
                          assessFitMutation.isPending ||
                          !selectedLeadActivities
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {assessFitMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Target className="w-3.5 h-3.5" />
                        )}
                        {assessFitMutation.isPending
                          ? assessFitMutation.assessmentStatus
                          : "Assess Fit"}
                      </button>
                    </div>
                  </div>
                  {selectedLeadActivities && (
                    <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span>Total: {selectedLeadActivities.count.total}</span>
                      {selectedLeadActivities.count.calls > 0 && (
                        <span>
                          • Calls: {selectedLeadActivities.count.calls}
                        </span>
                      )}
                      {selectedLeadActivities.count.emails > 0 && (
                        <span>
                          • Emails: {selectedLeadActivities.count.emails}
                        </span>
                      )}
                      {selectedLeadActivities.count.notes > 0 && (
                        <span>
                          • Notes: {selectedLeadActivities.count.notes}
                        </span>
                      )}
                      {selectedLeadActivities.count.tasks > 0 && (
                        <span>
                          • Tasks: {selectedLeadActivities.count.tasks}
                        </span>
                      )}
                      {selectedLeadActivities.count.opportunities > 0 && (
                        <span>
                          • Opportunities:{" "}
                          {selectedLeadActivities.count.opportunities}
                        </span>
                      )}
                    </div>
                  )}
                  <CloseActivityTimeline
                    activities={selectedLeadActivities?.activities || []}
                    isLoading={selectedLeadActivitiesLoading}
                    onActivityClick={handleActivityClick}
                  />
                </motion.div>

                {/* Generated Emails History */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-white border border-slate-200 rounded-lg p-5"
                >
                  <h3 className="text-sm font-semibold text-slate-900 tracking-wide flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4" />
                    Generated Emails
                    {generatedEmails.length > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-indigo-600 rounded-full">
                        {generatedEmails.length}
                      </span>
                    )}
                  </h3>
                  {generatedEmails.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No generated emails yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {generatedEmails.map((email) => {
                        const typeBadge = {
                          intro: {
                            label: "Intro",
                            className: "bg-emerald-100 text-emerald-700",
                          },
                          follow_up: {
                            label: "Follow-up",
                            className: "bg-amber-100 text-amber-700",
                          },
                          reply: {
                            label: "Reply",
                            className: "bg-blue-100 text-blue-700",
                          },
                        }[email.email_type] || {
                          label: email.email_type,
                          className: "bg-slate-100 text-slate-700",
                        };
                        const isOutdated =
                          latestActivityDate >
                          new Date(email.created_at).getTime();

                        return (
                          <button
                            key={email.id}
                            onClick={() => {
                              setGeneratedEmail(email);
                              setViewMode("generated-email");
                            }}
                            className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeBadge.className}`}
                              >
                                {typeBadge.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(email.created_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                              {isOutdated && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">
                                  Outdated
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-800 truncate">
                              {email.subject}
                            </p>
                            {email.recipient_name && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                To: {email.recipient_name}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white border border-slate-200 rounded-lg p-5"
                >
                  <h3 className="text-sm font-semibold text-slate-900 tracking-wide flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4" />
                    Fit Assessments
                    {fitAssessments.length > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-teal-600 rounded-full">
                        {fitAssessments.length}
                      </span>
                    )}
                  </h3>
                  {fitAssessments.length === 0 ? (
                    <p className="text-xs text-slate-400">No fit assessments yet</p>
                  ) : (
                    <div className="space-y-2">
                      {fitAssessments.map((fa) => {
                        const verdictBadge = {
                          strong_fit: { label: "Strong", className: "bg-emerald-100 text-emerald-700" },
                          moderate_fit: { label: "Moderate", className: "bg-amber-100 text-amber-700" },
                          weak_fit: { label: "Weak", className: "bg-orange-100 text-orange-700" },
                          poor_fit: { label: "Poor", className: "bg-red-100 text-red-700" },
                        }[fa.verdict] || { label: fa.verdict, className: "bg-slate-100 text-slate-700" };

                        return (
                          <button
                            key={fa.id}
                            onClick={() => {
                              setFitAssessment(fa);
                              setViewMode("fit-assessment");
                            }}
                            className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${verdictBadge.className}`}>
                                {verdictBadge.label}
                              </span>
                              <span className="text-xs font-bold text-slate-700">{fa.overall_score}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(fa.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {fa.summary}
                            </p>
                            {fa.facility_name && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {fa.facility_name}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ) : viewMode === "call" && selectedActivityId ? (
              <motion.div
                key="call-view"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setViewMode("lead");
                    setSelectedActivityId(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Lead
                </motion.button>
                <CallDetailContent
                  callId={selectedActivityId}
                  leadId={selectedLeadId || undefined}
                />
              </motion.div>
            ) : viewMode === "email" && selectedActivityId ? (
              <motion.div
                key="email-view"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setViewMode("lead");
                    setSelectedActivityId(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Lead
                </motion.button>
                <EmailDetailContent
                  emailThreadId={selectedActivityId}
                  leadId={selectedLeadId || undefined}
                />
              </motion.div>
            ) : viewMode === "generated-email" && generatedEmail ? (
              <motion.div
                key="generated-email-view"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setViewMode("lead");
                    setGeneratedEmail(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Lead
                </motion.button>
                <GeneratedEmailDisplay
                  email={generatedEmail}
                  contactEmail={selectedLead?.contacts?.[0]?.emails?.[0]?.email}
                  contactName={selectedLead?.contacts?.[0]?.name}
                  isOutdated={
                    latestActivityDate >
                    new Date(generatedEmail.created_at).getTime()
                  }
                  closeLeadId={selectedLeadId!}
                  onEditSubmit={handleEditEmail}
                  isRegenerating={generateEmailMutation.isPending}
                  mostRecentActivity={selectedLeadActivities?.activities?.[0]}
                  onActivityClick={handleActivityClick}
                />
              </motion.div>
            ) : viewMode === "fit-assessment" && fitAssessment ? (
              <motion.div
                key="fit-assessment-view"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setViewMode("lead");
                    setFitAssessment(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Lead
                </motion.button>
                <FitAssessmentDisplay assessment={fitAssessment} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Photos Grid Modal */}
        {isPhotosModalOpen &&
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
                    Photos ({facility?.photo_references?.length || 0})
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
                    {facility?.photo_references?.map((photoRef, idx) => (
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
                          alt={`${displayFacility.name} photo ${idx + 1}`}
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
            document.body,
          )}

        {/* Additional Photos Grid Modal */}
        {isAdditionalPhotosModalOpen &&
          combinedPhotos.length > 0 &&
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
                              photo.photoIndexInReview!,
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
                          alt={`${displayFacility.name} photo ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                          onLoadStart={() =>
                            handleImageLoadStart(`modal-combined-${idx}`)
                          }
                          onLoad={() =>
                            handleImageLoad(`modal-combined-${idx}`)
                          }
                          onError={() =>
                            handleImageLoad(`modal-combined-${idx}`)
                          }
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
            document.body,
          )}

        {/* Reviews Modal */}
        {isReviewsModalOpen &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]"
              onClick={() => setIsReviewsModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                  <h2 className="text-xl font-medium text-slate-900">
                    Reviews ({displayFacility?.reviews?.length || 0})
                  </h2>
                  <button
                    onClick={() => setIsReviewsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                {/* Reviews List */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                  <div className="space-y-4">
                    {displayFacility?.reviews?.map((review, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-gradient-to-br from-white to-slate-50/50 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-slate-900 text-base">
                            {review.author_name}
                          </span>
                          <div className="flex gap-0.5">
                            {renderStars(review.rating)}
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed mb-3">
                          {review.text}
                        </p>
                        <span className="text-xs text-slate-500 font-medium">
                          {review.relative_time_description}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )}

        {/* Scraped Reviews Modal */}
        {isAdditionalReviewsModalOpen &&
          displayFacility?.additional_reviews &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]"
              onClick={() => setIsAdditionalReviewsModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                  <div>
                    <h2 className="text-xl font-medium text-slate-900">
                      Scraped Reviews (
                      {displayFacility.additional_reviews?.length || 0})
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">from SerpAPI</p>
                  </div>
                  <button
                    onClick={() => setIsAdditionalReviewsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                {/* Reviews List */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                  <div className="space-y-4">
                    {displayFacility.additional_reviews?.map((review, idx) => {
                      const authorName =
                        review.user?.name || review.author_name || "Anonymous";
                      const reviewText = review.snippet || review.text || "";
                      const timeDescription =
                        review.date || review.relative_time_description || "";

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-gradient-to-br from-white to-slate-50/50 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all border border-slate-100"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {review.user?.thumbnail && (
                                <img
                                  src={review.user.thumbnail}
                                  alt={authorName}
                                  className="w-10 h-10 rounded-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 text-base">
                                    {authorName}
                                  </span>
                                  {review.user?.local_guide && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                      Local Guide
                                    </span>
                                  )}
                                </div>
                                {review.user &&
                                  (review.user.reviews ||
                                    review.user.photos) && (
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
                          <p className="text-sm text-slate-700 leading-relaxed mb-3">
                            {reviewText}
                          </p>
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
                                View Full Review
                              </a>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )}

        {/* Photo Lightbox Viewer */}
        {isPhotoViewerOpen &&
          ((photoViewerSource === "regular" &&
            displayFacility.photo_references) ||
            (photoViewerSource === "additional" &&
              displayFacility.additional_photos) ||
            (photoViewerSource === "review" &&
              displayFacility.additional_reviews?.[selectedReviewIndex]
                ?.images)) &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[10000]"
              onClick={closePhotoViewer}
            >
              {(() => {
                let photos;
                if (photoViewerSource === "regular") {
                  photos = displayFacility.photo_references;
                } else if (photoViewerSource === "additional") {
                  photos = displayFacility.additional_photos;
                } else if (photoViewerSource === "review") {
                  photos =
                    displayFacility.additional_reviews?.[selectedReviewIndex]
                      ?.images;
                }
                if (!photos) return null;
                const totalPhotos = photos.length;
                const currentPhoto = photos[selectedPhotoIndex];

                return (
                  <>
                    {/* Close Button */}
                    <button
                      onClick={closePhotoViewer}
                      className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                    >
                      <X className="w-6 h-6 text-white" />
                    </button>

                    {/* Photo Counter */}
                    <div className="absolute top-6 left-6 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-sm font-medium">
                      {selectedPhotoIndex + 1} / {totalPhotos}
                      {photoViewerSource === "additional" && (
                        <span className="ml-2 text-xs opacity-75">
                          (SerpAPI)
                        </span>
                      )}
                      {photoViewerSource === "review" && (
                        <span className="ml-2 text-xs opacity-75">
                          (Review Photo)
                        </span>
                      )}
                    </div>

                    {/* Previous Button */}
                    {selectedPhotoIndex > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          goToPrevPhoto();
                        }}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                      >
                        <ChevronLeft className="w-8 h-8 text-white" />
                      </button>
                    )}

                    {/* Next Button */}
                    {selectedPhotoIndex < totalPhotos - 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          goToNextPhoto();
                        }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                      >
                        <ChevronRight className="w-8 h-8 text-white" />
                      </button>
                    )}

                    {/* Main Photo */}
                    <motion.div
                      key={selectedPhotoIndex}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full flex items-center justify-center px-24 py-20"
                    >
                      <img
                        src={
                          photoViewerSource === "regular"
                            ? getPhotoUrl(currentPhoto as string, true)
                            : photoViewerSource === "additional"
                              ? getPhotoDataUrl(
                                  currentPhoto as {
                                    image: string;
                                    thumbnail: string;
                                  },
                                  true,
                                )
                              : (currentPhoto as string)
                        }
                        alt={`${displayFacility.name} photo ${selectedPhotoIndex + 1}`}
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  </>
                );
              })()}
            </motion.div>,
            document.body,
          )}

        {/* Sport Detail Modal */}
        <SportDetailModal
          isOpen={selectedSportDetail !== null}
          onClose={() => setSelectedSportDetail(null)}
          selectedSport={selectedSportDetail}
          onSelectSport={setSelectedSportDetail}
          facility={displayFacility}
        />

        {/* Tag Manager Modal */}
        <TagManagerModal
          isOpen={isTagManagementModalOpen}
          onClose={() => setIsTagManagementModalOpen(false)}
          facility={displayFacility}
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

        {/* Add Note Modal */}
        <AddNoteModal
          isOpen={isAddNoteModalOpen}
          onClose={() => setIsAddNoteModalOpen(false)}
          onSave={handleAddNote}
          combinedPhotos={combinedPhotos}
          facilityName={displayFacility.name}
          isSaving={addingNote}
        />

        {/* Edit Note Modal */}
        {editingNote && (
          <EditNoteModal
            isOpen={isEditNoteModalOpen}
            onClose={() => {
              setIsEditNoteModalOpen(false);
              setEditingNote(null);
            }}
            onSave={handleSaveEdit}
            combinedPhotos={combinedPhotos}
            facilityName={displayFacility.name}
            isSaving={addingNote}
            initialNoteText={editingNote.note_text}
            initialPhoto={
              editingNote.assigned_photo
                ? {
                    type: editingNote.assigned_photo.type,
                    url: editingNote.assigned_photo.url,
                    scrapedIndex: editingNote.assigned_photo.scrapedIndex,
                    reviewIndex: editingNote.assigned_photo.reviewIndex,
                    photoIndexInReview:
                      editingNote.assigned_photo.photoIndexInReview,
                    reviewUserName: editingNote.assigned_photo.reviewUserName,
                    reviewRating: editingNote.assigned_photo.reviewRating,
                    data: editingNote.assigned_photo.photoData,
                  }
                : null
            }
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(FacilitySidebarInner);
