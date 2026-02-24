/**
 * @fileoverview 角色面板 UI
 * 显示角色列表、跟随控制按钮和当前状态
 */

/**
 * 角色面板类
 */
export class RolePanel {
  constructor(containerId, followMode) {
    this.container = document.getElementById(containerId);
    this.followMode = followMode;
    this.elements = {};
    
    this._init();
  }

  /**
   * 初始化面板
   * @private
   */
  _init() {
    if (!this.container) {
      console.error('[RolePanel] 容器元素不存在:', this.container);
      return;
    }

    this._buildUI();
    this._bindEvents();
    
    // 注册跟随模式回调
    this.followMode.onStatusChange((status) => {
      this._updateStatus(status);
    });
  }

  /**
   * 构建 UI
   * @private
   */
  _buildUI() {
    this.container.innerHTML = `
      <div class="role-panel">
        <div class="role-panel-header">
          <h3>角色跟随</h3>
          <span class="role-status-indicator" id="roleStatusIndicator">●</span>
        </div>
        
        <div class="role-controls">
          <div class="role-select-row">
            <label>选择角色:</label>
            <select id="roleSelect" class="role-select">
              <option value="">-- 选择角色 --</option>
            </select>
          </div>
          
          <div class="role-buttons">
            <button id="btnRefreshRoles" class="btn-secondary" title="刷新角色列表">🔄</button>
            <button id="btnToggleFollow" class="btn-primary" disabled>开始跟随</button>
          </div>
        </div>
        
        <div class="role-current-info" id="roleCurrentInfo" style="display: none;">
          <div class="info-row">
            <span class="info-label">当前角色:</span>
            <span class="info-value" id="currentRoleName">-</span>
          </div>
          <div class="info-row">
            <span class="info-label">所在星系:</span>
            <span class="info-value" id="currentSystemName">-</span>
          </div>
          <div class="info-row">
            <span class="info-label">安全等级:</span>
            <span class="info-value" id="currentSecurityStatus">-</span>
          </div>
        </div>
        
        <div class="role-list-section">
          <h4>可用角色</h4>
          <div class="role-list" id="roleList">
            <p class="placeholder">暂无角色，请选择日志目录</p>
          </div>
        </div>
        
        <div class="role-log-path">
          <label>日志目录:</label>
          <div class="path-row">
            <input type="text" id="logPathInput" readonly placeholder="选择 EVE 日志目录..." />
            <button id="btnSelectLogDir" class="btn-secondary">浏览...</button>
          </div>
        </div>
      </div>
    `;

    // 缓存元素引用
    this.elements = {
      roleSelect: this.container.querySelector('#roleSelect'),
      btnRefreshRoles: this.container.querySelector('#btnRefreshRoles'),
      btnToggleFollow: this.container.querySelector('#btnToggleFollow'),
      btnSelectLogDir: this.container.querySelector('#btnSelectLogDir'),
      logPathInput: this.container.querySelector('#logPathInput'),
      roleList: this.container.querySelector('#roleList'),
      roleCurrentInfo: this.container.querySelector('#roleCurrentInfo'),
      currentRoleName: this.container.querySelector('#currentRoleName'),
      currentSystemName: this.container.querySelector('#currentSystemName'),
      currentSecurityStatus: this.container.querySelector('#currentSecurityStatus'),
      statusIndicator: this.container.querySelector('#roleStatusIndicator')
    };
  }

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    // 选择角色
    this.elements.roleSelect.addEventListener('change', (e) => {
      const roleName = e.target.value;
      this.elements.btnToggleFollow.disabled = !roleName;
      
      if (roleName) {
        const role = this.followMode.getAvailableRoles().find(r => r.name === roleName);
        if (role) {
          this._showRolePreview(role);
        }
      }
    });

    // 开始/停止跟随
    this.elements.btnToggleFollow.addEventListener('click', async () => {
      const roleName = this.elements.roleSelect.value;
      if (!roleName) return;

      if (this.followMode.isFollowing()) {
        this.followMode.stopFollowing();
      } else {
        const success = await this.followMode.startFollowing(roleName);
        if (!success) {
          this.showError('启动跟随失败，请检查角色状态');
        }
      }
    });

    // 刷新角色列表
    this.elements.btnRefreshRoles.addEventListener('click', () => {
      this.refreshRoles();
    });

