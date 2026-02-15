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
            searchInput: document.getElementById('searchInput'),
            searchResults: document.getElementById('searchResults')
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
        
        // 搜索事件绑定
        this.bindSearchEvents();
    }
    
    bindSearchEvents() {
        const searchInput = this.elements.searchInput;
        const searchResults = this.elements.searchResults;
        
        let debounceTimer = null;
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            clearTimeout(debounceTimer);
            
            if (query.length < 2) {
                this.hideSearchResults();
                return;
            }
            
            debounceTimer = setTimeout(() => {
                this.performSearch(query);
            }, 200);
        });
        
        // 点击外部关闭搜索结果
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.system-search')) {
                this.hideSearchResults();
            }
        });
        
        // 键盘导航
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideSearchResults();
                searchInput.blur();
            }
        });
    }
    
    performSearch(query) {
        const results = this.searchSystems(query);
        this.renderSearchResults(results, query);
    }
    
    searchSystems(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        for (const system of dataLoader.systems.values()) {
            const nameMatch = system.name.toLowerCase().includes(lowerQuery);
            const nameEnMatch = system.nameEn && system.nameEn.toLowerCase().includes(lowerQuery);
            
            if (nameMatch || nameEnMatch) {
                const region = dataLoader.regions.get(system.regionID);
                results.push({
                    system: system,
                    regionName: region ? region.name : '未知星域'
                });
            }
            
            if (results.length >= 20) break; // 最多显示20个结果
        }
        
        return results;
    }
    
    renderSearchResults(results, query) {
        const container = this.elements.searchResults;
        
        if (results.length === 0) {
            container.innerHTML = '<div class="search-no-results">未找到匹配的星系</div>';
            container.classList.add('show');
            return;
        }
        
        container.innerHTML = '';
        
        for (const item of results) {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            
            const securityClass = item.system.securityClass;
            const securityText = item.system.securityStatus.toFixed(1);
            
            div.innerHTML = `
                <div class="system-name">
                    ${this.highlightMatch(item.system.name, query)}
                    <span class="security-badge ${securityClass}">${securityText}</span>
                </div>
                <div class="region-name">${item.regionName}</div>
            `;
            
            div.addEventListener('click', () => {
                this.selectSystem(item.system);
                this.hideSearchResults();
                this.elements.searchInput.value = '';
            });
            
            container.appendChild(div);
        }
        
        container.classList.add('show');
    }
    
    highlightMatch(text, query) {
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) return text;
        
        const before = text.slice(0, index);
        const match = text.slice(index, index + query.length);
        const after = text.slice(index + query.length);
        
        return `${before}<mark style="background: rgba(90, 143, 199, 0.4); color: inherit;">${match}</mark>${after}`;
    }
    
    hideSearchResults() {
        this.elements.searchResults.classList.remove('show');
    }
    
    selectSystem(system) {
        // 跳转到星系所在星域并居中显示
        this.selectRegion(system.regionID, system.id, true);
        this.showToast(`已定位到: ${system.name}`);
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
    
    selectRegion(regionId, selectSystemId = null, centerOnTarget = false) {
        if (this.currentRegionId === regionId && !selectSystemId) return;
        
        this.currentRegionId = regionId;
        this.pendingSelection = selectSystemId;
        this.pendingCenterOnTarget = centerOnTarget;
        
        this.elements.regionSelect.value = regionId;
        
        const data = dataLoader.getRegionData(regionId);
        if (!data) {
            this.showToast('无法加载星域数据', 'error');
            return;
        }
        
        // 如果需要居中目标，跳过初始的 fitToBounds
        this.renderer.setData(data, centerOnTarget);
        
        // 如果有待选中的星系，在渲染后选中它
        if (selectSystemId) {
            // 检查是否在外部星系中
            const externalSystem = data.externalSystems.find(s => s.id === selectSystemId);
            if (externalSystem) {
                this.renderer.setSelectedSystem(externalSystem);
                this.updateSystemInfo(externalSystem);
                if (centerOnTarget) {
                    this.renderer.centerOnSystem(externalSystem);
                }
            } else {
                // 在本星域中查找
                const system = data.systems.find(s => s.id === selectSystemId);
                if (system) {
                    this.renderer.setSelectedSystem(system);
                    this.updateSystemInfo(system);
                    if (centerOnTarget) {
                        this.renderer.centerOnSystem(system);
                    }
                }
            }
            this.pendingSelection = null;
            this.pendingCenterOnTarget = false;
        } else {
            this.updateSystemInfo(null);
        }
        
        this.showToast(`已切换到: ${data.region.name}`);
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
