import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilters from '../SearchFilters';
import { AuctionSearchFilters } from '../../../types/auction';
import { AuctionService } from '../../../services/auctionService';

// Mock AuctionService
jest.mock('../../../services/auctionService');
const mockAuctionService = AuctionService as jest.Mocked<typeof AuctionService>;

describe.skip('SearchFilters', () => {
  const mockFilters: AuctionSearchFilters = {
    sortBy: 'timeLeft',
    sortOrder: 'asc',
    limit: 20,
    offset: 0,
  };

  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuctionService.getSearchSuggestions.mockReturnValue({
      itemTypes: ['weapon', 'armor', 'trinket', 'material', 'consumable', 'tool'],
      rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      sortOptions: [
        { value: 'timeLeft', label: 'Time Remaining' },
        { value: 'price', label: 'Price' },
        { value: 'rarity', label: 'Rarity' },
        { value: 'name', label: 'Name' },
      ],
    });
  });

  it('renders search filters with all options', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    expect(screen.getByText('🔍 Search Filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Item Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Rarity')).toBeInTheDocument();
    expect(screen.getByLabelText('Min Price')).toBeInTheDocument();
    expect(screen.getByLabelText('Max Price')).toBeInTheDocument();
    expect(screen.getByLabelText('Seller Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort By')).toBeInTheDocument();
    expect(screen.getByLabelText('Order')).toBeInTheDocument();
  });

  it('calls onFilterChange when item type is selected', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    const itemTypeSelect = screen.getByLabelText('Item Type');
    fireEvent.change(itemTypeSelect, { target: { value: 'weapon' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ itemType: 'weapon' });
  });

  it('calls onFilterChange when rarity is selected', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    const raritySelect = screen.getByLabelText('Rarity');
    fireEvent.change(raritySelect, { target: { value: 'rare' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ rarity: 'rare' });
  });

  it('calls onFilterChange when price filters are set', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    const minPriceInput = screen.getByLabelText('Min Price');
    fireEvent.change(minPriceInput, { target: { value: '10' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ minPrice: 10 });

    const maxPriceInput = screen.getByLabelText('Max Price');
    fireEvent.change(maxPriceInput, { target: { value: '100' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ maxPrice: 100 });
  });

  it('calls onFilterChange when seller name is entered', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    const sellerNameInput = screen.getByLabelText('Seller Name');
    fireEvent.change(sellerNameInput, { target: { value: 'TestSeller' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ sellerName: 'TestSeller' });
  });

  it('calls onFilterChange when sort options are changed', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    const sortBySelect = screen.getByLabelText('Sort By');
    fireEvent.change(sortBySelect, { target: { value: 'price' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ sortBy: 'price' });

    const sortOrderSelect = screen.getByLabelText('Order');
    fireEvent.change(sortOrderSelect, { target: { value: 'desc' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ sortOrder: 'desc' });
  });

  it('shows active filters when filters are applied', () => {
    const filtersWithValues: AuctionSearchFilters = {
      ...mockFilters,
      itemType: 'weapon',
      rarity: 'rare',
      minPrice: 10,
      maxPrice: 100,
      sellerName: 'TestSeller',
    };

    render(
      <SearchFilters
        filters={filtersWithValues}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    expect(screen.getByText('Active filters:')).toBeInTheDocument();
    expect(screen.getByText('Type: weapon')).toBeInTheDocument();
    expect(screen.getByText('Rarity: rare')).toBeInTheDocument();
    expect(screen.getByText('Min: 10')).toBeInTheDocument();
    expect(screen.getByText('Max: 100')).toBeInTheDocument();
    expect(screen.getByText('Seller: TestSeller')).toBeInTheDocument();
  });

  it('shows clear all button when filters are active', () => {
    const filtersWithValues: AuctionSearchFilters = {
      ...mockFilters,
      itemType: 'weapon',
    };

    render(
      <SearchFilters
        filters={filtersWithValues}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('clears all filters when clear all button is clicked', () => {
    const filtersWithValues: AuctionSearchFilters = {
      ...mockFilters,
      itemType: 'weapon',
      rarity: 'rare',
    };

    render(
      <SearchFilters
        filters={filtersWithValues}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText('Clear All'));

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      itemType: undefined,
      rarity: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sellerName: undefined,
      sortBy: 'timeLeft',
      sortOrder: 'asc',
    });
  });

  it('removes individual filter tags when clicked', () => {
    const filtersWithValues: AuctionSearchFilters = {
      ...mockFilters,
      itemType: 'weapon',
      rarity: 'rare',
    };

    render(
      <SearchFilters
        filters={filtersWithValues}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    // Find and click the remove button for the weapon filter
    const weaponTag = screen.getByText('Type: weapon').closest('.filter-tag');
    const removeButton = weaponTag?.querySelector('button');
    
    if (removeButton) {
      fireEvent.click(removeButton);
      expect(mockOnFilterChange).toHaveBeenCalledWith({ itemType: undefined });
    }
  });

  it('disables inputs when loading', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={true}
      />
    );

    expect(screen.getByLabelText('Item Type')).toBeDisabled();
    expect(screen.getByLabelText('Rarity')).toBeDisabled();
    expect(screen.getByLabelText('Min Price')).toBeDisabled();
    expect(screen.getByLabelText('Max Price')).toBeDisabled();
    expect(screen.getByLabelText('Seller Name')).toBeDisabled();
    expect(screen.getByLabelText('Sort By')).toBeDisabled();
    expect(screen.getByLabelText('Order')).toBeDisabled();
  });

  it('validates price inputs to only accept positive numbers', () => {
    render(
      <SearchFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        loading={false}
      />
    );

    const minPriceInput = screen.getByLabelText('Min Price');
    
    // Valid positive number
    fireEvent.change(minPriceInput, { target: { value: '50' } });
    expect(mockOnFilterChange).toHaveBeenCalledWith({ minPrice: 50 });

    // Invalid negative number should not call onFilterChange
    mockOnFilterChange.mockClear();
    fireEvent.change(minPriceInput, { target: { value: '-10' } });
    expect(mockOnFilterChange).not.toHaveBeenCalled();

    // Empty string should clear the filter
    fireEvent.change(minPriceInput, { target: { value: '' } });
    expect(mockOnFilterChange).toHaveBeenCalledWith({ minPrice: undefined });
  });
});