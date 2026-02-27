/**
 * CarFlow Sidebar
 * Handles car selection (Make -> Model -> Variant cascade) and sidebar toggle.
 */
const CF_SIDEBAR = {

  init() {
    this._setupToggle();
    this._setupCarSelection();
  },

  /**
   * Setup sidebar toggle button.
   */
  _setupToggle() {
    const btn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('expanded');
      // Trigger Plotly relayout for charts to resize
      setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    });
  },

  /**
   * Setup cascading car selection.
   */
  _setupCarSelection() {
    const makeSelect = document.getElementById('select-make');
    const modelSelect = document.getElementById('select-model');
    const variantSelect = document.getElementById('select-variant');

    // Make change handler
    makeSelect.addEventListener('change', async () => {
      const make = makeSelect.value;
      CF_STATE.selectedMake = make || null;
      CF_STATE.selectedModel = null;
      CF_STATE.selectedVariants = [];
      CF_STATE.demandBarChartMax = 0;
      CF_STATE.profitBarChartMax = 0;
      CF_STATE.resetAdsState();

      this._populateModels();
      this._populateVariants();
      this._renderVariantChips();
      this._notifySelectionChange();
    });

    // Model change handler
    modelSelect.addEventListener('change', async () => {
      const model = modelSelect.value;
      CF_STATE.selectedModel = model || null;
      CF_STATE.selectedVariants = [];
      CF_STATE.resetAdsState();

      this._populateVariants();
      this._renderVariantChips();
      this._notifySelectionChange();
    });

    // Variant change handler (add to multi-selection)
    variantSelect.addEventListener('change', async () => {
      const variant = variantSelect.value;
      if (variant && !CF_STATE.selectedVariants.includes(variant)) {
        CF_STATE.selectedVariants.push(variant);
        variantSelect.value = ''; // Reset to placeholder

        this._renderVariantChips();
        this._populateVariants(); // Update available variants in dropdown

        // Show loading state for ads data
        variantSelect.disabled = true;
        try {
          await this._loadAdsForVariants();
        } finally {
          variantSelect.disabled = false;
        }
        this._notifySelectionChange();
      }
    });
  },

  /**
   * Populate the Make dropdown with unique makes from master data.
   */
  populateMakes() {
    const makeSelect = document.getElementById('select-make');
    const makes = CF_STATE.getUniqueValues('Make');

    makeSelect.innerHTML = '<option value="">Select Make</option>' +
      makes.map(m => `<option value="${m}" ${CF_STATE.selectedMake === m ? 'selected' : ''}>${m}</option>`).join('');
  },

  /**
   * Populate the Model dropdown filtered by selected make.
   */
  _populateModels() {
    const modelSelect = document.getElementById('select-model');
    if (!CF_STATE.selectedMake) {
      modelSelect.innerHTML = '<option value="">Select Model</option>';
      modelSelect.disabled = true;
      return;
    }

    const models = CF_STATE.getUniqueValues('Product Model', row => row.Make === CF_STATE.selectedMake);
    modelSelect.innerHTML = '<option value="">Select Model</option>' +
      models.map(m => `<option value="${m}" ${CF_STATE.selectedModel === m ? 'selected' : ''}>${m}</option>`).join('');
    modelSelect.disabled = false;
  },

  /**
   * Populate the Variant dropdown filtered by selected model.
   */
  _populateVariants() {
    const variantSelect = document.getElementById('select-variant');
    if (!CF_STATE.selectedModel) {
      variantSelect.innerHTML = '<option value="">Select Variant</option>';
      variantSelect.disabled = true;
      return;
    }

    const variants = CF_STATE.getUniqueValues('Product Variant', row => row['Product Model'] === CF_STATE.selectedModel);
    // Exclude already selected variants from dropdown
    const available = variants.filter(v => !CF_STATE.selectedVariants.includes(v));
    variantSelect.innerHTML = '<option value="">Add Variant...</option>' +
      available.map(v => `<option value="${v}">${v}</option>`).join('');
    variantSelect.disabled = false;
  },

  /**
   * Render variant chips (multi-select display).
   */
  _renderVariantChips() {
    const container = document.getElementById('selected-variants');
    if (!container) return;

    container.innerHTML = CF_STATE.selectedVariants.map(v => `
      <span class="variant-chip">
        ${v}
        <span class="variant-chip-remove" data-variant="${v}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </span>
      </span>
    `).join('');

    // Remove variant handlers
    container.querySelectorAll('.variant-chip-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const variant = btn.dataset.variant;
        CF_STATE.selectedVariants = CF_STATE.selectedVariants.filter(v => v !== variant);
        this._renderVariantChips();
        this._populateVariants();

        // Reload ads
        await this._loadAdsForVariants();
        this._notifySelectionChange();
      });
    });
  },

  /**
   * Load ads data for current variant selection.
   */
  async _loadAdsForVariants() {
    if (!CF_STATE.selectedModel || CF_STATE.selectedVariants.length === 0) {
      CF_STATE.adsData = [];
      CF_STATE.historyData = [];
      return;
    }
    await CF_DATA.loadAllAdsData(CF_STATE.selectedModel, CF_STATE.selectedVariants);
  },

  /**
   * Notify the app that car selection changed.
   */
  _notifySelectionChange() {
    CF_STATE.emit('selectionChange');
  },

  /**
   * Restore sidebar dropdowns to match state (after page switch).
   */
  restoreState() {
    const makeSelect = document.getElementById('select-make');
    if (makeSelect && CF_STATE.selectedMake) {
      makeSelect.value = CF_STATE.selectedMake;
    }
    this._populateModels();
    // Restore model dropdown value after populating
    const modelSelect = document.getElementById('select-model');
    if (modelSelect && CF_STATE.selectedModel) {
      modelSelect.value = CF_STATE.selectedModel;
    }
    this._populateVariants();
    this._renderVariantChips();
  },
};
