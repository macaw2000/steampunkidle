import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import AuctionBrowser from './AuctionBrowser';
import CreateAuctionForm from './CreateAuctionForm';
import MyAuctions from './MyAuctions';
import './MarketplaceHub.css';

type MarketplaceTab = 'browse' | 'create' | 'manage';

const MarketplaceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const { character } = useSelector((state: RootState) => state.game);

  if (!character) {
    return (
      <div className="marketplace-hub">
        <div className="marketplace-error">
          <h3>Marketplace Unavailable</h3>
          <p>You need a character to access the marketplace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-hub">
      <div className="marketplace-header">
        <h2>🏪 Steampunk Marketplace</h2>
        <div className="currency-display">
          <span className="currency-amount">💰 {character.currency || 0} Steam Coins</span>
        </div>
      </div>

      <div className="marketplace-tabs">
        <button
          className={`tab-button ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          🔍 Browse Auctions
        </button>
        <button
          className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          📝 Create Auction
        </button>
        <button
          className={`tab-button ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          📊 My Auctions
        </button>
      </div>

      <div className="marketplace-content">
        {activeTab === 'browse' && <AuctionBrowser />}
        {activeTab === 'create' && <CreateAuctionForm />}
        {activeTab === 'manage' && <MyAuctions />}
      </div>
    </div>
  );
};

export default MarketplaceHub;