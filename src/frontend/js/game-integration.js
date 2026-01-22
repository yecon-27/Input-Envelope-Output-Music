/**
 * Game Integration Script - Connects game engine and result manager
 */

// Wait for page load complete
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Integration] Game integration script started');
    
    // Listen for game end event
    window.addEventListener('round:ended', function(event) {
        console.log('[Integration] Received game end event:', event.detail);
        
        if (window.gameResultManager) {
            // Call endGame method, it will process data and display result window
            window.gameResultManager.endGame();
        } else {
            console.error('[Integration] GameResultManager not found');
        }
    });

    // Initialize expert mode integration
    setupExpertIntegration();
    
    console.log('[Integration] Game event listeners set up');
});

/**
 * Setup expert mode real-time integration with game engine
 */
function setupExpertIntegration() {
    console.log('[Integration] Initializing expert mode integration...');
    
    // Listen for safety layer parameter changes
    if (window.safetyEnvelope) {
        window.safetyEnvelope.subscribe('paramChanged', ({ name, newValue, intercepted }) => {
            console.log(`[Expert] Parameter changed: ${name} = ${newValue} ${intercepted ? '(intercepted)' : ''}`);
            
            if (!window.game) return;
            
            // 1. Tempo -> Reward BPM
            if (name === 'tempo') {
                window.game.sessionConfig.rewardBpm = newValue;
                // If there's a background music engine, can also update here
            }
            
            // 2. Volume -> Synthesizer volume
            if (name === 'volume') {
                // GameEngine uses 'low'/'medium'/'high', but expert mode supports fine control
                // We directly operate PopSynth
                window.popSynth?.setVolume?.(newValue);
                // Update game config for consistency (approximate mapping)
                window.game.sessionConfig.volumeLevel = newValue > 0.8 ? 'high' : (newValue < 0.4 ? 'low' : 'medium');
            }
            
            // 3. Density -> Bubble spawn density
            if (name === 'density') {
                // Directly pass number to BubbleManager (requires BubbleManager to support numbers)
                window.game.bubbleManager?.setDensity?.(newValue);
                // Update game config
                window.game.sessionConfig.rhythmDensity = newValue < 0.8 ? 'sparse' : 'normal';
            }
            
            // 4. Note Range -> Can implement note range limits in BubbleManager (TODO)
        });
        
        // Listen for preview mode/mute
        window.safetyEnvelope.subscribe('previewModeChanged', ({ enabled, muted }) => {
            console.log(`[Expert] 预览模式: ${enabled}, 静音: ${muted}`);
            if (muted) {
                window.popSynth?.setVolume?.(0);
            } else {
                const vol = window.safetyEnvelope.getParam('volume');
                window.popSynth?.setVolume?.(vol);
            }
        });

        // 监听不安全模式
        window.safetyEnvelope.subscribe('unsafeModeChanged', ({ enabled }) => {
            console.log(`[Expert] 不安全模式: ${enabled}`);
            window.game.sessionConfig.expertMode = true; // 强制标记为专家模式
            
            // 视觉反馈：给 Canvas 容器加红框？
            const gameContainer = document.querySelector('.game-container') || document.body;
            if (enabled) {
                gameContainer.classList.add('unsafe-mode-active');
            } else {
                gameContainer.classList.remove('unsafe-mode-active');
            }
        });
    } else {
        console.warn('[Integration] SafetyEnvelope 未找到，无法绑定专家控制');
    }
}

// 调试函数 - 测试结果窗口
window.testResultWindow = function() {
    console.log('[Test] 测试结果窗口');
    
    if (window.gameResultManager) {
        // 模拟一些游戏数据
        window.gameResultManager.gameData = {
            bubblesPopped: 15,
            interactions: [
                { timestamp: Date.now() - 5000, type: 'bubble_pop' },
                { timestamp: Date.now() - 4000, type: 'bubble_pop' },
                { timestamp: Date.now() - 3000, type: 'bubble_pop' }
            ]
        };
        
        window.gameResultManager.showResultWindow();
    } else {
        console.error('GameResultManager 未找到');
    }
};

