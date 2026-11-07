import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { searchService } from "@/services/searchService";
import type { SearchResultType } from "@idm/shared-types";

const typeLabels: Record<SearchResultType, string> = {
  customer: "زبون",
  supplier: "مورد",
  product: "منتج",
  invoice: "فاتورة",
  milk_purchase: "شراء حليب",
  purchase_invoice: "فاتورة شراء",
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SmartSearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["smart-search", debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(link: string) {
    setIsOpen(false);
    setQuery("");
    navigate(link);
  }

  const showDropdown = isOpen && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="بحث عن زبون، مورد، منتج، فاتورة..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث">
            <X size={14} className="text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-gray-200 bg-surface py-1 shadow-lg">
          {isFetching && <p className="px-3 py-2 text-xs text-gray-400">جاري البحث...</p>}
          {!isFetching && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">لا توجد نتائج مطابقة</p>
          )}
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              onClick={() => goTo(result.link)}
              className="flex w-full flex-col items-start px-3 py-2 text-right hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-800">{result.title}</span>
              <span className="text-xs text-gray-400">
                {typeLabels[result.type]} — {result.subtitle}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
