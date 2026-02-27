"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Star,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

interface CombinedPhoto {
  url: string;
  type: "scraped" | "review";
  reviewIndex?: number;
  photoIndexInReview?: number;
  scrapedIndex?: number;
  data?: any;
  reviewUserThumbnail?: string;
  reviewUserName?: string;
  reviewRating?: number;
}

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteText: string, selectedPhoto: CombinedPhoto | null) => void;
  combinedPhotos: CombinedPhoto[];
  facilityName: string;
  isSaving?: boolean;
}

export default function AddNoteModal({
  isOpen,
  onClose,
  onSave,
  combinedPhotos,
  facilityName,
  isSaving = false,
}: AddNoteModalProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<CombinedPhoto | null>(
    null,
  );
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  const handleSave = () => {
    if (!noteText.trim()) return;
    onSave(noteText, selectedPhoto);
    // Reset state after save
    setNoteText("");
    setSelectedPhoto(null);
    setShowPhotoPicker(false);
  };

  const handleClose = () => {
    setNoteText("");
    setSelectedPhoto(null);
    setShowPhotoPicker(false);
    onClose();
  };

  const handlePhotoSelect = (photo: CombinedPhoto) => {
    if (selectedPhoto === photo) {
      setSelectedPhoto(null);
    } else {
      setSelectedPhoto(photo);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Add Note</h2>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Facility Name */}
            <div className="text-sm text-slate-500">
              Adding note to:{" "}
              <span className="font-semibold text-slate-700">
                {facilityName}
              </span>
            </div>

            {/* Note Text */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Note Text <span className="text-red-500">*</span>
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter your note..."
                className="w-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all"
                rows={4}
                disabled={isSaving}
                autoFocus
              />
            </div>

            {/* Assign Photo Section */}
            {combinedPhotos.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                  disabled={isSaving}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    <span>
                      Assign Photo (Optional)
                      {selectedPhoto && " - 1 selected"}
                    </span>
                  </div>
                  {showPhotoPicker ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {/* Selected Photo Preview */}
                {selectedPhoto && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={selectedPhoto.url}
                          alt="Selected"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {selectedPhoto.type === "review" && (
                          <div className="absolute bottom-1 right-1 bg-white/95 backdrop-blur-sm rounded px-1 py-0.5 shadow-sm flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-[10px] font-semibold text-slate-900">
                              {selectedPhoto.reviewRating?.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {selectedPhoto.type === "scraped"
                            ? "Scraped Photo"
                            : "Review Photo"}
                        </div>
                        {selectedPhoto.type === "review" &&
                          selectedPhoto.reviewUserName && (
                            <div className="text-xs text-slate-600 truncate">
                              by {selectedPhoto.reviewUserName}
                            </div>
                          )}
                      </div>
                      <button
                        onClick={() => setSelectedPhoto(null)}
                        disabled={isSaving}
                        className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Photo Grid */}
                {showPhotoPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3"
                  >
                    <div className="grid grid-cols-4 gap-3">
                      {combinedPhotos.map((photo, idx) => {
                        const isSelected = selectedPhoto === photo;
                        return (
                          <motion.div
                            key={`photo-${idx}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePhotoSelect(photo)}
                            className={`relative cursor-pointer rounded-lg overflow-hidden aspect-square ${
                              isSelected
                                ? "ring-2 ring-blue-500 ring-offset-2"
                                : "ring-1 ring-slate-200"
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                            {/* Overlay for selected state */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-4 h-4 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                            {/* Badge for photo type */}
                            {photo.type === "scraped" && photo.data?.video && (
                              <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm rounded-full p-1">
                                <Camera className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {photo.type === "review" && (
                              <div className="absolute bottom-1 right-1 bg-white/95 backdrop-blur-sm rounded px-1 py-0.5 shadow-sm flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                                <span className="text-[10px] font-semibold text-slate-900">
                                  {photo.reviewRating?.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!noteText.trim() || isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Note</span>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
