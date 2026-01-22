/**
 * Autism-Friendly Features Module
 * Provides sensory adjustment, predictability enhancement, and personalized support
 */

class AutismFriendlyFeatures {
    constructor() {
        this.settings = {
            soundVolume: 70,
            animationIntensity: 3,
            colorMode: 'normal',
            predictableMode: false,
            showProgress: true,
            gentleTransitions: true
        };
        
        this.achievements = [];
        this.achievementFlags = {
            consecutive5: false,
            consecutive10: false,
            consecutive15: false,
            total10: false,
            total25: false,
            total50: false,
            total100: false
        };
        this.sessionData = {
            startTime: null,
            movements: [],
            successes: [],
            attempts: [],
            consecutiveCount: 0,
            lastSuccessTime: 0
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.applySettings();
        this.startSessionTracking();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Sensory settings panel toggle
        const sensoryToggle = document.getElementById('sensory-panel-toggle');
        const sensoryPanel = document.getElementById('sensory-panel');
        
        if (sensoryToggle && sensoryPanel) {
            sensoryToggle.addEventListener('click', () => {
                sensoryPanel.classList.toggle('hidden');
            });
            
            // Click outside to close panel
            document.addEventListener('click', (e) => {
                if (!sensoryToggle.contains(e.target) && !sensoryPanel.contains(e.target)) {
                    sensoryPanel.classList.add('hidden');
                }
            });
        }
        
        // Volume control
        const soundVolume = document.getElementById('sound-volume');
        const soundVolumeValue = document.getElementById('sound-volume-value');
        if (soundVolume && soundVolumeValue) {
            soundVolume.addEventListener('input', (e) => {
                this.settings.soundVolume = parseInt(e.target.value);
                soundVolumeValue.textContent = `${this.settings.soundVolume}%`;
                this.applySoundVolume();
                this.saveSettings();
            });
        }
        
        // Animation intensity controlled by game speed, removed duplicate functionality
        
        // Color mode toggle
        const colorMode = document.getElementById('color-mode');
        if (colorMode) {
            colorMode.addEventListener('change', (e) => {
                this.settings.colorMode = e.target.value;
                this.applyColorMode();
                this.saveSettings();
            });
        }
        
        // Predictable mode
        const predictableMode = document.getElementById('predictable-mode');
        if (predictableMode) {
            predictableMode.addEventListener('change', (e) => {
                this.settings.predictableMode = e.target.checked;
                this.applyPredictableMode();
                this.saveSettings();
            });
        }
    }
    
    /**
     * Apply volume settings
     */
    applySoundVolume() {
        const isMuted = window.__panicMute === true;
        const volume = isMuted ? 0 : this.settings.soundVolume / 100;
        
        // Apply to PopSynth sound effects
        if (window.popSynth && typeof window.popSynth.setVolume === 'function') {
            window.popSynth.setVolume(volume);
            console.log(`[Audio] Sound effect volume set to: ${this.settings.soundVolume}%`);
        } else {
            // If popSynth not initialized yet, apply later
            console.log('[Audio] PopSynth not ready, will apply volume settings after initialization');
            setTimeout(() => {
                if (window.popSynth && typeof window.popSynth.setVolume === 'function') {
                    window.popSynth.setVolume(volume);
                    console.log(`[Audio] Delayed sound effect volume application: ${this.settings.soundVolume}%`);
                }
            }, 1000);
        }
        
        // Apply to Magenta background music
        if (window.MAGENTA && window.MAGENTA.player) {
            try {
                if (window.mm && window.mm.Player && window.mm.Player.tone) {
                    window.mm.Player.tone.Master.volume.value = 
                        20 * Math.log10(Math.max(0.01, volume));
                    console.log(`🎵 Background music volume set to: ${this.settings.soundVolume}%`);
                }
            } catch (e) {
                console.log('Background music volume adjustment failed:', e);
            }
        }
        
        // Apply to other possible audio sources
        try {
            // If there are other audio elements, also apply volume settings
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                audio.volume = volume;
            });
        } catch (e) {
            console.log('HTML audio element volume adjustment failed:', e);
        }
    }
    
    /**
     * Apply animation intensity settings
     */
    applyAnimationIntensity() {
        document.body.classList.remove('low-animation', 'high-animation');
        
        if (this.settings.animationIntensity <= 2) {
            document.body.classList.add('low-animation');
        } else if (this.settings.animationIntensity >= 4) {
            document.body.classList.add('high-animation');
        }
    }
    
    /**
     * Apply color mode
     */
    applyColorMode() {
        document.body.classList.remove('high-contrast', 'soft-colors');
        
        switch (this.settings.colorMode) {
            case 'high-contrast':
                document.body.classList.add('high-contrast');
                break;
            case 'soft':
                document.body.classList.add('soft-colors');
                break;
        }
    }
    
    /**
     * Apply predictable mode
     */
    applyPredictableMode() {
        // Remove existing indicator
        const existingIndicator = document.querySelector('.predictable-mode-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (this.settings.predictableMode) {
            // Add regular mode indicator
            const indicator = document.createElement('div');
            indicator.className = 'predictable-mode-indicator';
            indicator.textContent = '🔄 Regular Mode: Bubbles appear at fixed positions';
            document.body.appendChild(indicator);
            
            // Notify game engine to enable regular mode
            if (window.game && window.game.bubbleManager) {
                window.game.bubbleManager.setPredictableMode(true);
            }
        } else {
            // Notify game engine to disable regular mode
            if (window.game && window.game.bubbleManager) {
                window.game.bubbleManager.setPredictableMode(false);
            }
        }
    }
    
    /**
     * Apply all settings
     */
    applySettings() {
        this.applySoundVolume();
        this.applyAnimationIntensity();
        this.applyColorMode();
        this.applyPredictableMode();
        
        // Update UI display
        this.updateUIValues();
    }
    
    /**
     * Called when audio system initialization is complete
     * Ensures volume settings are applied correctly
     */
    onAudioSystemReady() {
        console.log('🔊 Audio system ready, reapplying volume settings');
        this.applySoundVolume();
    }
    
    /**
     * Update UI display values
     */
    updateUIValues() {
        const soundVolume = document.getElementById('sound-volume');
        const soundVolumeValue = document.getElementById('sound-volume-value');
        if (soundVolume && soundVolumeValue) {
            soundVolume.value = this.settings.soundVolume;
            soundVolumeValue.textContent = `${this.settings.soundVolume}%`;
        }
        
        // Animation intensity UI removed
        
        const colorMode = document.getElementById('color-mode');
        if (colorMode) {
            colorMode.value = this.settings.colorMode;
        }
        
        const predictableMode = document.getElementById('predictable-mode');
        if (predictableMode) {
            predictableMode.checked = this.settings.predictableMode;
        }
    }
    
    /**
     * Update progress display
     */
    updateProgress(remainingMs, totalMs) {
        const countdownDisplay = document.getElementById('countdown-display');
        const progressFill = document.getElementById('progress-fill');
        
        // New game progress indicator elements
        const gameCountdownDisplay = document.getElementById('game-countdown-display');
        const gameProgressFill = document.getElementById('game-progress-fill');
        const gameProgressIndicator = document.getElementById('game-progress-indicator');
        
        const seconds = Math.ceil(remainingMs / 1000);
        const progress = ((totalMs - remainingMs) / totalMs) * 100;
        const progressWidth = `${Math.max(0, Math.min(100, 100 - progress))}%`;
        
        // Update top small progress bar
        if (countdownDisplay) {
            countdownDisplay.textContent = `${seconds}s`;
        }
        
        if (progressFill) {
            progressFill.style.width = progressWidth;
        }
        
        // Update bottom large progress indicator
        if (gameCountdownDisplay) {
            gameCountdownDisplay.textContent = seconds;
        }
        
        if (gameProgressFill) {
            gameProgressFill.style.width = progressWidth;
        }
        
        // Update progress bar color based on remaining time
        if (gameProgressIndicator) {
            gameProgressIndicator.classList.remove('warning', 'danger');
            if (seconds <= 10) {
                gameProgressIndicator.classList.add('danger');
            } else if (seconds <= 20) {
                gameProgressIndicator.classList.add('warning');
            }
        }
    }
    
    /**
     * Show achievement notification
     */
    showAchievement(message, type = 'success') {
        // User has disabled achievement popups, return directly
        return;
    }
    
    /**
     * Record user movement (for analyzing coordination progress)
     */
    recordMovement(x, y, timestamp = Date.now()) {
        this.sessionData.movements.push({ x, y, timestamp });
        
        // Keep last 1000 movement records
        if (this.sessionData.movements.length > 1000) {
            this.sessionData.movements.shift();
        }
    }
    
    /**
     * Record miss event (bubble disappeared without being popped)
     */
    recordMiss() {
        const now = Date.now();
        
        // If more than 5 seconds since last success, reset consecutive count
        if (now - this.sessionData.lastSuccessTime > 5000) {
            if (this.sessionData.consecutiveCount > 0) {
                console.log(`Consecutive success interrupted, previous consecutive: ${this.sessionData.consecutiveCount}`);
                this.sessionData.consecutiveCount = 0;
            }
        }
    }
    
    /**
     * Record success event
     */
    recordSuccess(bubbleData) {
        const now = Date.now();
        this.sessionData.successes.push({
            ...bubbleData,
            timestamp: now
        });
        
        // Update consecutive success count
        if (now - this.sessionData.lastSuccessTime < 3000) { // Within 3 seconds counts as consecutive
            this.sessionData.consecutiveCount++;
        } else {
            this.sessionData.consecutiveCount = 1; // Restart counting
        }
        this.sessionData.lastSuccessTime = now;
        
        // Debug info - helps diagnose issues after 25 bubbles
        const totalCount = this.sessionData.successes.length;
        console.log(`[Success] Success recorded: total=${totalCount}, consecutive=${this.sessionData.consecutiveCount}`);
        
        // Show simple instant feedback (doesn't conflict with achievements)
        this.showSimpleFeedback();
        
        // Check if achievement unlocked
        this.checkAchievements();
    }
    
    /**
     * Show simple instant feedback
     */
    showSimpleFeedback() {
        // User has disabled instant feedback, return directly
        return;
    }
    
    /**
     * Check achievements
     */
    checkAchievements() {
        const successes = this.sessionData.successes;
        const totalCount = successes.length;
        const consecutiveCount = this.sessionData.consecutiveCount;
        
        // 调试信息
        console.log(`[Achievement] 检查成就: 总数=${totalCount}, 连续=${consecutiveCount}, 标志=`, this.achievementFlags);
        
        // 连续成功成就 - 只在重要里程碑时触发，避免过度反馈
        if (consecutiveCount === 5 && !this.achievementFlags.consecutive5) {
            this.achievementFlags.consecutive5 = true;
            this.showAchievement('太棒了！连续戳中5个泡泡！', 'success');
        } else if (consecutiveCount === 10 && !this.achievementFlags.consecutive10) {
            this.achievementFlags.consecutive10 = true;
            this.showAchievement('连击高手！连续戳中10个泡泡！', 'success');
        } else if (consecutiveCount === 15 && !this.achievementFlags.consecutive15) {
            this.achievementFlags.consecutive15 = true;
            this.showAchievement('超级连击！连续戳中15个泡泡！', 'success');
        }
        
        // 总数成就 - 只在刚达到时触发
        if (totalCount === 10 && !this.achievementFlags.total10) {
            this.achievementFlags.total10 = true;
            this.showAchievement('第一个里程碑！戳中10个泡泡！', 'milestone');
        } else if (totalCount === 25 && !this.achievementFlags.total25) {
            this.achievementFlags.total25 = true;
            this.showAchievement('进步神速！戳中25个泡泡！', 'milestone');
        } else if (totalCount === 50 && !this.achievementFlags.total50) {
            this.achievementFlags.total50 = true;
            this.showAchievement('协调大师！戳中50个泡泡！', 'milestone');
        } else if (totalCount === 100 && !this.achievementFlags.total100) {
            this.achievementFlags.total100 = true;
            this.showAchievement('传奇玩家！戳中100个泡泡！', 'milestone');
        }
    }
    
    /**
     * 开始会话追踪
     */
    startSessionTracking() {
        this.sessionData.startTime = Date.now();
    }
    
    /**
     * 重置成就标志（新游戏时调用）
     */
    resetAchievements() {
        this.achievementFlags = {
            consecutive5: false,
            consecutive10: false,
            consecutive15: false,
            total10: false,
            total25: false,
            total50: false,
            total100: false
        };
        
        // 🔥 Critical fix: Reset session data including bubble count
        this.sessionData.consecutiveCount = 0;
        this.sessionData.lastSuccessTime = 0;
        this.sessionData.successes = []; // Clear success records array
        this.sessionData.movements = []; // Clear movement records array
        this.sessionData.attempts = []; // Clear attempt records array
        this.achievements = []; // Clear achievement records
        
        // Restart session tracking
        this.startSessionTracking();
        
        console.log('🏆 Achievement system fully reset, bubble count zeroed');
    }
    
    /**
     * Get session report
     */
    getSessionReport() {
        const duration = Date.now() - this.sessionData.startTime;
        const movements = this.sessionData.movements;
        const successes = this.sessionData.successes;
        
        // Calculate coordination metrics
        let totalDistance = 0;
        let smoothness = 0;
        
        if (movements.length > 1) {
            for (let i = 1; i < movements.length; i++) {
                const prev = movements[i - 1];
                const curr = movements[i];
                const distance = Math.sqrt(
                    Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
                );
                totalDistance += distance;
            }
            
            // Smoothness = inverse of average movement distance (smaller = smoother)
            smoothness = movements.length / totalDistance;
        }
        
        return {
            duration,
            totalMovements: movements.length,
            totalSuccesses: successes.length,
            successRate: movements.length > 0 ? successes.length / movements.length : 0,
            averageMovementDistance: movements.length > 1 ? totalDistance / (movements.length - 1) : 0,
            smoothness,
            achievements: this.achievements.length
        };
    }
    
    /**
     * Save settings to local storage
     */
    saveSettings() {
        localStorage.setItem('autismFriendlySettings', JSON.stringify(this.settings));
    }
    
    /**
     * Load settings from local storage
     */
    loadSettings() {
        const saved = localStorage.getItem('autismFriendlySettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.log('Settings load failed, using defaults');
            }
        }
    }
}

// 全局实例
window.autismFeatures = new AutismFriendlyFeatures();
