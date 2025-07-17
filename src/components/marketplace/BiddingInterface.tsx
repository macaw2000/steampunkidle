import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { AuctionListing } from '../../types/auction';
import { AuctionService } from '../../services/auctionService';
import './BiddingInterface.css';

interface BiddingInterfaceProps {
  auction: AuctionListing;
  currentUserId: string;
  onClose: () => void;
  onBidSuccess: () => void;
  onBuyoutSuccess: () => void;
}

const BiddingInterface: React.FC<BiddingInterfaceProps> = ({
  auction,
  currentUserId,
  onClose,
  onBidSuccess,
  onBuyoutSuccess,
}) => {
  const [bidAmount, setBidAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { character } = useSelector((state: RootState) => state.game);

  const currentPrice = auction.currentBid || auction.startingPrice;
  const minimumBid = currentPrice + 1;
  const userCurrency = character?.currency || 0;

  const canBuyout = auction.buyoutPrice && auction.auctionType !== 'auction';
  const canAffordBid = bidAmount ? AuctionService.canAffordBid(userCurrency, parseInt(bidAmount, 10)) : false;
  const canAffordBuyout = canBuyout ? AuctionService.canAffordBid(userCurrency, auction.buyoutPrice!) : false;

  const handleBidAmountChange = (value: string) => {
    // Allow empty string or valid positive numbers
    if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) >= 0)) {
      setBidAmount(value);
      setError(null);
    }
  };

  const validateBid = (amount: number): string | null => {
    if (amount < minimumBid) {
      return `Bid must be at least ${minimumBid} (current price + 1)`;
    }
    if (amount > userCurrency) {
      return `Insufficient funds. You have ${userCurrency} Steam Coins`;
    }
    if (amount > 999999) {
      return 'Bid cannot exceed 999,999 Steam Coins';
    }
    return null;
  };

  const handlePlaceBid = async () => {
    if (!bidAmount) return;

    const amount = parseInt(bidAmount, 10);
    const validationError = validateBid(amount);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await AuctionService.placeBid({
        listingId: auction.listingId,
        bidderId: currentUserId,
        bidAmount: amount,
      });

      setSuccess(`Bid placed successfully for ${amount} Steam Coins!`);
      setTimeout(() => {
        onBidSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyout = async () => {
    if (!canBuyout || !auction.buyoutPrice) return;

    if (!canAffordBuyout) {
      setError(`Insufficient funds. You need ${auction.buyoutPrice} Steam Coins`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await AuctionService.buyoutAuction({
        listingId: auction.listingId,
        buyerId: currentUserId,
      });

      setSuccess(`Item purchased successfully for ${auction.buyoutPrice} Steam Coins!`);
      setTimeout(() => {
        onBuyoutSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bidding-interface-overlay">
      <div className="bidding-interface">
        <div className="bidding-header">
          <h3>💰 Bid on {auction.itemName}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="auction-summary">
          <div className="item-info">
            <span className="item-name">{auction.itemName}</span>
            <span className="item-rarity" style={{ color: AuctionService.getRarityColor(auction.itemRarity) }}>
              {auction.itemRarity.charAt(0).toUpperCase() + auction.itemRarity.slice(1)}
            </span>
          </div>
          
          <div className="price-summary">
            <div className="current-price">
              <span>Current Price: </span>
              <strong>💰 {currentPrice}</strong>
            </div>
            {auction.buyoutPrice && (
              <div className="buyout-price">
                <span>Buyout Price: </span>
                <strong>💰 {auction.buyoutPrice}</strong>
              </div>
            )}
          </div>

          <div className="user-currency">
            <span>Your Currency: </span>
            <strong>💰 {userCurrency}</strong>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
          </div>
        )}

        {success && (
          <div className="success-message">
            <span>✅ {success}</span>
          </div>
        )}

        {!success && (
          <div className="bidding-actions">
            <div className="bid-section">
              <h4>Place Bid</h4>
              <div className="bid-input-group">
                <label htmlFor="bidAmount">
                  Bid Amount (minimum: {minimumBid})
                </label>
                <input
                  id="bidAmount"
                  type="number"
                  min={minimumBid}
                  max={Math.min(userCurrency, 999999)}
                  value={bidAmount}
                  onChange={(e) => handleBidAmountChange(e.target.value)}
                  placeholder={`Enter amount (min: ${minimumBid})`}
                  disabled={loading}
                />
              </div>
              
              <button
                className="place-bid-button"
                onClick={handlePlaceBid}
                disabled={loading || !bidAmount || !canAffordBid}
              >
                {loading ? 'Placing Bid...' : `Place Bid (${bidAmount || '0'})`}
              </button>

              {bidAmount && !canAffordBid && (
                <div className="insufficient-funds-warning">
                  ⚠️ Insufficient funds for this bid
                </div>
              )}
            </div>

            {canBuyout && (
              <div className="buyout-section">
                <h4>Buy Now</h4>
                <p>Purchase immediately for {auction.buyoutPrice} Steam Coins</p>
                
                <button
                  className="buyout-button"
                  onClick={handleBuyout}
                  disabled={loading || !canAffordBuyout}
                >
                  {loading ? 'Processing...' : `Buy Now (${auction.buyoutPrice})`}
                </button>

                {!canAffordBuyout && (
                  <div className="insufficient-funds-warning">
                    ⚠️ Insufficient funds for buyout
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bidding-footer">
          <button className="cancel-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BiddingInterface;