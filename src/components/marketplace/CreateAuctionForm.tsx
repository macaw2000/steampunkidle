import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { CreateAuctionRequest, AuctionType } from '../../types/auction';
import { InventoryItem } from '../../types/item';
import { AuctionService } from '../../services/auctionService';
import './CreateAuctionForm.css';

const CreateAuctionForm: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState<Partial<CreateAuctionRequest>>({
    quantity: 1,
    startingPrice: 10,
    duration: 24,
    auctionType: 'both',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(true);

  const { character } = useSelector((state: RootState) => state.game);

  useEffect(() => {
    loadInventory();
  }, [character]);

  const loadInventory = async () => {
    if (!character) return;

    setLoadingInventory(true);
    try {
      // Mock inventory data - in real implementation, this would come from an API
      const mockInventory: InventoryItem[] = [
        {
          userId: character.userId,
          itemId: 'brass-gear-1',
          quantity: 5,
          acquiredAt: new Date(),
        },
        {
          userId: character.userId,
          itemId: 'steam-crystal-1',
          quantity: 2,
          acquiredAt: new Date(),
        },
        {
          userId: character.userId,
          itemId: 'copper-wrench-1',
          quantity: 1,
          acquiredAt: new Date(),
        },
      ];
      
      setInventory(mockInventory);
    } catch (err) {
      setError('Failed to load inventory');
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleItemSelect = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData(prev => ({
      ...prev,
      itemId: item.itemId,
      quantity: 1,
      // Set suggested starting price based on item rarity (mock data)
      startingPrice: AuctionService.getSuggestedStartingPrice('common'),
    }));
    setError(null);
  };

  const handleInputChange = (field: keyof CreateAuctionRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);

    // Auto-calculate buyout price when starting price changes
    if (field === 'startingPrice' && typeof value === 'number') {
      const suggestedBuyout = Math.floor(value * AuctionService.getSuggestedBuyoutMultiplier());
      setFormData(prev => ({ ...prev, buyoutPrice: suggestedBuyout }));
    }
  };

  const validateForm = (): string | null => {
    if (!character) return 'Character required';
    if (!selectedItem) return 'Please select an item to auction';
    if (!formData.quantity || formData.quantity < 1) return 'Quantity must be at least 1';
    if (formData.quantity > selectedItem.quantity) return 'Cannot auction more than you own';
    if (!formData.startingPrice || formData.startingPrice < 1) return 'Starting price must be at least 1';
    if (!formData.duration || formData.duration < 1 || formData.duration > 168) {
      return 'Duration must be between 1 and 168 hours';
    }
    if (formData.buyoutPrice && formData.buyoutPrice <= formData.startingPrice) {
      return 'Buyout price must be higher than starting price';
    }

    const listingFee = AuctionService.calculateListingFee(formData.startingPrice);
    if (!AuctionService.canAffordListing(character.currency || 0, formData.startingPrice)) {
      return `Insufficient funds for listing fee (${listingFee} Steam Coins)`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!character || !selectedItem) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const request: CreateAuctionRequest = {
      sellerId: character.userId,
      itemId: selectedItem.itemId,
      quantity: formData.quantity!,
      startingPrice: formData.startingPrice!,
      buyoutPrice: formData.buyoutPrice,
      duration: formData.duration!,
      auctionType: formData.auctionType as AuctionType,
    };

    const validation = AuctionService.validateCreateAuctionRequest(request);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await AuctionService.createAuction(request);
      setSuccess('Auction created successfully!');
      
      // Reset form
      setSelectedItem(null);
      setFormData({
        quantity: 1,
        startingPrice: 10,
        duration: 24,
        auctionType: 'both',
      });
      
      // Reload inventory
      loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

  const calculateFees = () => {
    if (!formData.startingPrice) return { listingFee: 0, successFee: 0, totalFees: 0 };
    
    return AuctionService.calculateTotalFees(
      formData.startingPrice,
      formData.buyoutPrice
    );
  };

  const fees = calculateFees();

  if (!character) {
    return (
      <div className="create-auction-form">
        <div className="form-error">
          <p>Character required to create auctions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-auction-form">
      <div className="form-header">
        <h3>📝 Create New Auction</h3>
        <div className="user-currency">
          Your Currency: <strong>💰 {character.currency || 0}</strong>
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

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h4>Select Item</h4>
          {loadingInventory ? (
            <div className="loading-inventory">Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div className="no-items">
              <p>No items available for auction.</p>
              <p>Craft or find items through activities to list them here.</p>
            </div>
          ) : (
            <div className="inventory-grid">
              {inventory.map((item) => (
                <div
                  key={item.itemId}
                  className={`inventory-item ${selectedItem?.itemId === item.itemId ? 'selected' : ''}`}
                  onClick={() => handleItemSelect(item)}
                >
                  <div className="item-name">{item.itemId.replace(/-/g, ' ')}</div>
                  <div className="item-quantity">x{item.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <>
            <div className="form-section">
              <h4>Auction Details</h4>
              
              <div className="form-group">
                <label htmlFor="quantity">
                  Quantity (max: {selectedItem.quantity})
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedItem.quantity}
                  value={formData.quantity || 1}
                  onChange={(e) => handleInputChange('quantity', parseInt(e.target.value, 10))}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="startingPrice">Starting Price</label>
                <input
                  id="startingPrice"
                  type="number"
                  min="1"
                  max="999999"
                  value={formData.startingPrice || ''}
                  onChange={(e) => handleInputChange('startingPrice', parseInt(e.target.value, 10))}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="buyoutPrice">
                  Buyout Price (optional)
                </label>
                <input
                  id="buyoutPrice"
                  type="number"
                  min={formData.startingPrice ? formData.startingPrice + 1 : 2}
                  max="999999"
                  value={formData.buyoutPrice || ''}
                  onChange={(e) => handleInputChange('buyoutPrice', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration">Duration (hours)</label>
                <select
                  id="duration"
                  value={formData.duration || 24}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value, 10))}
                  disabled={loading}
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                  <option value={168}>1 week</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="auctionType">Auction Type</label>
                <select
                  id="auctionType"
                  value={formData.auctionType || 'both'}
                  onChange={(e) => handleInputChange('auctionType', e.target.value)}
                  disabled={loading}
                >
                  <option value="auction">Auction Only</option>
                  <option value="buyout">Buyout Only</option>
                  <option value="both">Auction & Buyout</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h4>Fee Summary</h4>
              <div className="fee-breakdown">
                <div className="fee-item">
                  <span>Listing Fee (5%):</span>
                  <span>💰 {fees.listingFee}</span>
                </div>
                <div className="fee-item">
                  <span>Success Fee (10% if sold):</span>
                  <span>💰 {fees.successFee}</span>
                </div>
                <div className="fee-total">
                  <span>Total Upfront Cost:</span>
                  <span>💰 {fees.listingFee}</span>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="create-auction-button"
                disabled={loading || !selectedItem}
              >
                {loading ? 'Creating Auction...' : 'Create Auction'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default CreateAuctionForm;