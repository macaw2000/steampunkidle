import React from 'react';
import { AuctionSearchFilters } from '../../types/auction';
import { AuctionService } from '../../services/auctionService';
import './SearchFilters.css';

interface SearchFiltersProps {
  filters: AuctionSearchFilters;
  onFilterChange: (filters: Partial<AuctionSearchFilters>) => void;
  loading: boolean;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onFilterChange,
  loading,
}) => {
  const suggestions = AuctionService.getSearchSuggestions();

  const handleInputChange = (field: keyof AuctionSearchFilters, value: any) => {
    onFilterChange({ [field]: value });
  };

  const handlePriceChange = (field: 'minPrice' | 'maxPrice', value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    if (value === '' || (!isNaN(numValue!) && numValue! >= 0)) {
      onFilterChange({ [field]: numValue });
    }
  };

  const clearFilters = () => {
    onFilterChange({
      itemType: undefined,
      rarity: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sellerName: undefined,
      sortBy: 'timeLeft',
      sortOrder: 'asc',
    });
  };

  const hasActiveFilters = !!(
    filters.itemType ||
    filters.rarity ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.sellerName
  );

  return (
    <div className="search-filters">
      <div className="filters-header">
        <h3>🔍 Search Filters</h3>
        {hasActiveFilters && (
          <button 
            className="clear-filters-button"
            onClick={clearFilters}
            disabled={loading}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="filters-grid">
        <div className="filter-group">
          <label htmlFor="itemType">Item Type</label>
          <select
            id="itemType"
            value={filters.itemType || ''}
            onChange={(e) => handleInputChange('itemType', e.target.value || undefined)}
            disabled={loading}
          >
            <option value="">All Types</option>
            {suggestions.itemTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="rarity">Rarity</label>
          <select
            id="rarity"
            value={filters.rarity || ''}
            onChange={(e) => handleInputChange('rarity', e.target.value || undefined)}
            disabled={loading}
          >
            <option value="">All Rarities</option>
            {suggestions.rarities.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="minPrice">Min Price</label>
          <input
            id="minPrice"
            type="number"
            min="0"
            placeholder="0"
            value={filters.minPrice || ''}
            onChange={(e) => handlePriceChange('minPrice', e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxPrice">Max Price</label>
          <input
            id="maxPrice"
            type="number"
            min="0"
            placeholder="No limit"
            value={filters.maxPrice || ''}
            onChange={(e) => handlePriceChange('maxPrice', e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="sellerName">Seller Name</label>
          <input
            id="sellerName"
            type="text"
            placeholder="Enter seller name"
            value={filters.sellerName || ''}
            onChange={(e) => handleInputChange('sellerName', e.target.value || undefined)}
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="sortBy">Sort By</label>
          <select
            id="sortBy"
            value={filters.sortBy || 'timeLeft'}
            onChange={(e) => handleInputChange('sortBy', e.target.value)}
            disabled={loading}
          >
            {suggestions.sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sortOrder">Order</label>
          <select
            id="sortOrder"
            value={filters.sortOrder || 'asc'}
            onChange={(e) => handleInputChange('sortOrder', e.target.value as 'asc' | 'desc')}
            disabled={loading}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="active-filters">
          <span className="active-filters-label">Active filters:</span>
          <div className="filter-tags">
            {filters.itemType && (
              <span className="filter-tag">
                Type: {filters.itemType}
                <button onClick={() => handleInputChange('itemType', undefined)}>×</button>
              </span>
            )}
            {filters.rarity && (
              <span className="filter-tag">
                Rarity: {filters.rarity}
                <button onClick={() => handleInputChange('rarity', undefined)}>×</button>
              </span>
            )}
            {filters.minPrice && (
              <span className="filter-tag">
                Min: {filters.minPrice}
                <button onClick={() => handleInputChange('minPrice', undefined)}>×</button>
              </span>
            )}
            {filters.maxPrice && (
              <span className="filter-tag">
                Max: {filters.maxPrice}
                <button onClick={() => handleInputChange('maxPrice', undefined)}>×</button>
              </span>
            )}
            {filters.sellerName && (
              <span className="filter-tag">
                Seller: {filters.sellerName}
                <button onClick={() => handleInputChange('sellerName', undefined)}>×</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilters;