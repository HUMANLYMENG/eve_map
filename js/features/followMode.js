/**
 * @fileoverview 跟随模式控制器
 * 管理角色跟随功能，自动记录路径
 */

/**
 * 跟随模式类
 */
export class FollowMode {
  /**
   * @param {RoleManager} roleManager - 角色管理器
   * @param {PathManager} pathManager - 路径管理器
   * @param {MapRenderer} renderer - 地图渲染器
   */
  constructor(roleManager, pathManager, renderer) {
    this.roleManager = roleManager;
    this.pathManager = pathManager;
    this.renderer = renderer;
    
    this._isFollowing = false;
    this._currentRole = null;
    this._lastSystemId = null;
    this._statusCallbacks = [];
    this._systemChangeCallbacks = [];
    
    // 绑定角色管理器的星系变化回调
    this._setupRoleManagerCallback();
  }

  /**
   * 设置角色管理器的回调
   * @private
   */
  _setupRoleManagerCallback() {
    this.roleManager.onSystemChange((roleName, system) => {
      if (this._isFollowing && this._currentRole === roleName) {
        this.handleSystemChange(roleName, system);
      }
    });
  }

  /**
   * 是否正在跟随模式
   * @returns {boolean}
   */
  isFollowing() {
    return this._isFollowing;
  }

  /**
   * 获取当前跟随的角色名
   * @returns {string|null}
   */
  getCurrentRole() {
    return this._currentRole;
  }

  /**
   * 启动跟随模式
   * @param {string} roleName - 角色名
   * @returns {Promise<boolean>} - 是否成功启动
   */
  async startFollowing(roleName) {
    const role = this.roleManager.getRole(roleName);
    if (!role) {
      console.error(`[FollowMode] 角色不存在: ${roleName}`);
      return false;
    }

    // 如果已经在跟随其他角色，先停止
    if (this._isFollowing) {
      this.stopFollowing();
    }

    // 清空现有路径
    this.pathManager.clear();
    this._lastSystemId = null;

    // 获取当前星系并添加为第一个点
    const currentSystemResult = await this.roleManager.getCurrentSystem(roleName);
    if (currentSystemResult && currentSystemResult.system) {
      this.pathManager.addSystem(currentSystemResult.system);
      this._lastSystemId = currentSystemResult.system.id;
      this.renderer.centerOnSystem(currentSystemResult.system);
      this.renderer.setPathData(
        this.pathManager.getDisplayPath(),
        this.pathManager.getDisplayConnections()
      );
    }

    // 启动角色监控
    this.roleManager.startWatching(roleName, 1000);
    
    this._isFollowing = true;
    this._currentRole = roleName;

    // 触发状态变化回调
    this._notifyStatusChange({
      isFollowing: true,
      role: roleName,
      currentSystem: currentSystemResult?.system || null
    });

    console.log(`[FollowMode] 开始跟随角色: ${roleName}`);
    return true;
  }

  /**
   * 停止跟随模式
   */
  stopFollowing() {
    if (!this._isFollowing) return;

    const roleName = this._currentRole;
    
    // 停止角色监控
    this.roleManager.stopWatching(roleName);
    
    this._isFollowing = false;
    this._currentRole = null;
    this._lastSystemId = null;

    // 触发状态变化回调
    this._notifyStatusChange({
      isFollowing: false,
      role: null,
      currentSystem: null
    });

    console.log(`[FollowMode] 停止跟随角色: ${roleName}`);
  }

  /**
   * 切换跟随模式
   * @param {string} roleName - 角色名
   * @returns {Promise<boolean>}
   */
  async toggleFollowing(roleName) {
    if (this._isFollowing && this._currentRole === roleName) {
      this.stopFollowing();
      return false;
    } else {
      return await this.startFollowing(roleName);
    }
  }

  /**
   * 处理星系变化
   * @param {string} roleName - 角色名
   * @param {Object} system - 星系数据
   */
  async handleSystemChange(roleName, system) {
    if (!this._isFollowing || this._currentRole !== roleName) return;
    if (!system || !system.id) return;

    // 避免重复添加同一星系
    if (this._lastSystemId === system.id) return;

    // 添加星系到路径
    this.pathManager.addSystem(system);
    this._lastSystemId = system.id;

    // 更新渲染器
    this.renderer.centerOnSystem(system);
    this.renderer.setPathData(
      this.pathManager.getDisplayPath(),
      this.pathManager.getDisplayConnections()
    );

    // 触发星系变化回调
    this._notifySystemChange(roleName, system);

    console.log(`[FollowMode] 角色 ${roleName} 进入星系: ${system.name || system.nameZh}`);
  }

  /**
   * 获取所有可用角色
   * @returns {Array}
   */
  getAvailableRoles() {
    return this.roleManager.getAllRoles();
  }

  /**
   * 获取当前角色信息
   * @returns {Object|null}
   */
  getCurrentRoleInfo() {
    if (!this._currentRole) return null;
    
    const role = this.roleManager.getRole(this._currentRole);
    if (!role) return null;

    return {
      name: role.name,
      currentSystem: role.currentSystem,
      isChineseClient: role.isChineseClient,
      fileName: role.fileName
    };
  }

  /**
   * 注册状态变化回调
   * @param {Function} callback - (status) => void
   */
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this._statusCallbacks.push(callback);
    }
  }

  /**
   * 注册星系变化回调
   * @param {Function} callback - (roleName, system) => void
   */
  onSystemChange(callback) {
    if (typeof callback === 'function') {
      this._systemChangeCallbacks.push(callback);
    }
  }

  /**
   * 触发状态变化通知
   * @private
   */
  _notifyStatusChange(status) {
    for (const callback of this._statusCallbacks) {
      try {
        callback(status);
      } catch (e) {
        console.error('[FollowMode] 状态回调执行失败:', e);
      }
    }
  }

  /**
   * 触发星系变化通知
   * @private
   */
  _notifySystemChange(roleName, system) {
    for (const callback of this._systemChangeCallbacks) {
      try {
        callback(roleName, system);
      } catch (e) {
        console.error('[FollowMode] 星系变化回调执行失败:', e);
      }
    }
  }
}

// 默认导出
export default FollowMode;