// 调试函数 - 检查当前游戏数据
window.checkGameData = function() {
    if (window.gameResultManager) {
        console.log('[Data] 当前游戏数据:', window.gameResultManager.gameData);
        console.log('[Data] 游戏是否激活:', window.gameResultManager.isActive);
        const stats = window.gameResultManager.calculateStats();
        console.log('[Data] 计算的统计数据:', stats);
    } else {
        console.error('GameResultManager 未找到');
    }
};

// 调试函数 - 测试游戏重启
window.testGameRestart = function() {
    console.log('[Test] 测试游戏重启功能');
    console.log('[Test] 当前游戏对象:', window.game);
    console.log('[Test] 当前结果管理器:', window.gameResultManager);
    
    if (window.gameResultManager) {
        window.gameResultManager.startNewGame();
    } else {
        console.error('GameResultManager 未找到');
    }
};

// 调试函数 - 测试碰撞检测流程
window.testCollisionFlow = function() {
    console.log('[Test] 测试碰撞检测流程');
    
    if (!window.game) {
        console.error('[Test] 游戏对象未找到');
        return;
    }
    
    console.log('[Test] 游戏引擎状态:');
    console.log('  - isRunning:', window.game.isRunning);
    console.log('  - roundActive:', window.game.roundActive);
    console.log('  - bubbleManager:', !!window.game.bubbleManager);
    console.log('  - collisionDetector:', !!window.game.collisionDetector);
    
    if (window.game.bubbleManager) {
        const bubbles = window.game.bubbleManager.bubbles;
        console.log('[Test] 泡泡状态:');
        console.log('  - 泡泡数量:', bubbles.length);
        console.log('  - 泡泡列表:', bubbles.map(b => ({id: b.id, x: b.x, y: b.y, radius: b.radius})));
    }
    
    console.log('[Test] 手部位置:');
    console.log('  - handPositions:', window.game.handPositions);
    
    if (window.gameResultManager) {
        console.log('[Test] 结果管理器状态:');
        console.log('  - isActive:', window.gameResultManager.isActive);
        console.log('  - 当前数据:', window.gameResultManager.gameData);
    }
    
    // 模拟一次碰撞
    if (window.game.bubbleManager && window.game.bubbleManager.bubbles.length > 0) {
        const bubble = window.game.bubbleManager.bubbles[0];
        console.log('[Test] 模拟戳破第一个泡泡:', bubble.id);
        
        // 直接调用 BubbleManager 的 checkCollision
        const result = window.game.bubbleManager.checkCollision(bubble.x, bubble.y);
        console.log('[Test] 碰撞检测结果:', result);
    }
};

// 调试函数 - 手动记录泡泡戳破
window.testRecordBubblePop = function(handType = 'leftHand') {
    console.log('[Test] 测试手动记录泡泡戳破 - 手部类型:', handType);
    
    if (window.gameResultManager) {
        console.log('[Test] 戳破前数据:', window.gameResultManager.gameData);
        
        // 手动记录一次泡泡戳破
        window.gameResultManager.recordBubblePop(handType);
        
        console.log('[Test] 戳破后数据:', window.gameResultManager.gameData);
        console.log('[Test] 手动记录完成');
    } else {
        console.error('GameResultManager 未找到');
    }
};

// 调试函数 - 测试手部统计
window.testHandStats = function() {
    console.log('🧪 测试手部统计功能');
    
    if (!window.gameResultManager) {
        console.error('GameResultManager 未找到');
        return;
    }
    
    // 模拟一些手部数据
    console.log('📊 模拟左手戳破3次...');
    for (let i = 0; i < 3; i++) {
        window.gameResultManager.recordBubblePop('leftHand');
    }
    
    console.log('📊 模拟右手戳破2次...');
    for (let i = 0; i < 2; i++) {
        window.gameResultManager.recordBubblePop('rightHand');
    }
    
    console.log('📊 模拟未知手部戳破1次...');
    window.gameResultManager.recordBubblePop('unknown');
    
    // 计算统计
    const stats = window.gameResultManager.calculateStats();
    console.log('📈 手部统计结果:', stats.handPreference);
    
    // 显示结果窗口
    window.gameResultManager.endGame();
};

