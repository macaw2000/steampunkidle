import React, { useState, useEffect } from 'react';
import { AuctionListing } from '../../types/auction';
import { AuctionService } from '../../services/auctionService';
import './AuctionManagementCard.css';

interface AuctionManagementCardProps {
  auction: AuctionListing;
  currentUserId: string;
  category: 'selling' | 'bidding';
  onAuctionUpdate: () => void;
}

const AuctionManagementCard: React.FC<AuctionManagementCardProps> = ({
  auction,
  currentUserId,
  category,
  onAuctionUpdate,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(auction.expiresAt).getTime();
      const remaining = expiresAt - now;
      
      setTimeRemaining(remaining);
      setIsExpired(remaining <= 0);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [auction.expiresAt]);

  const handleCancelAuction = async () => {
    if (!window.confirm('Are you sure you want to cancel this auction?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await AuctionService.cancelAuction(auction.listingId, currentUserId);
      onAuctionUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel auction');
    } finally {
      setLoading(false);
    }
  };

  const currentPrice = auction.currentBid || auction.startingPrice;
  const rarityColor = AuctionService.getRarityColor(auction.itemRarity);
  const isOwnAuction = auction.sellerId === currentUserId;
  const canCancel = isOwnAuction && auction.status === 'active' && !auction.currentBid;

  const getStatusIcon = (status: string) => {
    const icons = {
      active: '🟢',
      sold: '✅',
      expired: '⏰',
      cancelled: '❌',
    };
    return icons[status as keyof typeof icons] || '❓';
  };

  const getActionText = () => {
    if (category === 'selling') {
      return isOwnAuction ? 'Your Listing' : 'Selling';
    } else {
      return auction.currentBidderId === currentUserId ? 'Your Bid' : 'Bidding';
    }
  };

  return (
    <div className={`auction-management-card ${auction.status} ${category}`}>
      <div className="card-header">
        <div className="item-info">
          <h4 
            className="item-name"
            style={{ color: rarityColor }}
          >
            {auction.itemName}
          </h4>
          <div className="item-details">
            <span className="item-rarity" style={{ color: rarityColor }}>
              {auction.itemRarity.charAt(0).toUpperCase() + auction.itemRarity.slice(1)}
            </span>
            {auction.quantity > 1 && (
              <span className="item-quantity">x{auction.quantity}</span>
            )}
          </div>
        </div>
        
        <div className="status-info">
          <span className={`status-badge ${auction.status}`}>
            {getStatusIcon(auction.status)} {AuctionService.getStatusDisplayText(auction.status)}
          </span>
          <span className="action-type">{getActionText()}</span>
        </div>
      </div>

      <div className="card-body">
        <div className="auction-details">
          <div className="detail-row">
            <span className="detail-label">
              {category === 'selling' ? 'Buyer:' : 'Seller:'}
            </span>
            <span className="detail-value">
              {category === 'selling' 
                ? (auction.currentBidderName || 'No bids yet')
                : auction.sellerName
              }
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Starting Price:</span>
            <span className="detail-value">💰 {auction.startingPrice}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Current Price:</span>
            <span className="detail-value">💰 {currentPrice}</span>
          </div>

          {auction.buyoutPrice && (
            <div className="detail-row">
              <span className="detail-label">Buyout Price:</span>
              <span className="detail-value">💰 {auction.buyoutPrice}</span>
            </div>
          )}

          <div className="detail-row">
            <span className="detail-label">
              {isExpired ? 'Expired:' : 'Time Remaining:'}
            </span>
            <span className={`detail-value ${isExpired ? 'expired' : ''}`}>
              {AuctionService.formatTimeRemaining(timeRemaining)}
            </span>
          </div>

          {auction.bidHistory.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Total Bids:</span>
              <span className="detail-value">{auction.bidHistory.length}</span>
            </div>
          )}
        </div>

        {category === 'selling' && auction.status === 'sold' && (
          <div className="sale-summary">
            <div className="sale-info">
              <span className="sale-label">Final Sale:</span>
              <span className="sale-value">💰 {currentPrice}</span>
            </div>
            <div className="fee-info">
              <span className="fee-label">Fees:</span>
              <span className="fee-value">💰 {auction.fees.totalFees}</span>
            </div>
            <div className="profit-info">
              <span className="profit-label">Net Profit:</span>
              <span className="profit-value">
                💰 {currentPrice - auction.fees.totalFees}
              </span>
            </div>
          </div>
        )}

        {category === 'bidding' && auction.currentBidderId === currentUserId && (
          <div className="bid-status">
            <div className="current-bid-info">
              <span className="bid-label">Your Bid:</span>
              <span className="bid-value">💰 {auction.currentBid}</span>
            </div>
            {auction.status === 'active' && (
              <div className="bid-status-text">
                {isExpired ? '⏰ Auction ended' : '🎯 You are the highest bidder'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-actions">
        {error && (
          <div className="action-error">
            <span>❌ {error}</span>
          </div>
        )}

        {canCancel && (
          <button
            className="cancel-auction-button"
            onClick={handleCancelAuction}
            disabled={loading}
          >
            {loading ? 'Cancelling...' : '❌ Cancel Auction'}
          </button>
        )}

        {auction.status === 'active' && !canCancel && isOwnAuction && auction.currentBid && (
          <div className="cannot-cancel-notice">
            <span>⚠️ Cannot cancel - auction has bids</span>
          </div>
        )}

        <div className="auction-metadata">
          <span className="created-date">
            Created: {new Date(auction.createdAt).toLocaleDateString()}
          </span>
          {auction.completedAt && (
            <span className="completed-date">
              Completed: {new Date(auction.completedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionManagementCard;