/**
 * CarFlow Configuration
 * Central place for all configurable values.
 */
const CF_CONFIG = {
  // GitHub repository details
  REPO_OWNER: 'CarFlowLab',
  REPO_NAME: 'CarFlow_BE',
  REPO_BRANCH: 'main',
  MASTER_FILES_PATH: 'ml_models/master_files',
  ETL_DATA_PATH: 'etl/data',
  ETL_HISTORY_PATH: 'etl/data_history',

  // GitHub token for private repos. Set via URL param ?token=xxx or enter in the UI.
  // IMPORTANT: For production, consider using a lightweight proxy/serverless function instead.
  githubToken: null,

  // Colors (matching Streamlit theme)
  colors: {
    primary: '#e66912',
    primaryLight: 'rgba(230, 105, 18, 0.15)',
    bg: '#FFFFFF',
    bgSecondary: '#F0F2F6',
    text: '#31333F',
    textLight: '#6b7280',
    textMuted: '#dadfe9',
    dark: '#2d1b27',
    spain: '#970c10',
    germany: '#153250',
    graySelect: '#a4a5ad',
    border: '#e5e7eb',
  },

  // Metrics definitions (matching MetricsMasterSheet3.csv)
  metrics: {
    demand: [
      {
        user_name: 'Adds Duration (Days)',
        master_name: 'add_days_q66',
        low_lim: 0,
        high_lim: 150,
        description: 'The median number of days that advertisements remain online, representing the typical duration cars are listed before being sold.',
      },
      {
        user_name: '% Adds Reduced',
        master_name: 'ratio_reduced_adds',
        low_lim: 0,
        high_lim: 1,
        description: 'The proportion of advertisements where the listed price has been reduced, indicating price adjustments in response to market conditions.',
      },
    ],
    profit: [
      {
        user_name: 'Expected Profit Margin (\u20ac)',
        master_name: 'Expected_ABS',
        low_lim: -2500,
        high_lim: 25000,
        description: 'The median expected profit in euros, calculated as the difference between typical car prices in Germany and Spain.',
      },
      {
        user_name: 'Expected Profit Margin (%)',
        master_name: 'Expected_REL_perc',
        low_lim: -5,
        high_lim: 50,
        description: 'The median expected profit margin as a percentage, comparing typical posting prices between Germany and Spain.',
      },
    ],
  },

  // Ads per page in the board
  adsPerPage: 10,

  // Provinces to exclude when "Exclude Islands" is on
  islandProvinces: ['Las Palmas', 'Sta. C. Tenerife', 'Baleares', 'Melilla', 'Ceuta'],

  // Website logo mapping
  siteLogos: {
    'Cochesnet.com': { ES: 'ES_Cochesnet_croped.png', DE: null },
    'AutoScout24.com': { ES: 'ES_AutoScout24_croped.png', DE: 'DE_AutoScout24_croped.png' },
  },
};
