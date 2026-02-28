/**
 * 主程序 - 应用程序入口 (原版)
 */

// 虫洞记录
// 虫洞类型列表
const WORMHOLE_TYPES = [
    'A009', 'A239', 'A641', 'A982', 'B041', 'B274', 'B449', 'B520', 'B735',
    'C008', 'C125', 'C140', 'C247', 'C248', 'C391', 'C414', 'C729', 'D364',
    'D382', 'D792', 'D845', 'E004', 'E175', 'E545', 'E587', 'F135', 'F216',
    'F355', 'G008', 'G024', 'H121', 'H296', 'H900', 'I182', 'J244', 'J377',
    'J492', 'K162', 'K329', 'K346', 'L005', 'L031', 'L477', 'L614', 'M001',
    'M164', 'M267', 'M555', 'M609', 'N062', 'N110', 'N290', 'N432', 'N766',
    'N770', 'N944', 'N968', 'O128', 'O477', 'O883', 'P060', 'Q003', 'Q063',
    'Q317', 'R051', 'R081', 'R259', 'R474', 'R943', 'S047', 'S199', 'S804',
    'S877', 'T405', 'T458', 'U210', 'U319', 'U372', 'U574', 'V283', 'V301',
    'V753', 'V898', 'V911', 'V928', 'W237', 'X450', 'X702', 'X877', 'Y683',
    'Y790', 'Z006', 'Z060', 'Z142', 'Z457', 'Z647', 'Z971'
];

