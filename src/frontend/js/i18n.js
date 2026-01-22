/**
 * Internationalization (i18n) Module
 * Centralizes all text resources for the application
 */

const TRANSLATIONS = {
    en: {
        // Main UI
        'ui.expertMode': 'Expert Mode',
        'ui.gameOver': 'Game Over',
        'ui.play': 'Play',
        'ui.playAgain': 'Play Again',
        'ui.finish': 'Finish',
        'ui.report': 'Game Report',
        'ui.analyzing': 'Analyzing...',
        'ui.waitingData': 'Waiting for data...',
        'ui.saveSettings': 'Save Settings',
        'ui.realtimeData': 'Real-time',
        'ui.laneDist': 'Lane Dist',
        'ui.patternPredict': 'Prediction',
        'ui.recentClicks': 'Recent Clicks',
        'ui.inputMode': 'Input: ',
        'ui.bubbleCount': 'Bubbles: ',
        'ui.timeRemaining': 'Time: ',
        'ui.gamePaused': 'Game Paused',
        'ui.clickContinue': 'Click resume button to continue',
        'ui.resume': 'Resume',

        // Header & Footer
        'header.mute': 'Mute',
        'header.unmute': 'Unmute',
        'header.settings': 'Params',
        'header.pause': 'Pause',
        'ui.mute': 'Mute',
        'ui.unmute': 'Unmute',
        'speed.slow': 'Slow',
        'speed.normal': 'Normal',
        'speed.fast': 'Fast',
        'footer.instruction': 'Move cursor to pop bubbles!',
        'footer.inputMode': 'Input: ',
        'footer.bubbleCount': 'Bubbles: ',

        // Settings Modal
        'set.title': 'Game Settings',
        'set.subtitle': 'Adjust sensory experience for your comfort',
        'set.volume': 'Volume',
        'set.timbre': 'Timbre',
        'set.latency': 'Latency',
        'set.feedback': 'Feedback',
        'set.reset': 'Reset',
        'set.start': 'Start Game',
        'set.close': 'Close',

        'opt.low': 'Soft',
        'opt.medium': 'Standard',
        'opt.high': 'Loud',
        'opt.soft': 'Soft',
        'opt.bright': 'Bright',
        'opt.piano': 'Piano',
        'opt.epiano': 'Electric Piano',
        'opt.guitar': 'Guitar',
        'opt.strings': 'Strings',
        'opt.immediate': 'Immediate',
        'opt.delay': 'Slow',
        'opt.full': 'On',
        'opt.visual': 'Visual Only',
        'opt.off': 'Off',
        'opt.on': 'On',
        'opt.sparse': 'Sparse',
        'opt.normal': 'Normal',

        // Sidebar
        'sidebar.title': 'Real-time Monitor',
        'sidebar.realtimeData': 'Real-time',
        'sidebar.laneDist': 'Lane Dist',
        'sidebar.patternPredict': 'Prediction',
        'sidebar.recentClicks': 'Recent Clicks',
        'sidebar.clickCount': 'Clicks',
        'sidebar.hitRate': 'Accuracy',
        'sidebar.dominant': 'Dominant',
        'sidebar.tooltip.pattern': 'Sequential: Seq Ratio > 40% & Lane >= 4\nRepetitive: Dominant Lane > 60%\nExploratory: Lane >= 4 & Dominant <= 60%',
        'sidebar.waitingForData': 'Waiting for data...',
        'sidebar.noData': 'No Data',
        'sidebar.pattern.sequential': 'Sequential (CDEGA)',
        'sidebar.pattern.repetitive': 'Repetitive',
        'sidebar.pattern.exploratory': 'Exploratory',
        'sidebar.pattern.mixed': 'Mixed',

        // Report
        'report.title': 'Game Report',
        'report.behaviorPattern': 'Behavior Pattern',
        'report.clickTrail': 'Click Trail & Lane Dist',
        'report.musicParams': 'Music Parameters',
        'report.score.sequential': 'Sequential',
        'report.score.repetitive': 'Repetitive',
        'report.score.exploratory': 'Exploratory',
        'report.tooltip.sequential': 'Seq Ratio > 40% & Lane Coverage >= 4\nProportion of C->D->E->G->A sequences',
        'report.tooltip.repetitive': 'Dominant Lane Ratio > 60%\nPreference for repeating same note',
        'report.tooltip.exploratory': 'Lane Coverage >= 4 & Dominant Ratio <= 60%\nActive exploration of different notes',

        // Expert Drawer
        'expert.titleTooltip': 'Expert Mode (Ctrl+Shift+E)',
        'expert.title': 'Music Parameters',
        'expert.close': 'Close',
        'expert.tempo': 'Tempo (BPM)',
        'expert.audioParams': 'Audio Parameters',
        'expert.volume': 'Gain',
        'expert.contrast': 'Accent ratio',
        'expert.density': 'Density',
        'expert.warning.unsafe': 'Risk of sensory overload',
        'expert.duration': 'Reward Duration',
        'expert.segment': 'Segment Select',
        'expert.segment.tip': 'Drag handles to set start/end',
        'expert.exit': 'Exit Expert Mode',
        'expert.behavior': 'Behavior Analysis',
        'expert.clickTrail': 'Click Trail',
        'expert.patternRecognition': 'Pattern Recognition',
        'expert.gameStats': 'Game Stats',
        'expert.refresh': 'Export Session Report',
        'expert.mode.test': 'Test Mode',
        'expert.mode.converge': 'Converge Mode',
        'expert.btn.preview': 'Preview',
        'expert.btn.stop': 'Pause',
        'expert.btn.reset': 'Reset',
        'expert.btn.save': 'Save',
        'expert.msg.saved': 'Saved (Local)',
        'expert.msg.failed': 'Submit Failed',
        'expert.safeRange': 'Safe: ',
        'expert.harmony': 'Harmony',
        'expert.setSafeRange': 'Set Safe Range',
        'expert.dbNotConfigured': 'Database not configured',

        // Game Engine
        'game.ready': 'Game Ready!',
        'game.paused': 'Paused',
        'game.samplingStarted': 'Sampling Started: {seconds}s',
        'game.samplingCompleted': 'Sampling Completed, {count} notes',

        // Messages
        'msg.paused': 'Take a break!',
        'msg.resume': 'Keep going!',
        'msg.slow': 'Take your time!',
        'msg.normal': 'Good pace!',
        'msg.fast': 'Fast challenge!',
        'msg.welcome': 'Welcome! Move cursor to pop bubbles!',
        'msg.saved': 'Settings saved, will apply next round',
        'msg.reward': 'Reward generated, click "Play" to listen',
        'msg.error': 'AI Generation Failed: Check Console',
        'msg.musicPlaying': 'Playing your created music!',
        'msg.musicError': 'Error playing music, please try again',
        'msg.downloadMidi': 'MIDI file downloaded!',
        'msg.downloadJson': 'Music data downloaded (JSON)!',

        // Achievements
        'ach.consecutive5': 'Great job! 5 bubbles in a row!',
        'ach.consecutive10': 'Combo Master! 10 bubbles in a row!',
        'ach.consecutive15': 'Super Combo! 15 bubbles in a row!',
        'ach.total10': 'First Milestone! 10 bubbles popped!',
        'ach.total25': 'Rapid Progress! 25 bubbles popped!',
        'ach.total50': 'Coordination Master! 50 bubbles popped!',
        'ach.total100': 'Legendary Player! 100 bubbles popped!',
        'af.predictableMode': 'Predictable Mode: Bubbles appear in fixed spots',

        // Game Results & Stats
        'res.success': 'Bubbles Popped',
        'res.speed': 'Avg Speed',
        'res.combo': 'Max Combo',
        'res.unitBubbles': 'bubbles',
        'res.unitSpeed': 'sec/bubble',
        'res.unitCombo': 'streak',
        
        // Encouragement
        'enc.excellent': ['Amazing! You are a true Bubble Master!', 'Perfect performance! Your coordination is incredible!', 'Outstanding! You mastered the game!'],
        'enc.great': ['Great job! Keep up the good rhythm!', 'Well done! Your skills are improving!', 'Excellent! Great focus!'],
        'enc.good': ['Good start! Practice makes perfect!', 'Good job! Every attempt counts!', 'Keep going! You are improving steadily!'],
        'enc.encouraging': ['Nice try! Enjoy the process!', 'Relax and have fun!', 'Keep trying! Everyone has their own pace!'],

        // Patterns & Analysis
        'pat.sequential': 'Sequential',
        'pat.repetitive': 'Repetitive',
        'pat.exploratory': 'Exploratory',
        'pat.mixed': 'Mixed',
        'pat.desc.sequential': 'Sequential (CDEGA Asc/Desc)',
        'pat.desc.repetitive': 'Repetitive (High Repetition)',
        'pat.desc.exploratory': 'Exploratory (High Diversity)',
        'pat.desc.mixed': 'Mixed Type',
        'pat.rule.sequential': 'Seq Ratio {ratio}% > 40% & Lane Coverage {diversity} >= 4',
        'pat.rule.repetitive': 'Dominant Lane Ratio {ratio}% > 60% ({lane})',
        'pat.rule.exploratory': 'Lane Coverage {diversity} >= 4 & Dominant Ratio {ratio}% <= 60%',
        'pat.rule.mixed': 'No dominant pattern detected',
        
        // Hand Preference
        'hand.left': 'You prefer your left hand! Try using your right hand next time for balance.',
        'hand.right': 'You prefer your right hand! Try using your left hand next time for balance.',
        'hand.balanced': 'Great! You are using both hands equally, which is good for motor skills.',
        'hand.none': 'Pop some bubbles to see which hand you prefer!',

        // Debug / Expert
        'debug.unsafe': 'Unsafe Mode',
        'debug.preview': 'Preview Mode',
        'debug.clickRate': 'Click Rate',
        'debug.successRate': 'Success Rate',
        'debug.intercepts': 'Intercepts',
        'debug.safe': 'Safe (0 violations)',
        'debug.attention': 'Needs attention ({count} violations)',
        'debug.rewardOff': 'Reward Off (Instant feedback only)',
        'debug.noData': 'Complete a round to see analysis',
        'debug.waiting': 'Waiting for reward generation',
        
        // Music Player
        'music.playing': ' Playing...',
        'music.download': ' Download Music',
        'music.error': 'No music generated, please finish a game first',
        'music.muted': 'Currently muted, please click "Unmute"',
        'music.playerNotReady': 'Music player not ready, please try again later',
        'music.loadingSamples': 'Loading instrument samples...',
        
        // Spectrogram
        'spectro.title.left': 'Unconstrained Baseline',
        'spectro.title.right': 'Constraint-First Output',
        'spectro.label.spec': 'Log-Mel Spectrogram (dB)',
        'spectro.label.loudness': 'Loudness Contour (LUFS)',
        'spectro.label.silence': 'Silence / No Data',
        'spectro.metrics.line': 'LRA: {lra} LU | Avg: {avg} LUFS | dE: {dE}',
        'spectro.summary.lra': 'Loudness Range (LRA): {raw} -> {safe} LU (x{factor} reduction)',
        'spectro.rawParams': 'Raw Params (behavior-derived)',
        'spectro.safeParams': 'Constrained Params',
        'ui.bpm': 'BPM',
        'ui.contrast': 'Contrast',
        'spectro.loading.title': 'Generating spectrogram comparison...',
        'spectro.loading.sub': 'This may take a few seconds',
        'spectro.fail.title': 'Generation failed',
        'spectro.btn.generate': 'Generate Comparison',
        'spectro.btn.exportPng': 'Export PNG',
        'spectro.btn.exportJson': 'Export JSON',
        'spectro.msg.exportPngDone': 'Comparison exported as PNG'
    }
};

