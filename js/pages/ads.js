/**
 * CarFlow - Advertisements Analysis Page
 * Renders: scatter plots (Price vs Kms, Price vs Age), ad cards board with pagination.
 */
const AdsPage = {

  render() {
    const container = document.getElementById('page-content');
    container.innerHTML = this._template();
    this._setupTabs();
    this._renderContent();
    this._setupSidebar();
  },

  _template() {
    const selectionText = this._getSelectionText();
    const hasVariants = CF_STATE.selectedVariants.length > 0;

    return `
      <div class="page-title">
        <span class="title-word">Ads</span>
        ${selectionText ? `<span class="title-selection">${selectionText}</span>` : ''}
      </div>

      ${hasVariants ? `
        <div class="tabs-container" id="ads-tabs">
          <button class="tab-btn active" data-tab="kms">Price VS Kms</button>
          <button class="tab-btn" data-tab="age">Price VS Age</button>
        </div>

        <div class="tab-panel active" id="tab-kms">
          <div id="ads-scatter-kms" class="chart-container" style="min-height:550px;"></div>
        </div>

        <div class="tab-panel" id="tab-age">
          <div id="ads-scatter-age" class="chart-container" style="min-height:550px;"></div>
        </div>

        <!-- ADS BOARD -->
        <div class="cf-card" style="margin-top:16px;" id="ads-board-container">
          <div class="ads-board-header">
            <div>
              <label>Sort by</label>
              <select id="ads-sort" class="cf-select" style="width:180px;display:inline-block;margin-left:6px;">
                <option value="price_asc">Price \u2191</option>
                <option value="price_desc">Price \u2193</option>
                <option value="reduction_desc">Price Reduction \u2193</option>
                <option value="time_desc">Time Posted \u2193</option>
                <option value="time_asc">Time Posted \u2191</option>
              </select>
            </div>
            <span class="pagination-info" id="ads-count-info"></span>
          </div>
          <div id="ads-board"></div>
          <div class="pagination-controls" id="ads-pagination"></div>
        </div>
      ` : `
        <div class="empty-state">
          <h3>SELECT Model and Variant</h3>
          <p>Use the Car Selection menu on the left to choose the brand, model, and specific variant(s) of the car ads you'd like to view.</p>
        </div>
      `}
    `;
  },

  _getSelectionText() {
    const parts = [];
    if (CF_STATE.selectedMake) {
      parts.push(CF_STATE.selectedMake);
      if (CF_STATE.selectedModel) {
        parts.push(CF_STATE.selectedModel);
        if (CF_STATE.selectedVariants.length > 0) {
          parts.push('| ' + CF_STATE.selectedVariants.join(' | '));
        }
      }
    }
    return parts.join(' ');
  },

  _setupTabs() {
    const tabs = document.querySelectorAll('#ads-tabs .tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        // Re-render active chart
        if (tab.dataset.tab === 'kms') CF_CHARTS.renderAdsScatter('ads-scatter-kms', 'Car Kms');
        else CF_CHARTS.renderAdsScatter('ads-scatter-age', 'Car Age Years');
      });
    });
  },

  _renderContent() {
    if (CF_STATE.selectedVariants.length === 0) return;

    // Render scatter charts
    CF_CHARTS.renderAdsScatter('ads-scatter-kms', 'Car Kms');
    setTimeout(() => CF_CHARTS.renderAdsScatter('ads-scatter-age', 'Car Age Years'), 50);

    // Setup sort handler
    const sortEl = document.getElementById('ads-sort');
    if (sortEl) {
      sortEl.value = CF_STATE.adsSortMethod;
      sortEl.addEventListener('change', (e) => {
        CF_STATE.adsSortMethod = e.target.value;
        CF_STATE.adsPage = 1;
        this._renderAdsBoard();
      });
    }

    // Render ads board
    this._renderAdsBoard();
  },

  /**
   * Render the ad cards board with pagination.
   */
  _renderAdsBoard() {
    const boardEl = document.getElementById('ads-board');
    const paginationEl = document.getElementById('ads-pagination');
    const countEl = document.getElementById('ads-count-info');
    if (!boardEl) return;

    const filtered = CF_DATA.getFilteredAds();
    const deduplicated = CF_DATA.deduplicateAds(filtered);
    const sorted = CF_DATA.sortAds(deduplicated);

    const perPage = CF_CONFIG.adsPerPage;
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
    CF_STATE.adsPage = Math.min(CF_STATE.adsPage, totalPages);
    const page = CF_STATE.adsPage;
    const start = (page - 1) * perPage;
    const end = Math.min(start + perPage, sorted.length);
    const pageAds = sorted.slice(start, end);

    // Count info
    if (countEl) {
      countEl.textContent = `${sorted.length} ads total`;
    }

    // Render cards
    boardEl.innerHTML = pageAds.map(row => this._adCard(row)).join('');

    // Price history charts are rendered lazily on click (see _adCard onclick handler)

    // Pagination
    if (paginationEl) {
      if (totalPages <= 1) {
        paginationEl.innerHTML = '';
      } else {
        paginationEl.innerHTML = `
          <button ${page <= 1 ? 'disabled' : ''} id="ads-prev">&#8592; Prev</button>
          <span>Page ${page} of ${totalPages}</span>
          <button ${page >= totalPages ? 'disabled' : ''} id="ads-next">Next &#8594;</button>
        `;
        document.getElementById('ads-prev')?.addEventListener('click', () => {
          CF_STATE.adsPage = Math.max(1, CF_STATE.adsPage - 1);
          this._renderAdsBoard();
        });
        document.getElementById('ads-next')?.addEventListener('click', () => {
          CF_STATE.adsPage = Math.min(totalPages, CF_STATE.adsPage + 1);
          this._renderAdsBoard();
        });
      }
    }
  },

  /**
   * Build an ad card HTML.
   */
  _adCard(row) {
    const price = this._formatPrice(row.Price);
    const brand = String(row.Make || '').toUpperCase();
    const model = this._capitalize(row['Product Model']);
    const variant = this._capitalize(row['Product Variant']);
    const kms = this._formatPrice(Math.round(row['Car Kms']));
    const year = row['Car Year'] ? Math.round(row['Car Year']) : '';
    const fuel = this._esc(row['Car Fuel'] || '');
    const transmission = this._esc(row['Car Transmission'] || '');
    const country = row.Country === 'ES' ? 'Spain' : 'Germany';
    const city = this._esc(row.City || '');
    const addUrl = encodeURI(row['Add Url'] || '#');
    const imageUrl = encodeURI(row['Image Url'] || '');
    const website = row.Website || '';
    const addId = String(row['Add ID'] || '').replace(/[^a-zA-Z0-9]/g, '_');

    // Time listed
    let timeListed = '';
    if (row['Creation Date']) {
      const created = new Date(row['Creation Date']);
      const now = new Date();
      const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      timeListed = `Listed: ${diffDays} days`;
    }

    // Site logo
    const siteLogoMap = CF_CONFIG.siteLogos[website];
    const siteLogoFile = siteLogoMap ? siteLogoMap[row.Country] : null;
    const siteLogoHtml = siteLogoFile
      ? `<img src="assets/resources/${siteLogoFile}" class="ad-card-site-logo" alt="${website}">`
      : `<span style="font-size:11px;color:var(--text-light);">${website}</span>`;

    // Price history toggle (renders chart lazily on first click)
    let priceHistoryHtml = '';
    const origAddId = String(row['Add ID'] || '').replace(/'/g, "\\'");
    if (row['Price Sentiment'] === 'Price Decrease') {
      priceHistoryHtml = `
        <div class="ad-price-history-toggle" data-add-id="${origAddId}" data-chart-id="price-hist-${addId}"
             onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';if(!c.dataset.rendered){CF_CHARTS.renderPriceHistoryChart('${('price-hist-' + addId)}','${origAddId}');c.dataset.rendered='1';}">
          &#x25BC; Reduced ${Math.round(row['Price Reduction Abs'])}\u20ac
        </div>
        <div class="price-history-chart" id="price-hist-${addId}" style="display:none;"></div>
      `;
    } else if (row['Price Sentiment'] === 'Price Increase') {
      priceHistoryHtml = `
        <div class="ad-price-history-toggle" data-add-id="${origAddId}" data-chart-id="price-hist-${addId}"
             onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';if(!c.dataset.rendered){CF_CHARTS.renderPriceHistoryChart('${('price-hist-' + addId)}','${origAddId}');c.dataset.rendered='1';}">
          &#x25B2; Increased ${Math.round(Math.abs(row['Price Reduction Abs']))}\u20ac
        </div>
        <div class="price-history-chart" id="price-hist-${addId}" style="display:none;"></div>
      `;
    }

    return `
      <div class="ad-card">
        <div>
          <a href="${addUrl}" target="_blank" rel="noopener">
            <img src="${imageUrl}" class="ad-card-image" alt="${brand} ${model}"
                 onerror="this.style.background='var(--bg-secondary)';this.alt='No image';">
          </a>
        </div>
        <div>
          <div class="ad-card-price">${price} \u20ac</div>
          ${priceHistoryHtml}
          <div class="ad-card-title">${brand} ${model} | ${variant}</div>
        </div>
        <div>
          ${siteLogoHtml}
          <div class="ad-card-specs">${kms} km  |  ${year}  |  ${fuel}  |  ${transmission}</div>
          <div class="ad-card-location">${country} | ${city}</div>
          <div class="ad-card-time">${timeListed}</div>
        </div>
      </div>
    `;
  },

  _formatPrice(num) {
    if (num == null || isNaN(num)) return '0';
    return Math.round(num).toLocaleString('de-DE');
  },

  _capitalize(str) {
    if (!str && str !== 0) return '';
    str = String(str);
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  },

  /**
   * Escape HTML entities to prevent XSS from CSV data.
   */
  _esc(str) {
    if (str == null || str === '') return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * Setup sidebar for the Ads page (visualization options + filters).
   */
  _setupSidebar() {
    const dynamicSidebar = document.getElementById('sidebar-dynamic');
    const viz = CF_STATE.adsViz;
    const f = CF_STATE.adsFilters;

    dynamicSidebar.innerHTML = `
      <!-- Visualisation Options -->
      <div class="sidebar-section">
        <h5 class="sidebar-section-title">Visualisation Options</h5>
        <div class="vis-options-grid">
          <div class="vis-country-col">
            <h6>Spain</h6>
            ${this._toggle('viz-es-dealers', 'Professional', viz.spainDealers, 'toggle-spain')}
            ${this._toggle('viz-es-private', 'Private', viz.spainPrivate, 'toggle-spain')}
            ${this._toggle('viz-es-evolution', 'Evolution', viz.spainEvolution, 'toggle-spain')}
            ${this._toggle('viz-es-islands', 'Exclude Islands', viz.spainExcludeIslands, 'toggle-spain')}
          </div>
          <div class="vis-country-col">
            <h6>Germany</h6>
            ${this._toggle('viz-de-dealers', 'Professional', viz.germanyDealers, 'toggle-germany')}
            ${this._toggle('viz-de-private', 'Private', viz.germanyPrivate, 'toggle-germany')}
            ${this._toggle('viz-de-evolution', 'Evolution', viz.germanyEvolution, 'toggle-germany')}
          </div>
        </div>
        ${this._toggle('viz-closed', 'Old Adds', viz.closedAds, '')}
      </div>

      <!-- Add Filters -->
      <div class="sidebar-expander${CF_STATE.selectedVariants.length > 0 ? ' open' : ''}" id="ads-filter-expander">
        <div class="sidebar-expander-header" onclick="this.parentElement.classList.toggle('open')">
          <span>Add Filters</span>
          <span class="arrow">&#9660;</span>
        </div>
        <div class="sidebar-expander-content">
          <div style="margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text);">Mileage (km)</label>
            <div class="filter-row">
              <div><label>Min</label><input type="number" class="cf-number-input" id="filter-km-min" value="${f.kmMin}" step="1000"></div>
              <div><label>Max</label><input type="number" class="cf-number-input" id="filter-km-max" value="${f.kmMax}" step="1000"></div>
            </div>
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text);">Add Price (\u20ac)</label>
            <div class="filter-row">
              <div><label>Min</label><input type="number" class="cf-number-input" id="filter-price-min" value="${f.priceMin}" step="500"></div>
              <div><label>Max</label><input type="number" class="cf-number-input" id="filter-price-max" value="${f.priceMax}" step="500"></div>
            </div>
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text);">Year</label>
            <div class="filter-row">
              <div><label>Min</label><input type="number" class="cf-number-input" id="filter-year-min" value="${f.yearMin}"></div>
              <div><label>Max</label><input type="number" class="cf-number-input" id="filter-year-max" value="${f.yearMax}"></div>
            </div>
          </div>
          <button class="cf-btn cf-btn-primary" id="btn-reset-filters" style="width:100%;margin-top:8px;">Reset Filters</button>
        </div>
      </div>
    `;

    this._setupSidebarListeners();
  },

  /**
   * Setup event listeners for sidebar controls.
   */
  _setupSidebarListeners() {
    // Toggle listeners
    const toggleMap = {
      'viz-es-dealers': 'spainDealers',
      'viz-es-private': 'spainPrivate',
      'viz-es-evolution': 'spainEvolution',
      'viz-es-islands': 'spainExcludeIslands',
      'viz-de-dealers': 'germanyDealers',
      'viz-de-private': 'germanyPrivate',
      'viz-de-evolution': 'germanyEvolution',
      'viz-closed': 'closedAds',
    };

    for (const [id, key] of Object.entries(toggleMap)) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          CF_STATE.adsViz[key] = el.checked;
          CF_STATE.adsPage = 1;
          this._refreshContent();
        });
      }
    }

    // Filter input listeners (debounced)
    let filterTimeout;
    const filterInputs = ['filter-km-min', 'filter-km-max', 'filter-price-min', 'filter-price-max', 'filter-year-min', 'filter-year-max'];
    const filterKeyMap = {
      'filter-km-min': 'kmMin', 'filter-km-max': 'kmMax',
      'filter-price-min': 'priceMin', 'filter-price-max': 'priceMax',
      'filter-year-min': 'yearMin', 'filter-year-max': 'yearMax',
    };

    for (const inputId of filterInputs) {
      const el = document.getElementById(inputId);
      if (el) {
        el.addEventListener('input', () => {
          clearTimeout(filterTimeout);
          filterTimeout = setTimeout(() => {
            CF_STATE.adsFilters[filterKeyMap[inputId]] = Number(el.value) || 0;
            CF_STATE.adsPage = 1;
            this._refreshContent();
          }, 300);
        });
      }
    }

    // Reset filters button
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        CF_DATA._updateAdsFilterRanges();
        // Update input values
        const f = CF_STATE.adsFilters;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('filter-km-min', f.kmMin);
        setVal('filter-km-max', f.kmMax);
        setVal('filter-price-min', f.priceMin);
        setVal('filter-price-max', f.priceMax);
        setVal('filter-year-min', f.yearMin);
        setVal('filter-year-max', f.yearMax);
        CF_STATE.adsPage = 1;
        this._refreshContent();
      });
    }
  },

  /**
   * Refresh scatter charts and ads board without full re-render.
   */
  _refreshContent() {
    CF_CHARTS.renderAdsScatter('ads-scatter-kms', 'Car Kms');
    CF_CHARTS.renderAdsScatter('ads-scatter-age', 'Car Age Years');
    this._renderAdsBoard();
  },

  /**
   * Build a toggle switch HTML.
   */
  _toggle(id, label, checked, extraClass) {
    return `
      <label class="cf-toggle ${extraClass}">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
        <div class="toggle-track"></div>
        <span class="toggle-label">${label}</span>
      </label>
    `;
  },

  /**
   * Refresh when car selection changes.
   */
  refreshCharts() {
    if (CF_STATE.currentPage !== 'ads') return;
    this.render();
  },
};
