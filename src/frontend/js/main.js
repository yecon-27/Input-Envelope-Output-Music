/**
 * Main application entry point
 * Handles initialization, UI interactions, and game coordination
 */

// --- Magenta UMD global fallback ---
// ---- Safely get Magenta UMD global ----
const mm =
  window.mm ||
  (window.magenta && window.magenta.music) ||
  window.magentamusic ||
  window.magentaMusic || null;

if (!mm || !mm.MusicRNN) {
  console.error('[Magenta] UMD not ready: check if index.html includes tf.min.js and music.js before main.js');
}

// Global game instance
let game = null;

// Helper to access i18n
const t = (key, params) => window.i18n ? window.i18n.t(key, params) : key;

// UI elements
const elements = {
    scoreValue: null,
    pauseBtn: null,
    slowBtn: null,
    normalBtn: null,
    fastBtn: null,
    pauseOverlay: null,
    encouragementMessage: null,
    sessionSettingsBtn: null,
    sessionModal: null,
    sessionStartBtn: null,
    sessionCloseBtn: null,
    sessionResetBtn: null,
    sessionVolume: null,
    sessionDensity: null,
    sessionTimbre: null,
    sessionLatency: null,
    sessionImmediate: null,
    sessionReward: null,
    sessionPreset: null,
    panicMuteBtn: null,
    resultMuteBtn: null,
    inputMode: null,
    bubbleCount: null
};

const SESSION_DEFAULTS = {
    volumeLevel: 'medium',
    rhythmDensity: 'normal',
    timbre: 'piano',
    feedbackLatencyMs: 0,
    immediateToneMode: 'full',
    rewardEnabled: true,
};

const SESSION_ENVELOPE = {
    rewardBpm: { min: 65, max: 75 },
    rewardDurationSec: { min: 8, max: 20 },
};

let statusUpdatesStarted = false;
let pausedBySettings = false;
let panicMuted = false;
// currentLang is now managed by i18n.js

// SVG icon definitions
const ICONS = {
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    volumeX: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>',
    volume2: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    rewind: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>',
    playSmall: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    fastForward: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>',
    target: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'
};

function updateUIText() {
    // 1. Header & Footer
    if(elements.pauseBtn) elements.pauseBtn.innerHTML = game?.isPaused 
        ? ICONS.play + `<span style="margin-left:6px">${t('ui.resume')}</span>`
        : ICONS.pause + `<span style="margin-left:6px">${t('header.pause')}</span>`;
        
    refreshPanicButtons();

    if(elements.sessionSettingsBtn) elements.sessionSettingsBtn.innerHTML = ICONS.settings + `<span style="margin-left:6px">${t('header.settings')}</span>`;
    
    // Speed buttons
    if(elements.slowBtn) elements.slowBtn.innerHTML = ICONS.rewind + `<span class="speed-label">${t('speed.slow')}</span>`;
    if(elements.normalBtn) elements.normalBtn.innerHTML = ICONS.playSmall + `<span class="speed-label">${t('speed.normal')}</span>`;
    if(elements.fastBtn) elements.fastBtn.innerHTML = ICONS.fastForward + `<span class="speed-label">${t('speed.fast')}</span>`;

    // Footer
    const instructionsP = document.querySelector('.instructions p');
    if(instructionsP) instructionsP.innerHTML = ICONS.target + ' ' + t('footer.instruction');
    
    const inputModeLabel = document.querySelector('.status-item:nth-child(1) span:first-child');
    if(inputModeLabel) inputModeLabel.textContent = t('footer.inputMode');
    if(elements.inputMode) elements.inputMode.textContent = t('input.mouse');

    const bubbleCountLabel = document.querySelector('.status-item:nth-child(2) span:first-child');
    if(bubbleCountLabel) bubbleCountLabel.textContent = t('footer.bubbleCount');

    const timeLabel = document.querySelector('.time-remaining span:first-child');
    if(timeLabel) timeLabel.textContent = t('ui.timeRemaining');

    // 2. Settings Modal
    const settingsTitle = document.querySelector('.settings-header h2');
    if(settingsTitle) settingsTitle.textContent = t('set.title');
    
    const settingsSub = document.querySelector('.settings-subtitle');
    if(settingsSub) settingsSub.textContent = t('set.subtitle');

    // New Settings Grid (using .settings-label-with-icon)
    const newLabels = document.querySelectorAll('.settings-label-with-icon span');
    if(newLabels.length >= 4) {
        newLabels[0].textContent = t('set.volume');
        newLabels[1].textContent = t('set.timbre');
        newLabels[2].textContent = t('set.latency');
        newLabels[3].textContent = t('set.feedback');
    }
    
    // Fallback for old settings grid if needed
    const oldLabels = document.querySelectorAll('.settings-field label');
    if(oldLabels.length > 0 && newLabels.length === 0) {
        if(oldLabels.length >= 6) {
            oldLabels[0].textContent = t('set.volume');
            oldLabels[1].textContent = t('set.density');
            oldLabels[2].textContent = t('set.timbre');
            oldLabels[3].textContent = t('set.latency');
            oldLabels[4].textContent = t('set.feedback');
            oldLabels[5].textContent = t('set.reward');
        }
    }

    // Settings Action Buttons
    if(elements.sessionResetBtn) elements.sessionResetBtn.textContent = t('set.reset');
    if(elements.sessionStartBtn) elements.sessionStartBtn.textContent = game?.roundActive ? t('ui.saveSettings') : t('set.start');
    if(elements.sessionCloseBtn) elements.sessionCloseBtn.textContent = t('set.close');

    // Update Segmented Controls
    updateSelectOptions('session-volume', ['opt.low', 'opt.medium', 'opt.high']);
    updateSelectOptions('session-timbre', ['opt.piano', 'opt.epiano', 'opt.guitar']);
    updateSelectOptions('session-latency', ['opt.immediate', 'opt.delay']);
    updateSelectOptions('session-immediate', ['opt.full', 'opt.visual', 'opt.off']);
    updateSelectOptions('session-reward', ['opt.on', 'opt.off']);

    // 3. Sidebar
    const sidebarTitle = document.querySelector('.sidebar-title');
    if (sidebarTitle) sidebarTitle.textContent = t('sidebar.title');

    const sectionTitles = document.querySelectorAll('.sidebar-section .section-title');
    if (sectionTitles.length >= 4) {
        updateTextWithIcon(sectionTitles[0], t('sidebar.realtimeData'));
        updateTextWithIcon(sectionTitles[1], t('sidebar.laneDist'));
        updateTextWithIcon(sectionTitles[2], t('sidebar.patternPredict'));
        updateTextWithIcon(sectionTitles[3], t('sidebar.recentClicks'));
    }

    // Sidebar Mini Labels
    const miniLabels = document.querySelectorAll('.mini-label');
    if(miniLabels.length >= 4) {
        miniLabels[0].textContent = t('sidebar.clickCount');
        miniLabels[1].textContent = t('sidebar.hitRate');
        miniLabels[2].textContent = 'BPM';
        miniLabels[3].textContent = t('sidebar.dominant');
    }
    
    // Sidebar Tooltip (bubble tooltip content within Pattern Predict section)
    const patternTooltipContent = document.querySelector('.sidebar-section .bubble-tooltip .bubble-tooltip-content');
    if (patternTooltipContent) {
        patternTooltipContent.textContent = t('sidebar.tooltip.pattern');
    }

    // 4. Report Panel
    const reportTitle = document.querySelector('.report-panel-header h3');
    if (reportTitle) updateTextWithIcon(reportTitle, t('report.title'));

    const reportSections = document.querySelectorAll('.report-section-title');
    if (reportSections.length >= 1) {
        updateTextWithIcon(reportSections[0], t('report.behaviorPattern'));
        if (reportSections[1]) updateTextWithIcon(reportSections[1], t('report.musicParams'));
    }
    
    // Report Score Labels
    const scoreLabels = document.querySelectorAll('.score-label');
    if(scoreLabels.length >= 3) {
        updateTextWithIcon(scoreLabels[0], t('report.score.sequential'));
        updateTextWithIcon(scoreLabels[1], t('report.score.repetitive'));
        updateTextWithIcon(scoreLabels[2], t('report.score.exploratory'));
        
        // Update tooltips inside these labels
        const tooltips = document.querySelectorAll('.score-label .info-icon');
        if(tooltips.length >= 3) {
            tooltips[0].setAttribute('data-tooltip', t('report.tooltip.sequential'));
            tooltips[1].setAttribute('data-tooltip', t('report.tooltip.repetitive'));
            tooltips[2].setAttribute('data-tooltip', t('report.tooltip.exploratory'));
        }
    }
    
    // Report Params
    const reportParamLabels = document.querySelectorAll('.music-params-grid label');
    if(reportParamLabels.length >= 3) {
        // Use helper to preserve the warning badge (which is a child of the label)
        // Structure: <label> <span> Title <span class="safe"></span> </span> <span class="warning"></span> </label>
        updateParamLabel(reportParamLabels[0], t('expert.tempo'));
        updateParamLabel(reportParamLabels[1], t('expert.contrast'));
        updateParamLabel(reportParamLabels[2], t('expert.volume'));
    }

    // 5. Result Overlay
    const resultTitle = document.querySelector('.game-result-overlay h2');
    if (resultTitle) updateTextWithIcon(resultTitle, t('ui.gameOver'));

    const statLabels = document.querySelectorAll('.stat-item .stat-label');
    if (statLabels.length >= 3) {
        statLabels[0].textContent = t('res.success');
        statLabels[1].textContent = t('res.speed');
        statLabels[2].textContent = t('res.combo');
    }

    const statUnits = document.querySelectorAll('.stat-item .stat-unit');
    if (statUnits.length >= 3) {
        statUnits[0].textContent = t('res.unitBubbles');
        statUnits[1].textContent = t('res.unitSpeed');
        statUnits[2].textContent = t('res.unitCombo');
    }

    // Result Buttons
    const playMusicBtn = document.getElementById('play-music-btn');
    if (playMusicBtn) updateTextWithIcon(playMusicBtn, t('ui.play'));
    
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) updateTextWithIcon(playAgainBtn, t('ui.playAgain'));
    
    const finishBtn = document.getElementById('finish-game-btn');
    if (finishBtn) updateTextWithIcon(finishBtn, t('ui.finish'));
    
    // Expert Button
    const expertBtn = document.getElementById('post-session-btn');
    if (expertBtn) updateTextWithIcon(expertBtn, t('ui.expertMode'));

    // Pause Overlay
    const pauseTitle = document.querySelector('#pause-overlay h2');
    const pauseDesc = document.querySelector('#pause-overlay p');
    if(pauseTitle) pauseTitle.textContent = t('ui.gamePaused');
    if(pauseDesc) pauseDesc.textContent = t('ui.clickContinue');
}

