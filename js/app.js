/**
 * CarFlow - Main Application
 * Initializes the app, handles navigation, and coordinates page rendering.
 */
const CF_APP = {

  async init() {
    // Check for GitHub token in URL params (e.g., ?token=ghp_xxx)
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      CF_CONFIG.githubToken = tokenParam;
      // Store in sessionStorage so it persists across page refreshes
      sessionStorage.setItem('cf_github_token', tokenParam);
      // Clean URL (remove token from address bar for security)
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Try to restore from sessionStorage
      const stored = sessionStorage.getItem('cf_github_token');
      if (stored) CF_CONFIG.githubToken = stored;
    }

    // Set default metrics
    CF_STATE.demandMetric = CF_CONFIG.metrics.demand[0];
    CF_STATE.profitMetric = CF_CONFIG.metrics.profit[0];

    // Setup navigation
    this._setupNavigation();

    // Listen for selection changes
    CF_STATE.on((changeType) => {
      if (changeType === 'selectionChange') {
        this._onSelectionChange();
      }
    });

    // Load master data
    await this._loadData();
  },

  /**
   * Attempt to load data, showing token prompt if needed.
   */
  async _loadData() {
    try {
      this._showLoading(true);
      CF_STATE.masterData = await CF_DATA.loadMasterData();
      console.log(`Loaded ${CF_STATE.masterData.length} master records`);

      // Initialize sidebar dropdowns
      CF_SIDEBAR.init();
      CF_SIDEBAR.populateMakes();

      // Render default page
      this._navigateTo('market');
      this._showLoading(false);
    } catch (err) {
      console.error('Failed to load data:', err);
      this._showTokenPrompt(err.message);
    }
  },

  /**
   * Setup top navigation tab clicks.
   */
  _setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._navigateTo(tab.dataset.page);
      });
    });
  },

  /**
   * Navigate to a page.
   */
  _navigateTo(page) {
    CF_STATE.currentPage = page;

    // Hide floating hover card when switching pages
    const hoverCard = document.getElementById('ads-hover-card');
    if (hoverCard) hoverCard.classList.remove('visible');

    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.page === page);
    });

    if (page === 'market') MarketPage.render();
    else if (page === 'ads') AdsPage.render();

    CF_SIDEBAR.restoreState();
  },

  /**
   * Handle car selection changes.
   */
  _onSelectionChange() {
    if (CF_STATE.currentPage === 'market') MarketPage.refreshCharts();
    else if (CF_STATE.currentPage === 'ads') AdsPage.render();
  },

  /**
   * Show/hide loading overlay.
   */
  _showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
  },

  /**
   * Show token input prompt when data loading fails.
   */
  _showTokenPrompt(errorMsg) {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div style="max-width:460px;margin:80px auto;text-align:center;">
        <img src="assets/logos/CarFlow Logo Hor 8.png" alt="CarFlow" style="height:40px;margin-bottom:24px;">
        <h3 style="margin-bottom:8px;">Connect to Data</h3>
        <p style="font-size:13px;color:var(--text-light);margin-bottom:24px;line-height:1.5;">
          The CarFlow data repository is private. Enter your GitHub personal access token
          to load the data. The token is stored only in your browser session.
        </p>
        <div style="text-align:left;margin-bottom:8px;">
          <label style="font-size:12px;color:var(--text-light);">GitHub Personal Access Token</label>
          <input type="password" id="token-input" class="cf-select" placeholder="ghp_xxxxxxxxxxxx" style="margin-top:4px;">
        </div>
        <button class="cf-btn cf-btn-primary" style="width:100%;margin-top:8px;" id="btn-connect">
          Connect
        </button>
        <p style="font-size:11px;color:var(--gray-select);margin-top:16px;">
          Need a token? Go to GitHub &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens
          and create one with <strong>repo</strong> scope.
        </p>
        ${errorMsg ? `<p style="font-size:11px;color:var(--spain);margin-top:8px;">Error: ${errorMsg}</p>` : ''}
      </div>
    `;

    const tokenInput = document.getElementById('token-input');
    const connectBtn = document.getElementById('btn-connect');

    const doConnect = async () => {
      const token = tokenInput.value.trim();
      if (!token) return;
      CF_CONFIG.githubToken = token;
      sessionStorage.setItem('cf_github_token', token);
      // Clear cache so we retry with the new token
      CF_DATA._cache = {};
      await this._loadData();
    };

    connectBtn.addEventListener('click', doConnect);
    tokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doConnect();
    });

    // Auto-focus the input
    tokenInput.focus();
  },
};

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => CF_APP.init());
