"use client";

export default function CuisineFilterBar({ cuisines = [], activeCuisineId, onSelect }) {
  return (
    <div className="flex w-full overflow-x-auto no-scrollbar gap-2 py-1">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full border px-3.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-semibold transition-all whitespace-nowrap font-[Poppins] ${
          !activeCuisineId
            ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
            : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
        }`}
      >
        All
      </button>
      {cuisines.map(cuisine => (
        <button
          key={cuisine._id}
          onClick={() => onSelect(cuisine._id)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-semibold transition-all whitespace-nowrap font-[Poppins] ${
            activeCuisineId === cuisine._id
              ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
          }`}
        >
          {cuisine.name}
        </button>
      ))}
    </div>
  );
}