function updateTextWithIcon(element, text) {
    if (!element) return;
    // Update the first text node found that is not empty
    let textNodeUpdated = false;
    for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
            node.textContent = ' ' + text + ' ';
            textNodeUpdated = true;
            break;
        }
    }
    // If no text node was found (e.g. only icon), append text
    if (!textNodeUpdated) {
        element.appendChild(document.createTextNode(' ' + text));
    }
}

function updateParamLabel(label, text) {
    if (!label) return;
    
    // Find the title span, explicitly excluding the warning badge
    // We look for a direct child span that is NOT the warning badge
    let titleSpan = null;
    for (let i = 0; i < label.children.length; i++) {
        const child = label.children[i];
        if (child.tagName === 'SPAN' && !child.classList.contains('param-warning-badge')) {
            titleSpan = child;
            break;
        }
    }

    if (titleSpan) {
        // Update the text inside this span (before the nested safe-range span)
        let textUpdated = false;
        for (let i = 0; i < titleSpan.childNodes.length; i++) {
            const node = titleSpan.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                node.textContent = text + ' ';
                textUpdated = true;
                break;
            }
        }
        if (!textUpdated) {
            titleSpan.prepend(document.createTextNode(text + ' '));
        }
    }
}

function updateSelectOptions(id, keys) {
    const element = document.getElementById(id);
    if(!element) return;
    
    // Check if it's a SELECT element (Old UI)
    if (element.tagName === 'SELECT') {
        for(let i=0; i<element.options.length && i<keys.length; i++) {
            element.options[i].text = t(keys[i]);
        }
    } 
    // Otherwise check if there is a corresponding segmented control (New UI)
    else {
        const control = document.querySelector(`.segmented-control[data-field="${id}"]`);
        if (control) {
            const segments = control.querySelectorAll('.segment');
            for(let i=0; i<segments.length && i<keys.length; i++) {
                // Find the span inside the button to update text
                const span = segments[i].querySelector('span');
                if (span) {
                    span.textContent = t(keys[i]);
                }
                // Update title attribute for tooltip
                segments[i].title = t(keys[i]);
            }
        }
    }
}

function toggleLanguage() {
    if (window.i18n) {
        window.i18n.toggleLanguage();
    }
}

window.SESSION_DEFAULTS = SESSION_DEFAULTS;
window.SESSION_ENVELOPE = SESSION_ENVELOPE;

