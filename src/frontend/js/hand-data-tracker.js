/**
 * Hand Movement Data Tracker
 * Collects and analyzes user hand movement data
 */
class HandDataTracker {
    constructor() {
        this.isTracking = false;
        this.data = {
            leftHand: {
                visible: false,
                position: { x: 0, y: 0 },
                lastPosition: { x: 0, y: 0 },
                speed: 0,
                totalDistance: 0
            },
            rightHand: {
                visible: false,
                position: { x: 0, y: 0 },
                lastPosition: { x: 0, y: 0 },
                speed: 0,
                totalDistance: 0
            },
            session: {
                startTime: Date.now(),
                popCount: 0,
                totalAttempts: 0,
                accuracy: 0,
                maxSpeed: 0,
                avgSpeed: 0,
                speedSamples: []
            }
        };
        
        this.lastUpdateTime = Date.now();
        this.updateInterval = null;
        
        this.initializeUI();
    }
    
    /**
     * Initialize UI elements
     */
    initializeUI() {
        // Get export button
        this.exportBtn = document.getElementById('export-data-btn');
        
        // Bind export button
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => {
                this.generateReport();
            });
        }
        
        // Auto-start tracking (runs in background)
        this.startTracking();
    }
    
    /**
     * Generate and export data report
     */
    generateReport() {
        const stats = this.getSessionStats();
        const report = this.createDetailedReport(stats);
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bubble-game-report-${timestamp}.json`;
        
        // Export JSON report
        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        link.click();
        
        // Also generate readable text report
        this.generateTextReport(report);
        
        console.log('📊 Data report exported:', filename);
    }
    
    /**
     * Start tracking
     */
    startTracking() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        this.resetSession();
        
        console.log('📊 Hand data tracking started (background)');
    }
    
    /**
     * Stop tracking
     */
    stopTracking() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        console.log('📊 Hand data tracking stopped');
    }
    
    /**
     * Reset session data
     */
    resetSession() {
        this.data.session = {
            startTime: Date.now(),
            popCount: 0,
            totalAttempts: 0,
            accuracy: 0,
            maxSpeed: 0,
            avgSpeed: 0,
            speedSamples: []
        };
        
        this.data.leftHand.totalDistance = 0;
        this.data.rightHand.totalDistance = 0;
    }
    
    /**
     * Update hand position data
     */
    updateHandPosition(hand, x, y, visible = true) {
        if (!this.isTracking) return;
        
        const handData = this.data[hand];
        if (!handData) return;
        
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        
        if (visible && handData.visible) {
            // Calculate movement distance
            const dx = x - handData.lastPosition.x;
            const dy = y - handData.lastPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate speed (pixels/second)
            const speed = deltaTime > 0 ? distance / deltaTime : 0;
            
            // Update data
            handData.speed = speed;
            handData.totalDistance += distance;
            
            // Record speed samples for average calculation
            if (speed > 0) {
                this.data.session.speedSamples.push(speed);
                if (this.data.session.speedSamples.length > 100) {
                    this.data.session.speedSamples.shift(); // Keep last 100 samples
                }
                
                // Update max speed
                this.data.session.maxSpeed = Math.max(this.data.session.maxSpeed, speed);
                
                // Calculate average speed
                const sum = this.data.session.speedSamples.reduce((a, b) => a + b, 0);
                this.data.session.avgSpeed = sum / this.data.session.speedSamples.length;
            }
        }
        
        // Update position and state
        handData.lastPosition = { x: handData.position.x, y: handData.position.y };
        handData.position = { x, y };
        handData.visible = visible;
        
        this.lastUpdateTime = currentTime;
    }
    
    /**
     * Record bubble pop event
     */
    recordPop(successful = true) {
        if (!this.isTracking) return;
        
        this.data.session.totalAttempts++;
        if (successful) {
            this.data.session.popCount++;
        }
        
        // Calculate accuracy
        this.data.session.accuracy = this.data.session.totalAttempts > 0 
            ? (this.data.session.popCount / this.data.session.totalAttempts) * 100 
            : 0;
    }
    
    // updateDisplay method removed - changed to background data collection
    
    /**
     * Get session statistics
     */
    getSessionStats() {
        const sessionTime = (Date.now() - this.data.session.startTime) / 1000; // seconds
        const totalDistance = this.data.leftHand.totalDistance + this.data.rightHand.totalDistance;
        
        return {
            sessionTime: sessionTime,
            popCount: this.data.session.popCount,
            totalAttempts: this.data.session.totalAttempts,
            accuracy: this.data.session.accuracy,
            totalDistance: totalDistance,
            maxSpeed: this.data.session.maxSpeed,
            avgSpeed: this.data.session.avgSpeed,
            leftHandDistance: this.data.leftHand.totalDistance,
            rightHandDistance: this.data.rightHand.totalDistance
        };
    }
    
    /**
     * Create detailed report
     */
    createDetailedReport(stats) {
        return {
            metadata: {
                timestamp: new Date().toISOString(),
                gameVersion: "1.0.0",
                reportType: "bubble-game-session",
                sessionDuration: Math.round(stats.sessionTime),
                generatedAt: new Date().toLocaleString()
            },
            
            gamePerformance: {
                totalBubblesPopped: stats.popCount,
                totalAttempts: this.data.session.totalAttempts,
                accuracy: Math.round(stats.accuracy * 100) / 100,
                successRate: stats.popCount > 0 ? Math.round((stats.popCount / this.data.session.totalAttempts) * 10000) / 100 : 0
            },
            
            movementAnalysis: {
                totalDistance: Math.round(stats.totalDistance),
                leftHandDistance: Math.round(stats.leftHandDistance),
                rightHandDistance: Math.round(stats.rightHandDistance),
                maxSpeed: Math.round(stats.maxSpeed * 100) / 100,
                avgSpeed: Math.round(stats.avgSpeed * 100) / 100,
                dominantHand: stats.rightHandDistance > stats.leftHandDistance ? 'right' : 'left'
            },
            
            timeAnalysis: {
                sessionStartTime: new Date(this.data.session.startTime).toLocaleString(),
                sessionEndTime: new Date().toLocaleString(),
                totalPlayTime: `${Math.floor(stats.sessionTime / 60)}m ${Math.round(stats.sessionTime % 60)}s`,
                avgTimePerBubble: stats.popCount > 0 ? Math.round((stats.sessionTime / stats.popCount) * 100) / 100 : 0
            },
            
            detailedMetrics: {
                speedSamples: this.data.session.speedSamples.length,
                handSwitches: this.calculateHandSwitches(),
                movementEfficiency: this.calculateMovementEfficiency(),
                consistencyScore: this.calculateConsistencyScore()
            },
            
            rawData: {
                leftHandData: this.data.leftHand,
                rightHandData: this.data.rightHand,
                sessionData: this.data.session
            }
        };
    }
    
    /**
     * Generate readable text report
     */
    generateTextReport(report) {
        const textReport = `
🎮 Bubble Game - User Behavior Analysis Report
=====================================

📊 Basic Info
-----------
Generated: ${report.metadata.generatedAt}
Duration: ${report.timeAnalysis.totalPlayTime}
Start Time: ${report.timeAnalysis.sessionStartTime}
End Time: ${report.timeAnalysis.sessionEndTime}

🎯 Game Performance
-----------
Bubbles Popped: ${report.gamePerformance.totalBubblesPopped}
Total Attempts: ${report.gamePerformance.totalAttempts}
Success Rate: ${report.gamePerformance.successRate}%
Avg Time Per Bubble: ${report.timeAnalysis.avgTimePerBubble}s

🖐️ Movement Analysis
-----------
Total Distance: ${report.movementAnalysis.totalDistance} pixels
Left Hand Distance: ${report.movementAnalysis.leftHandDistance} pixels
Right Hand Distance: ${report.movementAnalysis.rightHandDistance} pixels
Dominant Hand: ${report.movementAnalysis.dominantHand === 'right' ? 'Right' : 'Left'}
Max Speed: ${report.movementAnalysis.maxSpeed} px/s
Avg Speed: ${report.movementAnalysis.avgSpeed} px/s

📈 Advanced Metrics
-----------
Movement Efficiency: ${report.detailedMetrics.movementEfficiency}%
Consistency Score: ${report.detailedMetrics.consistencyScore}%
Hand Switches: ${report.detailedMetrics.handSwitches}
Speed Samples: ${report.detailedMetrics.speedSamples}

💡 Recommendations
-----------
${this.generateRecommendations(report)}

=====================================
Report complete - Data saved as JSON
        `;
        
        // Export text report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const textBlob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(textBlob);
        link.download = `bubble-game-analysis-${timestamp}.txt`;
        link.click();
    }
    
    /**
     * Calculate hand switches
     */
    calculateHandSwitches() {
        // Simplified calculation - based on left/right hand activity changes
        return Math.floor(Math.abs(this.data.leftHand.totalDistance - this.data.rightHand.totalDistance) / 100);
    }
    
    /**
     * Calculate movement efficiency
     */
    calculateMovementEfficiency() {
        const totalDistance = this.data.leftHand.totalDistance + this.data.rightHand.totalDistance;
        const popCount = this.data.session.popCount;
        
        if (popCount === 0 || totalDistance === 0) return 0;
        
        // Efficiency = success count / distance * 1000 (normalized)
        const efficiency = (popCount / totalDistance) * 1000;
        return Math.min(100, Math.round(efficiency * 100) / 100);
    }
    
    /**
     * Calculate consistency score
     */
    calculateConsistencyScore() {
        const speeds = this.data.session.speedSamples;
        if (speeds.length < 2) return 0;
        
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length;
        const stdDev = Math.sqrt(variance);
        
        // Consistency = 100 - (stdDev / avgSpeed * 100), clamped to 0-100
        const consistency = Math.max(0, 100 - (stdDev / avgSpeed * 100));
        return Math.round(consistency * 100) / 100;
    }
    
    /**
     * Generate personalized recommendations
     */
    generateRecommendations(report) {
        const recommendations = [];
        
        if (report.gamePerformance.successRate < 70) {
            recommendations.push("• Try slowing down and focus on accuracy over speed");
        }
        
        if (report.movementAnalysis.avgSpeed > 200) {
            recommendations.push("• Movement speed is high, try smoother hand motions");
        }
        
        if (report.detailedMetrics.consistencyScore < 60) {
            recommendations.push("• Practice maintaining a steady movement rhythm");
        }
        
        const dominantRatio = report.movementAnalysis.rightHandDistance / 
                            (report.movementAnalysis.leftHandDistance + report.movementAnalysis.rightHandDistance);
        
        if (dominantRatio > 0.8 || dominantRatio < 0.2) {
            recommendations.push("• Try using your non-dominant hand to improve coordination");
        }
        
        if (recommendations.length === 0) {
            recommendations.push("• Excellent performance! Keep up the current pace");
        }
        
        return recommendations.join('\n');
    }
    
    /**
     * Destroy tracker
     */
    destroy() {
        this.stopTracking();
        
        if (this.elements.toggle) {
            this.elements.toggle.removeEventListener('click', this.togglePanel);
        }
    }
}

// Export class
window.HandDataTracker = HandDataTracker;
