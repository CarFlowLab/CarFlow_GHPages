/**
 * CarFlow Data Layer
 * Handles fetching and parsing CSV data from GitHub (supports both public and private repos).
 */
const CF_DATA = {
  _cache: {},

  /**
   * Get auth headers for GitHub API requests.
   */
  _getHeaders() {
    const headers = { 'Accept': 'application/vnd.github.v3.raw' };
    if (CF_CONFIG.githubToken) {
      headers['Authorization'] = `token ${CF_CONFIG.githubToken}`;
    }
    return headers;
  },

  /**
   * Build a GitHub API URL for fetching file contents.
   */
  _apiUrl(path) {
    return `https://api.github.com/repos/${CF_CONFIG.REPO_OWNER}/${CF_CONFIG.REPO_NAME}/contents/${path}?ref=${CF_CONFIG.REPO_BRANCH}`;
  },

  /**
   * Build a raw GitHub URL (works for public repos without token).
   */
  _rawUrl(path) {
    return `https://raw.githubusercontent.com/${CF_CONFIG.REPO_OWNER}/${CF_CONFIG.REPO_NAME}/${CF_CONFIG.REPO_BRANCH}/${path}`;
  },

  /**
   * Fetch a file from GitHub, trying raw URL first (faster), then API with auth.
   */
  async _fetchFile(path) {
    const cacheKey = path;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    let text;

    // If we have a token, use the API endpoint with auth
    if (CF_CONFIG.githubToken) {
      const url = this._apiUrl(path);
      const response = await fetch(url, { headers: this._getHeaders() });
      if (!response.ok) throw new Error(`GitHub API failed for ${path}: ${response.status}`);
      text = await response.text();
    } else {
      // Try raw URL (public repos)
      const url = this._rawUrl(path);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}. If the repo is private, provide a GitHub token.`);
      text = await response.text();
    }

    this._cache[cacheKey] = text;
    return text;
  },

  /**
   * Fetch and parse a CSV from GitHub.
   */
  async fetchCSV(path) {
    const text = await this._fetchFile(path);

    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transform: (value) => {
          // Python writes NaN/None as literal "nan"/"None" strings in CSVs
          if (value === 'nan' || value === 'None' || value === 'NaN') return '';
          return value;
        },
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      });
    });
  },

  /**
   * List files in a GitHub directory.
   */
  async listDirectory(path) {
    const url = `https://api.github.com/repos/${CF_CONFIG.REPO_OWNER}/${CF_CONFIG.REPO_NAME}/contents/${path}?ref=${CF_CONFIG.REPO_BRANCH}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (CF_CONFIG.githubToken) {
      headers['Authorization'] = `token ${CF_CONFIG.githubToken}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to list ${path}: ${response.status}`);
    return response.json();
  },

  /**
   * Discover the latest master file.
   */
  async fetchMasterFileList() {
    try {
      const files = await this.listDirectory(CF_CONFIG.MASTER_FILES_PATH);
      return files
        .filter(f => f.name.endsWith('.csv'))
        .map(f => f.name)
        .sort()
        .reverse();
    } catch (e) {
      console.warn('Could not list master files via API, trying date-based fallback:', e.message);
      return this._guessLatestMasterFile();
    }
  },

  /**
   * Fallback: try to guess the latest master file by trying recent dates.
   */
  async _guessLatestMasterFile() {
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `master_${dateStr}.csv`;
      const path = `${CF_CONFIG.MASTER_FILES_PATH}/${filename}`;
      try {
        await this._fetchFile(path);
        return [filename];
      } catch { /* continue */ }
    }
    return [];
  },

  /**
   * Load the master dataset.
   */
  async loadMasterData() {
    const files = await this.fetchMasterFileList();
    if (files.length === 0) throw new Error('No master file found in the repository.');
    const latestFile = files[0];
    const path = `${CF_CONFIG.MASTER_FILES_PATH}/${latestFile}`;
    const data = await this.fetchCSV(path);

    // Clean data (matching Python logic)
    return data.map(row => {
      if (row.Expected_ABS > 100000 || row.Expected_REL > 2) {
        row.Expected_ABS = null;
        row.Expected_REL = null;
        row.Expected_REL_perc = null;
      }
      return row;
    }).filter((row, index, self) => {
      const key = `${row.Make}_${row['Product Model']}_${row['Product Variant']}`;
      return index === self.findIndex(r =>
        `${r.Make}_${r['Product Model']}_${r['Product Variant']}` === key
      );
    });
  },

  /**
   * Load ETL ads data for a given model/variant.
   */
  async loadAdsData(model, variant) {
    const path = `${CF_CONFIG.ETL_DATA_PATH}/ETL_Table__${model}_${variant}.csv`;
    try {
      const data = await this.fetchCSV(path);
      return this._addAdVariables(data);
    } catch (e) {
      console.warn(`Could not load ads for ${model}/${variant}:`, e.message);
      return [];
    }
  },

  /**
   * Load price history for a given model/variant.
   */
  async loadHistoryData(model, variant) {
    const path = `${CF_CONFIG.ETL_HISTORY_PATH}/HIS_Table__${model}_${variant}.csv`;
    try {
      return await this.fetchCSV(path);
    } catch (e) {
      console.warn(`Could not load history for ${model}/${variant}:`, e.message);
      return [];
    }
  },

  /**
   * Load combined ads and history data for all selected variants.
   */
  async loadAllAdsData(model, variants) {
    if (!model || variants.length === 0) {
      CF_STATE.adsData = [];
      CF_STATE.historyData = [];
      return;
    }

    const adsPromises = variants.map(v => this.loadAdsData(model, v));
    const hisPromises = variants.map(v => this.loadHistoryData(model, v));

    const [adsResults, hisResults] = await Promise.all([
      Promise.all(adsPromises),
      Promise.all(hisPromises),
    ]);

    CF_STATE.adsData = adsResults.flat();
    CF_STATE.historyData = hisResults.flat();

    this._updateAdsFilterRanges();
  },

  /**
   * Add computed variables to ads data (matching Python add_add_variables).
   */
  _addAdVariables(data) {
    return data.map(row => {
      const priceDiff = row['Price Reduction Abs'] || 0;
      if (priceDiff === 0) row['Price Sentiment'] = 'Price Stable';
      else if (priceDiff > 0) row['Price Sentiment'] = 'Price Decrease';
      else if (priceDiff < 0) row['Price Sentiment'] = 'Price Increase';
      else row['Price Sentiment'] = null;

      row['Car Kms'] = Number(row['Car Kms']) || 0;
      row['Price'] = Number(row['Price']) || 0;
      row['Car Year'] = Number(row['Car Year']) || 0;
      row['Car Age Years'] = Number(row['Car Age Years']) || 0;
      row['Price Reduction Abs'] = Number(row['Price Reduction Abs']) || 0;
      row['Price Min'] = Number(row['Price Min']) || row['Price'];
      row['Price Max'] = Number(row['Price Max']) || row['Price'];

      row['Add Closed'] = row['Add Closed'] === true || row['Add Closed'] === 'True' || row['Add Closed'] === 'true';
      row['Add Opened'] = row['Add Opened'] === true || row['Add Opened'] === 'True' || row['Add Opened'] === 'true';
      row['Add Completed'] = row['Add Completed'] === true || row['Add Completed'] === 'True' || row['Add Completed'] === 'true';

      return row;
    });
  },

  /**
   * Update ad filter ranges based on loaded data.
   */
  _updateAdsFilterRanges() {
    const ads = CF_STATE.adsData;
    if (!ads || ads.length === 0) return;

    const kms = ads.map(r => r['Car Kms']).filter(v => v != null && !isNaN(v));
    const prices = ads.map(r => r['Price']).filter(v => v != null && !isNaN(v));
    const years = ads.map(r => r['Car Year']).filter(v => v != null && !isNaN(v));

    if (kms.length > 0) {
      CF_STATE.adsFilters.kmMin = Math.floor(Math.min(...kms) / 10000) * 10000;
      CF_STATE.adsFilters.kmMax = (Math.floor(Math.max(...kms) / 10000) + 1) * 10000;
    }
    if (prices.length > 0) {
      CF_STATE.adsFilters.priceMin = Math.floor(Math.min(...prices) / 5000) * 5000;
      CF_STATE.adsFilters.priceMax = (Math.floor(Math.max(...prices) / 5000) + 1) * 5000;
    }
    if (years.length > 0) {
      CF_STATE.adsFilters.yearMin = Math.min(...years);
      CF_STATE.adsFilters.yearMax = Math.max(...years);
    }
  },

  /**
   * Get filtered ads based on current visualization and filter settings.
   */
  getFilteredAds() {
    if (!CF_STATE.adsData || CF_STATE.adsData.length === 0) return [];

    const viz = CF_STATE.adsViz;
    const filters = CF_STATE.adsFilters;

    return CF_STATE.adsData.filter(row => {
      let vizPass = false;
      const isES = row.Country === 'ES';
      const isDE = row.Country === 'DE';

      if (isES) {
        if (viz.spainDealers && row['Seller Type'] === 'Professional') vizPass = true;
        if (viz.spainPrivate && row['Seller Type'] === 'Private') vizPass = true;
        if (viz.spainExcludeIslands && CF_CONFIG.islandProvinces.includes(row.Province)) vizPass = false;
      }
      if (isDE) {
        if (viz.germanyDealers && row['Seller Type'] === 'Professional') vizPass = true;
        if (viz.germanyPrivate && row['Seller Type'] === 'Private') vizPass = true;
      }

      if (!viz.closedAds && row['Add Closed']) vizPass = false;
      if (!vizPass) return false;

      if (row['Car Kms'] < filters.kmMin || row['Car Kms'] > filters.kmMax) return false;
      if (row['Price'] < filters.priceMin || row['Price'] > filters.priceMax) return false;
      if (row['Car Year'] < filters.yearMin || row['Car Year'] > filters.yearMax) return false;

      return true;
    });
  },

  /**
   * Deduplicate ads for scatter display.
   */
  deduplicateAds(ads) {
    const seen = new Set();
    return ads.filter(row => {
      const key = `${row.Price}_${row['Car Kms']}_${row['Car Fuel']}_${row['Car Transmission']}_${row['Car Year']}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  /**
   * Sort ads by the current sort method.
   */
  sortAds(ads) {
    const method = CF_STATE.adsSortMethod;
    const sorted = [...ads];
    switch (method) {
      case 'price_asc':
        sorted.sort((a, b) => a.Price - b.Price); break;
      case 'price_desc':
        sorted.sort((a, b) => b.Price - a.Price); break;
      case 'reduction_desc':
        sorted.sort((a, b) => b['Price Reduction Abs'] - a['Price Reduction Abs']); break;
      case 'time_desc':
        sorted.sort((a, b) => new Date(a['Creation Date'] || 0) - new Date(b['Creation Date'] || 0)); break;
      case 'time_asc':
        sorted.sort((a, b) => new Date(b['Creation Date'] || 0) - new Date(a['Creation Date'] || 0)); break;
    }
    return sorted;
  },
};
