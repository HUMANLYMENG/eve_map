/**
 * 应用程序主类
 * 协调所有模块
 */

import { DataLoader } from './data/index.js';
import { MapRenderer } from './renderer/index.js';
import { MapInteraction } from './interaction/index.js';
import { PathManager } from './features/pathManager.js';
import { WormholeManager } from './features/wormholeManager.js';
import { SearchManager } from './features/searchManager.js';
import { Toast } from './ui/toast.js';
import { EventBus, Events } from './core/eventBus.js';
import { DEFAULT_REGION_ID, DEFAULT_SYSTEM_ID } from './core/config.js';

export class RegionalMapApp {
  constructor() {
    this.dataLoader = new DataLoader();
    this.renderer = null;
    this.interaction = null;
    this.pathManager = new PathManager();
    this.wormholeManager = new WormholeManager();
    this.searchManager = new SearchManager(this.dataLoader);
    this.eventBus = new EventBus();
    this.toast = null;
    
    this.currentRegionId = null;
    this.elements = {};
    this.eveScoutRefreshTimer = null; // EVE Scout 自动刷新定时器
    
    this._bindMethods();
  }
  
  /**
   * 绑定方法 this
   */
  _bindMethods() {
    this.onSystemSelect = this.onSystemSelect.bind(this);
    this.onSystemHover = this.onSystemHover.bind(this);
  }
  
  /**
   * 初始化应用
   */
  async init() {
    try {
      this._cacheElements();
      this.toast = new Toast(this.elements.toast);
      
      this._showLoading(true);
      
      // 加载数据
      await this.dataLoader.loadAll();
      
      // 初始化渲染器
      this.renderer = new MapRenderer(this.elements.canvas);
      this.renderer.setDataLoader(this.dataLoader);
      this.renderer.setStargateChecker(
        (fromId, toId) => this.dataLoader.hasStargateConnection(fromId, toId)
      );
      
      // 初始化交互
      this.interaction = new MapInteraction(
        this.renderer,
        this.onSystemHover,
        this.onSystemSelect
      );
      
      // 初始化功能模块
      this._initPathManager();
      this._initWormholeManager();
      this._initSearchManager();
      
      // 初始化 UI
      this._initRegionSelector();
      this._initResizer();
      this._initWormholePanel();
      
      // 加载 EVE Scout 数据
      this._loadEveScoutData();
      
      // 启动每分钟自动刷新 EVE Scout 数据
      this._startEveScoutAutoRefresh();
      
      // 默认选择星域
      this.selectRegion(DEFAULT_REGION_ID, DEFAULT_SYSTEM_ID, true);
      
      this.toast.show('地图加载完成');
      
    } catch (error) {
      console.error('[App] 初始化失败:', error);
      this.toast.show('加载失败: ' + error.message, 'error');
    } finally {
      this._showLoading(false);
    }
  }
  
  /**
   * 缓存 DOM 元素
   */
  _cacheElements() {
    this.elements = {
      canvas: document.getElementById('mapCanvas'),
      regionSelect: document.getElementById('regionSelect'),
      loadingMask: document.getElementById('loadingMask'),
      toast: document.getElementById('toast'),
      systemInfo: document.querySelector('#systemInfo .info-content'),
      searchInput: document.getElementById('searchInput'),
      searchResults: document.getElementById('searchResults'),
      pathList: document.querySelector('#pathPanel .path-list'),
      wormholeTable: document.querySelector('#wormholePanel .wormhole-table'),
      sidePanel: document.getElementById('sidePanel'),
      panelResizer: document.getElementById('panelResizer')
    };
  }
  
  /**
   * 初始化路径管理器
   */
  _initPathManager() {
    this.pathManager.onUpdateCallback((data) => {
      // 合并路径和 EVE Scout Thera/Turnur 连接
      const mergedData = this._mergeEveScoutConnections(data);
      this.renderer.setPathData(mergedData.systems, mergedData.connections);
      this._updatePathPanel();
    });
  }
  
