/**
 * 主程序 - 应用程序入口
 */

class RegionalMapApp {
    constructor() {
        this.renderer = null;
        this.interaction = null;
        this.currentRegionId = null;
        this.pendingSelection = null; // 切换星域后要选中的星系
        
        this.elements = {
            regionSelect: document.getElementById('regionSelect'),
            loadingMask: document.getElementById('loadingMask'),
            toast: document.getElementById('toast'),
            systemInfo: document.querySelector('#systemInfo .info-content'),
            borderSystems: document.querySelector('#borderSystems .border-list')
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.showLoading(true);
            
            await dataLoader.loadAll();
            
            const canvas = document.getElementById('mapCanvas');
            this.renderer = new MapRenderer(canvas);
            
            this.interaction = new MapInteraction(
                this.renderer,
                this.onSystemHover.bind(this),
                this.onSystemSelect.bind(this)
            );
            
            this.populateRegionSelector();
            this.bindEvents();
            
            // 默认选择 Metropolis
            this.selectRegion(10000042);
            
            this.showToast('地图加载完成');
            
        } catch (error) {
            console.error('[App] 初始化失败:', error);
            this.showToast('加载失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    bindEvents() {
        this.elements.regionSelect.addEventListener('change', (e) => {
            const regionId = parseInt(e.target.value);
            if (regionId) {
                this.selectRegion(regionId);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Home') {
                this.renderer.resetView();
            }
        });
    }
    
    populateRegionSelector() {
        const regions = dataLoader.getRegionList();
        const select = this.elements.regionSelect;
        
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        for (const region of regions) {
            const option = document.createElement('option');
            option.value = region.id;
            option.textContent = `${region.name} (${region.systemCount}个星系)`;
            select.appendChild(option);
        }
    }
    
    selectRegion(regionId, selectSystemId = null) {
        if (this.currentRegionId === regionId && !selectSystemId) return;
        
        this.currentRegionId = regionId;
        this.pendingSelection = selectSystemId;
        
        this.elements.regionSelect.value = regionId;
        
        const data = dataLoader.getRegionData(regionId);
        if (!data) {
            this.showToast('无法加载星域数据', 'error');
            return;
        }
        
        this.renderer.setData(data);
        
        // 如果有待选中的星系，在渲染后选中它
        if (selectSystemId) {
            // 检查是否在外部星系中
            const externalSystem = data.externalSystems.find(s => s.id === selectSystemId);
            if (externalSystem) {
                this.renderer.setSelectedSystem(externalSystem);
                this.updateSystemInfo(externalSystem);
            } else {
                // 在本星域中查找
                const system = data.systems.find(s => s.id === selectSystemId);
                if (system) {
                    this.renderer.setSelectedSystem(system);
                    this.updateSystemInfo(system);
                }
            }
            this.pendingSelection = null;
        } else {
            this.updateSidePanel(data);
            this.updateSystemInfo(null);
        }
        
        this.showToast(`已切换到: ${data.region.name}`);
    }
    
    updateSidePanel(data) {
        const borderList = this.elements.borderSystems;
        
        if (data.borderSystems.length === 0) {
            borderList.innerHTML = '<p class="placeholder">此星域没有直接连接的相邻星域</p>';
        } else {
            borderList.innerHTML = '';
            
            for (const system of data.borderSystems) {
                const item = document.createElement('div');
                item.className = 'border-item';
                
                const connections = system.borderConnections || [];
                const targetNames = [...new Set(connections.map(c => c.regionName))].join(', ');
                
                item.innerHTML = `
                    <div>
                        <div class="border-system-name">${system.name}</div>
                        <div class="border-target-region">→ ${targetNames}</div>
                    </div>
                    <span class="border-security ${system.securityClass}">
                        ${system.securityStatus.toFixed(1)}
                    </span>
                `;
                
                item.addEventListener('click', () => {
                    this.renderer.setSelectedSystem(system);
                    this.updateSystemInfo(system);
                });
                
                borderList.appendChild(item);
            }
        }
    }
    
    onSystemHover(system) {
        // 可以在这里添加悬停提示
        if (system && system.isExternal) {
            this.canvas.style.cursor = 'pointer';
        }
    }
    
    onSystemSelect(system) {
        if (!system) {
            this.updateSystemInfo(null);
            return;
        }
        
        // 如果点击的是外部星系，跳转到该星域并选中该星系
        if (system.isExternal) {
            const targetRegionId = system.regionID;
            const targetSystemId = system.id;
            
            this.showToast(`正在跳转到 ${system.name}...`);
            this.selectRegion(targetRegionId, targetSystemId);
            return;
        }
        
        this.updateSystemInfo(system);
    }
    
    updateSystemInfo(system) {
        const container = this.elements.systemInfo;
        
        if (!system) {
            container.innerHTML = '<p class="placeholder">悬停或点击星系查看详情</p>';
            return;
        }
        
        const securityClass = system.securityClass;
        const securityText = {
            'high': '高安',
            'low': '低安',
            'null': '00区'
        }[securityClass] || '未知';
        
        let html = `
            <div class="info-row">
                <span class="info-label">名称</span>
                <span class="info-value">${system.name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">安全等级</span>
                <span class="info-value ${securityClass}">${system.securityStatus.toFixed(2)} (${securityText})</span>
            </div>
        `;
        
        if (system.isBorder && system.borderConnections) {
            html += `
                <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value" style="color: #5ac75a;">入口星系</span>
                </div>
                <div class="info-row">
                    <span class="info-label">连接至</span>
                    <span class="info-value">
                        ${system.borderConnections.map(c => c.regionName).join(', ')}
                    </span>
                </div>
            `;
        }
        
        if (system.isExternal) {
            html += `
                <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value" style="color: #aaa;">相邻星域</span>
                </div>
                <div class="info-row">
                    <span class="info-label">所属星域</span>
                    <span class="info-value">${system.regionName || dataLoader.getRegionName(system.regionID)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">连接自</span>
                    <span class="info-value">${system.connectedFromName}</span>
                </div>
            `;
        }
        
        if (system.isHub) {
            html += `
                <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value" style="color: #ffdd44;">贸易中心</span>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    showLoading(show) {
        this.elements.loadingMask.classList.toggle('hidden', !show);
    }
    
    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = 'toast show';
        
        if (type === 'error') {
            toast.style.borderColor = '#ff4444';
            toast.style.color = '#ff8888';
        } else {
            toast.style.borderColor = '';
            toast.style.color = '';
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RegionalMapApp();
});
