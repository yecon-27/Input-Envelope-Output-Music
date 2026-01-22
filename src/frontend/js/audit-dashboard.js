/**
 * AuditDashboard - Expert Audit Report Dashboard
 * Responsible for rendering detailed data analysis after game ends, including dual-axis line chart and safety checklist
 */
class AuditDashboard {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Show audit dashboard
     * @param {Object} sessionData - Data exported from SessionLogger
     */
    show(sessionData) {
        // Reuse or create container
        let dashboard = document.getElementById('audit-dashboard-full');
        if (!dashboard) {
            dashboard = this.createDashboardElement();
        }
        
        this.container = dashboard;
        this.container.classList.remove('hidden');
        
        // Fill basic info
        this.updateMetaInfo(sessionData);
        
        // Render dual-axis line chart (BPM vs Click Freq)
        this.renderDualAxisChart(sessionData.timeline.causalAlignment);
        
        // Render safety checklist
        this.renderSafetyChecks(sessionData.safetyChecks);
        
        // Render interception log
        this.renderInterceptLog(sessionData.timeline.interceptedEvents);
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    createDashboardElement() {
        const div = document.createElement('div');
        div.id = 'audit-dashboard-full';
        div.className = 'audit-dashboard-overlay hidden';
        div.innerHTML = `
            <div class="audit-dashboard-content glass-panel">
                <div class="audit-header">
                    <h2>📊 专家审计报告 (Expert Audit Log)</h2>
                    <button id="audit-close-btn" class="close-btn">×</button>
                </div>
                
                <div class="audit-grid-layout">
                    <!-- 左侧：元数据与统计 -->
                    <div class="audit-col-left">
                        <div class="audit-card">
                            <h3>Session Meta</h3>
                            <div id="audit-meta-content" class="meta-content"></div>
                        </div>
                        <div class="audit-card">
                            <h3>Safety Checks</h3>
                            <div id="audit-safety-list" class="safety-list custom-scrollbar"></div>
                        </div>
                    </div>
                    
                    <!-- 中间：核心图表 -->
                    <div class="audit-col-center">
                        <div class="audit-card chart-card">
                            <h3>Causal Alignment (System BPM vs User Input)</h3>
                            <div class="chart-container">
                                <canvas id="audit-main-chart"></canvas>
                            </div>
                            <div class="chart-legend">
                                <span class="legend-item"><span class="dot bpm"></span>System BPM (60-80)</span>
                                <span class="legend-item"><span class="dot click"></span>User Click Freq (Hz)</span>
                            </div>
                        </div>
                        <div class="audit-card log-card">
                            <h3>Interception Log (Security Interception Records)</h3>
                            <div id="audit-intercept-log" class="intercept-log custom-scrollbar"></div>
                        </div>
                    </div>
                </div>
                
                <div class="audit-footer">
                    <button id="audit-export-json" class="btn-secondary">Export JSON</button>
                    <button id="audit-export-min" class="btn-secondary">Export Minimal</button>
                    <button id="audit-replay" class="btn-primary">Replay Session</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(div);
        
        // Bind events
        div.querySelector('#audit-close-btn').addEventListener('click', () => this.hide());
        div.querySelector('#audit-export-json').addEventListener('click', () => {
            window.sessionLogger?.downloadJSON();
        });
        div.querySelector('#audit-export-min').addEventListener('click', () => {
            window.gameResultManager?.exportMinimalAuditJSON();
        });
        
        // Inject styles
        this.injectStyles();
        
        return div;
    }

    injectStyles() {
        if (document.getElementById('audit-dashboard-styles')) return;
        const style = document.createElement('style');
        style.id = 'audit-dashboard-styles';
        style.textContent = `
            .audit-dashboard-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(8px);
                z-index: 3000;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 40px;
            }
            
            .audit-dashboard-content {
                width: 100%;
                max-width: 1200px;
                height: 90vh;
                background: rgba(30, 30, 40, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                display: flex;
                flex-direction: column;
                color: #e0e0e0;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            
            .audit-header {
                padding: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .audit-grid-layout {
                flex: 1;
                display: grid;
                grid-template-columns: 300px 1fr;
                gap: 20px;
                padding: 20px;
                overflow: hidden;
            }
            
            .audit-col-left, .audit-col-center {
                display: flex;
                flex-direction: column;
                gap: 20px;
                overflow: hidden;
            }
            
            .audit-card {
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .audit-card h3 {
                margin: 0;
                padding: 12px 16px;
                background: rgba(255,255,255,0.05);
                font-size: 14px;
                font-weight: 600;
                color: #a0a0a0;
                text-transform: uppercase;
            }
            
            .meta-content { padding: 16px; font-family: monospace; font-size: 12px; line-height: 1.6; }
            
            .safety-list { flex: 1; overflow-y: auto; padding: 10px; }
            
            .safety-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                margin-bottom: 6px;
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
                font-size: 13px;
            }
            .safety-item.pass { border-left: 3px solid #10B981; }
            .safety-item.fail { border-left: 3px solid #EF4444; }
            
            .chart-card { flex: 2; min-height: 300px; }
            .chart-container { flex: 1; position: relative; padding: 10px; background: rgba(0,0,0,0.2); }
            canvas { width: 100%; height: 100%; }
            
            .log-card { flex: 1; }
            .intercept-log { flex: 1; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 12px; }
            .log-entry { 
                padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); 
                display: grid; grid-template-columns: 60px 100px 1fr;
            }
            .log-entry:hover { background: rgba(255,255,255,0.05); }
            .log-time { color: #888; }
            .log-type { color: #EF4444; font-weight: bold; }
            
            .audit-footer {
                padding: 16px 20px;
                border-top: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .chart-legend {
                display: flex;
                justify-content: center;
                gap: 20px;
                padding: 8px;
                font-size: 12px;
                color: #ccc;
            }
            .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
            .dot.bpm { background: #6366F1; }
            .dot.click { background: #10B981; }
        `;
        document.head.appendChild(style);
    }

    updateMetaInfo(data) {
        const container = this.container.querySelector('#audit-meta-content');
        container.innerHTML = `
            <div>ID: ${data.sessionId}</div>
            <div>Date: ${new Date(data.startTime).toLocaleString()}</div>
            <div>Duration: ${data.durationSec.toFixed(1)}s</div>
            <div>Total Clicks: ${data.stats.totalClicks}</div>
            <div>Success Rate: ${Math.round(data.stats.successfulPops/data.stats.totalClicks*100 || 0)}%</div>
            <div>Intercepts: <span style="color:${data.stats.interceptedNotes > 0 ? '#EF4444':'#10B981'}">${data.stats.interceptedNotes}</span></div>
        `;
    }

    renderSafetyChecks(checks) {
        const container = this.container.querySelector('#audit-safety-list');
        container.innerHTML = '';
        
        Object.entries(checks).forEach(([key, result]) => {
            const div = document.createElement('div');
            div.className = `safety-item ${result.passed ? 'pass' : 'fail'}`;
            div.innerHTML = `
                <span>${key.replace('Check', '')}</span>
                <span>${result.passed ? 'PASS' : 'FAIL'}</span>
            `;
            container.appendChild(div);
            
            if (!result.passed && result.details) {
                result.details.forEach(detail => {
                    const detailDiv = document.createElement('div');
                    detailDiv.style.fontSize = '11px';
                    detailDiv.style.color = '#EF4444';
                    detailDiv.style.padding = '4px 12px';
                    detailDiv.textContent = `↳ ${detail}`;
                    container.appendChild(detailDiv);
                });
            }
        });
    }

    renderInterceptLog(events) {
        const container = this.container.querySelector('#audit-intercept-log');
        container.innerHTML = '';
        
        if (events.length === 0) {
            container.innerHTML = '<div style="padding:10px; color:#888;">No security interceptions recorded.</div>';
            return;
        }
        
        events.forEach(evt => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = `
                <span class="log-time">${evt.t.toFixed(1)}s</span>
                <span class="log-type">${evt.type}</span>
                <span class="log-detail">${evt.rule}: ${JSON.stringify(evt.original)} -> ${JSON.stringify(evt.clamped)}</span>
            `;
            container.appendChild(div);
        });
    }

    renderDualAxisChart(data) {
        const canvas = this.container.querySelector('#audit-main-chart');
        const ctx = canvas.getContext('2d');
        
        // Resize canvas
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const w = canvas.width;
        const h = canvas.height;
        const padding = 40;
        
        ctx.clearRect(0, 0, w, h);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = '#888';
            ctx.fillText('No data available', w/2, h/2);
            return;
        }
        
        // Scales
        const maxTime = data[data.length-1].t;
        // BPM Axis (Left) - Fixed range 40-140 usually, or dynamic
        const minBPM = 40, maxBPM = 120;
        // Freq Axis (Right) - 0 to 5 Hz
        const maxFreq = 5;
        
        const x = (t) => padding + (t / maxTime) * (w - 2 * padding);
        const yBPM = (bpm) => h - padding - ((bpm - minBPM) / (maxBPM - minBPM)) * (h - 2 * padding);
        const yFreq = (freq) => h - padding - (freq / maxFreq) * (h - 2 * padding);
        
        // Draw Axes
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // X axis
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        // Left Y (BPM)
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        // Right Y (Freq)
        ctx.moveTo(w - padding, padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${maxBPM} BPM`, padding - 5, padding);
        ctx.fillText(`${minBPM} BPM`, padding - 5, h - padding);
        
        ctx.textAlign = 'left';
        ctx.fillText(`${maxFreq} Hz`, w - padding + 5, padding);
        ctx.fillText(`0 Hz`, w - padding + 5, h - padding);
        
        // Draw BPM Line (Blue)
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((d, i) => {
            const px = x(d.t);
            const py = yBPM(d.systemBPM);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
        
        // Draw Click Freq Line (Green)
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((d, i) => {
            const px = x(d.t);
            const py = yFreq(d.userClickFreq);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
        
        // Draw Safe Zone for BPM (60-80) background
        const y80 = yBPM(80);
        const y60 = yBPM(60);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.fillRect(padding, y80, w - 2*padding, y60 - y80);
        
        ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.fillText('Safe Zone', padding + 10, y80 + 15);
    }
}

// Export singleton
window.auditDashboard = new AuditDashboard();
window.AuditDashboard = AuditDashboard;
