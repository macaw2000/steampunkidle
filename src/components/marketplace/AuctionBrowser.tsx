import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { AuctionService } from '../../services/auctionService';
import { AuctionListing, AuctionSearchFilters } from '../../types/auction';
import AuctionCard from './AuctionCard';
import SearchFilters from './SearchFilters';
import './AuctionBrowser.css';

const AuctionBrowser: React.FC = () => {
  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuctionSearchFilters>({
    sortBy: 'timeLeft',
    sortOrder: 'asc',
    limit: 20,
    offset: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const { character } = useSelector((state: RootState) => state.game);

  const searchAuctions = useCallback(async (searchFilters: AuctionSearchFilters, append = false) => {
    if (!character) return;

    setLoading(true);
    setError(null);

    try {
      const result = await AuctionService.searchAuctions(searchFilters);
      
      if (append) {
        setAuctions(prev => [...prev, ...result.listings]);
      } else {
        setAuctions(result.listings);
      }
      
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auctions');
      console.error('Error searching auctions:', err);
    } finally {
      setLoading(false);
    }
  }, [character]);

  useEffect(() => {
    searchAuctions(filters);
  }, [searchAuctions, filters]);

  const handleFilterChange = (newFilters: Partial<AuctionSearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, offset: 0 };
    setFilters(updatedFilters);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      const newFilters = { ...filters, offset: auctions.length };
      setFilters(newFilters);
      searchAuctions(newFilters, true);
    }
  };

  const handleRefresh = () => {
    searchAuctions({ ...filters, offset: 0 });
  };

  if (!character) {
    return (
      <div className="auction-browser">
        <div className="browser-error">
          <p>Character required to browse auctions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auction-browser">
      <div className="browser-header">
        <div className="results-info">
          <span className="results-count">
            {totalCount > 0 ? `${totalCount} auctions found` : 'No auctions found'}
          </span>
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <SearchFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        loading={loading}
      />

      {error && (
        <div className="browser-error">
          <p>❌ {error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      <div className="auction-grid">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.listingId}
            auction={auction}
            currentUserId={character.userId}
            onAuctionUpdate={() => handleRefresh()}
          />
        ))}
      </div>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading auctions...</p>
        </div>
      )}

      {hasMore && !loading && (
        <div className="load-more-section">
          <button 
            className="load-more-button"
            onClick={handleLoadMore}
          >
            Load More Auctions
          </button>
        </div>
      )}

      {auctions.length === 0 && !loading && !error && (
        <div className="no-auctions">
          <div className="no-auctions-icon">🏪</div>
          <h3>No Auctions Found</h3>
          <p>Try adjusting your search filters or check back later.</p>
        </div>
      )}
    </div>
  );
};

export default AuctionBrowser;