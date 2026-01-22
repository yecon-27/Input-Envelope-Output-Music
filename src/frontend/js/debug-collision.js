/**
 * Collision Detection Debug Tool
 * For diagnosing bubble pop data recording issues
 */

// Debug: Monitor all bubble pop events
window.debugCollisionSystem = function() {
    console.log('[Debug] Starting collision system monitoring...');
    
    if (!window.game || !window.game.bubbleManager) {
        console.error('[Debug] Game or bubble manager not found');
        return;
    }
    
    // Save original onPop callback
    const originalOnPop = window.game.bubbleManager.onPop;
    
    // Wrap onPop callback to add debug info
    window.game.bubbleManager.onPop = function(bubble) {
        console.log('[Debug] Bubble pop event triggered:', {
            bubbleId: bubble.id,
            position: { x: bubble.x, y: bubble.y },
            note: bubble.note?.name,
            timestamp: Date.now()
        });
        
        // Check GameResultManager state
        if (window.gameResultManager) {
            console.log('[Debug] GameResultManager state:');
            console.log('  - isActive:', window.gameResultManager.isActive);
            console.log('  - Count before pop:', window.gameResultManager.gameData.bubblesPopped);
            
            // Call original callback
            if (originalOnPop) {
                originalOnPop.call(this, bubble);
            }
            
            console.log('  - Count after pop:', window.gameResultManager.gameData.bubblesPopped);
        } else {
            console.error('[Debug] GameResultManager not found');
            
            // Still call original callback
            if (originalOnPop) {
                originalOnPop.call(this, bubble);
            }
        }
    };
    
    console.log('[Debug] Collision monitoring started');
    console.log('[Debug] Detailed debug info will be shown when popping bubbles');
};

// Debug: Manually trigger bubble pop
window.debugPopBubble = function() {
    if (!window.game || !window.game.bubbleManager) {
        console.error('[Debug] Game or bubble manager not found');
        return;
    }
    
    const bubbles = window.game.bubbleManager.bubbles;
    if (bubbles.length === 0) {
        console.warn('[Debug] No bubbles to pop');
        return;
    }
    
    const bubble = bubbles[0];
    console.log('[Debug] Manually popping bubble:', bubble.id);
    
    // Directly call checkCollision
    const result = window.game.bubbleManager.checkCollision(bubble.x, bubble.y);
    console.log('[Debug] Pop result:', result);
};

// Debug: Check game state
window.debugGameState = function() {
    console.log('[Debug] Game state check:');
    
    console.log('[Debug] Game object:', {
        exists: !!window.game,
        isRunning: window.game?.isRunning,
        roundActive: window.game?.roundActive,
        score: window.game?.score
    });
    
    console.log('[Debug] Bubble manager:', {
        exists: !!window.game?.bubbleManager,
        bubbleCount: window.game?.bubbleManager?.bubbles?.length || 0,
        onPopExists: !!window.game?.bubbleManager?.onPop
    });
    
    console.log('[Debug] Collision detector:', {
        exists: !!window.game?.collisionDetector,
        callbackCount: window.game?.collisionDetector?.collisionCallbacks?.length || 0
    });
    
    console.log('[Debug] Result manager:', {
        exists: !!window.gameResultManager,
        isActive: window.gameResultManager?.isActive,
        bubblesPopped: window.gameResultManager?.gameData?.bubblesPopped || 0
    });
    
    console.log('[Debug] Hand positions:', window.game?.handPositions);
};

console.log('[Debug] Collision debug tool loaded');
console.log('[Debug] Debug commands:');
console.log('  - debugCollisionSystem() : Monitor collision system');
console.log('  - debugPopBubble() : Manually pop bubble');
console.log('  - debugGameState() : Check game state');
