import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { AuctionListing } from '../../types/auction';
import { AuctionService } from '../../services/auctionService';
import AuctionManagementCard from './AuctionManagementCard';
import './MyAuctions.css';

type AuctionFilter = 'all' | 'active' | 'sold' | 'expired' | 'cancelled';
type AuctionCategory = 'selling' | 'bidding';

const MyAuctions: React.FC = () => {
  const [auctions, setAuctions] = useState<{
    selling: {
      active: AuctionListing[];
      expired: AuctionListing[];
      sold: AuctionListing[];
      cancelled: AuctionListing[];
    };
    bidding: {
      active: AuctionListing[];
      expired: AuctionListing[];
      sold: AuctionListing[];
      cancelled: AuctionListing[];
    };
    summary: {
      totalSelling: number;
      totalBidding: number;
      activeSelling: number;
      activeBidding: number;
    };
  } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<AuctionCategory>('selling');
  const [activeFilter, setActiveFilter] = useState<AuctionFilter>('all');

  const { character } = useSelector((state: RootState) => state.game);

  useEffect(() => {
    if (character) {
      loadUserAuctions();
    }
  }, [character]);

  const loadUserAuctions = async () => {
    if (!character) return;

    setLoading(true);
    setError(null);

    try {
      const result = await AuctionService.getUserAuctions(character.userId);
      setAuctions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auctions');
      console.error('Error loading user auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuctionUpdate = () => {
    loadUserAuctions();
  };

  const getFilteredAuctions = (): AuctionListing[] => {
    if (!auctions) return [];

    const categoryAuctions = auctions[activeCategory];
    
    if (activeFilter === 'all') {
      return [
        ...categoryAuctions.active,
        ...categoryAuctions.sold,
        ...categoryAuctions.expired,
        ...categoryAuctions.cancelled,
      ];
    }

    return categoryAuctions[activeFilter] || [];
  };

  const filteredAuctions = getFilteredAuctions();

  if (!character) {
    return (
      <div className="my-auctions">
        <div className="auctions-error">
          <p>Character required to view auctions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-auctions">
      <div className="auctions-header">
        <h3>📊 My Auctions</h3>
        <button 
          className="refresh-button"
          onClick={loadUserAuctions}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      {auctions && (
        <div className="auctions-summary">
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Selling:</span>
              <span className="stat-value">
                {auctions.summary.activeSelling} active / {auctions.summary.totalSelling} total
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Bidding:</span>
              <span className="stat-value">
                {auctions.summary.activeBidding} active / {auctions.summary.totalBidding} total
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="auctions-controls">
        <div className="category-tabs">
          <button
            className={`category-tab ${activeCategory === 'selling' ? 'active' : ''}`}
            onClick={() => setActiveCategory('selling')}
          >
            📤 Selling
          </button>
          <button
            className={`category-tab ${activeCategory === 'bidding' ? 'active' : ''}`}
            onClick={() => setActiveCategory('bidding')}
          >
            📥 Bidding
          </button>
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${activeFilter === 'active' ? 'active' : ''}`}
            onClick={() => setActiveFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-tab ${activeFilter === 'sold' ? 'active' : ''}`}
            onClick={() => setActiveFilter('sold')}
          >
            Sold
          </button>
          <button
            className={`filter-tab ${activeFilter === 'expired' ? 'active' : ''}`}
            onClick={() => setActiveFilter('expired')}
          >
            Expired
          </button>
          <button
            className={`filter-tab ${activeFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveFilter('cancelled')}
          >
            Cancelled
          </button>
        </div>
      </div>

      {error && (
        <div className="auctions-error">
          <p>❌ {error}</p>
          <button onClick={loadUserAuctions}>Try Again</button>
        </div>
      )}

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading your auctions...</p>
        </div>
      )}

      <div className="auctions-list">
        {filteredAuctions.length === 0 && !loading && !error && (
          <div className="no-auctions">
            <div className="no-auctions-icon">
              {activeCategory === 'selling' ? '📤' : '📥'}
            </div>
            <h4>No {activeCategory} auctions found</h4>
            <p>
              {activeCategory === 'selling' 
                ? 'Create your first auction to start selling items!'
                : 'Start bidding on items to see them here!'
              }
            </p>
          </div>
        )}

        {filteredAuctions.map((auction) => (
          <AuctionManagementCard
            key={auction.listingId}
            auction={auction}
            currentUserId={character.userId}
            category={activeCategory}
            onAuctionUpdate={handleAuctionUpdate}
          />
        ))}
      </div>
    </div>
  );
};

export default MyAuctions;