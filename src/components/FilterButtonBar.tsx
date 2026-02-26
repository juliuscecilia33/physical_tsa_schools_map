"use client";

import { useState, useRef } from "react";
import {
  PanelLeft,
  PanelLeftOpen,
  Eye,
  Trophy,
  Tag as TagIcon,
  Grid3x3,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import DisplayFilterDropdown from "./FilterDropdowns/DisplayFilterDropdown";
import SportFilterDropdown from "./FilterDropdowns/SportFilterDropdown";
import TagFilterDropdown from "./FilterDropdowns/TagFilterDropdown";
import CategoryFilterDropdown from "./FilterDropdowns/CategoryFilterDropdown";
import MoreFiltersDropdown from "./FilterDropdowns/MoreFiltersDropdown";
import { VisibilityFilter } from "@/types/facility";

interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface FilterButtonBarProps {
  // Sidebar state
  sidebarVisible: boolean;
  onToggleSidebar: () => void;

  // Display filter
  visibilityFilter: VisibilityFilter;
  onVisibilityFilterChange: (filter: VisibilityFilter) => void;

  // Sport filter
  availableSports: string[];
  selectedSports: string[];
  onSportToggle: (sport: string) => void;
  onClearSports: () => void;
  sportEmojis: Record<string, string>;

  // Tag filter
  availableTags: Tag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  onClearTags: () => void;

  // Category filter
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onClearCategories: () => void;
  categoryCounts: Record<string, number>;
  categoryColors: Record<string, string>;
}

type OpenDropdown = "display" | "sport" | "tag" | "category" | "more" | null;

export default function FilterButtonBar({
  sidebarVisible,
  onToggleSidebar,
  visibilityFilter,
  onVisibilityFilterChange,
  availableSports,
  selectedSports,
  onSportToggle,
  onClearSports,
  sportEmojis,
  availableTags,
  selectedTagIds,
  onTagToggle,
  onClearTags,
  selectedCategories,
  onCategoryToggle,
  onClearCategories,
  categoryCounts,
  categoryColors,
}: FilterButtonBarProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);

  // Refs for positioning dropdowns
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const sportButtonRef = useRef<HTMLButtonElement>(null);
  const tagButtonRef = useRef<HTMLButtonElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const handleDropdownToggle = (dropdown: OpenDropdown) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const closeAllDropdowns = () => {
    setOpenDropdown(null);
  };

  // Calculate active filter counts
  const displayFilterActive = visibilityFilter !== "UNHIDDEN_ONLY";
  const sportFilterCount = selectedSports.length;
  const tagFilterCount = selectedTagIds.length;
  const categoryFilterCount = selectedCategories.length;

  // Check if all filters are selected (for outline-only styling)
  const TOTAL_CATEGORIES = 5;
  const allCategoriesSelected = selectedCategories.length === TOTAL_CATEGORIES;
  const allSportsSelected =
    availableSports.length > 0 &&
    selectedSports.length === availableSports.length;
  const allTagsSelected =
    availableTags.length > 0 && selectedTagIds.length === availableTags.length;

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {/* Display Filter Button */}
        <button
          ref={displayButtonRef}
          onClick={() => handleDropdownToggle("display")}
          className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-3 min-w-[100px] rounded-2xl shadow-2xl border transition-all text-sm font-medium cursor-pointer ${
            displayFilterActive || openDropdown === "display"
              ? "bg-[#004aad] text-white border-[#004aad]"
              : "bg-white/95 backdrop-blur-xl text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            <span className="whitespace-nowrap">Display</span>
            {displayFilterActive && (
              <span className="px-1 py-0.5 bg-white/20 rounded-full text-xs">
                1
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Sport Filter Button */}
        <button
          ref={sportButtonRef}
          onClick={() => handleDropdownToggle("sport")}
          className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-3 min-w-[90px] rounded-2xl shadow-2xl border transition-all text-sm font-medium cursor-pointer ${
            openDropdown === "sport"
              ? "bg-[#004aad] text-white border-[#004aad]"
              : allSportsSelected
                ? "bg-white/95 backdrop-blur-xl text-[#004aad] border-2 border-[#004aad] hover:bg-slate-50"
                : sportFilterCount > 0
                  ? "bg-[#004aad] text-white border-[#004aad]"
                  : "bg-white/95 backdrop-blur-xl text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            <span className="whitespace-nowrap">Sport</span>
            {sportFilterCount > 0 && (
              <span className="px-1 py-0.5 bg-white/20 rounded-full text-xs">
                {sportFilterCount}
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Tag Filter Button */}
        <button
          ref={tagButtonRef}
          onClick={() => handleDropdownToggle("tag")}
          className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-3 min-w-[85px] rounded-2xl shadow-2xl border transition-all text-sm font-medium cursor-pointer ${
            openDropdown === "tag"
              ? "bg-[#004aad] text-white border-[#004aad]"
              : allTagsSelected
                ? "bg-white/95 backdrop-blur-xl text-[#004aad] border-2 border-[#004aad] hover:bg-slate-50"
                : tagFilterCount > 0
                  ? "bg-[#004aad] text-white border-[#004aad]"
                  : "bg-white/95 backdrop-blur-xl text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <TagIcon className="w-4 h-4" />
            <span className="whitespace-nowrap">Tags</span>
            {tagFilterCount > 0 && (
              <span className="px-1 py-0.5 bg-white/20 rounded-full text-xs">
                {tagFilterCount}
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Category Filter Button */}
        <button
          ref={categoryButtonRef}
          onClick={() => handleDropdownToggle("category")}
          className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-3 min-w-[115px] rounded-2xl shadow-2xl border transition-all text-sm font-medium cursor-pointer ${
            openDropdown === "category"
              ? "bg-[#004aad] text-white border-[#004aad]"
              : allCategoriesSelected
                ? "bg-white/95 backdrop-blur-xl text-[#004aad] border-2 border-[#004aad] hover:bg-slate-50"
                : categoryFilterCount > 0
                  ? "bg-[#004aad] text-white border-[#004aad]"
                  : "bg-white/95 backdrop-blur-xl text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Grid3x3 className="w-4 h-4" />
            <span className="whitespace-nowrap">Categories</span>
            {categoryFilterCount > 0 && (
              <span className="px-1 py-0.5 bg-white/20 rounded-full text-xs">
                {categoryFilterCount}
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* More Filters Button */}
        {/* <button
          ref={moreButtonRef}
          onClick={() => handleDropdownToggle('more')}
          className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-3 min-w-[85px] rounded-2xl shadow-2xl border transition-all text-sm font-medium cursor-pointer ${
            openDropdown === 'more'
              ? 'bg-[#004aad] text-white border-[#004aad]'
              : 'bg-white/95 backdrop-blur-xl text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <MoreHorizontal className="w-4 h-4" />
            <span className="whitespace-nowrap">More</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5" />
        </button> */}
      </div>

      {/* Dropdown Components */}
      <DisplayFilterDropdown
        isOpen={openDropdown === "display"}
        onClose={closeAllDropdowns}
        selectedFilter={visibilityFilter}
        onFilterChange={onVisibilityFilterChange}
        buttonRef={displayButtonRef}
      />

      <SportFilterDropdown
        isOpen={openDropdown === "sport"}
        onClose={closeAllDropdowns}
        availableSports={availableSports}
        selectedSports={selectedSports}
        onSportToggle={onSportToggle}
        onClearSports={onClearSports}
        sportEmojis={sportEmojis}
        buttonRef={sportButtonRef}
      />

      <TagFilterDropdown
        isOpen={openDropdown === "tag"}
        onClose={closeAllDropdowns}
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
        onTagToggle={onTagToggle}
        onClearTags={onClearTags}
        buttonRef={tagButtonRef}
      />

      <CategoryFilterDropdown
        isOpen={openDropdown === "category"}
        onClose={closeAllDropdowns}
        selectedCategories={selectedCategories}
        onCategoryToggle={onCategoryToggle}
        onClearCategories={onClearCategories}
        categoryCounts={categoryCounts}
        categoryColors={categoryColors}
        buttonRef={categoryButtonRef}
      />

      <MoreFiltersDropdown
        isOpen={openDropdown === "more"}
        onClose={closeAllDropdowns}
        buttonRef={moreButtonRef}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
