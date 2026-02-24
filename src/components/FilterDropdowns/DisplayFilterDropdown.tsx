'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VisibilityFilter } from '@/types/facility';

interface DisplayFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFilter: VisibilityFilter;
  onFilterChange: (filter: VisibilityFilter) => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

const DISPLAY_OPTIONS = [
  { value: 'UNHIDDEN_ONLY' as VisibilityFilter, label: 'All', description: 'Show all facilities except hidden' },
  { value: 'WITH_NOTES_ONLY' as VisibilityFilter, label: 'With Notes Only', description: 'Show only facilities with notes' },
  { value: 'ALL' as VisibilityFilter, label: 'All Facilities', description: 'Show everything including hidden' },
  { value: 'CLEANED_UP_ONLY' as VisibilityFilter, label: 'Cleaned Up (Low Quality)', description: 'Show low quality facilities' },
];

export default function DisplayFilterDropdown({
  isOpen,
  onClose,
  selectedFilter,
  onFilterChange,
  buttonRef,
}: DisplayFilterDropdownProps) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
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
    minWidth: `${position.width}px`,
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
          className="z-30 w-[280px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Display Options</h3>
            <div className="space-y-2">
              {DISPLAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onFilterChange(option.value);
                    onClose();
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                    selectedFilter === option.value
                      ? 'bg-[#004aad] text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className={`text-xs mt-1 ${selectedFilter === option.value ? 'text-white/80' : 'text-gray-500'}`}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
