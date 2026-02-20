/**
 * 地图渲染器主类
 * 协调各个渲染层
 */

import { Viewport } from './viewport.js';
import { BackgroundLayer } from './layers/background.js';
import { ConnectionsLayer } from './layers/connections.js';
import { SystemsLayer } from './layers/systems.js';
import { PathsLayer } from './layers/paths.js';
import { LabelsLayer } from './layers/labels.js';
import { RENDER_CONFIG } from '../core/config.js';

export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // 初始化视口
    this.viewport = new Viewport();
    
    // 初始化渲染层
    this.layers = {
      background: new BackgroundLayer(this.ctx, this.viewport),
      connections: new ConnectionsLayer(this.ctx, this.viewport),
      systems: new SystemsLayer(this.ctx, this.viewport),
      paths: new PathsLayer(this.ctx, this.viewport),
      labels: new LabelsLayer(this.ctx, this.viewport)
    };
    
    // 数据
    this.currentData = null;
    this.hasStargateFn = null; // 外部传入的连接检查函数
    
    // 初始化尺寸
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  /**
   * 调整大小
   */
  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || 
                 { width: 800, height: 600 };
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    
    this.viewport.resize(rect.width, rect.height);
    
    if (this.currentData) {
      this.render();
    }
  }
  
  /**
   * 设置数据
   */
  setData(data, skipFit = false) {
    this.currentData = data;
    this._clearSystemState();
    
    if (data?.bounds && !skipFit) {
      this.viewport.fitToBounds(data.bounds);
    } else if (data?.bounds) {
      // 即使跳过 fit，也要更新参考缩放，确保缩放限制正确
      this.viewport._updateReferenceZoom(data.bounds);
      this.viewport.clampZoom();
    } else {
      this.viewport.clampZoom();
    }
    
    this.render();
  }
  
  /**
   * 设置路径数据
   */
  setPathData(pathSystems, pathConnections) {
    this.layers.paths.setPathData(pathSystems, pathConnections);
    this.render();
  }
  
  /**
   * 设置数据加载器
   */
  setDataLoader(dataLoader) {
    this.dataLoader = dataLoader;
  }
  
  /**
   * 设置星门连接检查函数
   */
  setStargateChecker(fn) {
    this.hasStargateFn = fn;
  }
  
  /**
   * 渲染
   */
  render() {
    if (!this.currentData) return;
    
    const { ctx, viewport } = this;
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    
    // 构建所有系统的映射（用于路径层）
    const allSystems = this._buildAllSystemsMap();
    
    // 按顺序渲染各层
    this.layers.background.render();
    this.layers.connections.render(this.currentData);
    this.layers.systems.render(this.currentData);
    this.layers.paths.render(
      this.currentData, 
      allSystems, 
      this.hasStargateFn || (() => false),
      this.dataLoader
    );
    this.layers.labels.render(this.currentData);
    this._drawZoomIndicator();
  }
  
  /**
   * 构建所有系统的映射
   */
  _buildAllSystemsMap() {
    const map = new Map();
    if (this.currentData) {
      for (const s of this.currentData.systems || []) map.set(s.id, s);
      for (const s of this.currentData.externalSystems || []) map.set(s.id, s);
    }
    return map;
  }
  
  /**
   * 设置悬停系统
   */
  setHoveredSystem(system) {
    if (this.layers.systems.hoveredSystem !== system) {
      this.layers.systems.setHoveredSystem(system);
      this.layers.labels.setHoveredSystem(system);
      this.render();
    }
  }
  
  /**
   * 设置选中系统
   */
  setSelectedSystem(system) {
    if (this.layers.systems.selectedSystem !== system) {
      this.layers.systems.setSelectedSystem(system);
      this.layers.labels.setSelectedSystem(system);
      this.render();
    }
  }
  
  /**
   * 获取屏幕位置的系统
   */
  getSystemAt(screenPos) {
    if (!this.currentData) return null;
    
    const hitRadius = RENDER_CONFIG.HIT_RADIUS;
    const allSystems = [
      ...this.currentData.systems,
      ...(this.currentData.externalSystems || [])
    ];
    
    for (const system of allSystems) {
      const systemScreenPos = this.viewport.worldToScreen(system.position2D);
      const dx = systemScreenPos.x - screenPos.x;
      const dy = systemScreenPos.y - screenPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < hitRadius) {
        return system;
      }
    }
    
    return null;
  }
  
  /**
   * 平移
   */
  pan(deltaX, deltaY) {
    this.viewport.pan(deltaX, deltaY);
    this.render();
  }
  
  /**
   * 缩放
   */
  zoom(factor, centerX, centerY) {
    this.viewport.zoomAt(factor, centerX, centerY);
    this.render();
  }
  
  /**
   * 重置视图
   */
  resetView() {
    if (this.currentData?.bounds) {
      this.viewport.fitToBounds(this.currentData.bounds);
      this.render();
    }
  }
  
  /**
   * 居中到系统
   */
  centerOnSystem(system, zoomLevel = null) {
    this.viewport.centerOnSystem(system, zoomLevel);
    this.render();
  }
  
  /**
   * 获取视口
   */
  getViewport() {
    return this.viewport;
  }
  
  /**
   * 绘制缩放指示器
   */
  _drawZoomIndicator() {
    const { ctx, viewport } = this;
    const percentage = viewport.getZoomPercentage();
    
    // 左下角位置
    const padding = 10;
    const x = padding;
    const y = viewport.height - padding;
    const width = 80;
    const height = 22;
    const radius = 4;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.layers.systems.drawRoundedRect(x, y - height, width, height, radius);
    ctx.fill();
    
    // 文字
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Zoom: ${percentage}%`, x + 8, y - 6);
  }
  
  /**
   * 清除系统状态
   */
  _clearSystemState() {
    this.layers.systems.setHoveredSystem(null);
    this.layers.systems.setSelectedSystem(null);
    this.layers.labels.setHoveredSystem(null);
    this.layers.labels.setSelectedSystem(null);
  }
}

export { Viewport };
export * from './layers/base.js';