function syncSessionElements() {
    elements.sessionSettingsBtn = document.getElementById('session-settings-btn');
    elements.sessionModal = document.getElementById('session-settings-modal');
    elements.sessionStartBtn = document.getElementById('session-start-btn');
    elements.sessionCloseBtn = document.getElementById('session-close-btn');
    elements.sessionResetBtn = document.getElementById('session-reset-btn');
    elements.sessionVolume = document.getElementById('session-volume');
    elements.sessionDensity = document.getElementById('session-density');
    elements.sessionTimbre = document.getElementById('session-timbre');
    elements.sessionLatency = document.getElementById('session-latency');
    elements.sessionImmediate = document.getElementById('session-immediate');
    elements.sessionReward = document.getElementById('session-reward');
    elements.sessionPreset = document.getElementById('session-preset');
    elements.panicMuteBtn = document.getElementById('panic-mute-btn');
    elements.resultMuteBtn = document.getElementById('result-mute-btn');
}

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Bubble Popping Game - Initializing...');
    
    // Get UI elements
    initializeUIElements();
    
    // Initialize game engine
    initializeGame();
    
    // Set up event listeners
    setupEventListeners();
    
    // Handle responsive design
    setupResponsiveHandling();

    // Initialize i18n listener
    if (window.i18n) {
        window.i18n.subscribe(() => {
            updateUIText();
        });
        updateUIText(); // Initial text update
    }
    
    console.log('Application initialized successfully!');
});

/**
 * Get references to all UI elements
 */
function initializeUIElements() {
    elements.scoreValue = document.getElementById('score-value');
    elements.pauseBtn = document.getElementById('pause-btn');
    elements.slowBtn = document.getElementById('slow-btn');
    elements.normalBtn = document.getElementById('normal-btn');
    elements.fastBtn = document.getElementById('fast-btn');
    elements.pauseOverlay = document.getElementById('pause-overlay');
    elements.encouragementMessage = document.getElementById('encouragement-message');
    elements.inputMode = document.getElementById('input-mode');
    elements.bubbleCount = document.getElementById('bubble-count');
    syncSessionElements();

    // If settings UI is missing, try to inject
    ensureSessionSettingsUI();
    syncSessionElements();
    refreshPanicButtons();
    
    // Initialize segmented controls
    initSegmentedControls();
    
    // Verify all elements were found
    const missingElements = Object.entries(elements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);
    
    if (missingElements.length > 0) {
        // Some elements are optional now (like bpm sliders), so just warn
        // console.warn('Missing UI elements:', missingElements);
    }
    
    console.log('UI elements initialized successfully');
    return true;
}

function ensureSessionSettingsUI() {
    let controls = document.querySelector('.controls');
    if (!controls) {
        const header = document.querySelector('.game-header');
        if (header) {
            controls = document.createElement('div');
            controls.className = 'controls';
            header.appendChild(controls);
            console.warn('[SettingsUI] .controls not found, created fallback container');
        }
    }
    if (!controls) {
        console.warn('[SettingsUI] Control container not found, skipping UI injection');
        return;
    }
    if (controls && !document.getElementById('session-settings-btn')) {
        const btn = document.createElement('button');
        btn.id = 'session-settings-btn';
        btn.className = 'control-btn';
        btn.innerHTML = t('settings-btn'); // Will be updated by updateUIText
        controls.insertBefore(btn, controls.querySelector('.speed-controls') || null);
    }
    if (controls && !document.getElementById('panic-mute-btn')) {
        const btn = document.createElement('button');
        btn.id = 'panic-mute-btn';
        btn.className = 'control-btn panic-btn';
        btn.innerHTML = t('panic-btn-unmuted'); // Will be updated
        controls.insertBefore(btn, controls.querySelector('.speed-controls') || null);
    }
    if (controls && !document.getElementById('session-preset')) {
        const preset = document.createElement('div');
        preset.id = 'session-preset';
        preset.className = 'session-preset';
        preset.textContent = 'Preset: medium / normal / soft';
        controls.appendChild(preset);
    }
    if (!document.getElementById('session-settings-modal')) {
        const modal = document.createElement('div');
        modal.id = 'session-settings-modal';
      modal.className = 'settings-modal hidden';
      // Note: content will be updated by updateUIText, but initial structure needs to be maintained
      modal.innerHTML = `
          <div class="settings-panel">
            <div class="settings-header">
                <h2>Game Settings</h2>
                <p class="settings-subtitle">Adjust sensory experience to suit you</p>
            </div>
            
            <div class="settings-scroll-area">
                <div class="settings-grid">
                <div class="settings-field">
                    <label for="session-volume">Volume</label>
                    <select id="session-volume">
                    <option value="low">Soft (Low)</option>
                    <option value="medium" selected>Standard (Medium)</option>
                    <option value="high">Loud (High)</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label for="session-density">Bubble Count</label>
                    <select id="session-density">
                    <option value="sparse">Fewer (Sparse)</option>
                    <option value="normal" selected>Normal</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label for="session-timbre">Instrument</label>
                    <select id="session-timbre">
                    <option value="soft" selected>Soft Piano</option>
                    <option value="bright">Bright Violin</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label for="session-latency">Sound Delay</label>
                    <select id="session-latency">
                    <option value="0" selected>Immediate</option>
                    <option value="500">Delayed (0.5s)</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label for="session-immediate">Click Feedback</label>
                    <select id="session-immediate">
                    <option value="full" selected>Sound+Visual (Full)</option>
                    <option value="visual">Visual Only</option>
                    <option value="off">Off</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label for="session-reward">End Music</label>
                    <select id="session-reward">
                    <option value="on" selected>On</option>
                    <option value="off">Off</option>
                    </select>
                </div>
                </div>
            </div>

            <div class="settings-actions">
              <button id="session-reset-btn" class="result-btn secondary small">Reset</button>
              <button id="session-start-btn" class="result-btn primary small">Start Game</button>
              <button id="session-close-btn" class="result-btn secondary small">Close</button>
            </div>
          </div>
        `;
      document.body.appendChild(modal);
    }
}

/**
 * Initialize the game engine
 */
  async function initializeGame() {
    try {
      // 1. Fix random seed
      if (!window.__LEVEL_SEED) {
        const u32 = new Uint32Array(1);
        try { crypto.getRandomValues(u32); } catch { u32[0] = Math.floor(Math.random() * 2**32); }
        window.__LEVEL_SEED = (u32[0] >>> 0);
      }
      console.log('[Game Seed]', window.__LEVEL_SEED);
  
      // 2. Create and initialize game engine
      game = new GameEngine('game-canvas');
      // Expose game instance globally for result window and other modules
      window.game = game;
      const initialized = await game.init();
      if (!initialized) throw new Error('Failed to initialize game engine');
      console.log('Game engine ready');

      // 3. Ensure game result manager is initialized
      if (typeof GameResultManager !== 'undefined') {
        if (!window.gameResultManager) {
          window.gameResultManager = new GameResultManager();
        }
        console.log('Game result manager ready');
      } else {
        console.warn('GameResultManager not found');
      }

      // Warm up Magenta (download model/sounds while playing)
      initMusicRNN().catch(err => console.warn('[Magenta warmup failed]', err));
  
      // (Optional) Add keydown unlock fallback; pointerdown already added in GameEngine
      window.addEventListener('keydown', () => window.popSynth?.resume?.(), { once: true });

      // Show settings modal by default, wait for expert to click Start Round
      openSessionSettingsModal();
  
    } catch (e) {
      console.error('Failed to initialize game:', e);
      showErrorMessage('Failed to start game. Please refresh the page.');
    }
  }

