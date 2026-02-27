/**
 * CarFlow Application State
 * Centralized reactive state management.
 */
const CF_STATE = {
  // Data
  masterData: null,         // Parsed master CSV rows
  adsData: null,            // Parsed ETL ads data (combined for selected variants)
  historyData: null,        // Parsed price history data
  masterFileList: null,     // Available master file names

  // Car selection
  selectedMake: null,
  selectedModel: null,
  selectedVariants: [],

  // Derived filter arrays (indices into masterData)
  makeFilter: null,
  modelFilter: null,
  variantsFilter: null,

  // Market page metrics
  demandMetric: null,       // { user_name, master_name, ... }
  profitMetric: null,

  // Market page chart max tracking (for consistent x-axis across 3 charts)
  demandBarChartMax: 0,
  profitBarChartMax: 0,

  // Ads page visualization options
  adsViz: {
    spainDealers: true,
    spainPrivate: true,
    spainEvolution: true,
    spainExcludeIslands: true,
    germanyDealers: true,
    germanyPrivate: true,
    germanyEvolution: false,
    closedAds: false,
  },

  // Ads page filters
  adsFilters: {
    kmMin: 0,
    kmMax: 500000,
    priceMin: 0,
    priceMax: 200000,
    yearMin: 2000,
    yearMax: 2026,
  },

  // Ads page sort & pagination
  adsSortMethod: 'price_asc',
  adsPage: 1,

  // Current page
  currentPage: 'market',

  // Loading state
  isLoading: false,

  // Listeners
  _listeners: [],

  /**
   * Subscribe to state changes.
   */
  on(callback) {
    this._listeners.push(callback);
  },

  /**
   * Notify listeners of a state change.
   */
  emit(changeType, detail) {
    for (const cb of this._listeners) {
      cb(changeType, detail);
    }
  },

  /**
   * Reset ads-related state when car selection changes.
   */
  resetAdsState() {
    this.adsData = null;
    this.historyData = null;
    this.adsPage = 1;
    this.adsFilters = {
      kmMin: 0,
      kmMax: 500000,
      priceMin: 0,
      priceMax: 200000,
      yearMin: 2000,
      yearMax: 2026,
    };
  },

  /**
   * Compute car selection filter as a boolean array over masterData.
   */
  getCarSelectionFilter() {
    if (!this.masterData) return [];
    return this.masterData.map(row => {
      let pass = true;
      if (this.selectedMake) pass = pass && row.Make === this.selectedMake;
      if (this.selectedModel) pass = pass && row['Product Model'] === this.selectedModel;
      if (this.selectedVariants.length > 0) pass = pass && this.selectedVariants.includes(row['Product Variant']);
      return pass;
    });
  },

  /**
   * Get unique sorted values from masterData column, optionally filtered.
   */
  getUniqueValues(column, filterFn) {
    if (!this.masterData) return [];
    let data = this.masterData;
    if (filterFn) data = data.filter(filterFn);
    const vals = [...new Set(data.map(r => r[column]).filter(v => v != null && v !== ''))];
    return vals.sort();
  },
};
