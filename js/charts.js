/**
 * CarFlow Charts
 * All Plotly.js chart rendering functions.
 */
const CF_CHARTS = {

  // Shared Plotly config
  _baseConfig: { scrollZoom: true, responsive: true, displayModeBar: false },
  _baseLayout: {
    font: { family: 'CarFlowBody, -apple-system, sans-serif', size: 12 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 20, r: 20, b: 40, l: 100 },
  },

  /**
   * Render a horizontal bar chart for market metrics.
   * @param {string} containerId - DOM element ID
   * @param {string} metricCol - master_name of the metric
   * @param {string} level - 'make' | 'model' | 'variant'
   * @param {string} order - 'ascending' | 'descending'
   * @param {string} chartMaxKey - 'demand' | 'profit' for shared max tracking
   */
  renderMarketBarChart(containerId, metricCol, level, order, chartMaxKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = CF_STATE.masterData;
    if (!data) return;

    // Determine groupBy column and filter
    let groupCol, filterFn, isSelectedFn;
    if (level === 'make') {
      groupCol = 'Make';
      filterFn = () => true;
      isSelectedFn = (val) => val === CF_STATE.selectedMake;
    } else if (level === 'model') {
      groupCol = 'Product Model';
      filterFn = (row) => row.Make === CF_STATE.selectedMake;
      isSelectedFn = (val) => val === CF_STATE.selectedModel;
    } else {
      groupCol = 'Product Variant';
      filterFn = (row) => row['Product Model'] === CF_STATE.selectedModel;
      isSelectedFn = (val) => CF_STATE.selectedVariants.includes(val);
    }

    // Group by and compute median
    const filtered = data.filter(filterFn);
    const groups = {};
    for (const row of filtered) {
      const key = row[groupCol];
      const val = row[metricCol];
      if (key == null || val == null || isNaN(val)) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(val);
    }

    // Compute medians
    const entries = Object.entries(groups).map(([key, vals]) => {
      vals.sort((a, b) => a - b);
      const mid = Math.floor(vals.length / 2);
      const median = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
      return { label: key, value: median, selected: isSelectedFn(key) };
    });

    // Sort
    entries.sort((a, b) => order === 'ascending' ? a.value - b.value : b.value - a.value);

    if (entries.length === 0) {
      el.innerHTML = '';
      return;
    }

    // Compute average
    const avg = entries.reduce((s, e) => s + e.value, 0) / entries.length;

    // Track max across 3 charts
    const currentMax = entries.reduce((m, e) => Math.max(m, e.value), 0);
    if (chartMaxKey === 'demand') {
      CF_STATE.demandBarChartMax = Math.max(CF_STATE.demandBarChartMax, currentMax);
    } else {
      CF_STATE.profitBarChartMax = Math.max(CF_STATE.profitBarChartMax, currentMax);
    }
    const xMax = chartMaxKey === 'demand' ? CF_STATE.demandBarChartMax : CF_STATE.profitBarChartMax;

    // Get metric display name
    const metricInfo = this._getMetricInfo(metricCol);
    const metricName = metricInfo ? metricInfo.user_name : metricCol;

    // Build Plotly trace
    const colors = entries.map(e => e.selected ? CF_CONFIG.colors.primary : '#dadfe9');

    const trace = {
      type: 'bar',
      orientation: 'h',
      y: entries.map(e => e.label),
      x: entries.map(e => e.value),
      marker: { color: colors },
      hovertemplate: '%{y}: %{x:.1f}<extra></extra>',
    };

    const layout = {
      ...this._baseLayout,
      height: 500,
      bargap: 0.25,
      yaxis: {
        categoryorder: order === 'ascending' ? 'total ascending' : 'total descending',
        title: null,
        automargin: true,
        tickfont: { color: 'rgba(45, 27, 39, 0.55)', size: 11 },
      },
      xaxis: {
        title: { text: metricName, font: { size: 11, color: 'rgba(45, 27, 39, 0.55)' } },
        range: [0, xMax * 1.05],
        tickfont: { color: 'rgba(45, 27, 39, 0.55)', size: 11 },
      },
      showlegend: false,
      shapes: [{
        type: 'line',
        x0: avg, x1: avg,
        y0: -0.5, y1: entries.length - 0.5,
        line: { color: 'rgba(45, 27, 39, 0.75)', width: 1.5, dash: 'dash' },
      }],
      annotations: [{
        x: avg,
        y: entries.length - 0.5,
        text: 'Average',
        showarrow: false,
        yshift: 12,
        font: { size: 10, color: 'rgba(45, 27, 39, 0.75)' },
      }],
    };

    Plotly.react(el, [trace], layout, this._baseConfig);
  },

  /**
   * Render the market scatter plot (Demand vs Profit).
   */
  renderMarketScatter(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = CF_STATE.masterData;
    if (!data) return;

    const demandMetric = CF_STATE.demandMetric;
    const profitMetric = CF_STATE.profitMetric;
    if (!demandMetric || !profitMetric) return;

    const colX = demandMetric.master_name;
    const colY = profitMetric.master_name;
    const selFilter = CF_STATE.getCarSelectionFilter();
    const allSelected = selFilter.every(v => v);

    // Build trace data
    const xs = [], ys = [], colors = [], sizes = [], opacities = [], hoverTexts = [];

    data.forEach((row, i) => {
      const x = row[colX];
      const y = row[colY];
      if (x == null || y == null || isNaN(x) || isNaN(y)) return;

      const isSelected = allSelected ? false : selFilter[i];
      xs.push(x);
      ys.push(y);
      colors.push(isSelected ? CF_CONFIG.colors.primary : CF_CONFIG.colors.dark);
      sizes.push(isSelected ? 10 : 4);
      opacities.push(0.7);
      hoverTexts.push(`${row.Make} ${row['Product Model']}<br>${row['Product Variant']}`);
    });

    const trace = {
      type: 'scatter',
      mode: 'markers',
      x: xs,
      y: ys,
      marker: { color: colors, size: sizes, opacity: opacities },
      text: hoverTexts,
      hoverinfo: 'text',
    };

    const containerHeight = el.clientHeight || 550;
    const layout = {
      ...this._baseLayout,
      height: Math.max(containerHeight, 550),
      margin: { t: 20, r: 30, b: 50, l: 60 },
      xaxis: {
        title: demandMetric.user_name,
        range: [demandMetric.low_lim, demandMetric.high_lim],
        showline: false,
        zeroline: false,
        titlefont: { size: 12 },
      },
      yaxis: {
        title: profitMetric.user_name,
        range: [profitMetric.low_lim, profitMetric.high_lim],
        showline: false,
        zeroline: true,
        zerolinewidth: 3,
        zerolinecolor: '#dadfe9',
        titlefont: { size: 12 },
      },
      showlegend: false,
    };

    Plotly.react(el, [trace], layout, this._baseConfig);
  },

  /**
   * Render ads scatter plot (Price vs Kms or Price vs Age).
   */
  renderAdsScatter(containerId, xColumn) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const allAds = CF_DATA.getFilteredAds();
    const ads = CF_DATA.deduplicateAds(allAds);

    if (ads.length === 0) {
      el.innerHTML = '';
      Plotly.purge(el);
      return;
    }

    const pointSize = this._calcScatterPointSize(ads.length);
    const traces = [];

    // Open ads - by country
    const openES = ads.filter(r => !r['Add Closed'] && r.Country === 'ES');
    const openDE = ads.filter(r => !r['Add Closed'] && r.Country === 'DE');
    const closedES = ads.filter(r => r['Add Closed'] && r.Country === 'ES');
    const closedDE = ads.filter(r => r['Add Closed'] && r.Country === 'DE');

    if (openES.length > 0) {
      traces.push(this._scatterTrace(openES, xColumn, CF_CONFIG.colors.spain, 0.8, pointSize, 'Spain (Open)'));
    }
    if (openDE.length > 0) {
      traces.push(this._scatterTrace(openDE, xColumn, CF_CONFIG.colors.germany, 0.8, pointSize, 'Germany (Open)'));
    }
    if (closedES.length > 0) {
      traces.push(this._scatterTrace(closedES, xColumn, CF_CONFIG.colors.spain, 0.1, pointSize, 'Spain (Closed)'));
    }
    if (closedDE.length > 0) {
      traces.push(this._scatterTrace(closedDE, xColumn, CF_CONFIG.colors.germany, 0.1, pointSize, 'Germany (Closed)'));
    }

    // Evolution lines (width matches point diameter for a "water drop" look)
    if (CF_STATE.adsViz.spainEvolution) {
      const evoTraces = this._evolutionTraces(ads.filter(r => r.Country === 'ES'), xColumn, CF_CONFIG.colors.spain, pointSize);
      traces.push(...evoTraces);
    }
    if (CF_STATE.adsViz.germanyEvolution) {
      const evoTraces = this._evolutionTraces(ads.filter(r => r.Country === 'DE'), xColumn, CF_CONFIG.colors.germany, pointSize);
      traces.push(...evoTraces);
    }

    const xLabel = xColumn === 'Car Kms' ? 'Mileage (km)' : 'Car Age (years)';

    const layout = {
      ...this._baseLayout,
      height: 550,
      margin: { t: 20, r: 20, b: 50, l: 60 },
      xaxis: { title: xLabel, titlefont: { size: 12 } },
      yaxis: { title: 'Price (\u20ac)', titlefont: { size: 12 } },
      showlegend: false,
      dragmode: 'pan',
      hovermode: 'closest',
    };

    Plotly.react(el, traces, layout, this._baseConfig);

    // --- Floating hover card + click-to-open ---
    this._attachAdsScatterEvents(el);
  },

  /**
   * Attach hover/unhover/click events to an ads scatter plot element.
   */
  _attachAdsScatterEvents(el) {
    // Remove previous listeners (Plotly reuses the element)
    el.removeAllListeners?.('plotly_hover');
    el.removeAllListeners?.('plotly_unhover');
    el.removeAllListeners?.('plotly_click');

    // Ensure the floating card element exists
    let card = document.getElementById('ads-hover-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'ads-hover-card';
      card.className = 'ads-hover-card';
      document.body.appendChild(card);
    }

    let hideTimeout = null;

    el.on('plotly_hover', (eventData) => {
      clearTimeout(hideTimeout);
      const pt = eventData.points[0];
      if (!pt || !pt.customdata) return;
      const d = pt.customdata;

      // Format values
      const priceStr = Math.round(d.price).toLocaleString('de-DE');
      const kmsStr = Math.round(d.kms).toLocaleString('de-DE');
      const yearStr = d.year ? Math.round(d.year) : '';
      const modelStr = String(d.model || '').replace(/_/g, ' ');
      const variantStr = String(d.variant || '').replace(/_/g, ' ');
      const countryFlag = d.country === 'Spain' ? 'ES' : 'DE';

      card.innerHTML = `
        <img src="${encodeURI(d.imageUrl)}" class="ahc-img"
             onerror="this.style.display='none'">
        <div class="ahc-body">
          <div class="ahc-price">${priceStr} \u20ac</div>
          <div class="ahc-specs">${kmsStr} km &middot; ${yearStr}</div>
          <div class="ahc-meta">
            <img src="assets/resources/${countryFlag}.png" class="ahc-flag">
            ${d.country}
          </div>
          <div class="ahc-model">${modelStr} ${variantStr}</div>
        </div>
      `;

      // Position card near the data point using the underlying mouse event
      const mouseEvent = eventData.event;
      const cardW = 240, cardH = 140;
      let left, top;

      if (mouseEvent) {
        left = mouseEvent.clientX + 16;
        top = mouseEvent.clientY - cardH / 2;
      } else {
        // Fallback: use Plotly's internal pixel coords
        const bbox = el.getBoundingClientRect();
        left = bbox.left + (pt.xaxis ? pt.xaxis.l2p(pt.x) + pt.xaxis._offset : 0) + 16;
        top = bbox.top + (pt.yaxis ? pt.yaxis.l2p(pt.y) + pt.yaxis._offset : 0) - cardH / 2;
      }

      // Keep card within viewport
      if (left + cardW > window.innerWidth - 10) left = left - cardW - 32;
      if (top < 10) top = 10;
      if (top + cardH > window.innerHeight - 10) top = window.innerHeight - cardH - 10;

      card.style.left = left + 'px';
      card.style.top = top + 'px';
      card.classList.add('visible');
    });

    el.on('plotly_unhover', () => {
      hideTimeout = setTimeout(() => {
        card.classList.remove('visible');
      }, 120);
    });

    el.on('plotly_click', (eventData) => {
      const pt = eventData.points[0];
      if (!pt || !pt.customdata) return;
      const url = pt.customdata.addUrl;
      if (url && url !== '#' && url !== '') {
        window.open(encodeURI(url), '_blank', 'noopener');
      }
    });
  },

  /**
   * Create a scatter trace for ads. Embeds full row data in customdata for hover card.
   */
  _scatterTrace(ads, xCol, color, opacity, size, name) {
    return {
      type: 'scatter',
      mode: 'markers',
      name: name,
      x: ads.map(r => r[xCol]),
      y: ads.map(r => r.Price),
      customdata: ads.map(r => ({
        imageUrl: r['Image Url'] || '',
        addUrl: r['Add Url'] || '',
        price: r.Price,
        kms: r['Car Kms'],
        year: r['Car Year'],
        country: r.Country === 'ES' ? 'Spain' : 'Germany',
        make: r.Make || '',
        model: r['Product Model'] || '',
        variant: r['Product Variant'] || '',
      })),
      marker: { color: color, opacity: opacity, size: size },
      hovertemplate: '<extra></extra>',  // Hide default tooltip but keep plotly_hover events firing
      showlegend: false,
    };
  },

  /**
   * Create price evolution line traces.
   */
  _evolutionTraces(ads, xCol, color, pointSize) {
    const lineWidth = pointSize || 10;
    const traces = [];
    for (const row of ads) {
      if (row['Price Min'] != null && row['Price Max'] != null && row['Price Min'] !== row['Price Max']) {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: [row[xCol], row[xCol]],
          y: [row['Price Min'], row['Price Max']],
          line: { color: color, width: lineWidth, shape: 'linear', cap: 'round' },
          opacity: 0.08,
          showlegend: false,
          hoverinfo: 'skip',
        });
      }
    }
    return traces;
  },

  /**
   * Calculate scatter point size based on number of ads.
   */
  _calcScatterPointSize(count) {
    const guidelines = [
      [1, 25], [10, 24], [20, 22], [50, 20],
      [100, 17], [250, 15], [500, 12], [100000, 5],
    ];
    if (count <= guidelines[0][0]) return guidelines[0][1];
    if (count >= guidelines[guidelines.length - 1][0]) return guidelines[guidelines.length - 1][1];
    for (let i = 0; i < guidelines.length - 1; i++) {
      const [x0, y0] = guidelines[i];
      const [x1, y1] = guidelines[i + 1];
      if (count >= x0 && count <= x1) {
        const t = (count - x0) / (x1 - x0);
        return Math.round(y0 + t * (y1 - y0));
      }
    }
    return 10;
  },

  /**
   * Render a mini price history area chart for an ad card.
   */
  renderPriceHistoryChart(containerId, addId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const history = (CF_STATE.historyData || []).filter(r => r['Add ID'] == addId);
    if (history.length < 2) {
      el.innerHTML = '<span style="font-size:11px;color:#999">No history data</span>';
      return;
    }

    // Sort by date
    history.sort((a, b) => new Date(a['Query Date']) - new Date(b['Query Date']));

    const trace = {
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      x: history.map(r => r['Query Date']),
      y: history.map(r => r['Price']),
      fillcolor: 'rgba(230, 105, 18, 0.3)',
      line: { color: CF_CONFIG.colors.primary, width: 2 },
      hovertemplate: '%{x}<br>%{y:,.0f}\u20ac<extra></extra>',
    };

    const prices = history.map(r => r['Price']);
    const minY = Math.min(...prices) * 0.95;
    const maxY = Math.max(...prices) * 1.02;

    const layout = {
      margin: { t: 0, r: 0, b: 20, l: 0 },
      height: 90,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: { showgrid: false, tickfont: { size: 9 }, title: null },
      yaxis: { showgrid: false, tickfont: { size: 9 }, title: null, range: [minY, maxY] },
      showlegend: false,
    };

    Plotly.react(el, [trace], layout, { displayModeBar: false, responsive: true });
  },

  /**
   * Get metric info by master_name.
   */
  _getMetricInfo(masterName) {
    const all = [...CF_CONFIG.metrics.demand, ...CF_CONFIG.metrics.profit];
    return all.find(m => m.master_name === masterName) || null;
  },
};