  /**
   * 合并 EVE Scout Thera/Turnur 连接到路径数据
   */
  _mergeEveScoutConnections(pathData) {
    const eveScoutData = this._getEveScoutSpecialConnections();
    
    console.log('[App] Merging EVE Scout connections:', {
      eveScoutSystems: eveScoutData.systems.length,
      eveScoutConnections: eveScoutData.connections.length,
      pathSystems: pathData.systems.length,
      pathConnections: pathData.connections.length
    });
    
    if (!eveScoutData.systems || eveScoutData.systems.length === 0) {
      return pathData;
    }
    
    // 合并星系（去重）- 处理ID类型（字符串vs数字）
    const mergedSystems = [...pathData.systems];
    const systemIds = new Set(mergedSystems.map(s => s.id));
    
    for (const sys of eveScoutData.systems) {
      // 检查ID是否已存在（考虑类型差异）
      const sysId = sys.id;
      const numId = typeof sysId === 'string' ? parseInt(sysId, 10) : sysId;
      const strId = String(sysId);
      
      const alreadyExists = systemIds.has(sysId) || systemIds.has(numId) || systemIds.has(strId);
      if (!alreadyExists) {
        mergedSystems.push(sys);
        systemIds.add(sysId);
      }
    }
    
    // 合并连接
    const mergedConnections = [...pathData.connections, ...eveScoutData.connections];
    
    console.log('[App] Merged result:', {
      systems: mergedSystems.length,
      connections: mergedConnections.length
    });
    
    return {
      systems: mergedSystems,
      connections: mergedConnections
    };
  }
  
