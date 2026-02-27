/**
 * @fileoverview 角色跟随功能集成
 * 补充 main-legacy.js 的角色跟随功能
 * 支持浏览器环境和 Electron 环境
 */

(function() {
    // 在 RegionalMapApp 原型上添加角色跟随方法
    
    /**
     * 初始化角色跟随功能
     */
    RegionalMapApp.prototype.initRoleFollow = function() {
        // 角色跟随相关状态
        this.roleManager = null;
        this.followMode = null;
        this.rolePanelElements = {};
        this.currentLogDirectory = null;
        this.currentWatchId = null;
        
        // 检测运行环境
        this.isElectron = window.electronAPI?.isElectron === true;
        
        this._cacheRolePanelElements();
        this._bindRolePanelEvents();
        
        // 设置默认日志路径显示
        this._setDefaultLogPath();
        
        console.log('[RoleFollow] 角色跟随功能已初始化' + (this.isElectron ? ' (Electron 模式)' : ' (浏览器模式)'));
    };
    
    /**
     * 设置默认日志路径显示
     * @private
     */
    RegionalMapApp.prototype._setDefaultLogPath = async function() {
        let defaultPath = '';
        
        if (this.isElectron) {
            // Electron 环境：从主进程获取默认路径
            try {
                defaultPath = await window.electronAPI.getDefaultLogPath();
            } catch (e) {
                console.warn('[RoleFollow] 获取默认路径失败:', e);
                defaultPath = 'C:\\Users\\Username\\Documents\\EVE\\logs\\Chatlogs';
            }
        } else {
            // 浏览器环境：根据 UserAgent 推断
            defaultPath = this._getBrowserDefaultLogPath();
        }
        
        if (this.rolePanelElements.logPathInput) {
            this.rolePanelElements.logPathInput.value = defaultPath;
            this.rolePanelElements.logPathInput.title = this.isElectron 
                ? '点击"浏览..."选择目录，或直接使用默认路径'
                : '点击"浏览..."选择目录（需要 Chrome/Edge）';
        }
        
        // Electron 环境下自动检查默认路径是否存在
        if (this.isElectron && defaultPath) {
            try {
                const exists = await window.electronAPI.pathExists(defaultPath);
                if (exists) {
                    this.currentLogDirectory = defaultPath;
                    await this._scanRoles(defaultPath);
                    this.showToast('已自动加载默认日志目录');
                }
            } catch (e) {
                console.log('[RoleFollow] 默认路径不存在:', defaultPath);
            }
        }
        
        // Python 桥接模式下自动尝试扫描默认路径
        if (!this.isElectron) {
            const hasPythonBridge = await this._detectPythonBridge();
            if (hasPythonBridge && defaultPath) {
                try {
                    // 验证路径是否存在
                    const resp = await fetch(`/api/path-exists?path=${encodeURIComponent(defaultPath)}`);
                    const result = await resp.json();
                    if (result.exists) {
                        this.currentLogDirectory = defaultPath;
                        await this._scanRolesPython(defaultPath);
                        this.showToast('已自动加载默认日志目录 (Python桥接)');
                    }
                } catch (e) {
                    console.log('[RoleFollow] Python桥接默认路径不存在或无法访问:', defaultPath);
                }
            }
        }
    };
    
    /**
     * 获取浏览器环境的默认日志路径
     * @private
     */
    RegionalMapApp.prototype._getBrowserDefaultLogPath = function() {
        const userHome = navigator.userAgent.includes('Windows') ? 
            'C:\\Users\\' + (navigator.userAgent.match(/\\b\\w+$/) || ['Username'])[0] :
            '~';
        return userHome + '\\Documents\\EVE\\logs\\Chatlogs';
    };
    
    /**
     * 缓存角色面板元素
     * @private
     */
    RegionalMapApp.prototype._cacheRolePanelElements = function() {
        this.rolePanelElements = {
            roleSelect: document.getElementById('roleSelect'),
            btnRefreshRoles: document.getElementById('btnRefreshRoles'),
            btnToggleFollow: document.getElementById('btnToggleFollow'),
            btnSelectLogDir: document.getElementById('btnSelectLogDir'),
            logPathInput: document.getElementById('logPathInput'),
            roleList: document.getElementById('roleList'),
            roleCurrentInfo: document.getElementById('roleCurrentInfo'),
            currentRoleName: document.getElementById('currentRoleName'),
            currentSystemName: document.getElementById('currentSystemName'),
            currentSecurityStatus: document.getElementById('currentSecurityStatus'),
            statusIndicator: document.getElementById('roleStatusIndicator')
        };
    };
    
    /**
     * 绑定角色面板事件
     * @private
     */
    RegionalMapApp.prototype._bindRolePanelEvents = function() {
        const elems = this.rolePanelElements;
        
        // 选择日志目录
        elems.btnSelectLogDir.addEventListener('click', () => {
            this._selectLogDirectory();
        });
        
        // 刷新角色列表
        elems.btnRefreshRoles.addEventListener('click', () => {
            this._refreshRoles();
        });
        
        // 选择角色
        elems.roleSelect.addEventListener('change', (e) => {
            const roleName = e.target.value;
            elems.btnToggleFollow.disabled = !roleName;
        });
        
        // 开始/停止跟随
        elems.btnToggleFollow.addEventListener('click', () => {
            this._toggleFollow();
        });
    };
    
    /**
     * 检测是否有 Python 桥接后端
     * @private
     */
    RegionalMapApp.prototype._detectPythonBridge = async function() {
        try {
            const resp = await fetch('/api/default-log-path');
            return resp.ok;
        } catch {
            return false;
        }
    };
    
    /**
     * 选择日志目录
     * @private
     */
    RegionalMapApp.prototype._selectLogDirectory = async function() {
        // 先检测是否有 Python 桥接
        const hasPythonBridge = await this._detectPythonBridge();
        
        if (hasPythonBridge) {
            await this._selectLogDirectoryPython();
        } else if (this.isElectron) {
            await this._selectLogDirectoryElectron();
        } else {
            await this._selectLogDirectoryBrowser();
        }
    };
    
    /**
     * Python 桥接方式选择目录
     * @private
     */
    RegionalMapApp.prototype._selectLogDirectoryPython = async function() {
        try {
            // 获取默认路径
            const resp = await fetch('/api/default-log-path');
            const data = await resp.json();
            const defaultPath = data.path;
            
            // 提示用户输入路径（简化版，实际可以用 input 弹窗）
            const userPath = prompt('请输入 EVE 日志目录路径:', defaultPath);
            
            if (!userPath) return;
            
            this.currentLogDirectory = userPath;
            this.rolePanelElements.logPathInput.value = userPath;
            
            // 扫描角色
            await this._scanRolesPython(userPath);
            this.showToast('目录已选择');
            
        } catch (e) {
            console.error('[RoleFollow] Python 桥接选择目录失败:', e);
            this.showToast('选择目录失败: ' + e.message, 'error');
        }
    };
    
    /**
     * Python 桥接方式扫描角色
     * @private
     */
    RegionalMapApp.prototype._scanRolesPython = async function(dirPath) {
        const roles = [];
        const roleMap = new Map(); // 用于去重，保留最新的
        
        try {
            const resp = await fetch(`/api/scan-directory?path=${encodeURIComponent(dirPath)}`);
            const result = await resp.json();
            
            if (!result.success) {
                console.error('[RoleFollow] 扫描目录失败:', result.error);
                this.showToast('扫描目录失败: ' + result.error, 'error');
                return;
            }
            
            // 文件已按修改时间排序，遍历去重
            for (const file of result.files) {
                const listenerMatch = file.content.match(/Listener:\s*(.+)/);
                if (listenerMatch) {
                    const roleName = listenerMatch[1].trim();
                    // 只保留第一个（最新的）
                    if (!roleMap.has(roleName)) {
                        const isChinese = /频道更换为本地/.test(file.content);
                        roleMap.set(roleName, {
                            name: roleName,
                            filePath: file.path,
                            isChineseClient: isChinese
                        });
                    }
                }
            }
            
            // 转换为数组
            roles.push(...roleMap.values());
            
        } catch (e) {
            console.error('[RoleFollow] Python 桥接扫描角色失败:', e);
        }
        
        this._updateRoleList(roles);
        this.showToast(`找到 ${roles.length} 个角色`);
    };
    
    /**
     * Electron 环境选择目录
     * @private
     */
    RegionalMapApp.prototype._selectLogDirectoryElectron = async function() {
        try {
            const result = await window.electronAPI.selectDirectory();
            
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }
            
            const dirPath = result.filePaths[0];
            this.currentLogDirectory = dirPath;
            
            // 更新输入框显示
            this.rolePanelElements.logPathInput.value = dirPath;
            
            // 扫描角色
            await this._scanRoles(dirPath);
            this.showToast('目录选择成功');
            
        } catch (e) {
            console.error('[RoleFollow] 选择目录失败:', e);
            this.showToast('选择目录失败: ' + e.message, 'error');
        }
    };
    
    /**
     * 浏览器环境选择目录
     * @private
     */
    RegionalMapApp.prototype._selectLogDirectoryBrowser = async function() {
        // 检查浏览器支持
        if (!('showDirectoryPicker' in window)) {
            const isHTTPS = window.location.protocol === 'https:';
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1';
            
            if (!isHTTPS && !isLocalhost) {
                alert('文件选择功能需要以下之一：\n1. 通过 HTTPS 访问\n2. 本地访问 (localhost/127.0.0.1)\n\n建议使用 Electron 版本以获得最佳体验。');
            } else {
                alert('您的浏览器不支持文件选择功能。\n\n请使用 Chrome 86+, Edge 86+, 或 Opera 72+\n\n建议使用 Electron 版本以获得最佳体验。');
            }
            return;
        }
        
        try {
            const dirHandle = await window.showDirectoryPicker();
            
            if (dirHandle.requestPermission) {
                const permission = await dirHandle.requestPermission({ mode: 'read' });
                if (permission !== 'granted') {
                    this.showToast('需要读取权限才能扫描日志', 'error');
                    return;
                }
            }
            
            this.currentLogDirectory = dirHandle;
            this.rolePanelElements.logPathInput.value = dirHandle.name;
            this.rolePanelElements.logPathInput.dataset.hasPermission = 'true';
            
            await this._scanRoles(dirHandle);
            this.showToast('目录选择成功: ' + dirHandle.name);
            
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log('[RoleFollow] 用户取消了目录选择');
            } else if (e.name === 'SecurityError') {
                alert('安全限制：无法访问目录\n\n请确保：\n1. 使用 HTTPS 或 localhost\n2. 允许网站的文件访问权限');
            } else {
                console.error('[RoleFollow] 选择目录失败:', e);
                this.showToast('选择目录失败: ' + e.message, 'error');
            }
        }
    };
    
    /**
     * 扫描角色
     * @private
     */
    RegionalMapApp.prototype._scanRoles = async function(dirPathOrHandle) {
        let roles = [];
        
        if (this.isElectron) {
            roles = await this._scanRolesElectron(dirPathOrHandle);
        } else {
            roles = await this._scanRolesBrowser(dirPathOrHandle);
        }
        
        this._updateRoleList(roles);
        this.showToast(`找到 ${roles.length} 个角色`);
    };
    
    /**
     * Electron 环境扫描角色
     * @private
     */
    RegionalMapApp.prototype._scanRolesElectron = async function(dirPath) {
        const roles = [];
        const roleMap = new Map(); // 用于去重，保留最新的
        
        try {
            const result = await window.electronAPI.scanLogDirectory(dirPath);
            
            if (!result.success) {
                console.error('[RoleFollow] 扫描目录失败:', result.error);
                return roles;
            }
            
            // 文件已按修改时间排序，遍历去重
            for (const file of result.files) {
                const listenerMatch = file.content.match(/Listener:\s*(.+)/);
                if (listenerMatch) {
                    const roleName = listenerMatch[1].trim();
                    // 只保留第一个（最新的）
                    if (!roleMap.has(roleName)) {
                        const isChinese = /频道更换为本地/.test(file.content);
                        roleMap.set(roleName, {
                            name: roleName,
                            filePath: file.path,
                            isChineseClient: isChinese
                        });
                    }
                }
            }
            
            // 转换为数组
            roles.push(...roleMap.values());
            
        } catch (e) {
            console.error('[RoleFollow] 扫描角色失败:', e);
        }
        
        return roles;
    };
    
    /**
     * 浏览器环境扫描角色
     * @private
     */
    RegionalMapApp.prototype._scanRolesBrowser = async function(dirHandle) {
        const roles = [];
        const roleMap = new Map(); // 用于去重，保留最新的
        const fileEntries = []; // 先收集所有文件条目
        
        try {
            // 第一步：收集所有文件条目和修改时间
            for await (const [name, handle] of dirHandle.entries()) {
                if (handle.kind === 'file' && /^(Local|本地)_.+\.txt$/i.test(name)) {
                    try {
                        const file = await handle.getFile();
                        fileEntries.push({
                            name: name,
                            handle: handle,
                            lastModified: file.lastModified
                        });
                    } catch (e) {
                        console.warn('[RoleFollow] 获取文件信息失败:', name);
                    }
                }
            }
            
            // 按修改时间排序（最新的在前）
            fileEntries.sort((a, b) => b.lastModified - a.lastModified);
            
            // 第二步：遍历去重
            for (const entry of fileEntries) {
                try {
                    const file = await entry.handle.getFile();
                    const content = await file.text();
                    
                    const listenerMatch = content.match(/Listener:\s*(.+)/);
                    if (listenerMatch) {
                        const roleName = listenerMatch[1].trim();
                        // 只保留第一个（最新的）
                        if (!roleMap.has(roleName)) {
                            const isChinese = /频道更换为本地/.test(content);
                            roleMap.set(roleName, {
                                name: roleName,
                                fileHandle: entry.handle,
                                isChineseClient: isChinese
                            });
                        }
                    }
                } catch (e) {
                    console.warn('[RoleFollow] 读取文件失败:', entry.name);
                }
            }
            
            // 转换为数组
            roles.push(...roleMap.values());
            
        } catch (e) {
            console.error('[RoleFollow] 扫描角色失败:', e);
        }
        
        return roles;
    };
    
    /**
     * 更新角色列表
     * @private
     */
    RegionalMapApp.prototype._updateRoleList = function(roles) {
        const elems = this.rolePanelElements;
        
        // 去重：保留最新的角色
        const roleMap = new Map();
        for (const role of roles) {
            if (!roleMap.has(role.name)) {
                roleMap.set(role.name, role);
            }
        }
        roles = Array.from(roleMap.values());
        
        // 存储角色信息供后续使用
        this.scannedRoles = roles;
        
        // 更新下拉框
        elems.roleSelect.innerHTML = '<option value="">-- 选择角色 --</option>';
        for (const role of roles) {
            const option = document.createElement('option');
            option.value = role.name;
            option.textContent = role.name;
            option.dataset.isChinese = role.isChineseClient;
            elems.roleSelect.appendChild(option);
        }
        
        // 更新角色列表显示
        if (roles.length === 0) {
            elems.roleList.innerHTML = '<p class="placeholder">暂无角色，请选择日志目录</p>';
            return;
        }
        
        elems.roleList.innerHTML = '';
        for (const role of roles) {
            const item = document.createElement('div');
            item.className = 'role-list-item';
            item.innerHTML = `
                <span class="role-name">${role.name}</span>
                <span class="role-client ${role.isChineseClient ? 'zh' : 'en'}">
                    ${role.isChineseClient ? '中' : 'EN'}
                </span>
            `;
            elems.roleList.appendChild(item);
        }
    };
    
    /**
     * 刷新角色列表
     * @private
     */
    RegionalMapApp.prototype._refreshRoles = async function() {
        if (!this.currentLogDirectory) {
            this.showToast('请先选择日志目录', 'error');
            return;
        }
        await this._scanRoles(this.currentLogDirectory);
    };
    
    /**
     * 切换跟随模式
     * @private
     */
    RegionalMapApp.prototype._toggleFollow = async function() {
        const elems = this.rolePanelElements;
        const roleName = elems.roleSelect.value;
        
        if (!roleName) return;
        
        // 检查是否已经在跟随
        if (elems.btnToggleFollow.textContent === '停止跟随') {
            this._stopFollowing();
            return;
        }
        
        // 开始跟随
        await this._startFollowing(roleName);
    };
    
    /**
     * 开始跟随
     * @private
     */
    RegionalMapApp.prototype._startFollowing = async function(roleName) {
        const elems = this.rolePanelElements;
        
        // 获取角色信息
        const role = this.scannedRoles?.find(r => r.name === roleName);
        if (!role) {
            console.error('[RoleFollow] 找不到角色:', roleName);
            return;
        }
        
        console.log('[RoleFollow] 开始跟随角色:', roleName, 'role:', role);
        
        // 清空现有路径
        this.pathRecorder.clear();
        this.updatePathPanel();
        
        // 更新 UI
        elems.btnToggleFollow.textContent = '停止跟随';
        elems.btnToggleFollow.classList.remove('btn-primary');
        elems.btnToggleFollow.classList.add('btn-danger');
        elems.roleSelect.disabled = true;
        elems.statusIndicator.classList.add('active');
        
        // 获取当前星系
        let currentSystem = null;
        
        // 根据环境判断使用哪种方式
        if (this.isElectron) {
            console.log('[RoleFollow] 使用 Electron 方式获取当前星系');
            currentSystem = await this._getCurrentSystemElectron(role);
        } else if (role.filePath) {
            // Python 桥接方式 - 使用 filePath
            console.log('[RoleFollow] 使用 Python 桥接方式获取当前星系');
            currentSystem = await this._getCurrentSystemPython(role);
        } else if (role.fileHandle) {
            console.log('[RoleFollow] 使用浏览器方式获取当前星系');
            currentSystem = await this._getCurrentSystemBrowser(role);
        }
        
        console.log('[RoleFollow] 当前星系对象:', currentSystem);
        
        if (currentSystem) {
            console.log('[RoleFollow] 星系详情:', {
                name: currentSystem.name || currentSystem.nameZh,
                id: currentSystem.id,
                regionID: currentSystem.regionID,
                hasName: !!currentSystem.name,
                hasNameZh: !!currentSystem.nameZh
            });
            
            // 确保星系对象有必要的属性
            if (!currentSystem.regionID) {
                console.error('[RoleFollow] 星系对象缺少 regionID');
                this.showToast('星系数据不完整', 'error');
                return;
            }
            
            // 添加到路径（先添加再切换，这样路径面板会显示）
            console.log('[RoleFollow] 添加到路径记录器');
            this.pathRecorder.addSystem(currentSystem);
            console.log('[RoleFollow] 路径记录器状态:', {
                pathCount: this.pathRecorder.getDisplayPath().length,
                visitOrder: this.pathRecorder.getVisitOrder().length
            });
            
            // 更新路径面板
            console.log('[RoleFollow] 更新路径面板');
            this.updatePathPanel();
            
            // 设置路径数据到渲染器
            console.log('[RoleFollow] 设置路径数据到渲染器');
            this.renderer.setPathData(
                this.pathRecorder.getDisplayPath(),
                this.pathRecorder.getDisplayConnections()
            );
            
            // 切换到该星系所在星域并选中
            console.log('[RoleFollow] 切换到星域:', currentSystem.regionID, '星系:', currentSystem.id);
            this.selectRegion(currentSystem.regionID, currentSystem.id, true);
            
            // 延迟居中以确保渲染完成
            console.log('[RoleFollow] 准备居中到星系');
            setTimeout(() => {
                console.log('[RoleFollow] 执行居中');
                this.renderer.centerOnSystem(currentSystem);
                console.log('[RoleFollow] 已居中到星系');
            }, 200);
            
            // 更新角色信息面板
            elems.roleCurrentInfo.style.display = 'block';
            elems.currentRoleName.textContent = roleName;
            elems.currentSystemName.textContent = currentSystem.name || currentSystem.nameZh;
            
            const security = currentSystem.securityStatus;
            if (security !== undefined) {
                const secText = security.toFixed(1);
                const secClass = security >= 0.5 ? 'high' : security > 0 ? 'low' : 'null';
                elems.currentSecurityStatus.innerHTML = 
                    `<span class="security-${secClass}">${secText}</span>`;
            }
            
            this.showToast(`已定位到: ${currentSystem.name || currentSystem.nameZh}`, 'success');
        } else {
            // 找不到星系时仍然继续跟随，只是不聚焦
            console.warn('[RoleFollow] 无法获取当前星系，角色可能未换过星系');
            this.showToast('开始跟随角色，请在游戏中切换一次星系以定位', 'info');
            
            // 仍然显示角色信息面板
            elems.roleCurrentInfo.style.display = 'block';
            elems.currentRoleName.textContent = roleName;
            elems.currentSystemName.textContent = '等待定位...';
            elems.currentSecurityStatus.innerHTML = '<span>-</span>';
        }
        
        // 开始监控文件变化
        this._startFileWatching(roleName);
        
        this.showToast(`开始跟随角色: ${roleName}`);
    };
    
    /**
     * Python 桥接方式获取当前星系
     * @private
     */
    RegionalMapApp.prototype._getCurrentSystemPython = async function(role) {
        if (!role.filePath) {
            console.warn('[RoleFollow] Python 方式: 没有 filePath');
            return null;
        }
        
        try {
            console.log('[RoleFollow] Python 方式: 读取文件', role.filePath);
            const resp = await fetch(`/api/read-file?path=${encodeURIComponent(role.filePath)}`);
            const result = await resp.json();
            
            if (!result.success) {
                console.warn('[RoleFollow] Python 方式: 读取日志失败:', result.error);
                return null;
            }
            
            const content = result.content;
            const lines = content.split(/\r?\n/);
            
            // 方法1: 从后往前找星系变化记录（最新的）
            // 参考 eve_multi_pixel_monitor.py 的匹配方式
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                // 匹配英文或中文格式: Channel changed to Local : SystemName 或 频道更换为本地：SystemName
                // 使用 (?:Local|本地) 匹配英文或中文前缀，\s*[:：]\s* 匹配中英文冒号
                const systemMatch = line.match(/(?:Local|本地)\s*[:：]\s*(.+)/i);
                if (systemMatch) {
                    const systemName = systemMatch[1].trim().replace(/\*$/, '');
                    console.log('[RoleFollow] Python 方式: 从变化记录找到星系', systemName);
                    return this._findSystemByName(systemName);
                }
            }
            
            // 方法2: 如果文件刚创建，还没有换过星系，尝试从文件第一行找（如果有的话）
            // 实际上 EVE 日志不会在头部显示当前星系，只能通过变化记录
            
            console.warn('[RoleFollow] Python 方式: 日志中没有找到星系变化记录，角色可能未换过星系');
        } catch (e) {
            console.warn('[RoleFollow] Python 方式: 获取当前星系失败:', e);
        }
        
        return null;
    };
    
    /**
     * Electron 环境获取当前星系
     * @private
     */
    RegionalMapApp.prototype._getCurrentSystemElectron = async function(role) {
        try {
            // 获取日志目录（从 filePath 提取目录）
            const dirPath = role.filePath.substring(0, role.filePath.lastIndexOf('\\') || role.filePath.lastIndexOf('/'));
            
            // 重新扫描目录获取该角色的最新日志文件
            const scanResult = await window.electronAPI.scanLogDirectory(dirPath);
            if (!scanResult.success) {
                console.warn('[RoleFollow] 扫描目录失败:', scanResult.error);
                return null;
            }
            
            // 按修改时间排序，找到该角色的最新文件
            let latestFile = null;
            for (const file of scanResult.files) {
                const listenerMatch = file.content.match(/Listener:\s*(.+)/);
                if (listenerMatch && listenerMatch[1].trim() === role.name) {
                    if (!latestFile || file.name > latestFile.name) {
                        latestFile = file;
                    }
                }
            }
            
            if (!latestFile) {
                console.warn('[RoleFollow] 未找到角色的最新日志文件');
                return null;
            }
            
            const content = latestFile.content;
            const lines = content.split(/\r?\n/);
            
            for (let i = lines.length - 1; i >= 0; i--) {
                const systemMatch = lines[i].match(/Channel changed to Local\s*[:：]\s*(.+)/i) ||
                                   lines[i].match(/频道更换为本地\s*[:：]\s*(.+)/);
                if (systemMatch) {
                    const systemName = systemMatch[1].trim().replace(/\*$/, '').replace(/^：/, '');
                    return this._findSystemByName(systemName);
                }
            }
        } catch (e) {
            console.warn('[RoleFollow] 获取当前星系失败:', e);
        }
        
        return null;
    };
    
    /**
     * 浏览器环境获取当前星系
     * @private
     */
    RegionalMapApp.prototype._getCurrentSystemBrowser = async function(role) {
        if (!this.currentLogDirectory) return null;
        
        try {
            // 重新扫描目录获取该角色的最新日志文件
            let latestFile = null;
            let latestTime = 0;
            let scannedCount = 0;
            let matchedCount = 0;
            
            for await (const [name, handle] of this.currentLogDirectory.entries()) {
                if (handle.kind === 'file' && /^(Local|本地)_\d{8}_.+\.txt$/i.test(name)) {
                    scannedCount++;
                    try {
                        const file = await handle.getFile();
                        const content = await file.text();
                        
                        // 检查是否包含该角色
                        const listenerMatch = content.match(/Listener:\s*(.+)/);
                        if (listenerMatch) {
                            const foundRoleName = listenerMatch[1].trim();
                            if (foundRoleName === role.name) {
                                matchedCount++;
                                console.log('[RoleFollow] 匹配到角色文件:', name, '修改时间:', new Date(file.lastModified));
                                // 找到该角色的文件，检查是否最新
                                if (file.lastModified > latestTime) {
                                    latestTime = file.lastModified;
                                    latestFile = { handle, content, name };
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[RoleFollow] 读取文件失败:', name);
                    }
                }
            }
            
            console.log('[RoleFollow] 扫描完成:', { scannedCount, matchedCount, roleName: role.name });
            
            if (!latestFile) {
                console.warn('[RoleFollow] 未找到角色的最新日志文件');
                return null;
            }
            
            console.log('[RoleFollow] 使用最新文件:', latestFile.name);
            
            // 重新读取最新文件内容（确保获取最新数据）
            let freshContent;
            try {
                const freshFile = await latestFile.handle.getFile();
                freshContent = await freshFile.text();
            } catch (e) {
                console.warn('[RoleFollow] 重新读取文件失败:', e);
                return null;
            }
            
            const allLines = freshContent.split(/\r?\n/);
            console.log('[RoleFollow] 文件总行数:', allLines.length);
            
            // 从最新文件内容中解析星系
            for (let i = allLines.length - 1; i >= 0; i--) {
                const line = allLines[i];
                const systemMatch = line.match(/Channel changed to Local\s*[:：]\s*(.+)/i) ||
                                   line.match(/频道更换为本地\s*[:：]\s*(.+)/);
                if (systemMatch) {
                    const systemName = systemMatch[1].trim().replace(/\*$/, '').replace(/^：/, '');
                    console.log('[RoleFollow] 从日志解析到星系:', systemName);
                    return this._findSystemByName(systemName);
                }
            }
            
            console.warn('[RoleFollow] 日志文件中未找到星系切换记录');
        } catch (e) {
            console.warn('[RoleFollow] 获取当前星系失败:', e);
        }
        
        return null;
    };
    
    /**
     * 停止跟随
     * @private
     */
    RegionalMapApp.prototype._stopFollowing = async function() {
        const elems = this.rolePanelElements;
        
        // 停止监控
        if (this.isElectron && this.currentWatchId) {
            try {
                await window.electronAPI.stopWatching(this.currentWatchId);
            } catch (e) {
                console.warn('[RoleFollow] 停止监控失败:', e);
            }
            this.currentWatchId = null;
        }
        
        if (this._fileWatchTimer) {
            clearInterval(this._fileWatchTimer);
            this._fileWatchTimer = null;
        }
        
        // 移除 Electron 事件监听
        if (this.isElectron) {
            window.electronAPI.removeAllListeners('system-change');
        }
        
        // 更新 UI
        elems.btnToggleFollow.textContent = '开始跟随';
        elems.btnToggleFollow.classList.remove('btn-danger');
        elems.btnToggleFollow.classList.add('btn-primary');
        elems.roleSelect.disabled = false;
        elems.statusIndicator.classList.remove('active');
        elems.roleCurrentInfo.style.display = 'none';
        
        this.showToast('已停止跟随');
    };
    
    /**
     * 开始监控文件变化
     * @private
     */
    RegionalMapApp.prototype._startFileWatching = async function(roleName) {
        const role = this.scannedRoles?.find(r => r.name === roleName);
        if (!role) return;
        
        // 根据环境判断使用哪种方式（Electron 优先）
        if (this.isElectron) {
            console.log('[RoleFollow] 使用 Electron 方式监控文件');
            await this._startFileWatchingElectron(roleName);
        } else if (role.filePath) {
            // Python 桥接方式
            console.log('[RoleFollow] 使用 Python 桥接方式监控文件');
            this._startFileWatchingPython(roleName);
        } else if (role.fileHandle) {
            console.log('[RoleFollow] 使用浏览器方式监控文件');
            this._startFileWatchingBrowser(roleName);
        }
    };
    
    /**
     * Python 桥接方式监控文件变化
     * @private
     */
    RegionalMapApp.prototype._startFileWatchingPython = function(roleName) {
        let lastSystemId = null;
        const role = this.scannedRoles?.find(r => r.name === roleName);
        if (!role || !role.filePath) return;
        
        console.log('[RoleFollow] Python 方式: 开始监控', role.filePath);
        
        this._fileWatchTimer = setInterval(async () => {
            const currentSystem = await this._getCurrentSystemPython(role);
            if (currentSystem && currentSystem.id !== lastSystemId) {
                console.log('[RoleFollow] Python 方式: 检测到星系变化', currentSystem.name);
                lastSystemId = currentSystem.id;
                this._handleSystemChange(currentSystem);
            }
        }, 1000);
    };
    
    /**
     * Electron 环境监控文件变化
     * @private
     */
    RegionalMapApp.prototype._startFileWatchingElectron = async function(roleName) {
        const role = this.scannedRoles?.find(r => r.name === roleName);
        if (!role) return;
        
        console.log('[RoleFollow] Electron 模式使用渲染进程轮询（类似浏览器模式）');
        
        // 使用渲染进程轮询，避免 IPC 问题
        let lastSystem = await this._getCurrentSystemElectron(role);
        let lastFileContent = null;
        
        this._fileWatchTimer = setInterval(async () => {
            try {
                // 重新扫描目录获取最新文件（已按修改时间排序）
                const scanResult = await window.electronAPI.scanLogDirectory(this.currentLogDirectory);
                if (!scanResult.success) {
                    console.warn('[RoleFollow] 扫描目录失败:', scanResult.error);
                    return;
                }
                
                // 文件已按修改时间排序，第一个匹配的角色文件就是最新的
                let latestFile = null;
                for (const file of scanResult.files) {
                    const listenerMatch = file.content.match(/Listener:\s*(.+)/);
                    if (listenerMatch && listenerMatch[1].trim() === roleName) {
                        latestFile = file;
                        break; // 第一个匹配的就是最新的（已排序）
                    }
                }
                
                if (!latestFile) {
                    console.log('[RoleFollow] 未找到角色文件:', roleName);
                    return;
                }
                
                // 如果文件内容与上次相同，跳过解析
                if (latestFile.content === lastFileContent) {
                    return; // 文件未变化，跳过
                }
                
                console.log('[RoleFollow] 检测到文件变化，解析最新星系');
                lastFileContent = latestFile.content;
                
                // 从最新文件内容中解析星系（最后一行）
                const lines = latestFile.content.split(/\r?\n/);
                let currentSystemName = null;
                
                for (let i = lines.length - 1; i >= 0; i--) {
                    const systemMatch = lines[i].match(/Channel changed to Local\s*[:：]\s*(.+)/i) ||
                                       lines[i].match(/频道更换为本地\s*[:：]\s*(.+)/);
                    if (systemMatch) {
                        currentSystemName = systemMatch[1].trim().replace(/\*$/, '').replace(/^：/, '');
                        break; // 找到最后一行（最新的）星系记录
                    }
                }
                
                if (!currentSystemName) {
                    console.log('[RoleFollow] 未找到星系记录');
                    return;
                }
                
                const system = this._findSystemByName(currentSystemName);
                
                if (!system) {
                    console.warn('[RoleFollow] 找不到星系:', currentSystemName);
                    return;
                }
                
                // 检查星系是否变化
                if (!lastSystem || system.id !== lastSystem.id) {
                    console.log('[RoleFollow] 检测到星系变化:', lastSystem?.name, '->', system.name);
                    lastSystem = system;
                    this._handleSystemChange(system);
                } else {
                    console.log('[RoleFollow] 星系未变化:', system.name);
                }
            } catch (e) {
                console.warn('[RoleFollow] 轮询检查失败:', e);
            }
        }, 1000);
    };
    
    /**
     * 浏览器环境监控文件变化
     * @private
     */
    RegionalMapApp.prototype._startFileWatchingBrowser = function(roleName) {
        let lastSystemId = null;
        
        console.log('[RoleFollow] 开始文件监控:', roleName);
        
        this._fileWatchTimer = setInterval(async () => {
            const currentSystem = await this._getCurrentSystemFromLog(roleName);
            console.log('[RoleFollow] 轮询检查:', { 
                systemName: currentSystem?.name, 
                systemId: currentSystem?.id, 
                lastSystemId 
            });
            if (currentSystem && currentSystem.id !== lastSystemId) {
                console.log('[RoleFollow] 检测到星系变化:', lastSystemId, '->', currentSystem.id);
                lastSystemId = currentSystem.id;
                this._handleSystemChange(currentSystem);
            }
        }, 1000);
    };
    
    /**
     * 处理星系变化
     * @private
     */
    RegionalMapApp.prototype._handleSystemChange = function(system) {
        console.log('[RoleFollow] _handleSystemChange:', system.name, 'regionID:', system.regionID, 'isWormhole:', system.isWormhole);
        
        // 添加新星系到路径
        this.pathRecorder.addSystem(system);
        this.updatePathPanel();
        this.renderer.setPathData(
            this.pathRecorder.getDisplayPath(),
            this.pathRecorder.getDisplayConnections()
        );
        
        // 检查是否是虫洞星系（J-space）
        const isWormhole = system.isWormhole || system.id >= 31000000 || 
                          dataLoader.wormholeSystems.has(system.id);
        
        if (isWormhole) {
            // 虫洞星系：添加到当前视图为外部系统，不切换星域
            console.log('[RoleFollow] 进入虫洞星系，添加到当前视图');
            this._addWormholeToView(system);
        } else {
            // K-Space 星系：切换到对应星域
            console.log('[RoleFollow] 切换到星域:', system.regionID, '选中星系:', system.id);
            this.selectRegion(system.regionID, system.id, true);
        }
        
        // 检测虫洞连接（无星门连接）- 延迟执行确保地图已渲染
        setTimeout(() => {
            console.log('[RoleFollow] 检测虫洞连接...');
            this.detectWormholes();
        }, 500);
        
        // 更新显示
        const elems = this.rolePanelElements;
        elems.currentSystemName.textContent = system.name || system.nameZh;
        
        const security = system.securityStatus;
        if (security !== undefined) {
            const secText = security.toFixed(1);
            const secClass = security >= 0.5 ? 'high' : security > 0 ? 'low' : 'null';
            elems.currentSecurityStatus.innerHTML = 
                `<span class="security-${secClass}">${secText}</span>`;
        }
        
        this.showToast(`进入星系: ${system.name || system.nameZh}`);
    };
    
    /**
     * 将虫洞星系添加到当前视图
     * @private
     */
    RegionalMapApp.prototype._addWormholeToView = function(wormholeSystem) {
        // 获取当前星域数据
        const currentData = this.renderer.currentData;
        if (!currentData) return;
        
        // 检查虫洞是否已在外部系统中
        const existingExternal = currentData.externalSystems.find(s => s.id === wormholeSystem.id);
        if (existingExternal) {
            // 已存在，直接选中
            this.renderer.setSelectedSystem(existingExternal);
            this.updateSystemInfo(existingExternal);
            this.renderer.centerOnSystem(existingExternal);
            return;
        }
        
        // 创建外部系统对象（虫洞显示在当前星域边缘）
        const externalWormhole = {
            ...wormholeSystem,
            isExternal: true,
            // 计算位置：放在地图右侧边缘中间
            x: currentData.bounds.maxX + 200,
            y: (currentData.bounds.minY + currentData.bounds.maxY) / 2
        };
        
        // 添加到外部系统列表
        currentData.externalSystems.push(externalWormhole);
        
        // 重新设置数据（触发重绘）
        this.renderer.setData(currentData, true);
        
        // 选中新添加的虫洞
        setTimeout(() => {
            this.renderer.setSelectedSystem(externalWormhole);
            this.updateSystemInfo(externalWormhole);
            this.renderer.centerOnSystem(externalWormhole);
        }, 100);
    };
    
    /**
     * 从日志获取当前星系（浏览器环境）
     * @private
     */
    RegionalMapApp.prototype._getCurrentSystemFromLog = async function(roleName) {
        if (!this.currentLogDirectory) {
            console.warn('[RoleFollow] 轮询: currentLogDirectory 为空');
            return null;
        }
        
        try {
            // 重新扫描目录获取该角色的最新日志文件
            let latestFile = null;
            let latestTime = 0;
            let scannedCount = 0;
            let matchedCount = 0;
            
            for await (const [name, handle] of this.currentLogDirectory.entries()) {
                if (handle.kind === 'file' && /^(Local|本地)_\d{8}_.+\.txt$/i.test(name)) {
                    scannedCount++;
                    try {
                        const file = await handle.getFile();
                        const content = await file.text();
                        
                        // 检查是否包含该角色
                        const listenerMatch = content.match(/Listener:\s*(.+)/);
                        if (listenerMatch) {
                            const foundRoleName = listenerMatch[1].trim();
                            if (foundRoleName === roleName) {
                                matchedCount++;
                                // 找到该角色的文件，检查是否最新
                                if (file.lastModified > latestTime) {
                                    latestTime = file.lastModified;
                                    latestFile = { handle, content, name };
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[RoleFollow] 轮询: 读取文件失败:', name);
                    }
                }
            }
            
            console.log('[RoleFollow] 轮询扫描:', { scannedCount, matchedCount, hasLatestFile: !!latestFile });
            
            if (!latestFile) {
                console.warn('[RoleFollow] 轮询: 未找到角色文件');
                return null;
            }
            
            // 重新读取最新文件内容（文件可能已更新）
            let content;
            try {
                const freshFile = await latestFile.handle.getFile();
                content = await freshFile.text();
                console.log('[RoleFollow] 轮询: 重新读取文件，大小', content.length);
            } catch (e) {
                console.warn('[RoleFollow] 轮询: 重新读取文件失败', e);
                return null;
            }
            
            // 从最新文件内容中解析星系
            const lines = content.split(/\r?\n/);
            console.log('[RoleFollow] 轮询: 文件行数', lines.length);
            
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                const systemMatch = line.match(/Channel changed to Local\s*:\s*(.+)/i) ||
                                   line.match(/频道更换为本地\s*[:：]\s*(.+)/);
                if (systemMatch) {
                    const systemName = systemMatch[1].trim().replace(/\*$/, '').replace(/^：/, '');
                    console.log('[RoleFollow] 轮询: 解析到星系', systemName);
                    return this._findSystemByName(systemName);
                }
            }
            
            console.warn('[RoleFollow] 轮询: 未找到星系记录');
        } catch (e) {
            console.warn('[RoleFollow] 轮询: 异常', e);
        }
        
        return null;
    };
    
    /**
     * 根据名称查找星系
     * @private
     */
    RegionalMapApp.prototype._findSystemByName = function(name) {
        console.log('[RoleFollow] 查找星系:', name);
        
        if (!name) return null;
        
        // 调试：检查 dataLoader 状态
        if (!dataLoader.loaded) {
            console.warn('[RoleFollow] dataLoader 未加载完成');
            return null;
        }
        console.log('[RoleFollow] dataLoader 状态:', {
            systemsCount: dataLoader.systems.size,
            wormholeSystemsCount: dataLoader.wormholeSystems.size
        });
        
        // 清理名称：去除首尾空格，统一大小写
        const cleanName = name.trim();
        const lowerName = cleanName.toLowerCase();
        
        // 简单的中英文映射（小写键用于不区分大小写匹配）
        const nameMap = {
            'jita': '吉他', '吉他': 'Jita',
            'perimeter': '周边', '周边': 'Perimeter',
            'new caldari': '新加达里', '新加达里': 'New Caldari',
            'amarr': '艾玛', '艾玛': 'Amarr',
            'rens': '伦斯', '伦斯': 'Rens',
            'dodixie': '多迪谢', '多迪谢': 'Dodixie',
            'aeschee': '艾舍', '艾舍': 'Aeschee',
            'thera': '席拉', '席拉': 'Thera',
            'turnur': '图尔鲁尔', '图尔鲁尔': 'Turnur'
        };
        
        // 直接查找（不区分大小写）- 同时匹配 name(中文)、nameEn(英文) 和 nameZh(中文备用)
        // 先在普通星系中查找
        for (const system of dataLoader.systems.values()) {
            const sysName = (system.name || '').trim();
            const sysNameEn = (system.nameEn || '').trim();
            const sysNameZh = (system.nameZh || '').trim();
            
            if (sysName.toLowerCase() === lowerName || 
                sysNameEn.toLowerCase() === lowerName || 
                sysNameZh === cleanName) {
                console.log('[RoleFollow] 找到星系:', system.name, 'regionID:', system.regionID);
                return system;
            }
        }
        
        // 在虫洞星系中查找（虫洞名称通常是 J###### 格式）
        for (const system of dataLoader.wormholeSystems.values()) {
            const sysName = (system.name || '').trim();
            const sysNameEn = (system.nameEn || '').trim();
            
            if (sysName.toLowerCase() === lowerName || 
                sysNameEn.toLowerCase() === lowerName) {
                console.log('[RoleFollow] 找到虫洞星系:', system.name, 'regionID:', system.regionID);
                return system;
            }
        }
        
        // 映射后查找
        const mappedName = nameMap[lowerName];
        if (mappedName) {
            for (const system of dataLoader.systems.values()) {
                const sysName = (system.name || '').trim();
                const sysNameEn = (system.nameEn || '').trim();
                const sysNameZh = (system.nameZh || '').trim();
                
                if (sysName === mappedName || 
                    sysNameEn === mappedName || 
                    sysNameZh === mappedName) {
                    console.log('[RoleFollow] 通过映射找到星系:', system.name, 'regionID:', system.regionID);
                    return system;
                }
            }
        }
        
        console.warn('[RoleFollow] 未找到星系:', name, '(清理后:', cleanName + ')');
        return null;
    };
    
    /**
     * 更新路径面板
     */
    RegionalMapApp.prototype.updatePathPanel = function() {
        const container = this.elements.pathList;
        if (!container) return;
        
        const visitOrder = this.pathRecorder.getVisitOrder();
        
        if (visitOrder.length === 0) {
            container.innerHTML = '<p class="placeholder">点击星系记录路径，或启用角色跟随自动记录</p>';
            return;
        }
        
        let html = '';
        visitOrder.forEach((item, index) => {
            const isInDisplay = index >= visitOrder.length - this.pathRecorder.maxDisplay;
            const displayClass = isInDisplay ? 'path-item-display' : 'path-item-history';
            
            html += `
                <div class="path-item ${displayClass}" data-system-id="${item.id}" data-region-id="${item.regionID}">
                    <span class="path-number">${index + 1}</span>
                    <span class="path-name">${item.name}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // 绑定点击事件
        container.querySelectorAll('.path-item').forEach(item => {
            item.addEventListener('click', () => {
                const systemId = parseInt(item.dataset.systemId);
                const regionId = parseInt(item.dataset.regionId);
                this._focusOnSystem(regionId, systemId);
            });
        });
        
        // 滚动到最新
        container.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    };
    
    /**
     * 聚焦到指定系统
     * @private
     */
    RegionalMapApp.prototype._focusOnSystem = function(regionId, systemId) {
        if (systemId >= 31000000) {
            const system = dataLoader.systems.getWormhole ? 
                dataLoader.systems.getWormhole(systemId) : 
                Array.from(dataLoader.wormholeSystems?.values() || []).find(s => s.id === systemId);
            if (system) this.selectWormholeSystem(system);
            return;
        }
        
        this.selectRegion(regionId, systemId, true);
    };
    
    /**
     * 清除路径
     */
    RegionalMapApp.prototype.clearPath = function() {
        this.pathRecorder.clear();
        this.updatePathPanel();
        this.renderer.setPathData([], []);
        this.showToast('路径已清除');
    };
    
})();