// 调试函数 - 测试原始音乐功能
window.testOriginalMusicFlow = function() {
    console.log('🧪 测试原始音乐生成流程...');
    
    // 创建模拟的游戏会话
    const mockSession = {
        notes: [
            { pitch: 60, startTime: 0, endTime: 0.5 },
            { pitch: 64, startTime: 0.5, endTime: 1.0 },
            { pitch: 67, startTime: 1.0, endTime: 1.5 },
            { pitch: 72, startTime: 1.5, endTime: 2.0 }
        ],
        duration: 60
    };
    
    console.log('🎵 调用原始音乐生成函数...');
    
    if (window.gameApp && window.gameApp.generateMelodyFromSession) {
        window.gameApp.generateMelodyFromSession(mockSession, {
            primerBars: 2,
            continueSteps: 128,
            temperature: 1.0,
            downloadMidi: true,
        }).then(() => {
            console.log('✅ 原始音乐生成流程完成');
        }).catch(err => {
            console.error('❌ 原始音乐生成失败:', err);
        });
    } else {
        console.error('❌ generateMelodyFromSession 函数不可用');
    }
};

// 调试函数 - 检查Magenta状态
window.checkMagentaStatus = function() {
    console.log('🔍 检查Magenta状态...');
    
    console.log('📦 Magenta库状态:');
    console.log('  - window.mm:', !!window.mm);
    console.log('  - window.MAGENTA:', !!window.MAGENTA);
    
    if (window.mm) {
        console.log('  - mm.MusicRNN:', !!window.mm.MusicRNN);
        console.log('  - mm.Player:', !!window.mm.Player);
        console.log('  - mm.sequenceProtoToMidi:', !!window.mm.sequenceProtoToMidi);
    }
    
    if (window.MAGENTA) {
        console.log('  - MAGENTA.model:', !!window.MAGENTA.model);
        console.log('  - MAGENTA.player:', !!window.MAGENTA.player);
        console.log('  - MAGENTA.__backend:', window.MAGENTA.__backend);
    }
    
    console.log('🎵 音乐序列状态:');
    console.log('  - lastGeneratedSequence:', !!window.lastGeneratedSequence);
    if (window.lastGeneratedSequence) {
        console.log('  - 音符数量:', window.lastGeneratedSequence.notes?.length || 0);
    }
    
    // 测试初始化
    if (window.gameApp && window.gameApp.initMusicRNN) {
        console.log('🧪 测试Magenta初始化...');
        window.gameApp.initMusicRNN({ backend: 'cpu' })
            .then(() => {
                console.log('✅ Magenta初始化成功');
                console.log('  - 播放器可用:', !!window.MAGENTA?.player);
            })
            .catch(err => {
                console.error('❌ Magenta初始化失败:', err);
            });
    } else {
        console.warn('⚠️ initMusicRNN 函数不可用');
    }
};

// 调试函数 - 强制触发游戏结束
window.forceGameEnd = function() {
    console.log('🧪 强制触发游戏结束');
    
    if (window.gameResultManager) {
        // 确保游戏管理器是激活状态
        if (!window.gameResultManager.isActive) {
            window.gameResultManager.startGame();
        }
        
        // 添加一些测试数据
        window.gameResultManager.gameData.bubblesPopped = 25;
        window.gameResultManager.gameData.maxConsecutive = 8;
        window.gameResultManager.gameData.totalAttempts = 30;
        
        // 触发游戏结束
        window.gameResultManager.endGame();
        
        console.log('✅ 游戏结束已触发');
    } else {
        console.error('GameResultManager 未找到');
    }
};

console.log('📝 game-integration.js 加载完成');
console.log('💡 调试命令:');
console.log('  - testOriginalMusicFlow() : 测试原始音乐生成流程（应该自动下载MIDI）');
console.log('  - checkMagentaStatus() : 检查Magenta音乐库状态');
console.log('  - testResultWindow() : 测试结果窗口');
console.log('  - checkGameData() : 检查当前游戏数据');
console.log('  - testGameRestart() : 测试游戏重启功能');
console.log('  - testCollisionFlow() : 测试碰撞检测流程');
console.log('  - testRecordBubblePop("leftHand") : 测试手动记录泡泡戳破');
console.log('  - testHandStats() : 测试手部统计功能');
console.log('  - forceGameEnd() : 强制触发游戏结束（测试用）');