  /**
   * 获取 EVE Scout 中 Thera 和 Turnur 的特殊连接
   */
  _getEveScoutSpecialConnections() {
    console.log('[App] === _getEveScoutSpecialConnections START ===');
    
    const records = this.wormholeManager.eveScoutRecords;
    const result = { systems: [], connections: [] };
    
    console.log('[App] EVE Scout records count:', records?.length, 'type:', typeof records, 'isArray:', Array.isArray(records));
    
    if (!records || records.length === 0) {
      console.log('[App] No records, returning empty result');
      return result;
    }
    
    // 打印第一条记录的结构
    console.log('[App] First record sample:', JSON.stringify(records[0], null, 2));
    
    // 支持中英文匹配的特殊虫洞星系名称
    const specialSystemsEn = ['thera', 'turnur', 'turner']; // 英文
    const specialSystemsZh = ['席拉', '图尔鲁尔']; // 中文
    const addedSystems = new Map(); // 防止重复添加
    
    // 检查当前是否在特殊虫洞星系（Thera/Turnur）
    const currentInSpecialWormhole = this._isInSpecialWormhole();
    const currentSpecialName = this._getCurrentSpecialWormholeName();
    console.log('[App] Current in special wormhole:', currentInSpecialWormhole, 'Name:', currentSpecialName);
    
    let matchCount = 0;
    
    for (const record of records) {
      const fromName = (record.fromSystem || '').toLowerCase();
      const toName = (record.toSystem || '').toLowerCase();
      
      // 检查是否是 Thera 或 Turnur 的连接（中英文都支持）
      const isFromSpecial = specialSystemsEn.some(name => fromName.includes(name)) || 
                            specialSystemsZh.some(name => record.fromSystem?.includes(name));
      const isToSpecial = specialSystemsEn.some(name => toName.includes(name)) ||
                          specialSystemsZh.some(name => record.toSystem?.includes(name));
      
      if (isFromSpecial || isToSpecial) {
        matchCount++;
        console.log('[App] MATCH:', matchCount, { from: record.fromSystem, to: record.toSystem });
      } else {
        continue;
      }
      
      // 确定哪一端是特殊虫洞星系，哪一端是连接星系
      const specialName = isFromSpecial ? record.fromSystem : record.toSystem;
      const otherName = isFromSpecial ? record.toSystem : record.fromSystem;
      const specialId = isFromSpecial ? record.inSystemId : record.outSystemId;
      const otherId = isFromSpecial ? record.outSystemId : record.inSystemId;
      
      console.log('[App] Found special connection:', { 
        from: record.fromSystem, 
        to: record.toSystem, 
        isFromSpecial, 
        isToSpecial,
        specialName, 
        otherName,
        specialId,
        otherId 
      });
      
      // 查找连接星系ID（可能是 K-Space 或 J-Space）
      let otherSystemId = otherId;
      if (!otherSystemId) {
        otherSystemId = this._findSystemIdByName(otherName);
      }
      
      // 确保 ID 是数字类型
      if (otherSystemId) {
        otherSystemId = typeof otherSystemId === 'string' ? parseInt(otherSystemId, 10) : otherSystemId;
      }
      
      if (!otherSystemId) {
        console.log('[App] Skipping record - no system ID found for:', otherName);
        continue;
      }
      
      console.log('[App] Processing EVE Scout record:', { 
        from: record.fromSystem, 
        to: record.toSystem, 
        otherName, 
        otherSystemId,
        isFromSpecial, 
        isToSpecial,
        currentInSpecialWormhole 
      });
      
      // 确保 specialId 也是数字（如果是从 API 返回的）
      let specialSysId = specialId || `evescout-${record.id}`;
      if (specialSysId && typeof specialSysId === 'string' && !specialSysId.startsWith('evescout-')) {
        specialSysId = parseInt(specialSysId, 10);
      }
      
      // 情况1: 当前在普通星域，显示到 Thera/Turnur 的连接
      if (!currentInSpecialWormhole) {
        // 获取连接星系数据（K-Space）
        const otherSysData = this.dataLoader.systems?.get(otherSystemId);
        
        console.log('[App] Checking system in current region:', { 
          otherSystemId, 
          otherSysData: otherSysData ? { name: otherSysData.name, regionID: otherSysData.regionID } : null,
          currentRegionId: this.currentRegionId 
        });
        
        // 检查连接星系是否在当前星域
        if (!otherSysData) {
          console.log('[App] System not found:', otherSystemId);
          continue;
        }
        if (otherSysData.regionID !== this.currentRegionId) {
          console.log('[App] System not in current region:', otherSysData.name, otherSysData.regionID, '!==', this.currentRegionId);
          continue;
        }
        
        // 创建特殊虫洞星系数据
        if (!addedSystems.has(specialName)) {
          addedSystems.set(specialName, {
            id: specialSysId,
            name: specialName,
            isExternal: true,
            isWormhole: true,
            isEveScoutSpecial: true,
            wormholeType: record.type,
            wormholeSize: record.size,
            securityStatus: 0,
            securityClass: 'null',
            regionID: 0,
            position2D: null
          });
        }
        
        // 创建连接（从当前星域到特殊虫洞）
        result.connections.push({
          from: { id: otherSystemId, name: otherName, systemId: otherSystemId },
          to: { id: specialSysId, name: specialName, systemId: specialId || specialSysId },
          isEveScoutConnection: true,
          wormholeType: record.type,
          wormholeSize: record.size,
          source: 'evescout'
        });
        console.log('[App] Added connection in normal view:', otherName, '->', specialName);
      }
      // 情况2: 当前在 Thera/Turnur，显示所有连接的星系（K-Space 和 J-Space）
      else {
        // 简化匹配逻辑：检查 specialName 是否与当前所在的虫洞匹配
        // specialName 可能是中文("席拉")或英文("Thera")
        // currentSpecialName 是英文小写 ("thera")
        const specialNameLower = specialName.toLowerCase();
        
        // Ther a匹配：英文thera 或 中文席拉
        const isTheraMatch = specialNameLower.includes('thera') || specialName.includes('席拉');
        // Turnur匹配：英文turnur/turner 或 中文图尔鲁尔
        const isTurnurMatch = specialNameLower.includes('turnur') || specialNameLower.includes('turner') || specialName.includes('图尔鲁尔');
        
        // 当前在 Ther a但记录是 Turnur，或反之，则跳过
        if (currentSpecialName === 'thera' && !isTheraMatch) continue;
        if (currentSpecialName === 'turnur' && !isTurnurMatch) continue;
        
        console.log('[App] Matched wormhole:', specialName, 'current:', currentSpecialName);
        
        // 获取连接星系数据（可能是 K-Space 或 J-Space）
        let otherSysData = this.dataLoader.systems?.get(otherSystemId);
        let isWormhole = false;
        let wormholeClass = '';
        
        // 如果不是 K-Space，检查是否是 J-Space（虫洞星系）
        if (!otherSysData) {
          otherSysData = this.dataLoader.wormholeSystems?.get(otherSystemId);
          isWormhole = true;
          if (otherSysData) {
            wormholeClass = otherSysData.systemClass || '';
          }
        }
        
        // 创建连接星系数据（作为外部星系显示）
        if (!addedSystems.has(otherName)) {
          const sysData = {
            id: otherSystemId,
            name: otherName,
            isExternal: true,
            isEveScoutEntry: true,
            isWormhole: isWormhole,
            wormholeClass: wormholeClass,
            wormholeType: record.type,
            wormholeSize: record.size,
            securityStatus: otherSysData?.securityStatus ?? 0,
            securityClass: otherSysData?.securityClass || 'null',
            regionID: otherSysData?.regionID || (isWormhole ? 0 : 0),
            regionName: otherSysData?.regionName || (isWormhole ? '虫洞空间' : ''),
            position2D: null
          };
          addedSystems.set(otherName, sysData);
          console.log('[App] Added connected system:', otherName, isWormhole ? '(J-Space)' : '(K-Space)');
        }
        
        // 创建连接（从特殊虫洞到连接星系）
        result.connections.push({
          from: { id: specialSysId, name: specialName, systemId: specialId || specialSysId },
          to: { id: otherSystemId, name: otherName, systemId: otherSystemId },
          isEveScoutConnection: true,
          wormholeType: record.type,
          wormholeSize: record.size,
          source: 'evescout'
        });
        console.log('[App] Added connection in wormhole view:', specialName, '->', otherName);
      }
    }
    
    }
    