/**
 * Set up all event listeners for UI interactions
 */
function setupEventListeners() {
    // Pause/Resume button
    elements.pauseBtn.addEventListener('click', handlePauseToggle);
    
    // Speed control buttons
    elements.slowBtn.addEventListener('click', () => handleSpeedChange(0.5, 'slow'));
    elements.normalBtn.addEventListener('click', () => handleSpeedChange(1.0, 'normal'));
    elements.fastBtn.addEventListener('click', () => handleSpeedChange(1.5, 'fast'));

    // Session settings
    if (elements.sessionModal) {
        // Use event delegation to handle all clicks in modal, ensuring dynamic content responds
        elements.sessionModal.addEventListener('click', (e) => {
            const target = e.target;
            
            // Start button
            if (target.id === 'session-start-btn') {
                handleStartRound();
            }
            // Close button
            else if (target.id === 'session-close-btn') {
                closeSessionSettingsModal();
            }
            // Reset button
            else if (target.id === 'session-reset-btn') {
                resetSessionForm();
            }
        });
    }

    if (elements.sessionSettingsBtn) {
        elements.sessionSettingsBtn.addEventListener('click', () => openSessionSettingsModal());
    } else {
        console.warn('[SettingsUI] Settings button not found');
    }

    if (elements.panicMuteBtn) {
        elements.panicMuteBtn.addEventListener('click', () => setPanicMuted(!panicMuted));
    }
    if (elements.resultMuteBtn) {
        elements.resultMuteBtn.addEventListener('click', () => setPanicMuted(!panicMuted));
    }
    
    // Language Toggle
    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
        langBtn.addEventListener('click', toggleLanguage);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardInput);
    
    // Window resize handling
    window.addEventListener('resize', handleWindowResize);
    
    console.log('Event listeners set up successfully');
}

/**
 * Handle pause/resume button click
 */
function handlePauseToggle() {
    if (!game) return;
    
    const isPaused = game.togglePause();
    
    // Update UI
    elements.pauseBtn.innerHTML = isPaused 
        ? ICONS.play + `<span style="margin-left:6px">${t('ui.resume')}</span>`
        : ICONS.pause + `<span style="margin-left:6px">${t('header.pause')}</span>`;
    
    if (isPaused) {
        elements.pauseOverlay.classList.remove('hidden');
        showEncouragementMessage(t('msg.paused'));
    } else {
        elements.pauseOverlay.classList.add('hidden');
        showEncouragementMessage(t('msg.resume'));
    }
}

/**
 * Handle speed change button clicks
 */
function handleSpeedChange(speed, speedName) {
    if (!game) return;
    
    // Update game speed
    game.setSpeed(speed);
    
    // Update UI - remove active class from all speed buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    const buttonMap = {
        'slow': elements.slowBtn,
        'normal': elements.normalBtn,
        'fast': elements.fastBtn
    };
    
    buttonMap[speedName].classList.add('active');
    
    // Show feedback message
    const speedMessages = {
        'slow': t('msg.slow'),
        'normal': t('msg.normal'),
        'fast': t('msg.fast')
    };
    
    showEncouragementMessage(speedMessages[speedName]);
}

/**
 * Handle keyboard input for accessibility
 */
function handleKeyboardInput(event) {
    if (!game) return;
    
    switch (event.code) {
        case 'Space':
            event.preventDefault();
            handlePauseToggle();
            break;
        case 'Digit1':
            handleSpeedChange(0.5, 'slow');
            break;
        case 'Digit2':
            handleSpeedChange(1.0, 'normal');
            break;
        case 'Digit3':
            handleSpeedChange(1.5, 'fast');
            break;
    }
}

/**
 * Handle window resize for responsive design
 */
function handleWindowResize() {
    if (game && game.handleResize) {
        game.handleResize();
    }
}

/**
 * Set up responsive design handling
 */
function setupResponsiveHandling() {
    // Initial resize handling
    handleWindowResize();
    
    // Set up responsive canvas scaling
    const canvas = document.getElementById('game-canvas');
    const gameArea = canvas.parentElement;
    
    // Create ResizeObserver for better responsive handling
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(entries => {
            handleWindowResize();
        });
        
        resizeObserver.observe(gameArea);
    }
}

/**
 * Show encouragement message with fade animation
 */
function showEncouragementMessage(message, duration = 2000) {
    // User has disabled feedback, don't show
    return;
}

/**
 * Show error message to user
 */