class WormholeRecord {
    constructor(data) {
        // 数据来源标记: 'local' | 'evescout'
        this.source = data.source || 'local';
        
        // ID 生成
        if (this.source === 'evescout' && data.evescoutId) {
            this.id = `es-${data.evescoutId}`;
            this.evescoutId = data.evescoutId;
        } else {
            this.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
        
        this.fromSystem = data.fromSystem;
        this.toSystem = data.toSystem;
        this.fromSignal = data.fromSignal;
        this.toSignal = data.toSignal;
        this.type = data.type;
        this.size = data.size;
        this.maxLife = data.maxLife;
        
        // 记录时间（EVE Scout 数据使用服务器时间）
        this.recordTime = data.recordTime || Date.now();
        
        // 过期时间（EVE Scout 数据直接提供）
        if (data.expiresAt) {
            this.expiresAt = data.expiresAt;
        } else {
            const lifeHours = { '1h': 1, '4h': 4, '1d': 24, '2d': 48 };
            this.expiresAt = this.recordTime + (lifeHours[data.maxLife] || 24) * 60 * 60 * 1000;
        }
        
        // EVE Scout 特有字段
        if (this.source === 'evescout') {
            this.createdBy = data.createdBy;
            this.inSystemClass = data.inSystemClass;
            this.inRegionName = data.inRegionName;
            this.whExitsOutward = data.whExitsOutward;
        }
    }
    
    getRemainingTime() {
        const now = Date.now();
        const diff = this.expiresAt - now;
        
        if (diff <= 0) return '已过期';
        
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        
        if (hours >= 24) {
            return `${Math.floor(hours / 24)}天 ${hours % 24}小时`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes}分钟`;
        } else {
            return `${minutes}分钟`;
        }
    }
    
    getFormattedRecordTime() {
        const date = new Date(this.recordTime);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    getSourceLabel() {
        if (this.source === 'evescout') {
            return '🌐 ES';
        } else if (this.source === 'cloud') {
            return '☁️ 云端';
        }
        return '📝 本地';
    }
    
    getSourceTitle() {
        if (this.source === 'evescout') {
            return `EVE Scout · ${this.createdBy || '未知'}`;
        } else if (this.source === 'cloud') {
            return `云端共享 · ${this.createdBy || '未知'}`;
        }
        return '本地记录';
    }
    
    isEditable() {
        return this.source === 'local' || this.source === 'cloud';
    }
    
    getBookmarks() {
        const bookmarks = [];
        if (this.fromSignal && this.fromSignal !== '未知') {
            bookmarks.push({
                text: `${this.fromSignal} -> ${this.toSystem}`,
                copyText: `${this.fromSignal} -> ${this.toSystem}`
            });
        }
        if (this.toSignal && this.toSignal !== '未知') {
            bookmarks.push({
                text: `${this.toSignal} -> ${this.fromSystem}`,
                copyText: `${this.toSignal} -> ${this.fromSystem}`
            });
        }
        return bookmarks;
    }
    
    getKey() {
        return `${this.fromSystem}-${this.toSystem}-${this.type}`;
    }
    
    /**
     * 检查是否与另一个记录是同一虫洞（双向比较）
     * @param {WormholeRecord} other 
     * @returns {boolean}
     */
    isSameWormhole(other) {
        if (this.type !== other.type) return false;
        
        // 正向匹配
        const forwardMatch = this.fromSystem === other.fromSystem && 
                             this.toSystem === other.toSystem;
        
        // 反向匹配
        const reverseMatch = this.fromSystem === other.toSystem && 
                             this.toSystem === other.fromSystem;
        
        return forwardMatch || reverseMatch;
    }
}

// 路径记录器 - 记录唯一的无向连接（边）
class PathRecorder {
    constructor(maxDisplay = 6) {
        this.connections = new Map(); // 存储唯一的无向连接 key: "minId-maxId", value: {from, to, timestamp}
        this.currentSystem = null; // 当前所在星系
        this.allSystems = new Map(); // 所有访问过的星系（用于显示）
        this.visitOrder = []; // 访问顺序（用于路径面板显示）
        this.maxDisplay = maxDisplay;
    }
    
    addSystem(system) {
        if (!system) return;
        
        // 避免重复添加同一个星系（连续点击）
        if (this.currentSystem && this.currentSystem.id === system.id) return;
        
        // 记录星系访问
        const systemInfo = {
            id: system.id,
            name: system.name,
            regionID: system.regionID,
            timestamp: Date.now()
        };
        
        this.allSystems.set(system.id, systemInfo);
        this.visitOrder.push(systemInfo);
        
        // 如果有上一个星系，记录连接（无向，不重复）
        if (this.currentSystem) {
            const fromId = this.currentSystem.id;
            const toId = system.id;
            
            // 创建无向连接的唯一 key（小id在前，大id在后）
            const minId = Math.min(fromId, toId);
            const maxId = Math.max(fromId, toId);
            const key = `${minId}-${maxId}`;
            
            // 如果这条连接已存在，不重复记录
            if (!this.connections.has(key)) {
                this.connections.set(key, {
                    from: { ...this.currentSystem },
                    to: { 
                        id: system.id, 
                        name: system.name, 
                        regionID: system.regionID 
                    },
                    timestamp: Date.now()
                });
            }
        }
        
        // 更新当前星系
        this.currentSystem = systemInfo;
    }
    
    getDisplayPath() {
        // 返回所有访问过的星系
        return Array.from(this.allSystems.values());
    }
    
    getDisplayConnections() {
        // 返回所有唯一的连接
        return Array.from(this.connections.values());
    }
    
    getVisitOrder() {
        // 返回访问顺序（用于路径面板显示）
        return [...this.visitOrder];
    }
    
    clear() {
        this.connections.clear();
        this.allSystems.clear();
        this.visitOrder = [];
        this.currentSystem = null;
    }
    
    hasPath() {
        return this.allSystems.size > 0;
    }
}

class RegionalMapApp {
    constructor() {
        this.renderer = null;
        this.interaction = null;
        this.currentRegionId = null;
        this.pendingSelection = null;
        this.pathRecorder = new PathRecorder(6); // 路径记录器
        this.wormholeRecords = []; // 本地虫洞记录
        this.eveScoutRecords = []; // EVE Scout 虫洞记录
        this.cloudWormholeRecords = []; // 云端虫洞记录 (Supabase)
        this.detectedWormholes = new Set(); // 已检测到的虫洞，避免重复提示
        this.wormholeTimer = null; // 倒计时定时器
        this.wormholeFilter = 'all'; // 虫洞显示过滤器: 'all' | 'local' | 'cloud' | 'evescout'
        this.eveScoutRefreshTimer = null; // 自动刷新定时器
        this.supabaseSubscription = null; // Supabase 实时订阅
        
        this.elements = {
            regionSelect: document.getElementById('regionSelect'),
            loadingMask: document.getElementById('loadingMask'),
            toast: document.getElementById('toast'),
            systemInfo: document.querySelector('#systemInfo .info-content'),
            searchInput: document.getElementById('searchInput'),
            searchResults: document.getElementById('searchResults'),
            pathList: document.querySelector('#pathPanel .path-list'),
            pathPanel: document.getElementById('pathPanel'),
            wormholeTable: document.querySelector('#wormholePanel .wormhole-table'),
            wormholeTabs: null, // 将在初始化后设置
            refreshEveScoutBtn: null, // 将在初始化后设置
            lastUpdatedText: null // 将在初始化后设置
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
            this.initWormholePanel();
            
            // 初始化 Supabase 并加载云端数据
            this.initSupabase();
            
            // 加载 EVE Scout 数据（异步，不阻塞）
            this.loadEveScoutData();
            
            // 启动每分钟自动刷新 EVE Scout 数据
            this.startEveScoutAutoRefresh();
            
            // 启动每分钟刷新云端数据
            this.startCloudAutoRefresh();
            
            // 初始化角色跟随功能
            if (typeof this.initRoleFollow === 'function') {
                this.initRoleFollow();
            }
            
            // 默认选择耶舒尔 (Yeeshur) 所在星域并聚焦
            this.selectRegion(10000064, 30005008, true);
            
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
        
        // 侧面板拖动调整大小
        this.bindResizerEvents();
        
        // 页面卸载时清理定时器
        window.addEventListener('beforeunload', () => {
            this.stopEveScoutAutoRefresh();
        });
        
        // 绑定 EVE 登录按钮事件
        this.bindEveAuthEvents();
    }
    
    bindResizerEvents() {
        const resizer = document.getElementById('panelResizer');
        const sidePanel = document.getElementById('sidePanel');
        
        if (!resizer || !sidePanel) return;
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        const onMouseDown = (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidePanel.offsetWidth;
            
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; // 防止选择文本
            
            e.preventDefault();
        };
        
        const onMouseMove = (e) => {
            if (!isResizing) return;
            
            const diff = startX - e.clientX; // 向左拖动是增加宽度
            const newWidth = Math.max(260, Math.min(500, startWidth + diff));
            
            sidePanel.style.width = newWidth + 'px';
        };
        
        const onMouseUp = () => {
            if (!isResizing) return;
            
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // 触发 Canvas 重新调整大小
            if (this.renderer) {
                this.renderer.resize();
            }
        };
        
        resizer.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // 触摸设备支持
        resizer.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            onMouseDown({ clientX: touch.clientX, preventDefault: () => {} });
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isResizing) return;
            const touch = e.touches[0];
            onMouseMove({ clientX: touch.clientX });
        });
        
        document.addEventListener('touchend', onMouseUp);
    }
    
    /**
     * 绑定 EVE 认证事件
     */
    bindEveAuthEvents() {
        const eveLoginBtn = document.getElementById('eveLoginBtn');
        const logoutBtn = document.getElementById('eve-logout-btn');
        
        if (eveLoginBtn) {
            eveLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleEveLogin();
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleEveLogout();
            });
        }
        
        // 监听认证回调消息（浏览器环境）
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'EVE_AUTH_CALLBACK') {
                this.handleEveAuthCallback(event.data);
            }
        });
        
        // 监听 Electron 认证回调（Electron 环境）
        if (window.electronAPI && window.electronAPI.onEveAuthCallback) {
            window.electronAPI.onEveAuthCallback((data) => {
                console.log('[EVE Auth] Electron 回调数据:', data);
                if (data.success) {
                    this.handleEveAuthCallback({
                        type: 'EVE_AUTH_CALLBACK',
                        code: data.code,
                        state: data.state,
                        error: null
                    });
                } else {
                    this.handleEveAuthCallback({
                        type: 'EVE_AUTH_CALLBACK',
                        code: null,
                        state: null,
                        error: data.error
                    });
                }
            });
        }
    }
    
    /**
     * 处理 EVE 登录
     */
    async handleEveLogin() {
        if (typeof EveAuthService === 'undefined') {
            this.showToast('EVE 认证服务未加载', 'error');
            return;
        }
        
        this.eveAuth = new EveAuthService();
        
        try {
            // 检测是否在 Electron 环境
            const isElectron = window.electronAPI && window.electronAPI.isElectron;
            
            if (isElectron) {
                // Electron 环境：使用本地服务器接收回调（端口5525）
                this.eveAuth.redirectUri = 'http://localhost:5525/callback';
                console.log('[EVE Auth] Electron 模式，回调 URL:', this.eveAuth.redirectUri);
            } else {
                // 浏览器环境：使用当前页面 origin
                const currentOrigin = window.location.origin;
                this.eveAuth.redirectUri = currentOrigin + '/callback.html';
                console.log('[EVE Auth] 浏览器模式，回调 URL:', this.eveAuth.redirectUri);
            }
            
            const authUrl = await this.eveAuth.buildAuthUrl();
            
            console.log('[EVE Auth] 授权 URL:', authUrl);
            
            // 存储 PKCE 参数
            sessionStorage.setItem('eve_code_verifier', this.eveAuth.codeVerifier);
            sessionStorage.setItem('eve_state', this.eveAuth.state);
            
            if (isElectron) {
                // Electron: 使用 IPC 触发认证
                this.showToast('正在打开浏览器进行 EVE 登录...');
                window.electronAPI.startEveAuth(authUrl);
            } else {
                // 浏览器: 打开弹窗
                window.open(authUrl, 'eve-auth', 'width=800,height=600');
                this.showToast('请在弹出窗口中完成 EVE 登录');
            }
        } catch (error) {
            console.error('[App] EVE 登录错误:', error);
            this.showToast('EVE 登录失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 处理 EVE 认证回调
     */
    async handleEveAuthCallback(data) {
        const { code, state, error } = data;
        
        if (error) {
            this.showToast('EVE 认证失败: ' + error, 'error');
            return;
        }
        
        // 验证 state
        const savedState = sessionStorage.getItem('eve_state');
        if (state !== savedState) {
            this.showToast('State 验证失败，可能存在 CSRF 攻击', 'error');
            return;
        }
        
        // 恢复 PKCE 参数
        this.eveAuth.codeVerifier = sessionStorage.getItem('eve_code_verifier');
        this.eveAuth.state = state;
        
        try {
            this.showToast('正在完成认证...');
            
            // 换取 token
            await this.eveAuth.exchangeCodeForToken(code);
            
            // 获取角色信息
            const characterInfo = await this.eveAuth.getCharacterInfo();
            
            // 设置联盟认证
            const isAuthorized = supabaseService.setAllianceAuth(characterInfo);
            
            if (isAuthorized) {
                this.showToast(`欢迎, ${characterInfo.name}!联盟认证通过`);
                this.updateCloudAuthUI(characterInfo);
                
                // 加载云端数据
                this.loadCloudWormholes();
                this.subscribeToCloudWormholes();
            } else {
                this.showToast('该角色不属于目标联盟，无法访问云端', 'error');
                this.updateCloudAuthUI(characterInfo, false);
            }
            
            // 清理 sessionStorage
            sessionStorage.removeItem('eve_code_verifier');
            sessionStorage.removeItem('eve_state');
            
        } catch (error) {
            console.error('[App] EVE 认证处理错误:', error);
            this.showToast('认证失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 更新云端认证 UI
     */
    updateCloudAuthUI(characterInfo, authorized = true) {
        const loginBtn = document.getElementById('eveLoginBtn');
        const statusDiv = document.getElementById('eve-auth-status');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (statusDiv) {
            statusDiv.style.display = 'flex';
            
            // 设置头像
            const avatar = document.getElementById('eve-auth-avatar');
            if (avatar) {
                avatar.src = `https://images.evetech.net/characters/${characterInfo.character_id}/portrait?size=64`;
            }
            
            // 设置角色名
            const nameDiv = document.getElementById('eve-auth-name');
            if (nameDiv) {
                nameDiv.textContent = characterInfo.name;
            }
            
            // 设置联盟状态标签
            const tagSpan = document.getElementById('eve-auth-tag');
            if (tagSpan) {
                if (authorized) {
                    tagSpan.textContent = '✓ 联盟认证通过';
                    tagSpan.style.color = 'var(--accent-green)';
                } else {
                    tagSpan.textContent = '✗ 非目标联盟';
                    tagSpan.style.color = 'var(--accent-red)';
                }
            }
        }
    }
    
    /**
     * 处理 EVE 退出登录
     */
    handleEveLogout() {
        supabaseService.clearAuth();
        this.eveAuth = null;
        
        // 重置 UI
        const loginBtn = document.getElementById('eveLoginBtn');
        const statusDiv = document.getElementById('eve-auth-status');
        
        if (loginBtn) loginBtn.style.display = 'block';
        if (statusDiv) statusDiv.style.display = 'none';
        
        this.showToast('已退出登录');
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
        
        // 搜索 K-Space 星系
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
            
            if (results.length >= 20) break;
        }
        
        // 搜索虫洞星系（如果还有空间）
        if (results.length < 20) {
            for (const system of dataLoader.wormholeSystems.values()) {
                const nameMatch = system.name.toLowerCase().includes(lowerQuery);
                const nameEnMatch = system.nameEn && system.nameEn.toLowerCase().includes(lowerQuery);
                
                if (nameMatch || nameEnMatch) {
                    results.push({
                        system: system,
                        regionName: '虫洞星系',
                        isWormhole: true
                    });
                }
                
                if (results.length >= 20) break;
            }
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
            
            // 虫洞星系特殊显示
            if (item.isWormhole) {
                div.innerHTML = `
                    <div class="system-name">
                        ${this.highlightMatch(item.system.name, query)}
                        <span class="security-badge wormhole">J</span>
                    </div>
                    <div class="region-name">虫洞星系</div>
                `;
            } else {
                const securityClass = item.system.securityClass;
                const securityText = item.system.securityStatus.toFixed(1);
                
                div.innerHTML = `
                    <div class="system-name">
                        ${this.highlightMatch(item.system.name, query)}
                        <span class="security-badge ${securityClass}">${securityText}</span>
                    </div>
                    <div class="region-name">${item.regionName}</div>
                `;
            }
            
            div.addEventListener('click', () => {
                if (item.isWormhole) {
                    this.selectWormholeSystem(item.system);
                } else {
                    this.selectSystem(item.system);
                }
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
    
    selectWormholeSystem(system) {
        // 切换到虫洞星域视图
        this.currentRegionId = `wormhole-${system.id}`;
        this.elements.regionSelect.value = '';
        
        // 获取虫洞星域数据
        let data = dataLoader.getWormholeRegionData(system.id);
        if (!data) {
            this.showToast('无法加载虫洞星系数据', 'error');
            return;
        }
        
        // 获取与该虫洞连接的 K-Space 星系（从路径记录中）
        const connectedKSpace = this.getConnectedKSpaceSystems(system.id);
        
        if (connectedKSpace.length > 0) {
            // 构建外部连接
            const { externalSystems, externalConnections } = dataLoader.buildWormholeExternalConnections(
                system.id,
                connectedKSpace
            );
            data.externalSystems = externalSystems;
            data.externalConnections = externalConnections;
        }
        
        // 设置数据并渲染（使用 fitToBounds 计算合适的缩放）
        this.renderer.setData(data, false); // false = 使用 fitToBounds
        this.renderer.setSelectedSystem(data.systems[0]);
        
        // 居中显示（不传 zoomLevel，使用 fitToBounds 计算出的 zoom）
        this.renderer.centerOnSystem(data.systems[0]);
        
        this.showToast(`已定位到虫洞星系: ${system.name}`);
        this.updateSystemInfo(data.systems[0]);
    }
    
    getConnectedKSpaceSystems(wormholeId) {
        // 从路径记录中获取与虫洞连接的 K-Space 星系
        const connections = this.pathRecorder.getDisplayConnections();
        const connected = [];
        
        for (const conn of connections) {
            if (conn.from.id === wormholeId && conn.to.id < 31000000) {
                const kspaceSystem = dataLoader.systems.get(conn.to.id);
                if (kspaceSystem) {
                    connected.push({
                        system: kspaceSystem,
                        signal: '未知' // 可以从虫洞记录中获取
                    });
                }
            } else if (conn.to.id === wormholeId && conn.from.id < 31000000) {
                const kspaceSystem = dataLoader.systems.get(conn.from.id);
                if (kspaceSystem) {
                    connected.push({
                        system: kspaceSystem,
                        signal: '未知'
                    });
                }
            }
        }
        
        return connected;
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
        const canvas = this.mapRenderer?.canvas;
        if (!canvas) return;
        
        if (system && system.isExternal) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'default';
        }
    }
    
    onSystemSelect(system) {
        if (!system) {
            this.updateSystemInfo(null);
            return;
        }
        
        // 如果点击的是虫洞星系，切换到虫洞视图
        if (system.isWormhole || system.id >= 31000000) {
            this.selectWormholeSystem(system);
            // 注：点击不再自动记录路径，仅通过角色跟随记录
            // this.pathRecorder.addSystem(system);
            // this.updatePathPanel();
            // this.renderer.setPathData(this.pathRecorder.getDisplayPath(), this.pathRecorder.getDisplayConnections());
            // this.detectWormholes();
            return;
        }
        
        // 注：点击不再自动记录路径，仅通过角色跟随记录
        // this.pathRecorder.addSystem(system);
        // this.updatePathPanel();
        // this.renderer.setPathData(this.pathRecorder.getDisplayPath(), this.pathRecorder.getDisplayConnections());
        
        // 检测新形成的虫洞连接
        // this.detectWormholes();
        
        // 如果点击的是外部星系，跳转到该星域并选中该星系（居中显示）
        if (system.isExternal) {
            const targetRegionId = system.regionID;
            const targetSystemId = system.id;
            
            this.showToast(`正在跳转到 ${system.name}...`);
            this.selectRegion(targetRegionId, targetSystemId, true);
            return;
        }
        
        this.updateSystemInfo(system);
    }
    
    detectWormholes() {
        const connections = this.pathRecorder.getDisplayConnections();
        const allSystems = this.pathRecorder.getDisplayPath();
        
        for (const conn of connections) {
            const key = `${conn.from.id}-${conn.to.id}`;
            const reverseKey = `${conn.to.id}-${conn.from.id}`;
            
            if (this.detectedWormholes.has(key) || this.detectedWormholes.has(reverseKey)) {
                continue; // 已检测过
            }
            
            // 检查是否是虫洞连接（无星门连接）
            const hasStargate = dataLoader.connections.get(conn.from.id)?.includes(conn.to.id);
            
            if (!hasStargate) {
                // 发现新虫洞
                this.detectedWormholes.add(key);
                this.showWormholeDialog(conn.from, conn.to);
            }
        }
    }
    
    showWormholeDialog(fromSystem, toSystem) {
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'wormhole-dialog';
        dialog.innerHTML = `
            <div class="wormhole-dialog-content">
                <h3>发现虫洞连接</h3>
                <p>${fromSystem.name} ↔ ${toSystem.name}</p>
                <div class="wormhole-form">
                    <div class="form-row">
                        <label>虫洞类型:</label>
                        <div class="wh-type-search">
                            <input type="text" id="wh-type-input" value="K162" placeholder="输入类型搜索..." autocomplete="off">
                            <div class="wh-type-dropdown" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="form-row">
                        <label>${fromSystem.name} 信号:</label>
                        <input type="text" id="wh-from-signal" placeholder="ABC-123" maxlength="10">
                    </div>
                    <div class="form-row">
                        <label>${toSystem.name} 信号:</label>
                        <input type="text" id="wh-to-signal" placeholder="XYZ-789" maxlength="10">
                    </div>
                    <div class="form-row">
                        <label>虫洞大小:</label>
                        <select id="wh-size">
                            <option value="S">S (护卫舰)</option>
                            <option value="M">M (巡洋舰)</option>
                            <option value="L">L (战列舰)</option>
                            <option value="XL">XL (旗舰)</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>最大寿命:</label>
                        <select id="wh-life">
                            <option value="1h">1小时</option>
                            <option value="4h">4小时</option>
                            <option value="1d" selected>1天</option>
                            <option value="2d">2天</option>
                        </select>
                    </div>
                </div>
                <div class="wormhole-dialog-buttons">
                    <button class="btn-cancel">取消</button>
                    <button class="btn-save">记录虫洞</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 类型搜索功能
        const typeInput = dialog.querySelector('#wh-type-input');
        const typeDropdown = dialog.querySelector('.wh-type-dropdown');
        
        const filterTypes = (query) => {
            const filtered = WORMHOLE_TYPES.filter(t => 
                t.toLowerCase().includes(query.toLowerCase())
            );
            return filtered.slice(0, 10); // 最多显示10个
        };
        
        const showDropdown = () => {
            const filtered = filterTypes(typeInput.value);
            typeDropdown.innerHTML = filtered.map(t => 
                `<div class="wh-type-option" data-value="${t}">${t}</div>`
            ).join('');
            typeDropdown.style.display = filtered.length > 0 ? 'block' : 'none';
            
            // 绑定选项点击
            typeDropdown.querySelectorAll('.wh-type-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    typeInput.value = opt.dataset.value;
                    typeDropdown.style.display = 'none';
                });
            });
        };
        
        typeInput.addEventListener('input', showDropdown);
        typeInput.addEventListener('focus', showDropdown);
        
        // 点击外部关闭下拉
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.wh-type-search')) {
                typeDropdown.style.display = 'none';
            }
        });
        
        // 绑定按钮事件
        dialog.querySelector('.btn-cancel').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('.btn-save').addEventListener('click', () => {
            const type = typeInput.value.toUpperCase();
            // 验证类型
            if (!WORMHOLE_TYPES.includes(type)) {
                this.showToast('请输入有效的虫洞类型', 'error');
                return;
            }
            
            const fromSignal = dialog.querySelector('#wh-from-signal').value || '未知';
            const toSignal = dialog.querySelector('#wh-to-signal').value || '未知';
            const size = dialog.querySelector('#wh-size').value;
            const maxLife = dialog.querySelector('#wh-life').value;
            
            const record = new WormholeRecord({
                fromSystem: fromSystem.name,
                toSystem: toSystem.name,
                fromSignal,
                toSignal,
                type,
                size,
                maxLife
            });
            
            this.wormholeRecords.push(record);
            this.updateWormholeTable();
            this.startWormholeTimer();
            dialog.remove();
            this.showToast('虫洞已记录');
        });
    }
    
    // ========== EVE Scout 集成方法 ==========
    
    /**
     * 初始化虫洞面板 UI
     */
    initWormholePanel() {
        const panel = document.getElementById('wormholePanel');
        if (!panel) return;
        
        // 创建面板头部（标签和刷新按钮）
        const header = document.createElement('div');
        header.className = 'wormhole-panel-header';
        header.innerHTML = `
            <div class="wormhole-tabs">
                <button class="wh-tab active" data-filter="all">全部</button>
                <button class="wh-tab" data-filter="local">本地</button>
                <button class="wh-tab" data-filter="cloud">云端</button>
                <button class="wh-tab" data-filter="evescout">EVE Scout</button>
            </div>
            <div class="wormhole-actions">
                <button id="addCloudWormhole" class="btn-refresh" title="手动添加虫洞">+</button>
                <button id="syncToCloud" class="btn-refresh" title="同步到云端">☁️</button>
                <button id="refreshEveScout" class="btn-refresh" title="刷新 EVE Scout 数据">🔄</button>
                <span id="lastUpdated" class="last-updated"></span>
            </div>
        `;
        
        // 插入到面板标题后面
        const title = panel.querySelector('h3');
        if (title) {
            title.after(header);
        } else {
            panel.insertBefore(header, panel.firstChild);
        }
        
        // 更新元素引用
        this.elements.wormholeTabs = header.querySelector('.wormhole-tabs');
        this.elements.refreshEveScoutBtn = header.querySelector('#refreshEveScout');
        this.elements.lastUpdatedText = header.querySelector('#lastUpdated');
        
        // 绑定标签切换事件
        this.elements.wormholeTabs.querySelectorAll('.wh-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.elements.wormholeTabs.querySelectorAll('.wh-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.wormholeFilter = tab.dataset.filter;
                this.updateWormholeTable();
            });
        });
        
        // 绑定刷新按钮
        this.elements.refreshEveScoutBtn.addEventListener('click', () => {
            this.refreshEveScoutData();
        });
        
        // 绑定同步到云端按钮
        const syncBtn = header.querySelector('#syncToCloud');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                this.syncToCloud();
            });
        }
        
        // 绑定手动添加虫洞按钮
        const addBtn = header.querySelector('#addCloudWormhole');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddCloudWormholeDialog();
            });
        }
    }
    
    /**
     * 获取过滤后的虫洞记录列表
     */
    getFilteredWormholeRecords() {
        let records = [];
        
        switch (this.wormholeFilter) {
            case 'local':
                records = this.wormholeRecords;
                break;
            case 'cloud':
                records = this.cloudWormholeRecords;
                break;
            case 'evescout':
                records = this.eveScoutRecords;
                break;
            case 'all':
            default:
                // 合并所有数据源（本地、云端、EVE Scout）
                records = this.mergeAllWormholeRecords();
                break;
        }
        
        return records;
    }
    
    /**
     * 合并本地和 EVE Scout 记录，去除重复（以本地记录优先）
     */
    mergeWormholeRecords(localRecords, esRecords) {
        const merged = [...localRecords];
        const localKeys = new Set(localRecords.map(r => r.getKey()));
        
        for (const esRecord of esRecords) {
            // 检查是否已存在相同的本地记录
            const isDuplicate = localKeys.has(esRecord.getKey()) ||
                localRecords.some(local => local.isSameWormhole(esRecord));
            
            if (!isDuplicate) {
                merged.push(esRecord);
            }
        }
        
        return merged;
    }
    
    /**
     * 合并所有数据源的虫洞记录
     * 优先级：本地 > 云端 > EVE Scout
     */
    mergeAllWormholeRecords() {
        const merged = [];
        const keys = new Set();
        
        // 1. 先添加本地记录（最高优先级）
        for (const record of this.wormholeRecords) {
            const key = record.getKey();
            if (!keys.has(key)) {
                merged.push(record);
                keys.add(key);
            }
        }
        
        // 2. 添加云端记录
        for (const record of this.cloudWormholeRecords) {
            const key = record.getKey();
            // 检查是否与本地记录重复
            const isDuplicate = this.wormholeRecords.some(local => 
                local.isSameWormhole(record) || local.getKey() === key
            );
            if (!isDuplicate && !keys.has(key)) {
                merged.push(record);
                keys.add(key);
            }
        }
        
        // 3. 添加 EVE Scout 记录（最低优先级）
        for (const record of this.eveScoutRecords) {
            const key = record.getKey();
            // 检查是否与本地或云端记录重复
            const isDuplicate = this.wormholeRecords.some(local => local.isSameWormhole(record)) ||
                this.cloudWormholeRecords.some(cloud => cloud.isSameWormhole(record)) ||
                keys.has(key);
            
            if (!isDuplicate) {
                merged.push(record);
                keys.add(key);
            }
        }
        
        return merged;
    }
    
    /**
     * 加载 EVE Scout 数据
     */
    async loadEveScoutData() {
        try {
            if (typeof eveScoutService === 'undefined') {
                console.warn('[App] EVE Scout 服务不可用');
                return;
            }
            
            const records = await eveScoutService.getWormholeRecords();
            this.eveScoutRecords = records.map(data => new WormholeRecord(data));
            
            this.updateLastUpdatedText();
            this.updateWormholeTable();
            
            console.log(`[App] 加载了 ${this.eveScoutRecords.length} 条 EVE Scout 记录`);
            
        } catch (error) {
            console.error('[App] 加载 EVE Scout 数据失败:', error);
            this.showToast('EVE Scout 数据加载失败', 'error');
        }
    }
    
    /**
     * 刷新 EVE Scout 数据
     */
    async refreshEveScoutData() {
        if (typeof eveScoutService === 'undefined') {
            this.showToast('EVE Scout 服务不可用', 'error');
            return;
        }
        
        this.elements.refreshEveScoutBtn.classList.add('spinning');
        
        try {
            eveScoutService.clearCache();
            await this.loadEveScoutData();
            this.showToast('EVE Scout 数据已刷新');
        } catch (error) {
            this.showToast('刷新失败: ' + error.message, 'error');
        } finally {
            this.elements.refreshEveScoutBtn.classList.remove('spinning');
        }
    }
    
    /**
     * 启动 EVE Scout 自动刷新（每分钟）
     */
    startEveScoutAutoRefresh() {
        // 清除已有的定时器
        if (this.eveScoutRefreshTimer) {
            clearInterval(this.eveScoutRefreshTimer);
        }
        
        // 每分钟自动刷新
        this.eveScoutRefreshTimer = setInterval(() => {
            console.log('[App] 自动刷新 EVE Scout 数据...');
            this.loadEveScoutData();
        }, 60 * 1000); // 60秒 = 1分钟
        
        console.log('[App] EVE Scout 自动刷新已启动（每分钟）');
    }
    
    /**
     * 停止 EVE Scout 自动刷新
     */
    stopEveScoutAutoRefresh() {
        if (this.eveScoutRefreshTimer) {
            clearInterval(this.eveScoutRefreshTimer);
            this.eveScoutRefreshTimer = null;
            console.log('[App] EVE Scout 自动刷新已停止');
        }
    }
    
    /**
     * 更新最后更新时间显示
     */
    updateLastUpdatedText() {
        if (!this.elements.lastUpdatedText) return;
        
        if (typeof eveScoutService !== 'undefined') {
            const status = eveScoutService.getCacheStatus();
            if (status.hasCache) {
                this.elements.lastUpdatedText.textContent = status.ageText;
                this.elements.lastUpdatedText.title = `共 ${status.count} 条记录`;
            } else {
                this.elements.lastUpdatedText.textContent = '未更新';
            }
        }
    }
    
    // ========== 虫洞表格更新 ==========
    
    updateWormholeTable() {
        const container = this.elements.wormholeTable;
        if (!container) return;
        
        const records = this.getFilteredWormholeRecords();
        
        if (records.length === 0) {
            const emptyText = this.wormholeFilter === 'evescout' 
                ? '暂无 EVE Scout 虫洞记录' 
                : '暂无虫洞记录';
            container.innerHTML = `<p class="placeholder">${emptyText}</p>`;
            return;
        }
        
        let html = `
            <table class="wormhole-data-table">
                <thead>
                    <tr>
                        <th>起点↔终点</th>
                        <th>大小</th>
                        <th>书签名</th>
                        <th>剩余时间</th>
                        <th>类型</th>
                        <th>来源</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        records.forEach((record, index) => {
            // 调试：输出记录信息
            console.log('[Table] 虫洞记录:', {
                fromSystem: record.fromSystem,
                toSystem: record.toSystem,
                source: record.source,
                type: typeof record.fromSystem
            });
            
            const remaining = record.getRemainingTime();
            const expired = remaining === '已过期';
            const bookmarks = record.getBookmarks();
            const sourceLabel = record.getSourceLabel();
            const sourceTitle = record.getSourceTitle();
            const isEditable = record.isEditable();
            
            let bookmarksHtml = '';
            if (bookmarks.length > 0) {
                bookmarksHtml = bookmarks.map((bm, i) => 
                    `<span class="bookmark-tag" data-copy="${bm.copyText}" title="点击复制">${bm.text}</span>`
                ).join('<br>');
            } else {
                bookmarksHtml = '<span class="bookmark-tag-empty">无信号</span>';
            }
            
            // 操作按钮（本地记录可编辑/删除，EVE Scout 只读）
            let actionButtons = '';
            if (isEditable) {
                actionButtons = `
                    <button class="btn-edit-wh" data-record-id="${record.id}" data-source="${record.source}">编辑</button>
                    <button class="btn-delete-wh" data-record-id="${record.id}" data-source="${record.source}">删除</button>
                `;
            } else {
                actionButtons = `<span class="readonly-tag" title="${sourceTitle}">只读</span>`;
            }
            
            html += `
                <tr class="${expired ? 'expired' : ''} ${record.source}">
                    <td>${record.fromSystem}↔${record.toSystem}</td>
                    <td>${record.size}</td>
                    <td class="bookmarks-cell">${bookmarksHtml}</td>
                    <td class="remaining-time">${remaining}</td>
                    <td>${record.type}</td>
                    <td title="${sourceTitle}">${sourceLabel}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // 绑定书签名点击复制
        container.querySelectorAll('.bookmark-tag').forEach(tag => {
            tag.addEventListener('click', async () => {
                const text = tag.dataset.copy;
                try {
                    await navigator.clipboard.writeText(text);
                    this.showToast('已复制: ' + text);
                } catch (err) {
                    // 降级方案
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    this.showToast('已复制: ' + text);
                }
            });
        });
        
        // 绑定删除按钮（本地和云端记录）
        container.querySelectorAll('.btn-delete-wh').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recordId = e.target.dataset.recordId;
                const source = e.target.dataset.source;
                
                if (source === 'evescout') return; // EVE Scout 记录不可删除
                
                if (source === 'cloud') {
                    // 删除云端记录
                    const success = await supabaseService.deleteWormhole(recordId);
                    if (success) {
                        this.showToast('云端虫洞已删除');
                        // 从本地缓存中移除
                        const index = this.cloudWormholeRecords.findIndex(r => r.id === recordId);
                        if (index !== -1) {
                            this.cloudWormholeRecords.splice(index, 1);
                            this.updateWormholeTable();
                        }
                    } else {
                        this.showToast('删除失败', 'error');
                    }
                } else {
                    // 删除本地记录
                    const index = this.wormholeRecords.findIndex(r => r.id === recordId);
                    if (index !== -1) {
                        this.wormholeRecords.splice(index, 1);
                        this.updateWormholeTable();
                    }
                }
            });
        });
        
        // 绑定编辑按钮（仅本地记录）
        container.querySelectorAll('.btn-edit-wh').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recordId = e.target.dataset.recordId;
                const source = e.target.dataset.source;
                
                if (source === 'evescout') return; // EVE Scout 记录不可编辑
                
                // 通过 ID 查找
                const index = this.wormholeRecords.findIndex(r => r.id === recordId);
                if (index !== -1) {
                    this.editWormhole(index);
                }
            });
        });
    }
    
    editWormhole(index) {
        const record = this.wormholeRecords[index];
        if (!record) return;
        
        // 创建编辑对话框
        const dialog = document.createElement('div');
        dialog.className = 'wormhole-dialog';
        dialog.innerHTML = `
            <div class="wormhole-dialog-content">
                <h3>编辑虫洞</h3>
                <div class="wormhole-form">
                    <div class="form-row">
                        <label>虫洞类型:</label>
                        <input type="text" id="edit-wh-type" value="${record.type}" placeholder="例如: C247" maxlength="6">
                    </div>
                    <div class="form-row">
                        <label>起点信号:</label>
                        <input type="text" id="edit-wh-from-signal" value="${record.fromSignal || ''}" placeholder="ABC-123" maxlength="10">
                    </div>
                    <div class="form-row">
                        <label>终点信号:</label>
                        <input type="text" id="edit-wh-to-signal" value="${record.toSignal || ''}" placeholder="ABC-123" maxlength="10">
                    </div>
                    <div class="form-row">
                        <label>虫洞大小:</label>
                        <select id="edit-wh-size">
                            <option value="S" ${record.size === 'S' ? 'selected' : ''}>S (小型)</option>
                            <option value="M" ${record.size === 'M' ? 'selected' : ''}>M (中型)</option>
                            <option value="L" ${record.size === 'L' ? 'selected' : ''}>L (大型)</option>
                            <option value="XL" ${record.size === 'XL' ? 'selected' : ''}>XL (超大型)</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>最大寿命:</label>
                        <select id="edit-wh-life">
                            <option value="1h" ${record.maxLife === '1h' ? 'selected' : ''}>1小时</option>
                            <option value="4h" ${record.maxLife === '4h' ? 'selected' : ''}>4小时</option>
                            <option value="1d" ${record.maxLife === '1d' ? 'selected' : ''}>1天</option>
                            <option value="2d" ${record.maxLife === '2d' ? 'selected' : ''}>2天</option>
                        </select>
                    </div>
                </div>
                <div class="wormhole-dialog-buttons">
                    <button class="btn-save">保存</button>
                    <button class="btn-cancel">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 绑定保存按钮
        dialog.querySelector('.btn-save').addEventListener('click', () => {
            const type = document.getElementById('edit-wh-type').value.trim().toUpperCase();
            // 验证
            if (!type || !/^[A-Z0-9]{4,6}$/.test(type)) {
                this.showToast('请输入有效的虫洞类型', 'error');
                return;
            }
            
            const fromSignal = document.getElementById('edit-wh-from-signal').value.trim();
            const toSignal = document.getElementById('edit-wh-to-signal').value.trim();
            const size = document.getElementById('edit-wh-size').value;
            const maxLife = document.getElementById('edit-wh-life').value;
            
            // 更新记录
            record.type = type;
            record.fromSignal = fromSignal || '未知';
            record.toSignal = toSignal || '未知';
            record.size = size;
            record.maxLife = maxLife;
            // 重新计算过期时间
            const lifeHours = { '1h': 1, '4h': 4, '1d': 24, '2d': 48 };
            record.expiresAt = record.recordTime + (lifeHours[maxLife] || 24) * 60 * 60 * 1000;
            
            document.body.removeChild(dialog);
            this.updateWormholeTable();
            this.showToast('虫洞已更新');
        });
        
        // 绑定取消按钮
        dialog.querySelector('.btn-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });
    }
    
    startWormholeTimer() {
        if (this.wormholeTimer) return;
        
        this.wormholeTimer = setInterval(() => {
            this.updateWormholeTable();
        }, 60000); // 每分钟更新一次
    }
    
    updatePathPanel() {
        const container = this.elements.pathList;
        const visitOrder = this.pathRecorder.getVisitOrder();
        
        if (visitOrder.length === 0) {
            container.innerHTML = '<p class="placeholder">点击星系记录路径</p>';
            return;
        }
        
        let html = '';
        visitOrder.forEach((item, index) => {
            const isInDisplay = index >= visitOrder.length - this.pathRecorder.maxDisplay;
            const displayClass = isInDisplay ? 'path-item-display' : 'path-item-history';
            const number = index + 1;
            
            html += `
                <div class="path-item ${displayClass}" data-system-id="${item.id}" data-region-id="${item.regionID}">
                    <span class="path-number">${number}</span>
                    <span class="path-name">${item.name}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // 绑定点击事件 - 聚焦到星系
        container.querySelectorAll('.path-item').forEach(item => {
            item.addEventListener('click', () => {
                const systemId = parseInt(item.dataset.systemId);
                const regionId = parseInt(item.dataset.regionId);
                this.focusOnSystem(regionId, systemId);
            });
        });
        
        // 滚动到最新
        if (container.lastElementChild) {
            container.lastElementChild.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    focusOnSystem(regionId, systemId) {
        // 检测是否是虫洞星系
        if (systemId >= 31000000) {
            const wormholeSystem = dataLoader.wormholeSystems.get(systemId);
            if (wormholeSystem) {
                this.selectWormholeSystem(wormholeSystem);
            }
            return;
        }
        
        // 如果不在当前星域，先切换星域
        if (this.currentRegionId !== regionId) {
            this.selectRegion(regionId, systemId, true);
        } else {
            // 在当前星域，直接居中
            const data = dataLoader.getRegionData(regionId);
            if (data) {
                const system = data.systems.find(s => s.id === systemId) || 
                              data.externalSystems.find(s => s.id === systemId);
                if (system) {
                    this.renderer.setSelectedSystem(system);
                    this.renderer.centerOnSystem(system);
                    this.updateSystemInfo(system);
                }
            }
        }
    }
    
    clearPath() {
        this.pathRecorder.clear();
        this.updatePathPanel();
        this.renderer.setPathData([], []);
        this.showToast('路径已清除');
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
    
    // ========== Supabase 云端集成 ==========
    
    /**
     * 初始化 Supabase
     */
    initSupabase() {
        if (typeof supabaseService === 'undefined') {
            console.warn('[App] supabaseService 未加载');
            return;
        }
        
        // 使用项目配置的 Supabase 连接信息
        const supabaseUrl = 'https://nvwmogsgkbllkxebvzcg.supabase.co';
        const supabaseKey = '[REMOVED_SUPABASE_KEY]';
        
        const success = supabaseService.init(supabaseUrl, supabaseKey);
        
        if (success) {
            console.log('[App] Supabase 初始化成功');
            
            // 检查是否已通过 EVE 联盟认证
            if (supabaseService.isAuthorized()) {
                console.log('[App] 已通过联盟认证，加载云端数据');
                this.loadCloudWormholes();
                this.subscribeToCloudWormholes();
            } else {
                console.log('[App] 未通过联盟认证，显示登录提示');
                this.showCloudAuthPrompt();
            }
        } else {
            console.warn('[App] Supabase 初始化失败');
        }
    }
    
    /**
     * 显示云端认证提示
     */
    showCloudAuthPrompt() {
        const container = document.getElementById('cloud-auth-prompt');
        if (container) {
            container.style.display = 'block';
        }
    }
    
    /**
     * 加载云端虫洞数据
     */
    async loadCloudWormholes() {
        if (!supabaseService.initialized) return;
        
        console.log('[App] 加载云端虫洞数据...');
        const records = await supabaseService.getActiveWormholes();
        
        // 调试：输出原始数据
        if (records.length > 0) {
            console.log('[App] 云端数据样例:', {
                fromSystemName: records[0].fromSystemName,
                toSystemName: records[0].toSystemName,
                size: records[0].size,
                source: records[0].source
            });
        }
        
        // 转换为 WormholeRecord 对象（字段需要与本地格式一致）
        this.cloudWormholeRecords = records.map(data => {
            const record = new WormholeRecord({
                fromSystem: data.fromSystemName || '未知',
                toSystem: data.toSystemName || '未知',
                fromSignal: data.fromSignal || '',
                toSignal: data.toSignal || '',
                type: '',
                size: data.size,
                maxLife: data.lifetime ? Math.round(data.lifetime / 60) + 'h' : '1d',
                expiresAt: new Date(data.expiresAt).getTime(),
                source: 'cloud',
                createdBy: data.createdBy,
                recordTime: new Date(data.createdAt).getTime()
            });
            // 保留云端 ID 用于删除
            record.id = data.id;
            return record;
        });
        
        console.log('[App] 加载了', this.cloudWormholeRecords.length, '条云端虫洞');
        this.updateWormholeTable();
    }
    
    /**
     * 订阅云端虫洞变化
     */
    subscribeToCloudWormholes() {
        if (!supabaseService.initialized) return;
        
        this.supabaseSubscription = supabaseService.subscribeToWormholes({
            onInsert: (data) => {
                console.log('[App] 云端新虫洞:', data);
                this.showToast(`新虫洞: ${data.fromSystemName} → ${data.toSystemName}`);
                this.loadCloudWormholes(); // 重新加载所有数据
            },
            onUpdate: (data) => {
                console.log('[App] 云端虫洞更新:', data);
                this.loadCloudWormholes();
            },
            onDelete: (data) => {
                console.log('[App] 云端虫洞删除:', data);
                this.loadCloudWormholes();
            }
        });
    }
    
    /**
     * 同步本地虫洞到云端
     */
    async syncToCloud() {
        if (!supabaseService.initialized) {
            this.showToast('Supabase 未连接', 'error');
            return;
        }
        
        if (this.wormholeRecords.length === 0) {
            this.showToast('没有本地虫洞需要同步');
            return;
        }
        
        console.log('[App] 开始同步', this.wormholeRecords.length, '条虫洞到云端...');
        
        let successCount = 0;
        // 用于追踪已同步的记录（避免重复）
        const syncedKeys = new Set();
        
        for (const record of this.wormholeRecords) {
            // 跳过已经同步到云端的记录（避免重复同步）
            if (record.syncedToCloud) {
                console.log('[Sync] 跳过已同步记录:', record.fromSystem, '->', record.toSystem);
                continue;
            }
            
            // 调试：输出记录内容
            console.log('[Sync] 本地记录:', {
                fromSystem: record.fromSystem,
                toSystem: record.toSystem,
                fromSignal: record.fromSignal,
                toSignal: record.toSignal,
                type: typeof record.fromSystem
            });
            
            // 生成唯一键（用于去重）
            const syncKey = `${record.fromSystem}-${record.toSystem}`;
            if (syncedKeys.has(syncKey)) {
                console.log('[Sync] 跳过重复记录:', syncKey);
                continue;
            }
            syncedKeys.add(syncKey);
            
            // 处理 fromSystem 和 toSystem（可能是字符串或对象）
            let fromSystemName = typeof record.fromSystem === 'string' 
                ? record.fromSystem 
                : (record.fromSystem?.name || '');
            let toSystemName = typeof record.toSystem === 'string' 
                ? record.toSystem 
                : (record.toSystem?.name || '');
            
            // 如果名称为空，尝试使用 signal 或其他字段
            if (!fromSystemName) fromSystemName = record.fromSignal || '未知';
            if (!toSystemName) toSystemName = record.toSignal || '未知';
            
            console.log('[Sync] 处理后名称:', { fromSystemName, toSystemName });
            
            const cloudRecord = {
                fromSystemId: '',
                fromSystemName: fromSystemName,
                toSystemId: '',
                toSystemName: toSystemName,
                fromSignal: record.fromSignal || '',
                toSignal: record.toSignal || '',
                size: record.size,
                mass: record.mass,
                lifetime: record.remainingHours ? record.remainingHours * 60 : 1440,
                source: 'cloud',
                createdBy: record.createdBy || '匿名'
            };
            
            // 使用本地记录的过期时间，保持一致
            if (record.expiresAt) {
                const remainingMs = record.expiresAt - Date.now();
                if (remainingMs > 0) {
                    cloudRecord.lifetime = Math.floor(remainingMs / 60000); // 转换为分钟
                }
            }
            
            const result = await supabaseService.createWormhole(cloudRecord);
            if (result) {
                successCount++;
                // 标记本地记录已同步（但不修改 source，保持显示为本地）
                record.syncedToCloud = true;
                record.cloudId = result.id; // 保存云端 ID 用于删除
            }
        }
        
        this.showToast(`成功同步 ${successCount} 条虫洞到云端`);
        console.log('[App] 同步完成:', successCount, '条');
        
        // 同步后立即刷新云端数据
        if (successCount > 0) {
            await this.loadCloudWormholes();
        }
    }
    
    /**
     * 显示手动添加虫洞对话框（支持单条和批量导入）
     */
    showAddCloudWormholeDialog() {
        if (!supabaseService.initialized) {
            this.showToast('Supabase 未连接', 'error');
            return;
        }
        
        const dialog = document.createElement('div');
        dialog.className = 'wormhole-dialog';
        dialog.innerHTML = `
            <div class="wormhole-dialog-content" style="max-width: 500px;">
                <h3>添加虫洞到云端</h3>
                
                <!-- 选项卡 -->
                <div class="dialog-tabs">
                    <button class="tab-btn active" data-tab="single">单条添加</button>
                    <button class="tab-btn" data-tab="batch">批量导入</button>
                </div>
                
                <!-- 单条添加面板 -->
                <div class="tab-panel" id="panel-single">
                    <div class="wormhole-form">
                        <div class="form-row">
                            <label>起点星系:</label>
                            <input type="text" id="cloud-wh-from" placeholder="例如: 耶舒尔" required>
                        </div>
                        <div class="form-row">
                            <label>终点星系:</label>
                            <input type="text" id="cloud-wh-to" placeholder="例如: 杰尼" required>
                        </div>
                        <div class="form-row">
                            <label>起点信号:</label>
                            <input type="text" id="cloud-wh-from-sig" placeholder="例如: ABC-123">
                        </div>
                        <div class="form-row">
                            <label>终点信号:</label>
                            <input type="text" id="cloud-wh-to-sig" placeholder="例如: XYZ-789">
                        </div>
                        <div class="form-row">
                            <label>虫洞大小:</label>
                            <select id="cloud-wh-size">
                                <option value="S">S (小型)</option>
                                <option value="M">M (中型)</option>
                                <option value="L" selected>L (大型)</option>
                                <option value="XL">XL (超大型)</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>剩余时间:</label>
                            <select id="cloud-wh-life">
                                <option value="1">小于 4 小时</option>
                                <option value="4" selected>4 小时 - 24 小时</option>
                                <option value="24">24 小时 - 48 小时</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 批量导入面板 -->
                <div class="tab-panel hidden" id="panel-batch">
                    <div class="batch-import-info">
                        <p>📋 <strong>从游戏复制粘贴虫洞列表</strong></p>
                        <p style="font-size: 12px; color: #888;">格式: 信号 > 目的地 | 起点星系 | 过期时间(UTC+0)</p>
                    </div>
                    <textarea id="batch-wh-data" placeholder="IVI-608 > J114330	...	...	Naga	...	...	2026.02.28 09:34	2026.03.01 09:34	Carthago
EOF-368 > J220546	...	...	J114330	...	...	2026.02.28 09:26	2026.03.01 09:26	Carthago
...
(粘贴多行数据，每行一个虫洞)" style="width: 100%; height: 150px; font-family: monospace; font-size: 11px;"></textarea>
                    <div id="batch-preview" style="margin-top: 10px; max-height: 150px; overflow-y: auto;"></div>
                </div>
                
                <div class="wormhole-dialog-buttons">
                    <button class="btn-save" id="btn-save-wh">保存到云端</button>
                    <button class="btn-cancel">取消</button>
                </div>
            </div>
        `;
        
        // 添加选项卡样式
        const style = document.createElement('style');
        style.textContent = `
            .dialog-tabs { display: flex; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 10px; }
            .tab-btn { background: transparent; border: none; color: #888; padding: 8px 16px; cursor: pointer; font-size: 14px; }
            .tab-btn.active { color: #fff; border-bottom: 2px solid #5a8fc7; }
            .tab-btn:hover { color: #ccc; }
            .tab-panel.hidden { display: none; }
            .batch-import-info { background: rgba(90, 143, 199, 0.1); padding: 10px; border-radius: 4px; margin-bottom: 10px; }
            .batch-import-info p { margin: 4px 0; }
            #batch-wh-data { background: #1a1a1a; border: 1px solid #444; color: #ddd; padding: 8px; border-radius: 4px; resize: vertical; }
            #batch-preview table { width: 100%; font-size: 11px; border-collapse: collapse; }
            #batch-preview th, #batch-preview td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #333; }
            #batch-preview th { color: #888; }
            .preview-valid { color: #5ac75a; }
            .preview-invalid { color: #c75a5a; }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(dialog);
        
        let currentTab = 'single';
        let parsedBatchData = [];
        
        // 选项卡切换
        dialog.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dialog.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                dialog.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
                document.getElementById('panel-' + btn.dataset.tab).classList.remove('hidden');
                currentTab = btn.dataset.tab;
            });
        });
        
        // 实时解析批量数据
        const batchTextarea = document.getElementById('batch-wh-data');
        if (batchTextarea) {
            batchTextarea.addEventListener('input', () => {
                parsedBatchData = this.parseBatchWormholeData(batchTextarea.value);
                this.showBatchPreview(parsedBatchData);
            });
        }
        
        // 绑定保存按钮
        document.getElementById('btn-save-wh').addEventListener('click', async () => {
            if (currentTab === 'single') {
                // 单条添加
                const fromSystem = document.getElementById('cloud-wh-from').value.trim();
                const toSystem = document.getElementById('cloud-wh-to').value.trim();
                const fromSignal = document.getElementById('cloud-wh-from-sig').value.trim();
                const toSignal = document.getElementById('cloud-wh-to-sig').value.trim();
                const size = document.getElementById('cloud-wh-size').value;
                const lifeHours = parseInt(document.getElementById('cloud-wh-life').value);
                
                if (!fromSystem || !toSystem) {
                    this.showToast('请填写起点和终点星系', 'error');
                    return;
                }
                
                const cloudRecord = {
                    fromSystemId: '',
                    fromSystemName: fromSystem,
                    toSystemId: '',
                    toSystemName: toSystem,
                    fromSignal: fromSignal,
                    toSignal: toSignal,
                    size: size,
                    mass: 'stable',
                    lifetime: lifeHours * 60,
                    source: 'cloud',
                    createdBy: '用户手动添加'
                };
                
                const result = await supabaseService.createWormhole(cloudRecord);
                
                if (result) {
                    this.showToast('虫洞已保存到云端');
                    document.body.removeChild(dialog);
                    await this.loadCloudWormholes();
                } else {
                    this.showToast('保存失败', 'error');
                }
            } else {
                // 批量导入
                if (parsedBatchData.length === 0) {
                    this.showToast('没有可导入的数据', 'error');
                    return;
                }
                
                const validRecords = parsedBatchData.filter(r => r.valid);
                if (validRecords.length === 0) {
                    this.showToast('没有有效的虫洞数据', 'error');
                    return;
                }
                
                this.showToast(`正在导入 ${validRecords.length} 条虫洞...`);
                
                let successCount = 0;
                for (const record of validRecords) {
                    const result = await supabaseService.createWormhole(record.data);
                    if (result) successCount++;
                }
                
                this.showToast(`成功导入 ${successCount}/${validRecords.length} 条虫洞`);
                document.body.removeChild(dialog);
                await this.loadCloudWormholes();
            }
        });
        
        // 绑定取消按钮
        dialog.querySelector('.btn-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });
    }
    
    /**
     * 解析批量虫洞数据
     * @param {string} text - 粘贴的表格数据
     * @returns {Array} 解析结果数组
     */
    parseBatchWormholeData(text) {
        if (!text || !text.trim()) return [];
        
        const lines = text.trim().split('\n');
        const results = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            // 按 Tab 分割
            const cols = line.split('\t');
            
            if (cols.length < 9) {
                console.warn(`第${i+1}行: 列数不足 (只有${cols.length}列, 需要9列)`);
                results.push({
                    valid: false,
                    error: `列数不足 (只有${cols.length}列)`,
                    raw: line.substring(0, 100)
                });
                continue;
            }
            
            try {
                // 第1列: 信号 > 目的地 (如: IVI-608 > J114330)
                let col1 = cols[0].trim();
                
                // 处理HTML实体编码 (如 &gt; 转为 >)
                col1 = col1.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
                
                const signalMatch = col1.match(/^([A-Z0-9-]+)\s*>\s*(.+)$/);
                const signalName = signalMatch ? signalMatch[1] : col1;
                const destination = signalMatch ? signalMatch[2] : '';
                
                // 第4列: 起点星系
                const fromSystem = cols[3].trim();
                
                // 第8列: 过期时间 (UTC+0) - 格式: 2026.03.01 09:34
                const expireTimeStr = cols[7].trim();
                
                // 第9列: 创建者
                const createdBy = cols[8] ? cols[8].trim() : '匿名';
                
                // 验证必填字段
                if (!fromSystem) {
                    results.push({
                        valid: false,
                        error: '缺少起点星系',
                        raw: line.substring(0, 100)
                    });
                    continue;
                }
                
                // 时间转换: UTC+0 → 北京时间，计算剩余分钟
                const remainingMinutes = this.calculateRemainingMinutesFromUTC(expireTimeStr);
                
                if (remainingMinutes <= 0) {
                    results.push({
                        valid: false,
                        error: remainingMinutes === 0 ? '无法解析时间' : '已过期',
                        raw: line.substring(0, 100),
                        fromSystem,
                        destination
                    });
                    continue;
                }
                
                results.push({
                    valid: true,
                    data: {
                        fromSystemId: '',
                        fromSystemName: fromSystem,
                        toSystemId: '',
                        toSystemName: destination,
                        fromSignal: signalName,
                        toSignal: '',
                        size: 'L',
                        mass: 'stable',
                        lifetime: remainingMinutes,
                        source: 'cloud',
                        createdBy: createdBy
                    },
                    fromSystem,
                    destination,
                    signalName,
                    remainingMinutes,
                    matched: false  // 是否已匹配反向虫洞
                });
                
            } catch (e) {
                console.error(`解析第${i+1}行异常:`, e);
                results.push({
                    valid: false,
                    error: '解析异常: ' + e.message,
                    raw: line.substring(0, 100)
                });
            }
        }
        
        // 匹配反向虫洞：A->B 和 B->A 是同一个虫洞的两个方向
        this.matchReverseWormholes(results);
        
        return results;
    }
    
    /**
     * 匹配反向虫洞，互补 toSignal
     * @param {Array} results - 解析结果数组
     */
    matchReverseWormholes(results) {
        const validRecords = results.filter(r => r.valid);
        
        for (let i = 0; i < validRecords.length; i++) {
            const recordA = validRecords[i];
            if (recordA.matched) continue;  // 已匹配过的跳过
            
            // 查找反向虫洞：A的起点是B的终点，且A的终点是B的起点
            const reverseRecord = validRecords.find(r => 
                r !== recordA && 
                !r.matched &&
                r.fromSystem === recordA.destination &&
                r.destination === recordA.fromSystem
            );
            
            if (reverseRecord) {
                // 找到反向虫洞，互相补全 toSignal
                recordA.data.toSignal = reverseRecord.signalName;
                reverseRecord.data.toSignal = recordA.signalName;
                
                recordA.matched = true;
                reverseRecord.matched = true;
                
                console.log(`[BatchImport] 匹配反向虫洞: ${recordA.signalName} (${recordA.fromSystem}<>${recordA.destination}) <-> ${reverseRecord.signalName}`);
            }
        }
    }
    
    /**
     * 根据 UTC 过期时间计算剩余分钟（转换为北京时间）
     * @param {string} utcTimeStr - UTC+0 时间，格式: 2026.03.01 09:34
     * @returns {number} 剩余分钟
     */
    calculateRemainingMinutesFromUTC(utcTimeStr) {
        try {
            // 输入验证
            if (!utcTimeStr || typeof utcTimeStr !== 'string') {
                console.error('无效的时间输入:', utcTimeStr);
                return 0;
            }
            
            const trimmed = utcTimeStr.trim();
            if (!trimmed) {
                console.error('空的时间输入');
                return 0;
            }
            
            // 将 2026.03.01 09:34 格式转换为 ISO 格式 2026-03-01T09:34:00Z
            const isoStr = trimmed.replace(/\./g, '-').replace(' ', 'T') + ':00Z';
            
            const utcDate = new Date(isoStr);
            
            // 检查日期是否有效
            if (isNaN(utcDate.getTime())) {
                console.error('无法解析日期:', utcTimeStr, '-> ISO:', isoStr);
                return 0;
            }
            
            // 转换为北京时间 (UTC+8)
            const beijingDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
            
            // 当前北京时间
            const now = new Date();
            const nowBeijing = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 60 * 60 * 1000);
            
            // 计算差值（毫秒）
            const diffMs = beijingDate - nowBeijing;
            
            return Math.floor(diffMs / 60000); // 转换为分钟
        } catch (e) {
            console.error('时间解析失败:', utcTimeStr, e);
            return 0;
        }
    }
    
    /**
     * 显示批量导入预览
     * @param {Array} parsedData - 解析后的数据
     */
    showBatchPreview(parsedData) {
        const previewDiv = document.getElementById('batch-preview');
        if (!previewDiv) return;
        
        if (parsedData.length === 0) {
            previewDiv.innerHTML = '';
            return;
        }
        
        const validCount = parsedData.filter(r => r.valid).length;
        const invalidCount = parsedData.length - validCount;
        
        let html = `<p style="margin: 0 0 8px 0; font-size: 12px;">共 ${parsedData.length} 行: <span class="preview-valid">${validCount} 有效</span>, <span class="preview-invalid">${invalidCount} 无效</span></p>`;
        
        html += '<table><thead><tr><th>起点</th><th>终点</th><th>信号</th><th>剩余</th><th>状态</th></tr></thead><tbody>';
        
        // 统计匹配情况
        const matchedCount = parsedData.filter(r => r.valid && r.matched).length;
        if (matchedCount > 0) {
            html += `<p style="margin: 0 0 8px 0; font-size: 12px; color: #66bb6a;">已匹配 ${matchedCount} 条反向虫洞 ✓</p>`;
        }
        
        html += '<table><thead><tr><th>起点</th><th>终点</th><th>信号</th><th>对面信号</th><th>剩余</th><th>状态</th></tr></thead><tbody>';
        
        parsedData.slice(0, 10).forEach(item => {
            if (item.valid) {
                const hours = Math.floor(item.remainingMinutes / 60);
                const mins = item.remainingMinutes % 60;
                const matchedIcon = item.matched ? '↔' : '';
                const toSignal = item.data.toSignal || '-';
                html += `<tr>
                    <td>${item.fromSystem}</td>
                    <td>${item.destination}</td>
                    <td>${item.signalName}</td>
                    <td>${toSignal} ${matchedIcon}</td>
                    <td>${hours}小时${mins}分</td>
                    <td class="preview-valid">✓</td>
                </tr>`;
            } else {
                html += `<tr>
                    <td colspan="5" style="color: #888;">${item.raw.substring(0, 50)}...</td>
                    <td class="preview-invalid" title="${item.error}">✗</td>
                </tr>`;
            }
        });
        
        if (parsedData.length > 10) {
            html += `<tr><td colspan="6" style="text-align: center; color: #888;">还有 ${parsedData.length - 10} 行...</td></tr>`;
        }
        
        html += '</tbody></table>';
        previewDiv.innerHTML = html;
    }
    
    /**
     * 启动云端数据自动刷新
     */
    startCloudAutoRefresh() {
        // 每分钟刷新一次云端数据
        setInterval(() => {
            console.log('[App] 自动刷新云端虫洞数据...');
            this.loadCloudWormholes();
        }, 60 * 1000); // 1分钟
        
        console.log('[App] 云端虫洞自动刷新已启动（1分钟）');
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