    result.systems = Array.from(addedSystems.values());
    console.log('[App] EVE Scout special connections FINAL:', {
      matchedRecords: matchCount,
      systems: result.systems.length,
      connections: result.connections.length
    });
    console.log('[App] === _getEveScoutSpecialConnections END ===');
    return result;
  }
  
  /**
   * 检查当前是否在特殊虫洞星系（Thera/Turnur）
   */
  _isInSpecialWormhole() {
    if (!this.currentRegionId) return false;
    const regionIdStr = String(this.currentRegionId).toLowerCase();
    return regionIdStr.includes('thera') || 
           regionIdStr.includes('turnur') || 
           regionIdStr.includes('turner') ||
           regionIdStr.includes('席拉') ||
           regionIdStr.includes('图尔鲁尔') ||
           regionIdStr.includes('wormhole-31000005') || // Thera
           regionIdStr.includes('wormhole-31000006');   // Turnur
  }
  
  /**
   * 获取当前特殊虫洞星系的名称
   */
  _getCurrentSpecialWormholeName() {
    if (!this.currentRegionId) return '';
    const regionIdStr = String(this.currentRegionId).toLowerCase();
    if (regionIdStr.includes('thera') || regionIdStr.includes('席拉') || regionIdStr.includes('wormhole-31000005')) return 'thera';
    if (regionIdStr.includes('turnur') || regionIdStr.includes('图尔鲁尔') || regionIdStr.includes('turner') || regionIdStr.includes('wormhole-31000006')) return 'turnur';
    return '';
  }
  
  /**
   * 根据名称查找星系ID
   */
  _findSystemIdByName(name) {
    if (!this.dataLoader?.systems) return null;
    
    for (const [id, system] of this.dataLoader.systems) {
      if (system.name === name) {
        return id;
      }
    }
    return null;
  }
  
  /**
   * 初始化虫洞管理器
   */
  _initWormholeManager() {
    this.wormholeManager.onUpdateCallback(() => {
      this._updateWormholeTable();
      // EVE Scout 数据更新后，触发路径更新以显示特殊连接
      this.pathManager._notifyUpdate();
    });
    
    // 监听虫洞检测事件
    this.eventBus.on(Events.WORMHOLE_DETECTED, (wormhole) => {
      this._showWormholeDialog(wormhole.fromSystem, wormhole.toSystem);
    });
  }
  
  /**
   * 初始化搜索管理器
   */
  _initSearchManager() {
    this.searchManager.onResultsCallback((results, query) => {
      this._renderSearchResults(results, query);
    });
    
    this.searchManager.onSelectCallback((result) => {
      if (result.isWormhole) {
        this._selectWormholeSystem(result.system);
      } else {
        this._selectSystem(result.system);
      }
    });
    
    // 绑定搜索输入
    this.elements.searchInput?.addEventListener('input', (e) => {
      this.searchManager.search(e.target.value.trim());
    });
    
    // 点击外部关闭搜索结果
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.system-search')) {
        this._hideSearchResults();
      }
    });
  }
  
  /**
   * 初始化星域选择器
   */
  _initRegionSelector() {
    const regions = this.dataLoader.getRegionList();
    const select = this.elements.regionSelect;
    
    for (const region of regions) {
      const option = document.createElement('option');
      option.value = region.id;
      option.textContent = `${region.name} (${region.systemCount}个星系)`;
      select?.appendChild(option);
    }
    
    select?.addEventListener('change', (e) => {
      const regionId = parseInt(e.target.value);
      if (regionId) this.selectRegion(regionId);
    });
  }
  
  /**
   * 初始化面板调整大小
   */
  _initResizer() {
    const resizer = this.elements.panelResizer;
    const sidePanel = this.elements.sidePanel;
    if (!resizer || !sidePanel) return;
    
    let isResizing = false;
    
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      sidePanel.style.width = Math.max(260, Math.min(500, newWidth)) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      this.renderer?.resize();
    });
  }
  
  /**
   * 初始化虫洞面板
   */
  _initWormholePanel() {
    const panel = document.getElementById('wormholePanel');
    if (!panel) return;
    
    // 检查是否已经有标签栏
    if (panel.querySelector('.wormhole-panel-header')) return;
    
    // 创建面板头部（标签和刷新按钮）
    const header = document.createElement('div');
    header.className = 'wormhole-panel-header';
    header.innerHTML = `
      <div class="wormhole-tabs">
        <button class="wh-tab active" data-filter="all">全部</button>
        <button class="wh-tab" data-filter="local">本地</button>
        <button class="wh-tab" data-filter="evescout">EVE Scout</button>
      </div>
      <div class="wormhole-actions">
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
        this.wormholeManager.setFilter(tab.dataset.filter);
      });
    });
    
    // 绑定刷新按钮
    this.elements.refreshEveScoutBtn.addEventListener('click', () => {
      this._refreshEveScoutData();
    });
  }
  
  /**
   * 刷新 EVE Scout 数据
   */
  async _refreshEveScoutData() {
    if (typeof eveScoutService === 'undefined') {
      this.toast.show('EVE Scout 服务不可用', 'error');
      return;
    }
    
    this.elements.refreshEveScoutBtn?.classList.add('spinning');
    
    try {
      eveScoutService.clearCache();
      const records = await eveScoutService.getWormholeRecords();
      this.wormholeManager.setEveScoutRecords(records);
      this.toast.show('EVE Scout 数据已刷新');
    } catch (error) {
      this.toast.show('刷新失败: ' + error.message, 'error');
    } finally {
      this.elements.refreshEveScoutBtn?.classList.remove('spinning');
    }
  }
  
  /**
   * 启动 EVE Scout 自动刷新（每分钟）
   */
  _startEveScoutAutoRefresh() {
    // 清除已有的定时器
    if (this.eveScoutRefreshTimer) {
      clearInterval(this.eveScoutRefreshTimer);
    }
    
    // 每分钟自动刷新
    this.eveScoutRefreshTimer = setInterval(() => {
      console.log('[App] 自动刷新 EVE Scout 数据...');
      this._loadEveScoutData();
    }, 60 * 1000); // 60秒 = 1分钟
    
    console.log('[App] EVE Scout 自动刷新已启动（每分钟）');
    
    // 页面卸载时清理定时器
    window.addEventListener('beforeunload', () => {
      this._stopEveScoutAutoRefresh();
    });
  }
  
  /**
   * 停止 EVE Scout 自动刷新
   */
  _stopEveScoutAutoRefresh() {
    if (this.eveScoutRefreshTimer) {
      clearInterval(this.eveScoutRefreshTimer);
      this.eveScoutRefreshTimer = null;
      console.log('[App] EVE Scout 自动刷新已停止');
    }
  }
  
  /**
   * 选择星域
   */
  selectRegion(regionId, systemId = null, centerOnTarget = false) {
    if (this.currentRegionId === regionId && !systemId) return;
    
    this.currentRegionId = regionId;
    this.elements.regionSelect.value = regionId;
    
    const data = this.dataLoader.getRegionData(regionId);
    if (!data) {
      this.toast.show('无法加载星域数据', 'error');
      return;
    }
    
    this.renderer.setData(data, centerOnTarget);
    
    if (systemId) {
      const system = data.systems.find(s => s.id === systemId) ||
                     data.externalSystems.find(s => s.id === systemId);
      if (system) {
        this.renderer.setSelectedSystem(system);
        this._updateSystemInfo(system);
        if (centerOnTarget) {
          this.renderer.centerOnSystem(system);
        }
      }
    } else {
      this._updateSystemInfo(null);
    }
    
    // 触发路径更新以重新计算 EVE Scout 连接（无论是否有路径）
    this.pathManager._notifyUpdate();
    
    this.toast.show(`已切换到: ${data.region.name}`);
  }
  
  /**
   * 系统悬停回调
   */
  onSystemHover(system) {
    // 可以添加悬停提示
  }
  
  /**
   * 系统选择回调
   */
  onSystemSelect(system) {
    if (!system) {
      this._updateSystemInfo(null);
      return;
    }
    
    // 添加到路径
    this.pathManager.addSystem(system);
    
    // 检测虫洞
    this._detectWormholes();
    
    // 外部星系跳转
    if (system.isExternal) {
      this.toast.show(`正在跳转到 ${system.name}...`);
      this.selectRegion(system.regionID, system.id, true);
      return;
    }
    
    // 虫洞星系特殊处理
    if (system.isWormhole || system.id >= 31000000) {
      this._selectWormholeSystem(system);
      return;
    }
    
    this._updateSystemInfo(system);
  }
  
  /**
   * 选择普通星系（来自搜索）
   */
  _selectSystem(system) {
    this.selectRegion(system.regionID, system.id, true);
    this.toast.show(`已定位到: ${system.name}`);
  }
  
  /**
   * 选择虫洞星系
   */
  _selectWormholeSystem(system) {
    // 获取连接的 K-Space 星系
    const connected = this._getConnectedKSpace(system.id);
    const data = this.dataLoader.getWormholeRegionData(system.id, connected);
    
    if (!data) {
      this.toast.show('无法加载虫洞星系数据', 'error');
      return;
    }
    
    this.currentRegionId = `wormhole-${system.id}`;
    this.elements.regionSelect.value = '';
    
    this.renderer.setData(data, false);
    this.renderer.setSelectedSystem(data.systems[0]);
    this.renderer.centerOnSystem(data.systems[0]);
    
    // 触发路径更新以显示 EVE Scout 连接
    this.pathManager._notifyUpdate();
    
    this.toast.show(`已定位到虫洞星系: ${system.name}`);
    this._updateSystemInfo(data.systems[0]);
  }
  
  /**
   * 获取与虫洞连接的 K-Space 星系
   */
  _getConnectedKSpace(wormholeId) {
    const connected = [];
    const pathData = this.pathManager.getPathData();
    
    for (const conn of pathData.connections) {
      if (conn.from.id === wormholeId && conn.to.id < 31000000) {
        const system = this.dataLoader.systems.get(conn.to.id);
        if (system) connected.push({ system, signal: '未知' });
      } else if (conn.to.id === wormholeId && conn.from.id < 31000000) {
        const system = this.dataLoader.systems.get(conn.from.id);
        if (system) connected.push({ system, signal: '未知' });
      }
    }
    
    return connected;
  }
  
  /**
   * 检测虫洞
   */
  _detectWormholes() {
    const pathData = this.pathManager.getPathData();
    
    for (const conn of pathData.connections) {
      const hasStargate = this.dataLoader.hasStargateConnection(
        conn.from.id, conn.to.id
      );
      
      if (!hasStargate) {
        const wormhole = this.wormholeManager.detectWormhole(
          conn.from, conn.to
        );
        
        if (wormhole) {
          this.eventBus.emit(Events.WORMHOLE_DETECTED, wormhole);
        }
      }
    }
  }
  
  /**
   * 更新系统信息面板
   */
  _updateSystemInfo(system) {
    const container = this.elements.systemInfo;
    if (!container) return;
    
    if (!system) {
      container.innerHTML = '<p class="placeholder">悬停或点击星系查看详情</p>';
      return;
    }
    
    // 构建信息 HTML
    let html = `
      <div class="info-row">
        <span class="info-label">名称</span>
        <span class="info-value">${system.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">安全等级</span>
        <span class="info-value ${system.securityClass}">
          ${system.securityStatus.toFixed(2)} (${this._getSecurityText(system.securityClass)})
        </span>
      </div>
    `;
    
    if (system.isBorder) {
      html += `
        <div class="info-row">
          <span class="info-label">类型</span>
          <span class="info-value" style="color: #5ac75a;">入口星系</span>
        </div>
      `;
    }
    
    if (system.isExternal) {
      html += `
        <div class="info-row">
          <span class="info-label">类型</span>
          <span class="info-value" style="color: #aaa;">相邻星域</span>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
  
  /**
   * 获取安全等级文本
   */
  _getSecurityText(securityClass) {
    const texts = { high: '高安', low: '低安', null: '00区' };
    return texts[securityClass] || '未知';
  }
  
  /**
   * 更新路径面板
   */
  _updatePathPanel() {
    const container = this.elements.pathList;
    if (!container) return;
    
    const visitOrder = this.pathManager.getVisitOrder();
    
    if (visitOrder.length === 0) {
      container.innerHTML = '<p class="placeholder">点击星系记录路径</p>';
      return;
    }
    
    let html = '';
    visitOrder.forEach((item, index) => {
      const isInDisplay = index >= visitOrder.length - this.pathManager.recorder.maxDisplay;
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
  }
  
  /**
   * 聚焦到指定系统
   */
  _focusOnSystem(regionId, systemId) {
    if (systemId >= 31000000) {
      const system = this.dataLoader.systems.getWormhole(systemId);
      if (system) this._selectWormholeSystem(system);
      return;
    }
    
    this.selectRegion(regionId, systemId, true);
  }
  
  /**
   * 显示虫洞对话框
   */
  _showWormholeDialog(fromSystem, toSystem) {
    // 移除已有对话框
    const existing = document.querySelector('.wormhole-dialog');
    if (existing) existing.remove();
    
    const dialog = document.createElement('div');
    dialog.className = 'wormhole-dialog';
    dialog.innerHTML = `
      <div class="wormhole-dialog-content">
        <h3>发现虫洞连接</h3>
        <p>${fromSystem.name} ↔ ${toSystem.name}</p>
        <div class="wormhole-form">
          <div class="form-row">
            <label>虫洞类型:</label>
            <input type="text" id="wh-type" value="K162" placeholder="K162" maxlength="6">
          </div>
          <div class="form-row">
            <label>${fromSystem.name} 信号:</label>
            <input type="text" id="wh-from-sig" placeholder="ABC-123" maxlength="10">
          </div>
          <div class="form-row">
            <label>${toSystem.name} 信号:</label>
            <input type="text" id="wh-to-sig" placeholder="XYZ-789" maxlength="10">
          </div>
          <div class="form-row">
            <label>虫洞大小:</label>
            <select id="wh-size">
              <option value="S">S (护卫舰)</option>
              <option value="M" selected>M (巡洋舰)</option>
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
    
    // 绑定事件
    dialog.querySelector('.btn-cancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.btn-save').addEventListener('click', () => {
      const type = dialog.querySelector('#wh-type').value.trim().toUpperCase();
      if (!this.wormholeManager.isValidType(type)) {
        this.toast.show('请输入有效的虫洞类型', 'error');
        return;
      }
      
      this.wormholeManager.addLocalRecord({
        fromSystem: fromSystem.name,
        toSystem: toSystem.name,
        fromSignal: dialog.querySelector('#wh-from-sig').value || '未知',
        toSignal: dialog.querySelector('#wh-to-sig').value || '未知',
        type,
        size: dialog.querySelector('#wh-size').value,
        maxLife: dialog.querySelector('#wh-life').value
      });
      
      dialog.remove();
      this.toast.show('虫洞已记录');
    });
    
    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }
  
  /**
   * 更新虫洞表格
   */
  _updateWormholeTable() {
    const container = this.elements.wormholeTable;
    if (!container) return;
    
    const records = this.wormholeManager.getFilteredRecords();
    
    if (records.length === 0) {
      const emptyText = this.wormholeManager.filter === 'evescout' 
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
    
    records.forEach((record) => {
      const remaining = record.getRemainingTime();
      const expired = remaining === '已过期';
      const bookmarks = record.getBookmarks();
      const sourceLabel = record.getSourceLabel();
      const sourceTitle = record.getSourceTitle();
      const isEditable = record.isEditable();
      
      let bookmarksHtml = '';
      if (bookmarks.length > 0) {
        bookmarksHtml = bookmarks.map((bm) => 
          `<span class="bookmark-tag" data-copy="${bm.copyText}" title="点击复制">${bm.text}</span>`
        ).join('<br>');
      } else {
        bookmarksHtml = '<span class="bookmark-tag-empty">无信号</span>';
      }
      
      let actionButtons = '';
      if (isEditable) {
        actionButtons = `
          <button class="btn-edit-wh" data-record-id="${record.id}">编辑</button>
          <button class="btn-delete-wh" data-record-id="${record.id}">删除</button>
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
    
    // 绑定书签复制
    container.querySelectorAll('.bookmark-tag').forEach(tag => {
      tag.addEventListener('click', async () => {
        const text = tag.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
          this.toast.show('已复制: ' + text);
        } catch (err) {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          this.toast.show('已复制: ' + text);
        }
      });
    });
    
    // 绑定删除按钮
    container.querySelectorAll('.btn-delete-wh').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recordId = e.target.dataset.recordId;
        this.wormholeManager.deleteLocalRecord(recordId);
      });
    });
  }
  
  /**
   * 渲染搜索结果
   */
  _renderSearchResults(results, query) {
    const container = this.elements.searchResults;
    if (!container) return;
    
    if (results.length === 0) {
      container.innerHTML = '<div class="search-no-results">未找到匹配的星系</div>';
      container.classList.add('show');
      return;
    }
    
    container.innerHTML = results.map(item => `
      <div class="search-result-item" data-system-id="${item.system.id}">
        <div class="system-name">
          ${item.highlightedName}
          <span class="security-badge ${item.system.securityClass}">
            ${item.system.securityStatus.toFixed(1)}
          </span>
        </div>
        <div class="region-name">${item.regionName}</div>
      </div>
    `).join('');
    
    container.classList.add('show');
    
    // 绑定点击事件
    container.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const systemId = parseInt(el.dataset.systemId);
        const result = results.find(r => r.system.id === systemId);
        if (result) this.searchManager.select(result);
        this._hideSearchResults();
      });
    });
  }
  
  /**
   * 隐藏搜索结果
   */
  _hideSearchResults() {
    this.elements.searchResults?.classList.remove('show');
  }
  
  /**
   * 显示/隐藏加载遮罩
   */
  _showLoading(show) {
    this.elements.loadingMask?.classList.toggle('hidden', !show);
  }
  
  /**
   * 加载 EVE Scout 数据
   */
  async _loadEveScoutData() {
    if (typeof eveScoutService === 'undefined') return;
    
    try {
      // 传入 dataLoader 以转换星系名称为中文
      const records = await eveScoutService.getWormholeRecords(this.dataLoader);
      console.log('[App] EVE Scout 加载记录数:', records.length);
      this.wormholeManager.setEveScoutRecords(records);
      // 触发路径更新以显示 EVE Scout 连接（无论是否有路径）
      this.pathManager._notifyUpdate();
    } catch (error) {
      console.warn('[App] EVE Scout 加载失败:', error);
    }
  }
  
  /**
   * 清除路径
   */
  clearPath() {
    this.pathManager.clear();
    this.toast.show('路径已清除');
  }
}
// Last modified: 2026年 2月20日 星期五 23时41分21秒 CST
