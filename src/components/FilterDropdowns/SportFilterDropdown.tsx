'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SportFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  availableSports: string[];
  selectedSports: string[];
  onSportToggle: (sport: string) => void;
  onClearSports: () => void;
  sportEmojis: Record<string, string>;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export default function SportFilterDropdown({
  isOpen,
  onClose,
  availableSports,
  selectedSports,
  onSportToggle,
  onClearSports,
  sportEmojis,
  buttonRef,
}: SportFilterDropdownProps) {
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
              <h3 className="text-sm font-semibold text-gray-900">Filter by Sport</h3>
              {selectedSports.length > 0 && (
                <button
                  onClick={() => {
                    onClearSports();
                  }}
                  className="text-xs text-[#004aad] hover:text-[#003380] font-medium"
                >
                  Clear ({selectedSports.length})
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {availableSports.map((sport) => {
                  const isSelected = selectedSports.includes(sport);
                  return (
                    <button
                      key={sport}
                      onClick={() => onSportToggle(sport)}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-[#004aad] text-white shadow-md'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-base">{sportEmojis[sport] || '🏃'}</span>
                      <span className="truncate text-left flex-1">{sport}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
