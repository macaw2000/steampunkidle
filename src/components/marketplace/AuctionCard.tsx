import React, { useState, useEffect } from 'react';
import { AuctionListing } from '../../types/auction';
import { AuctionService } from '../../services/auctionService';
import BiddingInterface from './BiddingInterface';
import './AuctionCard.css';

interface AuctionCardProps {
  auction: AuctionListing;
  currentUserId: string;
  onAuctionUpdate: () => void;
}

const AuctionCard: React.FC<AuctionCardProps> = ({
  auction,
  currentUserId,
  onAuctionUpdate,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showBiddingInterface, setShowBiddingInterface] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

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

  const isOwnAuction = auction.sellerId === currentUserId;
  const canBid = !isOwnAuction && !isExpired && auction.status === 'active';
  const canBuyout = canBid && auction.buyoutPrice && auction.auctionType !== 'auction';

  const currentPrice = auction.currentBid || auction.startingPrice;
  const rarityColor = AuctionService.getRarityColor(auction.itemRarity);

  const handleBidSuccess = () => {
    setShowBiddingInterface(false);
    onAuctionUpdate();
  };

  const handleBuyoutSuccess = () => {
    onAuctionUpdate();
  };

  return (
    <div className={`auction-card ${auction.status} ${isExpired ? 'expired' : ''}`}>
      <div className="auction-header">
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
        <div className="auction-status">
          <span className={`status-badge ${auction.status}`}>
            {AuctionService.getStatusDisplayText(auction.status)}
          </span>
        </div>
      </div>

      <div className="auction-body">
        <div className="seller-info">
          <span className="seller-label">Seller:</span>
          <span className="seller-name">{auction.sellerName}</span>
        </div>

        <div className="price-info">
          <div className="current-price">
            <span className="price-label">Current Price:</span>
            <span className="price-value">💰 {currentPrice}</span>
          </div>
          
          {auction.buyoutPrice && (
            <div className="buyout-price">
              <span className="price-label">Buyout:</span>
              <span className="price-value">💰 {auction.buyoutPrice}</span>
            </div>
          )}
        </div>

        <div className="time-info">
          <span className="time-label">
            {isExpired ? 'Expired' : 'Time Remaining:'}
          </span>
          <span className={`time-value ${isExpired ? 'expired' : ''}`}>
            {AuctionService.formatTimeRemaining(timeRemaining)}
          </span>
        </div>

        {auction.currentBidderName && (
          <div className="current-bidder">
            <span className="bidder-label">Current Bidder:</span>
            <span className="bidder-name">{auction.currentBidderName}</span>
          </div>
        )}
      </div>

      <div className="auction-actions">
        {isOwnAuction && (
          <div className="own-auction-notice">
            <span>📝 Your Auction</span>
          </div>
        )}

        {canBid && (
          <div className="bid-actions">
            <button
              className="bid-button"
              onClick={() => setShowBiddingInterface(true)}
            >
              💰 Place Bid
            </button>
            
            {canBuyout && (
              <button
                className="buyout-button"
                onClick={() => {
                  // Handle buyout directly
                  setShowBiddingInterface(true);
                }}
              >
                ⚡ Buy Now
              </button>
            )}
          </div>
        )}

        {isExpired && auction.status === 'active' && (
          <div className="expired-notice">
            <span>⏰ Auction Expired</span>
          </div>
        )}

        {auction.status === 'sold' && (
          <div className="sold-notice">
            <span>✅ Sold</span>
          </div>
        )}
      </div>

      {showBiddingInterface && (
        <BiddingInterface
          auction={auction}
          currentUserId={currentUserId}
          onClose={() => setShowBiddingInterface(false)}
          onBidSuccess={handleBidSuccess}
          onBuyoutSuccess={handleBuyoutSuccess}
        />
      )}
    </div>
  );
};

export default AuctionCard;