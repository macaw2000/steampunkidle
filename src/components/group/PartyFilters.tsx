/**
 * Party filters component for filtering available parties
 */

import React from 'react';
import { PartyRole } from '../../types/zone';
import './PartyFilters.css';

interface PartyFiltersProps {
  filters: {
    minLevel: number;
    maxLevel: number;
    visibility: 'all' | 'public' | 'guild';
    hasSpace: boolean;
    needsRole?: 'any' | PartyRole;
  };
  onFiltersChange: (filters: any) => void;
  maxLevel: number;
  showRoleFilter?: boolean;
}

export const PartyFilters: React.FC<PartyFiltersProps> = ({
  filters,
  onFiltersChange,
  maxLevel,
  showRoleFilter = false
}) => {
  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      minLevel: 1,
      maxLevel: 100,
      visibility: 'all',
      hasSpace: true,
      ...(showRoleFilter && { needsRole: 'any' })
    });
  };

  return (
    <div className="party-filters">
      <div className="filters-header">
        <h5>Filters</h5>
        <button className="reset-filters" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className="filters-grid">
        <div className="filter-group">
          <label>Min Level</label>
          <input
            type="number"
            min="1"
            max={maxLevel}
            value={filters.minLevel}
            onChange={(e) => handleFilterChange('minLevel', parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="filter-group">
          <label>Max Level</label>
          <input
            type="number"
            min={filters.minLevel}
            max="100"
            value={filters.maxLevel}
            onChange={(e) => handleFilterChange('maxLevel', parseInt(e.target.value) || 100)}
          />
        </div>

        <div className="filter-group">
          <label>Visibility</label>
          <select
            value={filters.visibility}
            onChange={(e) => handleFilterChange('visibility', e.target.value)}
          >
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="guild">Guild Only</option>
          </select>
        </div>

        {showRoleFilter && filters.needsRole !== undefined && (
          <div className="filter-group">
            <label>Needs Role</label>
            <select
              value={filters.needsRole}
              onChange={(e) => handleFilterChange('needsRole', e.target.value)}
            >
              <option value="any">Any</option>
              <option value="tank">Tank 🛡️</option>
              <option value="healer">Healer ⚕️</option>
              <option value="dps">DPS ⚔️</option>
            </select>
          </div>
        )}

        <div className="filter-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.hasSpace}
              onChange={(e) => handleFilterChange('hasSpace', e.target.checked)}
            />
            <span className="checkbox-text">Has Available Space</span>
          </label>
        </div>
      </div>

      <div className="active-filters">
        {filters.minLevel > 1 && (
          <span className="filter-tag">
            Min Level: {filters.minLevel}
            <button onClick={() => handleFilterChange('minLevel', 1)}>×</button>
          </span>
        )}
        
        {filters.maxLevel < 100 && (
          <span className="filter-tag">
            Max Level: {filters.maxLevel}
            <button onClick={() => handleFilterChange('maxLevel', 100)}>×</button>
          </span>
        )}
        
        {filters.visibility !== 'all' && (
          <span className="filter-tag">
            {filters.visibility === 'public' ? 'Public Only' : 'Guild Only'}
            <button onClick={() => handleFilterChange('visibility', 'all')}>×</button>
          </span>
        )}
        
        {showRoleFilter && filters.needsRole && filters.needsRole !== 'any' && (
          <span className="filter-tag">
            Needs {filters.needsRole}
            <button onClick={() => handleFilterChange('needsRole', 'any')}>×</button>
          </span>
        )}
        
        {!filters.hasSpace && (
          <span className="filter-tag">
            Including Full Parties
            <button onClick={() => handleFilterChange('hasSpace', true)}>×</button>
          </span>
        )}
      </div>
    </div>
  );
};

export default PartyFilters;