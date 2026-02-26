'use client';

import { useState, useEffect } from 'react';
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
  buttonRef: React.RefObject<HTMLButtonElement | null>;
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
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: rect.left,
        });
      }
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, buttonRef]);

  if (!isOpen) return null;

  const dropdownStyle = {
    position: 'fixed' as const,
    top: `${position.top}px`,
    left: `${position.left}px`,
  };

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
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'border-opacity-100'
                            : 'border-opacity-30 opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isSelected ? tag.color : `${tag.color}10`,
                          color: isSelected ? 'white' : tag.color,
                          borderColor: tag.color,
                        } as React.CSSProperties}
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
