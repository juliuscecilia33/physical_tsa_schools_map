'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface TagFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  availableTags: Tag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  onClearTags: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export default function TagFilterDropdown({
  isOpen,
  onClose,
  availableTags,
  selectedTagIds,
  onTagToggle,
  onClearTags,
  buttonRef,
}: TagFilterDropdownProps) {
  if (!isOpen) return null;

  const buttonRect = buttonRef.current?.getBoundingClientRect();

  // Calculate position accounting for any parent scroll
  const dropdownStyle = buttonRect
    ? {
        position: 'fixed' as const,
        top: `${buttonRect.bottom + 8}px`,
        left: `${buttonRect.left}px`,
      }
    : { display: 'none' as const };

  return (
    <>
      {/* Backdrop to close dropdown */}
      <div
        className="fixed inset-0 z-20"
        onClick={onClose}
      />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          style={dropdownStyle}
          className="z-30 w-[360px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Filter by Tag</h3>
              {selectedTagIds.length > 0 && (
                <button
                  onClick={() => {
                    onClearTags();
                  }}
                  className="text-xs text-[#004aad] hover:text-[#003380] font-medium"
                >
                  Clear ({selectedTagIds.length})
                </button>
              )}
            </div>

            {availableTags.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                No tags available
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onTagToggle(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'shadow-md ring-2 ring-offset-1'
                            : 'hover:shadow-sm'
                        }`}
                        style={{
                          backgroundColor: isSelected ? tag.color : `${tag.color}30`,
                          color: isSelected ? 'white' : tag.color,
                          ringColor: isSelected ? tag.color : 'transparent',
                        }}
                        title={tag.description || tag.name}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
