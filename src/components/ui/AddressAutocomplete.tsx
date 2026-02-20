import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface ParsedAddress {
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface GeoapifyResult {
  formatted: string;
  housenumber?: string;
  street?: string;
  city?: string;
  state_code?: string;
  postcode?: string;
  country_code?: string;
  address_line1?: string;
  address_line2?: string;
  result_type?: string;
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: ParsedAddress) => void;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const GEOAPIFY_API_KEY = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY as string | undefined;

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onAddressSelect,
  value: externalValue,
  onChange: externalOnChange,
  placeholder = 'Start typing your address...',
  className = '',
  disabled = false,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const inputValue = externalValue !== undefined ? externalValue : internalValue;

  const [suggestions, setSuggestions] = useState<GeoapifyResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the user just selected a suggestion to suppress re-fetching
  const justSelectedRef = useRef(false);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (!GEOAPIFY_API_KEY || text.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        text,
        apiKey: GEOAPIFY_API_KEY,
        filter: 'countrycode:us',
        format: 'json',
        limit: '5',
        type: 'street',
      });

      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?${params}`
      );

      if (!response.ok) return;

      const data = await response.json();
      const results: GeoapifyResult[] = data.results || [];
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (externalOnChange) {
      externalOnChange(newValue);
    } else {
      setInternalValue(newValue);
    }

    // Don't fetch if we just selected a suggestion
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (newValue.length >= 3) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, 300);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const parseAddress = (result: GeoapifyResult): ParsedAddress => {
    let line1 = '';
    if (result.housenumber && result.street) {
      line1 = `${result.housenumber} ${result.street}`;
    } else if (result.address_line1) {
      line1 = result.address_line1;
    } else if (result.street) {
      line1 = result.street;
    }

    return {
      address_line1: line1,
      address_line2: '',
      city: result.city || '',
      state: (result.state_code || '').toUpperCase(),
      zip: result.postcode || '',
      country: 'US',
    };
  };

  const handleSelect = (result: GeoapifyResult) => {
    const parsed = parseAddress(result);

    // Set the input to the street address
    justSelectedRef.current = true;
    if (externalOnChange) {
      externalOnChange(parsed.address_line1);
    } else {
      setInternalValue(parsed.address_line1);
    }

    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onAddressSelect(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const formatSuggestion = (result: GeoapifyResult): string => {
    return result.formatted || '';
  };

  if (!GEOAPIFY_API_KEY) {
    // Fallback to plain input if no API key
    return (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          if (externalOnChange) externalOnChange(e.target.value);
          else setInternalValue(e.target.value);
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {suggestions.map((result, index) => (
            <li
              key={index}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(result);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-4 py-3 cursor-pointer text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-emerald-50 text-emerald-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{formatSuggestion(result)}</span>
              </div>
            </li>
          ))}
          <li className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100">
            Powered by Geoapify
          </li>
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
