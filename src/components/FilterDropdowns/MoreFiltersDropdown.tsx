'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MoreFiltersDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export default function MoreFiltersDropdown({
  isOpen,
  onClose,
  buttonRef,
}: MoreFiltersDropdownProps) {
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
          className="z-30 w-[280px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">More Filters</h3>
            <div className="text-sm text-gray-500 text-center py-8">
              Additional filter options coming soon
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
