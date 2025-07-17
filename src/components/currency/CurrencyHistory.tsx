/**
 * Currency transaction history component
 */

import React, { useState, useEffect } from 'react';
import { CurrencyService } from '../../services/currencyService';
import { CurrencyHistory as CurrencyHistoryType, CurrencyTransaction, CurrencySource } from '../../types/currency';
import { CurrencyDisplay } from './CurrencyDisplay';
import './CurrencyHistory.css';

interface CurrencyHistoryProps {
  userId: string;
  className?: string;
}

export const CurrencyHistory: React.FC<CurrencyHistoryProps> = ({
  userId,
  className = '',
}) => {
  const [history, setHistory] = useState<CurrencyHistoryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<CurrencySource | ''>('');

  useEffect(() => {
    loadHistory();
  }, [userId, currentPage, sourceFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const historyData = await CurrencyService.getCurrencyHistory({
        userId,
        page: currentPage,
        limit: 20,
        source: sourceFilter || undefined,
      });

      setHistory(historyData);
    } catch (err) {
      console.error('Error loading currency history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load currency history');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSourceFilterChange = (source: CurrencySource | '') => {
    setSourceFilter(source);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const formatTransactionTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className={`currency-history ${className}`}>
        <div className="currency-history__loading">
          <div className="loading-spinner"></div>
          <span>Loading transaction history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`currency-history ${className}`}>
        <div className="currency-history__error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={loadHistory} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!history || history.transactions.length === 0) {
    return (
      <div className={`currency-history ${className}`}>
        <div className="currency-history__empty">
          <span className="empty-icon">💰</span>
          <h3>No Transaction History</h3>
          <p>Start playing to earn your first steam coins!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`currency-history ${className}`}>
      <div className="currency-history__header">
        <h3>Transaction History</h3>
        <div className="currency-history__filters">
          <select
            value={sourceFilter}
            onChange={(e) => handleSourceFilterChange(e.target.value as CurrencySource | '')}
            className="source-filter"
          >
            <option value="">All Sources</option>
            <option value="activity">Activity Rewards</option>
            <option value="crafting">Crafting</option>
            <option value="harvesting">Harvesting</option>
            <option value="combat">Combat</option>
            <option value="auction">Marketplace</option>
            <option value="guild">Guild</option>
          </select>
        </div>
      </div>

      <div className="currency-history__list">
        {history.transactions.map((transaction) => (
          <TransactionItem
            key={transaction.transactionId}
            transaction={transaction}
            formatTime={formatTransactionTime}
          />
        ))}
      </div>

      {history.totalPages > 1 && (
        <div className="currency-history__pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {history.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === history.totalPages}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

interface TransactionItemProps {
  transaction: CurrencyTransaction;
  formatTime: (timestamp: Date) => string;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, formatTime }) => {
  const typeIcon = CurrencyService.getTransactionTypeIcon(transaction.type);
  const sourceDisplayName = CurrencyService.getSourceDisplayName(transaction.source);

  return (
    <div className={`transaction-item transaction-item--${transaction.type}`}>
      <div className="transaction-item__icon">
        {typeIcon}
      </div>
      <div className="transaction-item__details">
        <div className="transaction-item__description">
          {transaction.description}
        </div>
        <div className="transaction-item__meta">
          <span className="transaction-item__source">{sourceDisplayName}</span>
          <span className="transaction-item__time">{formatTime(transaction.timestamp)}</span>
        </div>
      </div>
      <div className="transaction-item__amount">
        <CurrencyDisplay
          amount={transaction.amount}
          size="small"
          showIcon={false}
          className={`amount--${transaction.type}`}
        />
        <div className="transaction-item__balance">
          Balance: <CurrencyDisplay amount={transaction.balanceAfter} size="small" showIcon={false} />
        </div>
      </div>
    </div>
  );
};

export default CurrencyHistory;