function showErrorMessage(message) {
    // Create error overlay
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'error-overlay';
    errorOverlay.innerHTML = `
        <div class="error-content">
            <h2>Oops! Something went wrong</h2>
            <p>${message}</p>
            <button onclick="location.reload()" class="control-btn">Refresh Page</button>
        </div>
    `;
    
    // Add error styles
    errorOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(248, 249, 250, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    document.body.appendChild(errorOverlay);
}

/**
 * Update score display
 */
function updateScoreDisplay(score) {
    if (elements.scoreValue) {
        elements.scoreValue.textContent = score;
    }
}

/**
 * Get current game state (for debugging)
 */
function getGameState() {
    return game ? game.getState() : null;
}

/**
 * Get bubble manager for debugging
 */
function getBubbleManager() {
    return game ? game.getBubbleManager() : null;
}

/**
 * Get hand tracker for debugging
 */
function getHandTracker() {
    return game ? game.getHandTracker() : null;
}

/**
 * Start status updates for UI
 */
function startStatusUpdates() {
    setInterval(() => {
      if (game) {
        const state = game.getState();
  
        // Query remaining time and update progress bar
        if (typeof game.getRoundRemainingMs === 'function') {
          const remainingMs = game.getRoundRemainingMs();
          const totalMs = game.roundDurationMs || 60000; // Default 60s
          
          // Update autism-friendly progress display
          if (window.autismFeatures) {
            window.autismFeatures.updateProgress(remainingMs, totalMs);
          }
        }
  
        // Update bubble count
        if (elements.bubbleCount) {
          elements.bubbleCount.textContent = state.bubbleCount || 0;
        }
  
        if (elements.inputMode) {
          elements.inputMode.textContent = t('input.mouse') || 'Mouse';
        }
      }
    }, 500);
  }

function normalizeSessionConfig(config = {}) {
    const merged = { ...SESSION_DEFAULTS, ...config };
    // Keep rewardBpm and duration safe just in case, but they come from defaults now
    return merged;
}

function getCurrentSessionConfig() {
    return normalizeSessionConfig(window.sessionConfig || game?.sessionConfig || {});
}

function updateSessionPresetLabel(config) {
    if (!elements.sessionPreset) return;
    elements.sessionPreset.textContent = `Preset: ${config.volumeLevel} / ${config.rhythmDensity} / ${config.timbre}`;
}

// Initialize segmented controls
function initSegmentedControls() {
    const controls = document.querySelectorAll('.segmented-control');
    controls.forEach(control => {
        const fieldId = control.dataset.field;
        const hiddenInput = document.getElementById(fieldId);
        const segments = control.querySelectorAll('.segment');
        
        segments.forEach(segment => {
            segment.addEventListener('click', () => {
                // Remove all active states
                segments.forEach(s => s.classList.remove('active'));
                // Add current active state
                segment.classList.add('active');
                // Update hidden input value
                if (hiddenInput) {
                    hiddenInput.value = segment.dataset.value;
                }
            });
        });
    });
}

// Update segmented control selected state
function updateSegmentedControl(fieldId, value) {
    const control = document.querySelector(`.segmented-control[data-field="${fieldId}"]`);
    if (!control) return;
    
    const segments = control.querySelectorAll('.segment');
    segments.forEach(segment => {
        if (segment.dataset.value === String(value)) {
            segment.classList.add('active');
        } else {
            segment.classList.remove('active');
        }
    });
    
    const hiddenInput = document.getElementById(fieldId);
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

function loadSessionSettingsForm(config) {
    if (!elements.sessionModal) return;
    const normalized = normalizeSessionConfig(config);
    
    // Update segmented controls (only update settings that exist in UI)
    updateSegmentedControl('session-volume', normalized.volumeLevel || 'medium');
    updateSegmentedControl('session-timbre', normalized.timbre || 'piano');
    updateSegmentedControl('session-latency', String(normalized.feedbackLatencyMs ?? 0));
    updateSegmentedControl('session-immediate', normalized.immediateToneMode || 'full');
    
    // Also update hidden input values (for backward compatibility)
    if(elements.sessionVolume) elements.sessionVolume.value = normalized.volumeLevel || 'medium';
    if(elements.sessionDensity) elements.sessionDensity.value = normalized.rhythmDensity || 'normal';
    if(elements.sessionTimbre) elements.sessionTimbre.value = normalized.timbre || 'piano';
    if(elements.sessionLatency) elements.sessionLatency.value = String(normalized.feedbackLatencyMs ?? 0);
    if(elements.sessionImmediate) elements.sessionImmediate.value = normalized.immediateToneMode || 'full';
    if(elements.sessionReward) elements.sessionReward.value = normalized.rewardEnabled ? 'on' : 'off';
    
    updateSessionPresetLabel(normalized);
}

function readSessionSettingsForm() {
    return normalizeSessionConfig({
        volumeLevel: elements.sessionVolume?.value || 'medium',
        rhythmDensity: elements.sessionDensity?.value || 'normal',
        timbre: elements.sessionTimbre?.value || 'piano',
        feedbackLatencyMs: parseInt(elements.sessionLatency?.value || '0', 10),
        immediateToneMode: elements.sessionImmediate?.value || 'full',
        rewardEnabled: elements.sessionReward?.value === 'on',
    });
}

function resetSessionForm() {
    loadSessionSettingsForm(SESSION_DEFAULTS);
}

function syncPanicButton(btn, isMuted) {
    if (!btn) return;
    btn.classList.toggle('is-muted', isMuted);
    btn.innerHTML = isMuted 
        ? ICONS.volume2 + `<span style="margin-left:6px">${t('header.unmute')}</span>`
        : ICONS.volumeX + `<span style="margin-left:6px">${t('header.mute')}</span>`;
}

function refreshPanicButtons() {
    const muted = window.__panicMute === true;
    syncPanicButton(elements.panicMuteBtn, muted);
    syncPanicButton(elements.resultMuteBtn, muted);
}

function setPanicMuted(isMuted) {
    const nextMuted = Boolean(isMuted);
    if (panicMuted === nextMuted) {
        refreshPanicButtons();
        return;
    }
    panicMuted = nextMuted;
    window.__panicMute = panicMuted;
    refreshPanicButtons();
    if (window.MAGENTA?.player) {
        window.MAGENTA.player.stop();
    }
    if (window.autismFeatures?.applySoundVolume) {
        window.autismFeatures.applySoundVolume();
        window.autismFeatures.updateUIValues?.();
    } else if (window.popSynth?.setVolume) {
        window.popSynth.setVolume(panicMuted ? 0 : 0.7);
    }
}

function openSessionSettingsModal() {
    if (!elements.sessionModal) {
        ensureSessionSettingsUI();
        syncSessionElements();
    }
    if (!elements.sessionModal) {
        console.warn('[SettingsUI] session-settings-modal missing, please confirm latest index.html is loaded');
        return;
    }
    const config = getCurrentSessionConfig();
    loadSessionSettingsForm(config);
    if (elements.sessionStartBtn) {
        elements.sessionStartBtn.textContent = game?.roundActive ? t('ui.saveSettings') : t('set.start');
    }
    if (game?.roundActive && !game.isPaused) {
        game.togglePause();
        pausedBySettings = true;
    }
    updateUIText(); // Ensure modal text is updated
    elements.sessionModal.classList.remove('hidden');
}

function closeSessionSettingsModal() {
    elements.sessionModal.classList.add('hidden');
    if (pausedBySettings && game?.isPaused) {
        game.togglePause();
    }
    pausedBySettings = false;
}

function handleStartRound() {
    const config = readSessionSettingsForm();
    window.sessionConfig = { ...config };
    game?.setSessionConfig?.(config);
    updateSessionPresetLabel(config);

    if (game?.roundActive) {
        showEncouragementMessage(t('msg.saved'), 1200);
        closeSessionSettingsModal();
        return;
    }

    if (!game?.isRunning) {
        game.start();
    }

    if (!statusUpdatesStarted) {
        startStatusUpdates();
        statusUpdatesStarted = true;
    }

    // Reset achievements and result statistics
    if (window.autismFeatures) {
        window.autismFeatures.resetAchievements();
    }
    if (window.gameResultManager) {
        window.gameResultManager.startGame();
    }

    game.startRound(60, {
        clearHistory: true,
        onEnd: async (session) => {
            try {
                console.log('Round ended:', session);
                game.stop();

                if (window.gameResultManager) {
                    window.gameResultManager.endGame();
                    console.log('📊 Game results displayed');
                }

                const enableMusicGeneration = window.enableAIMusic || false;
                if (enableMusicGeneration) {
                    setTimeout(async () => {
                        try {
                            await generateMelodyFromSession(session, {
                                primerBars: 2,
                                continueSteps: 64,
                                temperature: 1.0,
                                downloadMidi: false,
                            });
                        } catch (musicError) {
                            console.warn('🎵 Music generation failed, but game results unaffected', musicError);
                        }
                    }, 100);
                } else {
                    window.lastGeneratedSequence = createRichTestMusic(session);
                    console.log('🎵 Music generation disabled, using rich test sequence');
                    window.gameResultManager?.updateDebugPanel?.();
                    try { window.dispatchEvent(new CustomEvent('sequence:updated', { detail: { sequence: window.lastGeneratedSequence } })); } catch {}
                }
            } catch (err) {
                console.error('[AI] submit failed:', err);
                showEncouragementMessage(t('msg.error'), 1500);
            }
        },
    });

    showEncouragementMessage(t('msg.welcome'));
    closeSessionSettingsModal();
}

// Export functions for global access
window.gameApp = {
    updateScoreDisplay,
    showEncouragementMessage,
    getGameState,
    getBubbleManager,
    getHandTracker,
    startStatusUpdates,
    setPanicMuted,
    refreshPanicButtons
};

window.sessionUI = {
    open: openSessionSettingsModal,
    close: closeSessionSettingsModal
};

// ===== Magenta MusicRNN (fixed CPU backend) =====
const MAGENTA = {
    model: null,
    player: null,
    stepsPerQuarter: 4,
    qpm: 120,
    __backend: null,   // Record current model backend
};
  
  async function initMusicRNN({ forceReload = false, backend = 'cpu' } = {}) {
    const mm = window.mm;
    if (!mm || !mm.MusicRNN) {
      console.error('[Magenta] UMD not loaded: confirm index.html includes tf.min.js and vendor/magenta/music.js before main.js');
      return;
    }
  
    const tfjs = window.tf;
    if (tfjs && tfjs.getBackend() !== backend) {
      await tfjs.setBackend(backend);   // Key: select backend before initializing model
      await tfjs.ready();
    }
  
    // Same backend and already initialized, return directly
    if (!forceReload && MAGENTA.model && MAGENTA.__backend === backend) {
      return;
    }
  
    // If previously using different backend, rebuild model (avoid weight loss)
    try { MAGENTA.model?.dispose?.(); } catch {}
    MAGENTA.model = new mm.MusicRNN('../../vendor/magenta/checkpoints/music_rnn/melody_rnn');
    await MAGENTA.model.initialize();
  
    // Create SoundFont player to ensure correct sound
    if (!MAGENTA.player) {
      try {
        // Try using SoundFont player (if available)
        MAGENTA.player = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
        console.log('🎹 Using SoundFont player (piano sound)');
        
        // Preload common instrument samples to prevent first play errors
        // 0: Piano, 4: E.Piano, 24: Guitar (Nylon), 9: Percussion (Standard Kit)
        const preloadSeq = {
          notes: [
            { program: 0, pitch: 60, startTime: 0, endTime: 0.1 },
            { program: 4, pitch: 60, startTime: 0, endTime: 0.1 },
            { program: 24, pitch: 60, startTime: 0, endTime: 0.1 },
            { program: 0, pitch: 36, startTime: 0, endTime: 0.1, isDrum: true } 
          ],
          totalTime: 0.1
        };
        MAGENTA.player.loadSamples(preloadSeq).then(() => {
            console.log('✅ Common instrument samples preloaded');
        }).catch(err => {
            console.warn('⚠️ Instrument sample preload failed', err);
        });

      } catch (e) {
        // Fallback to default player
        MAGENTA.player = new mm.Player();
        console.log('🎵 Using default player');
      }
    }
    MAGENTA.__backend = backend;
    // Expose to global for result popup playback
    window.MAGENTA = MAGENTA;
    console.log('[Magenta] MusicRNN ready on backend =', backend);
}
  
  // Quantize (keep original logic)
  function sessionToQuantized(session, sustainSec = 0.2) {
    const notes = [...session.notes].sort((a, b) => a.dt - b.dt);
    const ns = {
      ticksPerQuarter: 220,
      totalTime: Math.max(0.001, ...notes.map(n => (n.dt / 1000 + sustainSec))),
      tempos: [{ time: 0, qpm: MAGENTA.qpm }],
      notes: notes.map(n => ({
        pitch: n.midi,
        startTime: n.dt / 1000,
        endTime: n.dt / 1000 + sustainSec,
        velocity: 80,
      })),
    };
    return mm.sequences.quantizeNoteSequence(ns, MAGENTA.stepsPerQuarter);
  }
  
  // Generate + play (temporarily switch to CPU for continueSequence to avoid multinomial error)
  async function generateMelodyFromSession(session, {
    primerBars = 2,
    continueSteps = 128,
    temperature = 1.1,
    downloadMidi = true,
  } = {}) {
    // Ensure CPU initialization (important)
    await initMusicRNN({ backend: 'cpu' });
  
    if (!session?.notes?.length) {
      window.gameApp?.showEncouragementMessage?.('No notes collected this round', 1200);
      return;
    }
  
    // Get user primer
    const qns = sessionToQuantized(session);
    const primerSteps = Math.min(primerBars * 16, qns.totalQuantizedSteps);
    const primer = mm.sequences.clone(qns);
    primer.totalQuantizedSteps = primerSteps;
    primer.notes = qns.notes.filter(n => n.quantizedEndStep <= primerSteps);
  
    let cont = null;

    // Add slight random perturbation for each generation (enhance diversity)
    const tempAdj = temperature + (Math.random() - 0.5) * 0.25; // ±0.125
    const stepsAdj = Math.max(32, continueSteps + Math.floor((Math.random() - 0.5) * 24)); // ±12 steps
    console.log('[Magenta] sampling params:', { temperature: tempAdj.toFixed(3), continueSteps: stepsAdj });
  
    // 1) User primer
    try {
      cont = await MAGENTA.model.continueSequence(primer, stepsAdj, tempAdj);
    } catch (err) {
      console.warn('[Magenta] user-primer continue failed:', err);
    }
  
    // 2) If empty, use built-in seed (randomized)
    if (!cont?.notes?.length) {
      console.warn('[Magenta] empty with user primer, retry with fallback seed');
      const seed = buildFallbackSeed();
      try {
        cont = await MAGENTA.model.continueSequence(seed, stepsAdj, Math.max(0.8, tempAdj));
      } catch (err2) {
        console.warn('[Magenta] fallback seed failed:', err2);
      }
    }
  
    // 3) If still empty, use greedy (temperature = 0.0)
    if (!cont?.notes?.length) {
      console.warn('[Magenta] fallback to greedy decoding (temperature=0)');
      const seed = buildFallbackSeed();
      try {
        cont = await MAGENTA.model.continueSequence(seed, stepsAdj, 0.0);
      } catch (err3) {
        console.error('[Magenta] greedy also failed:', err3);
        showEncouragementMessage('AI generation failed: check console errors', 1500);
        return;
      }
    }
  
    const full = mm.sequences.unquantizeSequence(cont);
    if ((!full.totalTime || full.totalTime <= 0) && full.notes?.length) {
      full.totalTime = Math.max(...full.notes.map(n => n.endTime), 0.001);
    }
  
    try { await mm.Player.tone?.context?.resume?.(); } catch {}
  
    // Only generate, don't auto-play (user clicks to play)
    window.lastGeneratedSequence = full;
    window.gameResultManager?.updateDebugPanel?.();
    try { window.dispatchEvent(new CustomEvent('sequence:updated', { detail: { sequence: full } })); } catch {}
    
    window.gameApp?.showEncouragementMessage?.(t('msg.reward'), 1800);
  
    if (downloadMidi) {
      try {
        // Improve MIDI generation to ensure sound
        const enhancedSequence = enhanceMidiSequence(full);
        
        // Validate sequence structure
        if (!enhancedSequence || !Array.isArray(enhancedSequence.notes)) {
          console.warn('⚠️ Enhanced sequence structure invalid, skipping MIDI download');
          return;
        }
        
        console.log('🎵 Preparing MIDI conversion, sequence info:', {
          notes: enhancedSequence.notes.length,
          totalTime: enhancedSequence.totalTime,
          ticksPerQuarter: enhancedSequence.ticksPerQuarter
        });
        
        const midi = mm.sequenceProtoToMidi(enhancedSequence);
        
        if (!midi || !midi.length) {
          console.warn('⚠️ MIDI conversion result empty');
          return;
        }
        
        const blob = new Blob([midi], { type: 'audio/midi' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; 
        a.download = 'magenta_rnn_output.mid'; 
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ MIDI file downloaded, contains', enhancedSequence.notes?.length || 0, 'notes');
      } catch (midiError) {
        console.warn('⚠️ MIDI download failed:', midiError);
        // Don't throw error, let music playback continue
      }
    }
  }

  /**
   * Enhance MIDI sequence to ensure MIDI file has sound
   */
  function enhanceMidiSequence(sequence) {
    if (!sequence || !sequence.notes || sequence.notes.length === 0) {
      console.warn('⚠️ Sequence empty, creating default notes');
      // Create a simple default sequence
      return {
        ticksPerQuarter: 220,
        totalTime: 4.0,
        tempos: [{ time: 0, qpm: 120 }],
        notes: [
          { pitch: 60, startTime: 0, endTime: 0.5, velocity: 80 },
          { pitch: 64, startTime: 0.5, endTime: 1.0, velocity: 80 },
          { pitch: 67, startTime: 1.0, endTime: 1.5, velocity: 80 },
          { pitch: 72, startTime: 1.5, endTime: 2.0, velocity: 80 }
        ],
        instrumentInfos: [{ instrument: 0, program: 0, isDrum: false }]
      };
    }
    
    // Copy original sequence
    const enhanced = JSON.parse(JSON.stringify(sequence));
    
    // Ensure all required properties exist
    enhanced.ticksPerQuarter = enhanced.ticksPerQuarter || 220;
    enhanced.tempos = Array.isArray(enhanced.tempos) && enhanced.tempos.length > 0 
      ? enhanced.tempos 
      : [{ time: 0, qpm: 120 }];
    
    // Ensure notes is array
    if (!Array.isArray(enhanced.notes)) {
      enhanced.notes = [];
    }
    
    // Enhance notes
    enhanced.notes = enhanced.notes.map(note => {
      const enhancedNote = { ...note };
      
      // Ensure note has reasonable duration (at least 0.1s)
      if (!enhancedNote.endTime || enhancedNote.endTime <= enhancedNote.startTime) {
        enhancedNote.endTime = enhancedNote.startTime + 0.25;
      }
      
      const duration = enhancedNote.endTime - enhancedNote.startTime;
      if (duration < 0.1) {
        enhancedNote.endTime = enhancedNote.startTime + 0.25;
      }
      
      // Ensure note has reasonable velocity
      enhancedNote.velocity = enhancedNote.velocity || 80;
      if (enhancedNote.velocity < 30) {
        enhancedNote.velocity = 60;
      }
      
      // Ensure note is in reasonable pitch range
      if (enhancedNote.pitch < 21) enhancedNote.pitch = 60; // C4
      if (enhancedNote.pitch > 108) enhancedNote.pitch = 72; // C5
      
      return enhancedNote;
    });
    
    // Ensure total time is reasonable
    if (enhanced.notes.length > 0) {
      const maxEndTime = Math.max(...enhanced.notes.map(n => n.endTime));
      enhanced.totalTime = Math.max(enhanced.totalTime || 0, maxEndTime + 0.5);
    } else {
      enhanced.totalTime = 2.0;
    }
    
    // Add instrument info (piano)
    if (!Array.isArray(enhanced.instrumentInfos) || enhanced.instrumentInfos.length === 0) {
      enhanced.instrumentInfos = [
        {
          instrument: 0, // Piano
          program: 0,
          isDrum: false
        }
      ];
    }
    
    // Add other potentially needed properties
    enhanced.keySignatures = enhanced.keySignatures || [];
    enhanced.timeSignatures = enhanced.timeSignatures || [];
    enhanced.controlChanges = enhanced.controlChanges || [];
    
    console.log('🎵 MIDI sequence enhanced:', {
      notes: enhanced.notes.length,
      totalTime: enhanced.totalTime,
      ticksPerQuarter: enhanced.ticksPerQuarter,
      tempos: enhanced.tempos.length,
      instrumentInfos: enhanced.instrumentInfos.length
    });
    
    return enhanced;
  }
  
  /**
   * Create rich test music sequence
   * Calls safe nursery rhyme style generator (AdvancedMusicGenerator)
   */
  function createRichTestMusic(session) {
    try {
      const GenCtor = (typeof window.AdvancedMusicGenerator === 'function')
        ? window.AdvancedMusicGenerator
        : (typeof AdvancedMusicGenerator === 'function' ? AdvancedMusicGenerator : null);
      if (!GenCtor) {
        console.warn('AdvancedMusicGenerator not ready, returning empty sequence');
        return { notes: [], tempos: [{ time: 0, qpm: 125 }], totalTime: 0 };
      }
      const generator = new GenCtor();
      if (window.sessionConfig) {
        generator.setSessionConfig(window.sessionConfig);
      }
      const actions = generator.buildActionTraceFromSession(session);
      const { sequence } = generator.generateReward(actions, generator.getSessionConfig());
      return sequence;
    } catch (e) {
      console.warn('Fallback createRichTestMusic failed:', e);
      return { notes: [], tempos: [{ time: 0, qpm: 125 }], totalTime: 0 };
    }
  }
  
  // Generate main melody
  function generateMelody(notes, scale, duration, channel, program) {
    let currentTime = 0;
    const noteLength = 0.5;
    
    while (currentTime < duration - 2) {
      if (Math.random() < 0.15) { // 15% chance to rest
        currentTime += noteLength;
        continue;
      }
      
      const pitch = scale[Math.floor(Math.random() * scale.length)] + 12; // One octave higher
      const velocity = 70 + Math.floor(Math.random() * 30);
      const length = noteLength * (0.7 + Math.random() * 0.6);
      
      notes.push({
        pitch: pitch,
        startTime: currentTime,
        endTime: currentTime + length,
        velocity: velocity,
        instrument: channel,
        program: program
      });
      
      currentTime += noteLength;
    }
  }
  
  // Generate harmony
  function generateHarmony(notes, scale, duration, channel, program) {
    const chordInterval = 2.0; // One chord every 2 seconds
    
    for (let time = 0; time < duration - 2; time += chordInterval) {
      const rootIndex = Math.floor(Math.random() * scale.length);
      const root = scale[rootIndex];
      
      // Triad
      const chordNotes = [
        { pitch: root, interval: 0 },
        { pitch: scale[(rootIndex + 2) % scale.length], interval: 0.1 },
        { pitch: scale[(rootIndex + 4) % scale.length], interval: 0.2 }
      ];
      
      chordNotes.forEach(note => {
        notes.push({
          pitch: note.pitch,
          startTime: time + note.interval,
          endTime: time + chordInterval * 0.9,
          velocity: 50 + Math.floor(Math.random() * 20),
          instrument: channel,
          program: program
        });
      });
    }
  }
  
  // Generate bass line
  function generateBassLine(notes, scale, duration, channel, program) {
    let currentTime = 0;
    const noteLength = 1.0; // Bass notes are longer
    
    while (currentTime < duration - 1) {
      const pitch = scale[Math.floor(Math.random() * 3)] - 24; // Two octaves lower
      const velocity = 60 + Math.floor(Math.random() * 20);
      
      notes.push({
        pitch: pitch,
        startTime: currentTime,
        endTime: currentTime + noteLength * 0.8,
        velocity: velocity,
        instrument: channel,
        program: program
      });
      
      currentTime += noteLength;
    }
  }
  
  // Generate counter melody
  function generateCounterMelody(notes, scale, duration, channel, program) {
    let currentTime = 0.25; // Slightly offset
    const noteLength = 0.75;
    
    while (currentTime < duration - 2) {
      if (Math.random() < 0.3) { // 30% chance to rest
        currentTime += noteLength;
        continue;
      }
      
      const pitch = scale[Math.floor(Math.random() * scale.length)] + 6; // Mid range
      const velocity = 55 + Math.floor(Math.random() * 25);
      
      notes.push({
        pitch: pitch,
        startTime: currentTime,
        endTime: currentTime + noteLength * 0.6,
        velocity: velocity,
        instrument: channel,
        program: program
      });
      
      currentTime += noteLength;
    }
  }
  
  // Generate ornaments
  function generateOrnaments(notes, scale, duration, channel, program) {
    const ornamentTimes = [];
    for (let i = 0; i < duration; i += 4) {
      if (Math.random() < 0.7) { // 70% chance to add ornament
        ornamentTimes.push(i + Math.random() * 2);
      }
    }
    
    ornamentTimes.forEach(time => {
      const pitch = scale[Math.floor(Math.random() * scale.length)] + 24; // High register
      const velocity = 40 + Math.floor(Math.random() * 30);
      
      // Fast ornament notes
      for (let i = 0; i < 3; i++) {
        notes.push({
          pitch: pitch + i * 2,
          startTime: time + i * 0.1,
          endTime: time + i * 0.1 + 0.15,
          velocity: velocity,
          instrument: channel,
          program: program
        });
      }
    });
  }
  
  // Generate percussion
  function generatePercussion(notes, duration) {
    // Add basic drum pattern
    for (let time = 0; time < duration; time += 1) {
      // Bass drum (every beat)
      notes.push({
        pitch: 36, // Bass Drum
        startTime: time,
        endTime: time + 0.1,
        velocity: 80,
        instrument: 9, // Percussion channel
        program: 0
      });
      
      // Snare drum (off-beat)
      if (time % 2 === 1) {
        notes.push({
          pitch: 38, // Snare Drum
          startTime: time,
          endTime: time + 0.1,
          velocity: 70,
          instrument: 9,
          program: 0
        });
      }
      
      // Hi-hat (every half beat)
      if (Math.random() < 0.6) {
        notes.push({
          pitch: 42, // Closed Hi-hat
          startTime: time + 0.5,
          endTime: time + 0.6,
          velocity: 50,
          instrument: 9,
          program: 0
        });
      }
    }
  }
  
  // Add dynamic changes
  function addDynamicChanges(notes, duration) {
    notes.forEach(note => {
      const timeRatio = note.startTime / duration;
      
      // Crescendo and decrescendo
      if (timeRatio < 0.2) {
        // Beginning crescendo
        note.velocity = Math.floor(note.velocity * (0.5 + timeRatio * 2.5));
      } else if (timeRatio > 0.8) {
        // Ending decrescendo
        note.velocity = Math.floor(note.velocity * (1 - (timeRatio - 0.8) * 2));
      }
      
      // Ensure velocity is in reasonable range
      note.velocity = Math.max(20, Math.min(127, note.velocity));
    });
  }

  // Expose enhancement functions to global
  window.enhanceMidiSequence = enhanceMidiSequence;
  window.createRichTestMusic = createRichTestMusic;

  // ---------- A) Generic helper: temporarily switch to CPU for function execution (with logging) ----------
async function withCPU(fn) {
    const tf = window.tf;
    if (!tf) throw new Error('TFJS (tf.min.js) not loaded');
    const prev = tf.getBackend?.() || 'cpu';
    try {
      if (prev !== 'cpu') {
        await tf.setBackend('cpu');
        await tf.ready();
      }
      // Debug confirm using CPU
      console.log('[TFJS] using backend:', tf.getBackend());
      return await fn();
    } finally {
      if (prev !== 'cpu') {
        await tf.setBackend(prev);
        await tf.ready();
        console.log('[TFJS] restored backend:', tf.getBackend());
      }
    }
  }
  
  function buildFallbackSeed(qpm = MAGENTA.qpm, spq = MAGENTA.stepsPerQuarter) {
    // Use different simple motifs and random root notes to avoid same fallback every time
    const patterns = [
      [0, 4, 7, 12],   // Major triad arpeggio (C-E-G-C)
      [0, 3, 7, 10],   // Minor color
      [0, 5, 7, 12],   // sus4 color
      [0, 2, 4, 7],    // Stepwise fragment
    ];
    const base = 48 + Math.floor(Math.random() * 24); // C3..B4
    const pat = patterns[Math.floor(Math.random() * patterns.length)];

    const seed = {
      ticksPerQuarter: 220,
      totalTime: 1.0,
      tempos: [{ time: 0, qpm }],
      notes: pat.map((p, i) => ({
        pitch: base + p,
        startTime: i * 0.25,
        endTime: (i + 1) * 0.25,
        velocity: 85 + Math.floor(Math.random() * 20),
      })),
    };
    return mm.sequences.quantizeNoteSequence(seed, spq);
  }
  
  // For debugging
  Object.assign(window.gameApp, {
    initMusicRNN,
    buildFallbackSeed,
    MAGENTA,
  });
