"use client";

import { Facility, FacilityTag } from "@/types/facility";
import { motion } from "framer-motion";
import { X, Tag, Plus, Edit2, Save, XCircle as XIcon, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

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

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  facility: Facility | null;
  allTags: FacilityTag[];
  facilityTags: FacilityTag[];
  loadingTags: boolean;
  assigningTag: boolean;
  onAssignTag: (tagId: string) => Promise<void>;
  // Create tag props
  newTagName: string;
  setNewTagName: (name: string) => void;
  newTagColor: string;
  setNewTagColor: (color: string) => void;
  newTagDescription: string;
  setNewTagDescription: (description: string) => void;
  creatingTag: boolean;
  onCreateTag: () => Promise<void>;
  // Edit tag props
  editingTagId: string | null;
  editTagName: string;
  setEditTagName: (name: string) => void;
  editTagColor: string;
  setEditTagColor: (color: string) => void;
  editTagDescription: string;
  setEditTagDescription: (description: string) => void;
  onStartEditTag: (tag: FacilityTag) => void;
  onCancelEditTag: () => void;
  onSaveEditTag: (tagId: string) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
  // Collapsible sections
  showCreateTagSection: boolean;
  setShowCreateTagSection: (show: boolean) => void;
  showManageTagsSection: boolean;
  setShowManageTagsSection: (show: boolean) => void;
}

export default function TagManagerModal({
  isOpen,
  onClose,
  facility,
  allTags,
  facilityTags,
  loadingTags,
  assigningTag,
  onAssignTag,
  newTagName,
  setNewTagName,
  newTagColor,
  setNewTagColor,
  newTagDescription,
  setNewTagDescription,
  creatingTag,
  onCreateTag,
  editingTagId,
  editTagName,
  setEditTagName,
  editTagColor,
  setEditTagColor,
  editTagDescription,
  setEditTagDescription,
  onStartEditTag,
  onCancelEditTag,
  onSaveEditTag,
  onDeleteTag,
  showCreateTagSection,
  setShowCreateTagSection,
  showManageTagsSection,
  setShowManageTagsSection,
}: TagManagerModalProps) {
  if (!isOpen || !facility) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-[9999]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
          <h2 className="text-xl font-medium text-slate-900">Tag Manager</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6">
          {/* Section 1: Assign Existing Tags */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Assign Existing Tags
            </h3>
            {loadingTags ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-slate-500 mt-3">Loading tags...</p>
              </div>
            ) : allTags.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <Tag className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No tags available</p>
                <p className="text-xs text-slate-400 mt-1">
                  Create your first tag using the button below
                </p>
              </div>
            ) : allTags.filter((tag) => !facilityTags.some((ft) => ft.id === tag.id))
                .length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <Tag className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">All tags already assigned</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags
                  .filter((tag) => !facilityTags.some((ft) => ft.id === tag.id))
                  .map((tag) => (
                    <motion.button
                      key={tag.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onAssignTag(tag.id)}
                      disabled={assigningTag}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        borderColor: tag.color,
                      } as React.CSSProperties}
                      title={tag.description || tag.name}
                    >
                      {tag.name}
                    </motion.button>
                  ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateTagSection(!showCreateTagSection)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Tag</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowManageTagsSection(!showManageTagsSection)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              <span>Manage All Tags</span>
            </motion.button>
          </div>

          {/* Section 2: Create New Tag (Conditional) */}
          {showCreateTagSection && (
            <>
              {/* Divider */}
              <div className="border-t border-slate-200"></div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create New Tag
                </h3>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-600/20 space-y-3">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    disabled={creatingTag}
                  />
                  <input
                    type="text"
                    value={newTagDescription}
                    onChange={(e) => setNewTagDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    disabled={creatingTag}
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map((colorOption) => (
                        <button
                          key={colorOption.value}
                          onClick={() => setNewTagColor(colorOption.value)}
                          className={`w-8 h-8 rounded-full transition-all ${
                            newTagColor === colorOption.value
                              ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: colorOption.value }}
                          title={colorOption.name}
                          disabled={creatingTag}
                        />
                      ))}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCreateTag}
                    disabled={!newTagName.trim() || creatingTag}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{creatingTag ? "Creating..." : "Create Tag"}</span>
                  </motion.button>
                </div>
              </div>
            </>
          )}

          {/* Section 3: Manage All Tags (Conditional) */}
          {showManageTagsSection && (
            <>
              {/* Divider */}
              <div className="border-t border-slate-200"></div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Edit2 className="w-4 h-4" />
                  Manage All Tags ({allTags.length})
                </h3>
                {loadingTags ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : allTags.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No tags created yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="bg-white rounded-xl p-3 border border-slate-200 hover:border-slate-300 transition-colors"
                      >
                        {editingTagId === tag.id ? (
                          // Edit Mode
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editTagName}
                              onChange={(e) => setEditTagName(e.target.value)}
                              className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                            <input
                              type="text"
                              value={editTagDescription}
                              onChange={(e) =>
                                setEditTagDescription(e.target.value)
                              }
                              placeholder="Description (optional)"
                              className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-2">
                                Color
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {TAG_COLORS.map((colorOption) => (
                                  <button
                                    key={colorOption.value}
                                    onClick={() =>
                                      setEditTagColor(colorOption.value)
                                    }
                                    className={`w-8 h-8 rounded-full transition-all ${
                                      editTagColor === colorOption.value
                                        ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                                        : "hover:scale-105"
                                    }`}
                                    style={{
                                      backgroundColor: colorOption.value,
                                    }}
                                    title={colorOption.name}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onSaveEditTag(tag.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-medium cursor-pointer"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onCancelEditTag}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                              >
                                <XIcon className="w-3 h-3" />
                                Cancel
                              </motion.button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {tag.name}
                                </p>
                                {tag.description && (
                                  <p className="text-xs text-slate-500 truncate">
                                    {tag.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-3">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onStartEditTag(tag)}
                                className="p-1.5 hover:bg-blue-100 rounded text-blue-600 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onDeleteTag(tag.id)}
                                className="p-1.5 hover:bg-red-100 rounded text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </motion.button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
