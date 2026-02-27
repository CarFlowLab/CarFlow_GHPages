/**
 * CarFlow - Market Comparison Page
 * Renders: page title, 3 tabs (Demand, Profit, Scatter), metric description boxes.
 */
const MarketPage = {

  /**
   * Render the full market page into the page-content container.
   */
  render() {
    const container = document.getElementById('page-content');
    container.innerHTML = this._template();
    this._setupTabs();
    this._renderCharts();
    this._setupSidebar();
  },

  /**
   * Build HTML template.
   */
  _template() {
    const selectionText = this._getSelectionText();
    const demandMetric = CF_STATE.demandMetric;
    const profitMetric = CF_STATE.profitMetric;

    return `
      <div class="page-title">
        <span class="title-word">Market</span>
        ${selectionText ? `<span class="title-selection">${selectionText}</span>` : ''}
      </div>

      <div class="tabs-container" id="market-tabs">
        <button class="tab-btn active" data-tab="demand">Market Demand</button>
        <button class="tab-btn" data-tab="profit">Profit Margin</button>
        <button class="tab-btn" data-tab="scatter">Profit VS Demand</button>
      </div>

      <!-- DEMAND TAB -->
      <div class="tab-panel active" id="tab-demand">
        <div class="chart-grid-3">
          <div id="demand-chart-make" class="chart-container"></div>
          <div id="demand-chart-model" class="chart-container"></div>
          <div id="demand-chart-variant" class="chart-container"></div>
        </div>
        ${this._descriptionBox(demandMetric)}
      </div>

      <!-- PROFIT TAB -->
      <div class="tab-panel" id="tab-profit">
        <div class="chart-grid-3">
          <div id="profit-chart-make" class="chart-container"></div>
          <div id="profit-chart-model" class="chart-container"></div>
          <div id="profit-chart-variant" class="chart-container"></div>
        </div>
        ${this._descriptionBox(profitMetric)}
      </div>

      <!-- SCATTER TAB -->
      <div class="tab-panel" id="tab-scatter">
        <div id="market-scatter" class="chart-container" style="min-height:550px;"></div>
        ${this._descriptionBox(demandMetric)}
        ${this._descriptionBox(profitMetric)}
      </div>
    `;
  },

  /**
   * Build a description box for a metric.
   */
  _descriptionBox(metric) {
    if (!metric) return '';
    return `
      <div class="description-box">
        <div class="desc-title">${metric.user_name}</div>
        <div class="desc-text">${metric.description}</div>
      </div>
    `;
  },

  /**
   * Get selection text for the title.
   */
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

  /**
   * Setup tab switching.
   */
  _setupTabs() {
    const tabs = document.querySelectorAll('#market-tabs .tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Deactivate all
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        // Activate clicked
        tab.classList.add('active');
        const panelId = 'tab-' + tab.dataset.tab;
        document.getElementById(panelId).classList.add('active');
        // Re-render charts for the active tab to ensure proper sizing
        this._renderActiveTabCharts(tab.dataset.tab);
      });
    });
  },

  /**
   * Render charts for the currently active tab.
   */
  _renderActiveTabCharts(tabName) {
    if (tabName === 'demand') this._renderDemandCharts();
    else if (tabName === 'profit') this._renderProfitCharts();
    else if (tabName === 'scatter') this._renderScatterChart();
  },

  /**
   * Render all charts.
   */
  _renderCharts() {
    this._renderDemandCharts();
    // Pre-render profit and scatter so they're ready when tab is switched
    setTimeout(() => this._renderProfitCharts(), 50);
    setTimeout(() => this._renderScatterChart(), 100);
  },

  _renderDemandCharts() {
    if (!CF_STATE.demandMetric) return;
    const col = CF_STATE.demandMetric.master_name;
    CF_STATE.demandBarChartMax = 0;
    CF_CHARTS.renderMarketBarChart('demand-chart-make', col, 'make', 'descending', 'demand');
    CF_CHARTS.renderMarketBarChart('demand-chart-model', col, 'model', 'descending', 'demand');
    CF_CHARTS.renderMarketBarChart('demand-chart-variant', col, 'variant', 'descending', 'demand');
  },

  _renderProfitCharts() {
    if (!CF_STATE.profitMetric) return;
    const col = CF_STATE.profitMetric.master_name;
    CF_STATE.profitBarChartMax = 0;
    CF_CHARTS.renderMarketBarChart('profit-chart-make', col, 'make', 'ascending', 'profit');
    CF_CHARTS.renderMarketBarChart('profit-chart-model', col, 'model', 'ascending', 'profit');
    CF_CHARTS.renderMarketBarChart('profit-chart-variant', col, 'variant', 'ascending', 'profit');
  },

  _renderScatterChart() {
    CF_CHARTS.renderMarketScatter('market-scatter');
  },

  /**
   * Setup sidebar dynamic content for the Market page (metric selectors).
   */
  _setupSidebar() {
    const dynamicSidebar = document.getElementById('sidebar-dynamic');
    dynamicSidebar.innerHTML = `
      <div class="sidebar-section">
        <h5 class="sidebar-section-title">Metric Selection</h5>

        <label style="font-size:12px;color:var(--text-light);margin-bottom:4px;display:block;">Market Demand Metric</label>
        <select id="select-demand-metric" class="cf-select">
          ${CF_CONFIG.metrics.demand.map(m =>
            `<option value="${m.master_name}" ${CF_STATE.demandMetric && CF_STATE.demandMetric.master_name === m.master_name ? 'selected' : ''}>${m.user_name}</option>`
          ).join('')}
        </select>

        <div style="margin-top:10px;">
          <label style="font-size:12px;color:var(--text-light);margin-bottom:4px;display:block;">Potential Profit</label>
          <select id="select-profit-metric" class="cf-select">
            ${CF_CONFIG.metrics.profit.map(m =>
              `<option value="${m.master_name}" ${CF_STATE.profitMetric && CF_STATE.profitMetric.master_name === m.master_name ? 'selected' : ''}>${m.user_name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
    `;

    // Metric change handlers
    document.getElementById('select-demand-metric').addEventListener('change', (e) => {
      CF_STATE.demandMetric = CF_CONFIG.metrics.demand.find(m => m.master_name === e.target.value);
      CF_STATE.demandBarChartMax = 0;
      this.render();
    });

    document.getElementById('select-profit-metric').addEventListener('change', (e) => {
      CF_STATE.profitMetric = CF_CONFIG.metrics.profit.find(m => m.master_name === e.target.value);
      CF_STATE.profitBarChartMax = 0;
      this.render();
    });
  },

  /**
   * Refresh only the charts (called when car selection changes).
   */
  refreshCharts() {
    if (CF_STATE.currentPage !== 'market') return;
    // Update title
    const titleEl = document.querySelector('.page-title');
    if (titleEl) {
      const selectionText = this._getSelectionText();
      titleEl.innerHTML = `
        <span class="title-word">Market</span>
        ${selectionText ? `<span class="title-selection">${selectionText}</span>` : ''}
      `;
    }
    CF_STATE.demandBarChartMax = 0;
    CF_STATE.profitBarChartMax = 0;
    this._renderCharts();
  },
};