    // 选择日志目录
    this.elements.btnSelectLogDir.addEventListener('click', () => {
      this._selectLogDirectory();
    });
  }

  /**
   * 更新状态显示
   * @private
   */
  _updateStatus(status) {
    const { isFollowing, role, currentSystem } = status;
    
    // 更新状态指示器
    if (isFollowing) {
      this.elements.statusIndicator.classList.add('active');
      this.elements.btnToggleFollow.textContent = '停止跟随';
      this.elements.btnToggleFollow.classList.add('btn-danger');
      this.elements.btnToggleFollow.classList.remove('btn-primary');
      this.elements.roleSelect.disabled = true;
    } else {
      this.elements.statusIndicator.classList.remove('active');
      this.elements.btnToggleFollow.textContent = '开始跟随';
      this.elements.btnToggleFollow.classList.remove('btn-danger');
      this.elements.btnToggleFollow.classList.add('btn-primary');
      this.elements.roleSelect.disabled = false;
    }

    // 更新当前信息
    if (isFollowing && currentSystem) {
      this.elements.roleCurrentInfo.style.display = 'block';
      this.elements.currentRoleName.textContent = role;
      this.elements.currentSystemName.textContent = 
        currentSystem.nameZh || currentSystem.name;
      
      const security = currentSystem.securityStatus;
      if (security !== undefined) {
        const secText = security.toFixed(1);
        const secClass = security >= 0.5 ? 'high' : security > 0 ? 'low' : 'null';
        this.elements.currentSecurityStatus.innerHTML = 
          `<span class="security-${secClass}">${secText}</span>`;
      }
    } else {
      this.elements.roleCurrentInfo.style.display = 'none';
    }
  }

  /**
   * 显示角色预览
   * @private
   */
  _showRolePreview(role) {
    // 可以在这里显示角色的预览信息
  }

  /**
   * 刷新角色列表
   */
  refreshRoles() {
    const roles = this.followMode.getAvailableRoles();
    
    // 更新下拉框
    const select = this.elements.roleSelect;
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">-- 选择角色 --</option>';
    
    for (const role of roles) {
      const option = document.createElement('option');
      option.value = role.name;
      option.textContent = role.name;
      select.appendChild(option);
    }
    
    // 恢复选择
    if (currentValue && roles.find(r => r.name === currentValue)) {
      select.value = currentValue;
    }

    // 更新角色列表显示
    this._updateRoleList(roles);
  }

  /**
   * 更新角色列表显示
   * @private
   */
  _updateRoleList(roles) {
    const list = this.elements.roleList;
    
    if (roles.length === 0) {
      list.innerHTML = '<p class="placeholder">暂无角色，请选择日志目录</p>';
      return;
    }

    list.innerHTML = '';
    for (const role of roles) {
      const item = document.createElement('div');
      item.className = 'role-list-item';
      
      const isFollowing = this.followMode.isFollowing() && 
                         this.followMode.getCurrentRole() === role.name;
      
      item.innerHTML = `
        <span class="role-name ${isFollowing ? 'active' : ''}">${role.name}</span>
        <span class="role-client ${role.isChineseClient ? 'zh' : 'en'}">
          ${role.isChineseClient ? '中' : 'EN'}
        </span>
        ${isFollowing ? '<span class="role-following">跟随中</span>' : ''}
      `;
      
      list.appendChild(item);
    }
  }

  /**
   * 选择日志目录
   * @private
   */
  async _selectLogDirectory() {
    try {
      // 检查是否支持 File System Access API
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker();
        
        // 验证目录名称包含 Chatlogs 或者是 EVE/logs
        let isValidDir = dirHandle.name.toLowerCase() === 'chatlogs' ||
                        dirHandle.name.toLowerCase().includes('eve');
        
        if (!isValidDir) {
          this.showError('请选择 EVE 的 Chatlogs 目录');
          return;
        }

        this.elements.logPathInput.value = dirHandle.name;
        
        // 触发扫描事件
        this._onDirectorySelected(dirHandle);
      } else {
        this.showError('您的浏览器不支持文件系统访问，请使用 Chrome/Edge');
      }
    } catch (e) {
      // 用户取消选择
      if (e.name !== 'AbortError') {
        console.error('[RolePanel] 选择目录失败:', e);
        this.showError('选择目录失败');
      }
    }
  }

  /**
   * 目录选择后的处理
   * @private
   */
  _onDirectorySelected(dirHandle) {
    // 触发外部事件，让主应用处理扫描
    const event = new CustomEvent('role:directorySelected', {
      detail: { dirHandle }
    });
    document.dispatchEvent(event);
  }

  /**
   * 设置日志路径（用于初始化）
   * @param {string} path - 路径显示文本
   */
  setLogPath(path) {
    this.elements.logPathInput.value = path;
  }

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   */
  showError(message) {
    // 可以使用 toast 或 alert
    console.error('[RolePanel]', message);
    
    // 简单的视觉反馈
    const indicator = this.elements.statusIndicator;
    indicator.classList.add('error');
    setTimeout(() => indicator.classList.remove('error'), 1000);
  }

  /**
   * 销毁面板
   */
  destroy() {
    this.container.innerHTML = '';
  }
}

// 默认导出
export default RolePanel;
