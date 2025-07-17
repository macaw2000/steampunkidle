/**
 * Currency display component for showing player's steam coins
 */

import React from 'react';
import { CurrencyService } from '../../services/currencyService';
import './CurrencyDisplay.css';

interface CurrencyDisplayProps {
  amount: number;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  showIcon = true,
  showLabel = false,
  size = 'medium',
  className = '',
}) => {
  const formattedAmount = CurrencyService.formatCurrency(amount);
  const currencyIcon = CurrencyService.getCurrencyIcon();
  const currencyName = CurrencyService.getCurrencyDisplayName();

  return (
    <div className={`currency-display currency-display--${size} ${className}`}>
      {showIcon && (
        <span className="currency-display__icon" aria-label={currencyName}>
          {currencyIcon}
        </span>
      )}
      <span className="currency-display__amount" title={`${amount.toLocaleString()} ${currencyName}`}>
        {formattedAmount}
      </span>
      {showLabel && (
        <span className="currency-display__label">
          {currencyName}
        </span>
      )}
    </div>
  );
};

export default CurrencyDisplay;