// Load additional language packs if available
if (typeof TRANSLATIONS_ZH !== 'undefined') {
    TRANSLATIONS.zh = TRANSLATIONS_ZH;
}

class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('gameLanguage') || 'en';
        // Fallback to 'en' if requested language not available
        if (!TRANSLATIONS[this.currentLang]) {
            this.currentLang = 'en';
        }
        this.listeners = [];
        console.log('[I18n] Initialized with language:', this.currentLang);
    }

    /**
     * Get translated string
     */
    t(key, params = {}) {
        const langData = TRANSLATIONS[this.currentLang] || TRANSLATIONS.en;
        const value = langData[key];
        
        if (value === undefined) {
            // Fallback to English
            const fallback = TRANSLATIONS.en[key];
            if (fallback !== undefined) {
                return Array.isArray(fallback) 
                    ? this.processParams(fallback[Math.floor(Math.random() * fallback.length)], params)
                    : this.processParams(fallback, params);
            }
            console.warn(`[I18n] Missing translation for key: ${key}`);
            return key;
        }

        if (Array.isArray(value)) {
            return this.processParams(value[Math.floor(Math.random() * value.length)], params);
        }

        return this.processParams(value, params);
    }

    processParams(text, params) {
        if (!params || Object.keys(params).length === 0) return text;
        return text.replace(/\{(\w+)\}/g, (match, p1) => {
            return params[p1] !== undefined ? params[p1] : match;
        });
    }

    setLanguage(lang) {
        if (!TRANSLATIONS[lang]) {
            console.warn('[I18n] Language not available:', lang);
            return;
        }
        if (this.currentLang === lang) return;

        this.currentLang = lang;
        localStorage.setItem('gameLanguage', lang);
        console.log('[I18n] Language set to:', lang);
        
        this.notifyListeners();
        this.updateDocumentTitle();
    }

    toggleLanguage() {
        const langs = Object.keys(TRANSLATIONS);
        const currentIndex = langs.indexOf(this.currentLang);
        const newLang = langs[(currentIndex + 1) % langs.length];
        this.setLanguage(newLang);
        return newLang;
    }

    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try { cb(this.currentLang); } catch (e) { console.error('[I18n] Error:', e); }
        });
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang } }));
    }

    updateDocumentTitle() {
        document.title = this.currentLang === 'en' 
            ? 'Bubble Popping Game - Autism Friendly Music'
            : 'Bubble Popping Game';
    }

    getAvailableLanguages() {
        return Object.keys(TRANSLATIONS);
    }
}

window.i18n = new I18n();
