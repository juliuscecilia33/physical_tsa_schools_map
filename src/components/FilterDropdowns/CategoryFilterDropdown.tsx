'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onClearCategories: () => void;
  categoryCounts: Record<string, number>;
  categoryColors: Record<string, string>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

const CATEGORIES = [
  'Parks & Fields',
  'Fitness & Wellness',
  'Sports Venues',
  'Educational',
  'Other',
];

export default function CategoryFilterDropdown({
  isOpen,
  onClose,
  selectedCategories,
  onCategoryToggle,
  onClearCategories,
  categoryCounts,
  categoryColors,
  buttonRef,
}: CategoryFilterDropdownProps) {
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
          className="z-30 w-[320px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Categories</h3>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => {
                    onClearCategories();
                  }}
                  className="text-xs text-[#004aad] hover:text-[#003380] font-medium"
                >
                  Clear ({selectedCategories.length})
                </button>
              )}
            </div>

            <div className="space-y-2">
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category);
                const count = categoryCounts[category] || 0;
                const color = categoryColors[category] || '#6b7280';

                return (
                  <button
                    key={category}
                    onClick={() => onCategoryToggle(category)}
                    className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#004aad] text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: isSelected ? 'white' : color,
                        }}
                      />
                      <span>{category}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        isSelected ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
