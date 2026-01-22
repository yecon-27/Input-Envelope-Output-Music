/**
 * Game Engine - Core game loop and rendering system
 * Handles game state, timing, and coordinates all game systems.
 */
class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.gameSpeed = 1.0; // 1.0 = normal, 0.5 = slow, 1.5 = fast
        
        // Timing
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        // Game systems (will be initialized later)
        this.bubbleManager = null;
        this.handTracker = null;
        this.collisionDetector = null;
        this.soundManager = null;
        this.scoreManager = null;
        this.animationManager = null;

        // --- Round collection state ---
        this.roundActive = false;
        this.roundStart = 0;
        this.roundNotes = [];     // Only store hit events for this round (relative time)
        this.roundTimer = null;
        this.onRoundEnd = null;   // End callback (for step C)
        window.Sessions ??= [];   // Archive of all historical rounds

        // New fields for pause countdown
        this.roundDurationMs = 0;   // Total duration of this round (milliseconds)
        this.roundEndAt = 0;        // Planned end absolute timestamp
        this.roundRemainingMs = null; // Remaining milliseconds when paused
        this.roundPausedAt = 0;     // Timestamp when entering pause

        // Session level config (consistent with reward generation)
        this.sessionConfig = {
            volumeLevel: 'medium',
            rhythmDensity: 'normal',
            timbre: 'piano',
            feedbackLatencyMs: 0,
            immediateToneMode: 'full', // full | visual | off
            rewardEnabled: true,
            rewardBpm: 125,
            rewardDurationSec: 10,
            expertMode: false,
        };
        if (window.sessionConfig) {
            this.sessionConfig = { ...this.sessionConfig, ...window.sessionConfig };
        }
                
        // Canvas setup
        this.setupCanvas();
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.update = this.update.bind(this);
        this.render = this.render.bind(this);

        // Subscribe to language changes
        if (window.i18n) {
            window.i18n.subscribe(() => this.onLanguageChanged());
        }
    }

    t(key, params) {
        return window.i18n ? window.i18n.t(key, params) : key;
    }

    onLanguageChanged() {
        if (!this.isRunning) {
            this.clearCanvas();
            this.drawBackground();
            this.drawCenteredMessage(this.t('game.ready'), '#95C3D8');
        } else if (this.isPaused) {
            this.render(); // Will call drawCenteredMessage with 'game.paused'
        }
    }

    setSessionConfig(cfg = {}) {
        this.sessionConfig = { ...this.sessionConfig, ...cfg };
        // Compatible with global config usage
        window.sessionConfig = this.sessionConfig;
        
        // Apply volume settings
        const vol = this.sessionConfig.volumeLevel;
        const gain =
            vol === 'low' ? 0.4 :
            vol === 'high' ? 1.0 : 0.7;
        window.popSynth?.setVolume?.(gain);
        
        // Apply timbre settings
        const timbre = this.sessionConfig.timbre || 'piano';
        window.popSynth?.setTimbre?.(timbre);
        
        // Apply bubble density settings
        const density = this.sessionConfig.rhythmDensity || 'normal';
        this.bubbleManager?.setDensity?.(density);
    }
    
    /**
     * Set up canvas with proper sizing and context settings
     */
    setupCanvas() {
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Configure rendering context for smooth graphics
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Set default styles
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
    }
    
    /**
     * Initialize all game systems
     */
    async init() {
        console.log('Initializing Game Engine...');
      
        // 1) Bubble + Collision
        this.bubbleManager = new BubbleManager(this.canvas.width, this.canvas.height);
        // -- In init() --
        // Make PopSynth available (create once if not created)
        window.popSynth ??= new PopSynth();
        this.setSessionConfig(this.sessionConfig);
        this.setupLaneGuides();

        // Unlock AudioContext (one user gesture is enough, fallback)
        const unlockAudio = () => window.popSynth?.resume?.();
        window.addEventListener('pointerdown', unlockAudio, { once: true });

        // GameEngine.init()
        this.bubbleManager.setOnPop((b) => {
            if (!b?.note) return;
        
            const cfg = this.sessionConfig || {};
            const playImmediate = cfg.immediateToneMode === 'full';
            const delay = cfg.feedbackLatencyMs || 0;
        
            if (playImmediate) {
                window.popSynth?.resume?.();
                setTimeout(() => {
                    window.popSynth?.play?.(b.note.freq, { dur: 0.15 });
                }, delay);
            }

            // ★ Trigger pitch label bounce animation
            this.triggerLanePop(b.laneId);

            // Record success event to autism-friendly system
            if (window.autismFeatures) {
                window.autismFeatures.recordSuccess({
                    id: b.id,
                    midi: b.note.midi,
                    laneId: b.laneId
                });
            }

            // 记录点击轨迹
            this.appendTrailDot(b.note?.name, b.color);
        
            // ✅ 只记录到“本局”的 notes
            if (this.roundActive) {
                this.roundNotes.push({
                    dt: performance.now() - this.roundStart,
                    id: b.id,
                    midi: b.note.midi,
                    freq: b.note.freq,
                    name: b.note.name,
                    laneId: b.laneId,
                });
            }
        });
        this.collisionDetector = new CollisionDetector();
        this.collisionDetector.addCollisionCallback(this.handleBubblePop.bind(this));
      
        // Background/text/score
        this.clearCanvas();
        this.drawBackground();
        this.drawCenteredMessage(this.t('game.ready'), '#95C3D8');
        this.score = 0;
        this.handPositions = {
          leftHand:  { x: 0, y: 0, visible: false },
          rightHand: { x: 0, y: 0, visible: false }
        };
      
        // 2) HandTracker (new first then bindcallback)
        // this.handTracker = new HandTracker();
        // this.handTracker.onPositionUpdate = (pos) => {
        //   this.handPositions.rightHand = { x: pos.x, y: pos.y, visible: true };
        // };
        // this.handTracker.onHandDetected = () => { this.handPositions.rightHand.visible = true; };
        // this.handTracker.onHandLost     = () => { this.handPositions.rightHand.visible = false; };
        // this.handTracker.initialize();
      
        // 3) Only keep mouse control (removed camera/pose detection)
        this.poseDetector = null;
        this.setupMouseFallback();
      
        // Notify sensory settings system that audio is ready
        if (window.autismFeatures && typeof window.autismFeatures.onAudioSystemReady === 'function') {
            window.autismFeatures.onAudioSystemReady();
        }
        
        console.log('Game Engine initialized successfully');
        return true;
      }

    setupLaneGuides() {
        const gameMain = this.canvas?.parentElement;
        this.laneLabelsEl = document.getElementById('lane-labels');
        this.clickTrailEl = document.getElementById('click-trail');
        if (!this.laneLabelsEl && gameMain) {
            this.laneLabelsEl = document.createElement('div');
            this.laneLabelsEl.id = 'lane-labels';
            this.laneLabelsEl.className = 'lane-labels';
            gameMain.appendChild(this.laneLabelsEl);
        }
        if (!this.clickTrailEl && gameMain) {
            this.clickTrailEl = document.createElement('div');
            this.clickTrailEl.id = 'click-trail';
            this.clickTrailEl.className = 'click-trail';
            gameMain.appendChild(this.clickTrailEl);
        }
        if (!this.laneLabelsEl || !window.BUBBLE_LANES) return;
        
        const lanes = window.BUBBLE_LANES;
        this.laneLabelsEl.innerHTML = '';
        this.laneLabelElements = {}; // Store references
        
        // Calculate lane width percentage to match BubbleManager logic
        // x = laneWidth * (laneIndex + 1)
        // laneWidth = canvasWidth / (lanes.length + 1)
        const totalSlots = lanes.length + 1;

        lanes.forEach((lane, index) => {
            const div = document.createElement('div');
            div.className = 'lane-label';
            div.textContent = lane.note.name[0]; // e.g., 'C', 'D'
            
            // Position using percentage to match canvas coordinates
            const leftPercent = ((index + 1) / totalSlots) * 100;
            div.style.left = `${leftPercent}%`;
            
            // Store original color for active state
            div.dataset.color = lane.color;
            
            this.laneLabelsEl.appendChild(div);
            this.laneLabelElements[lane.id] = div;
        });

        // Initialize click trail empty
        if (this.clickTrailEl) this.clickTrailEl.innerHTML = '';
    }

    /**
     * Update lane label highlights based on active bubbles
     */
    updateLaneHighlights() {
        if (!this.bubbleManager || !this.laneLabelElements) return;
        
        const bubbles = this.bubbleManager.getBubbles();
        const activeLanes = new Set();
        
        // Mark lanes as active if they have any bubble (active or popping)
        bubbles.forEach(b => activeLanes.add(b.laneId));
        
        Object.entries(this.laneLabelElements).forEach(([laneId, el]) => {
            const isActive = activeLanes.has(parseInt(laneId));
            if (isActive) {
                if (!el.classList.contains('active')) {
                    el.classList.add('active');
                    el.style.color = el.dataset.color; // Highlight text with lane color
                }
            } else {
                if (el.classList.contains('active')) {
                    el.classList.remove('active');
                    el.style.color = ''; // Revert to CSS default
                }
            }
        });
    }

    /**
     * Trigger pitch label bounce animation (called when bubble is popped)
     * @param {number} laneId - lane number (1-5)
     */
    triggerLanePop(laneId) {
        const el = this.laneLabelElements?.[laneId];
        if (!el) return;
        
        // Optimization: prevent visual overload from high-frequency repeated triggers
        // If animation is in progress, ignore new trigger requests
        if (el.classList.contains('pop')) return;
        
        // Add bounce class
        el.classList.add('pop');
        el.style.color = el.dataset.color;
        
        // Remove class after animation ends (matches CSS 0.6s animation time)
        setTimeout(() => {
            el.classList.remove('pop');
        }, 600);
    }
    
    /**
     * Start the game loop
     */
    start() {
        if (this.isRunning) {
            console.log('Game is already running');
            return;
        }
        
        console.log('Starting game...');
        this.isRunning = true;
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        
        // Start the game loop
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Pause or resume the game
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        const now = performance.now();
      
        if (!this.roundActive) {
          this.lastFrameTime = now;
          return this.isPaused;
        }
      
        if (this.isPaused) {
          if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
          }
          this.roundRemainingMs = Math.max(0, this.roundEndAt - now);
          this.roundPausedAt = now;
        } else {
          const pausedMs = now - (this.roundPausedAt || now);
          this.roundStart += pausedMs;
          this.roundEndAt = now + (this.roundRemainingMs ?? 0);
          this.roundTimer = setTimeout(() => this.stopRound({ save: true }),
                                       this.roundRemainingMs ?? 0);
          this.roundPausedAt = 0;
          this.roundRemainingMs = null;
          this.lastFrameTime = now;
        }
        return this.isPaused;
      }
    
    /**
     * Stop the game
     */
    stop() {
        console.log('Stopping game...');
        this.isRunning = false;
        this.isPaused = false;
        this.stopRound?.({ save: false });
      }
    
    /**
     * Set game speed (0.5 = slow, 1.0 = normal, 1.5 = fast)
     */
    setSpeed(speed) {
        const validSpeeds = [0.5, 1.0, 1.5];
        if (validSpeeds.includes(speed)) {
            this.gameSpeed = speed;
            console.log(`Game speed set to: ${speed === 0.5 ? 'Slow' : speed === 1.0 ? 'Normal' : 'Fast'}`);
        } else {
            console.warn('Invalid speed value. Use 0.5, 1.0, or 1.5');
        }
    }
    
    /**
     * Main game loop - handles timing and calls update/render
     */
    gameLoop(currentTime) {
        if (!this.isRunning) {
            return;
        }
        
        // Calculate delta time
        const deltaTime = currentTime - this.lastFrameTime;
        
        // Only update if enough time has passed (frame rate limiting)
        if (deltaTime >= this.frameInterval) {
            // Update game state (only if not paused)
            if (!this.isPaused) {
                this.update(deltaTime * this.gameSpeed);
            }
            
            // Always render (to show pause overlay, etc.)
            this.render();
            
            this.lastFrameTime = currentTime;
        }
        
        // Continue the loop
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Update all game systems
     */
    update(deltaTime) {
        // Add: check for hand detection timeout
        if (this.handTracker && this.handTracker.checkHandTimeout) {
            this.handTracker.checkHandTimeout();
        }
        
        // Update bubble system
        if (this.bubbleManager) {
            this.bubbleManager.update(deltaTime, this.gameSpeed);
        }
        
        // Check for collisions between hands and bubbles
        if (this.collisionDetector && this.bubbleManager) {
            const bubbles = this.bubbleManager.getBubbles();
            this.collisionDetector.checkCollisions(this.handPositions, bubbles);
        }
        
        // Keep time for animations
        const time = performance.now() * 0.001; // Convert to seconds
        this.animationTime = time;
    }
    
    /**
     * Render the current frame
     */
    render() {
        // Clear the canvas
        this.clearCanvas();
        
        // Draw background
        this.drawBackground();
        
        // Render game objects here (will be expanded in later tasks)
        this.renderGameObjects();

        // Update lane indicators
        this.updateLaneHighlights();
        
        // Draw debug info if needed
        if (this.isPaused) {
            this.drawCenteredMessage(this.t('game.paused'), '#6C757D');
        }
    }
    
    /**
     * Clear the entire canvas
     */
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Draw the background gradient
     */
    drawBackground() {
        // Create gradient background (autism-friendly soft colors)
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#FFFFFF'); // Pure White
        gradient.addColorStop(1, '#E1F5FE'); // Very Light Blue
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Render game objects
     */
    renderGameObjects() {
        // Render bubbles
        if (this.bubbleManager) {
            this.bubbleManager.render(this.ctx);
        }
        
        // Render hand cursors
        if (this.collisionDetector) {
            this.collisionDetector.renderHandCursors(this.ctx, this.handPositions);
        }
    }
    
    /**
     * Draw centered text message
     */
    drawCenteredMessage(text, color = '#2C3E50') {
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 24px "Segoe UI", sans-serif';
        this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    }
    
    /**
     * Get current game state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            gameSpeed: this.gameSpeed,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            bubbleCount: this.bubbleManager ? this.bubbleManager.getBubbleCount() : 0
        };
    }
    
    /**
     * Get bubble manager for debugging
     */
    getBubbleManager() {
        return this.bubbleManager;
    }
    
    detectPopAttempts(positions) {
        // Record last position for speed calculation
        if (!this.lastHandPositions) {
            this.lastHandPositions = {
                leftHand: { x: 0, y: 0, timestamp: Date.now() },
                rightHand: { x: 0, y: 0, timestamp: Date.now() }
            };
        }
        
        const now = Date.now();
        const speedThreshold = 150; // pixels/second, above this speed is considered a pop attempt
        
        // Check left hand
        if (positions.leftHand.visible) {
            const deltaTime = (now - this.lastHandPositions.leftHand.timestamp) / 1000;
            if (deltaTime > 0) {
                const dx = positions.leftHand.x - this.lastHandPositions.leftHand.x;
                const dy = positions.leftHand.y - this.lastHandPositions.leftHand.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = distance / deltaTime;
                
                if (speed > speedThreshold) {
                    // Record attempt (if no collision, it's a failed attempt)
                    this.recordAttempt(positions.leftHand.x, positions.leftHand.y);
                }
            }
            this.lastHandPositions.leftHand = {
                x: positions.leftHand.x,
                y: positions.leftHand.y,
                timestamp: now
            };
        }
        
        // Check right hand
        if (positions.rightHand.visible) {
            const deltaTime = (now - this.lastHandPositions.rightHand.timestamp) / 1000;
            if (deltaTime > 0) {
                const dx = positions.rightHand.x - this.lastHandPositions.rightHand.x;
                const dy = positions.rightHand.y - this.lastHandPositions.rightHand.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = distance / deltaTime;
                
                if (speed > speedThreshold) {
                    // Record attempt (if no collision, it's a failed attempt)
                    this.recordAttempt(positions.rightHand.x, positions.rightHand.y);
                }
            }
            this.lastHandPositions.rightHand = {
                x: positions.rightHand.x,
                y: positions.rightHand.y,
                timestamp: now
            };
        }
    }
    
    /**
     * Record bubble pop attempt
     */
    recordAttempt(x, y) {
        // Prevent duplicate recording (multiple fast movements within 500ms count as one attempt)
        const now = Date.now();
        if (this.lastAttemptTime && (now - this.lastAttemptTime) < 500) {
            return;
        }
        this.lastAttemptTime = now;
        
        // Check if bubble was hit
        const bubbles = this.bubbleManager ? this.bubbleManager.getBubbles() : [];
        let hit = false;
        
        for (const bubble of bubbles) {
            const distance = Math.sqrt(
                Math.pow(x - bubble.x, 2) + Math.pow(y - bubble.y, 2)
            );
            if (distance <= bubble.radius + 35) { // 35 is hand radius
                hit = true;
                break;
            }
        }
        
        // Record to SessionLogger (only record misses, hits are recorded in handleBubblePop to avoid duplicates)
        if (!hit && window.sessionLogger) {
            window.sessionLogger.recordClick(x, y, false);
        }
        
        // Record to data tracker
        if (this.poseDetector?.handDataTracker) {
            this.poseDetector.handDataTracker.recordPop(hit);
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Keep original size - no scaling
        // Remove any existing transform to maintain original 1024x768 size
        this.canvas.style.transform = 'none';
        this.canvas.style.transformOrigin = 'center center';
        
        // Update bubble manager with original dimensions
        if (this.bubbleManager) {
            this.bubbleManager.handleResize(this.canvas.width, this.canvas.height);
        }
        
        // Update pose detector dimensions
        if (this.poseDetector) {
            this.poseDetector.updateCanvasDimensions(this.canvas.width, this.canvas.height);
        }
    }
        /**
     * Start a round of sampling
     * @param {number} seconds  Round duration (seconds)
     * @param {{onEnd?: (session) => void, clearHistory?: boolean}} opts
     */
    startRound(seconds = 30, opts = {}) {
        if (this.roundActive) this.stopRound({ save: false });

        this.roundActive = true;
        this.roundStart = performance.now();
        this.roundNotes = [];
        this.onRoundEnd = (typeof opts.onEnd === 'function') ? opts.onEnd : null;
        // Ensure Sessions array exists
        if (!window.Sessions || opts.clearHistory) window.Sessions = [];

        // Reset bubbles and generate fixed number by lane
        this.bubbleManager?.clearAllBubbles();
        // Initially generate a group of 4 sequentially, each with delay, creating obvious height difference
        const initialCount = this.bubbleManager?.targetBubbleCount || 4;
        for (let i = 0; i < initialCount; i++) {
            this.bubbleManager?.scheduleSpawn(null, i * 800);
        }
        // Clear click trail
        if (this.clickTrailEl) this.clickTrailEl.innerHTML = '';

        // Record total duration and planned end time
        this.roundDurationMs = seconds * 1000;
        this.roundEndAt = this.roundStart + this.roundDurationMs;
        this.roundRemainingMs = this.roundDurationMs; // Initial remaining = total duration
        this.roundPausedAt = 0;
        window.sessionLogger?.startRecording();

        // 移除开始提示，避免干扰
        // window.gameApp?.showEncouragementMessage?.(this.t('game.samplingStarted', { seconds }), 1000);

        // 用“剩余毫秒数”启动计时器
        this.roundTimer = setTimeout(() => this.stopRound({ save: true }),
                                    this.roundRemainingMs);
        }

    /**
     * 结束当前一局
     * @param {{save?: boolean}} param0
     */
    stopRound({ save = true } = {}) {
        if (!this.roundActive) return;
      
        if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
      
        this.roundActive = false;
      
        const endedAt = performance.now();
        const session = {
          startedAt: this.roundStart,
          endedAt,
          durationSec: (endedAt - this.roundStart) / 1000, // 已自动不含暂停
          notes: this.roundNotes.slice(),
          meta: { seed: window.__LEVEL_SEED ?? null, scale: 'pentatonic', gameSpeed: this.gameSpeed }
        };
      
        if (save) {
            if (!window.Sessions) window.Sessions = [];
            window.Sessions.push(session);
        }
        
        try { this.onRoundEnd?.(session); } catch(e) { console.warn(e); }
        window.dispatchEvent(new CustomEvent('round:ended', { detail: session }));
        const report = window.sessionLogger?.stopRecording();
        if (report) console.log(JSON.stringify(report));
        
        // 移除结束提示
        // window.gameApp?.showEncouragementMessage?.(this.t('game.samplingCompleted', { count: session.notes.length }), 1200);
      
        // 清理
        this.onRoundEnd = null;
        this.roundRemainingMs = null;
        this.roundPausedAt = 0;
        
        // 🔥 Important: Clear this round's note records to prevent accumulation in next round
        this.roundNotes = [];
      }
    
    // ← 建议紧跟在 stopRound() 之后加入
    getRoundRemainingMs() {
        if (!this.roundActive) return 0;
        if (this.isPaused && this.roundRemainingMs != null) return this.roundRemainingMs;
        return Math.max(0, this.roundEndAt - performance.now());
    }
      

    /** 便捷获取最近一局 */
    getLastSession() {
    return window.Sessions?.[window.Sessions.length - 1] ?? null;
    }

    /**
     * 点击轨迹追加一个标记
     */
    appendTrailDot(noteName = '', color = '#666') {
        // 用户请求移除即时反馈，防止overwhelming
        return;
    }

    /** 导出最近一局为 JSON（可选） */
    downloadLastSessionJSON(filename = 'session.json') {
    const s = this.getLastSession();
    if (!s) { console.warn('No session'); return; }
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    }
    /**
     * Handle bubble pop collision
     */
    handleBubblePop(collision) {
        if (!this.bubbleManager) return;
      
        // 1) 命中 -> 触发“爆炸”（动画 + onPop → 播放声音 + 记录）
        const popped = this.bubbleManager.popBubble(collision.bubble.id);
        if (!popped) return;  // 已在冷却中或正在爆炸，忽略
      
        // 2) 计分 & UI
        this.score += 10;
        window.gameApp?.updateScoreDisplay?.(this.score);
        
        // Record to game result manager (with hand info)
        if (window.gameResultManager) {
            const handType = collision.handType || 'unknown';
            window.gameResultManager.recordBubblePop(handType);
            console.log('📊 Recording bubble pop - hand type:', handType);
        }
      
        // 移除随机鼓励消息，让成就系统统一处理反馈
      
        // 3) （可选）在爆炸动画结束后再真正移除气泡
        //    popAnimation.duration 目前为 300ms，这里给一点余量
        setTimeout(() => {
          this.bubbleManager?.removeBubble(collision.bubble.id);
        }, 320);
      
        console.log(`Bubble popped! Score: ${this.score}`);
      }
    
    /**
     * Setup mouse fallback for testing without camera
     */
    setupMouseFallback() {
        console.log('Setting up mouse control');
        
        // Track mouse position as right hand
        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            
            this.handPositions.rightHand = {
                x: x,
                y: y,
                visible: true
            };
            
            // Store for pose detector simulation
            window.testMousePosition = { x, y };
        });
        
        // Handle mouse click to pop bubbles
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            
            // Check collision with bubbles
            if (this.bubbleManager) {
                const poppedBubble = this.bubbleManager.checkCollision(x, y);
                if (poppedBubble) {
                    console.log('🖱️ Mouse click popped bubble:', poppedBubble.id);
                    
                    // Record to SessionLogger
                    if (window.sessionLogger) {
                        window.sessionLogger.recordBubblePop(poppedBubble);
                        window.sessionLogger.recordClick(x, y, true);
                    }

                    // Directly record hand data (mouse mode defaults to right hand)
                    if (window.gameResultManager) {
                        window.gameResultManager.recordBubblePop('rightHand');
                        console.log('📊 Recording right hand pop data');
                    }
                } else {
                    // 鼠标点击未命中
                    if (window.sessionLogger) {
                        window.sessionLogger.recordClick(x, y, false);
                    }
                }
            }
        });

        // Hide hand when mouse leaves canvas
        this.canvas.addEventListener('mouseleave', () => {
            this.handPositions.rightHand.visible = false;
            window.testMousePosition = null;
        });
    }
    
    /**
     * Get current score
     */
    getScore() {
        return this.score;
    }
    
    /**
     * Reset game state
     */
    
    reset() {
        // 先确保当前局被取消且不入库，避免影响下一局
        this.stopRound?.({ save: false });
    
        this.score = 0;
        this.bubbleManager?.clearAllBubbles();
        this.collisionDetector?.reset();
        window.gameApp?.updateScoreDisplay?.(this.score);
        console.log('Game reset');
    }
    
    /**
     * togglePictogram() {
     */
    togglePictogram() {
        if (!this.poseDetector) return false;
        const enabled = this.poseDetector.togglePictogramMode();
        return enabled;
    }
    
    /**
     * Get current hand tracker
     */
    getHandTracker() {
        return this.handTracker;
    }
}

// Export for use in other modules
window.GameEngine = GameEngine;
