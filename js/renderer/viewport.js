/**
 * 视口管理模块
 * 处理坐标转换、缩放、平移
 */

import { RENDER_CONFIG } from '../core/config.js';
import { isValidNumber, clamp } from '../core/utils.js';

export class Viewport {
  constructor(width = 800, height = 600) {
    this.x = 0;
    this.y = 0;
    this.zoom = RENDER_CONFIG.DEFAULT_ZOOM;
    this.width = width;
    this.height = height;
    
    // 参考缩放（fitToBounds 时的 zoom）
    this.referenceZoom = RENDER_CONFIG.DEFAULT_ZOOM;
  }
  
  /**
   * 世界坐标转屏幕坐标
   */
  worldToScreen(worldPos) {
    const zoom = isValidNumber(this.zoom) ? this.zoom : RENDER_CONFIG.DEFAULT_ZOOM;
    return {
      x: worldPos.x * zoom + this.x,
      y: -worldPos.y * zoom + this.y  // Y轴翻转
    };
  }
  
  /**
   * 屏幕坐标转世界坐标
   */
  screenToWorld(screenPos) {
    const zoom = isValidNumber(this.zoom) && this.zoom !== 0 
      ? this.zoom 
      : RENDER_CONFIG.DEFAULT_ZOOM;
    return {
      x: (screenPos.x - this.x) / zoom,
      y: -(screenPos.y - this.y) / zoom
    };
  }
  
  /**
   * 根据边界自适应
   */
  fitToBounds(bounds, padding = 40) {
    const availableWidth = this.width - padding * 2;
    const availableHeight = this.height - padding * 2;
    
    if (!bounds || bounds.width === 0 || bounds.height === 0 ||
        !isValidNumber(bounds.width) || !isValidNumber(bounds.height)) {
      this.zoom = RENDER_CONFIG.DEFAULT_ZOOM;
      this.x = this.width / 2;
      this.y = this.height / 2;
      this._updateReferenceZoom(bounds);
      return;
    }
    
    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    let zoom = Math.min(scaleX, scaleY) * 0.9;
    
    if (!isValidNumber(zoom) || zoom <= 0) {
      zoom = RENDER_CONFIG.DEFAULT_ZOOM;
    }
    
    this.zoom = zoom;
    this.x = this.width / 2 - bounds.centerX * this.zoom;
    this.y = this.height / 2 + bounds.centerY * this.zoom;
    
    this._updateReferenceZoom(bounds);
    this.clampZoom();
  }
  
  /**
   * 居中到指定系统
   */
  centerOnSystem(system, zoomLevel = null) {
    if (!system) return;
    
    let zoom = zoomLevel;
    // 如果没有指定缩放，使用适合当前星域的参考缩放
    if (!isValidNumber(zoom) || zoom <= 0) {
      zoom = this.referenceZoom;
    }
    
    this.zoom = this._clampZoomValue(zoom);
    
    const targetX = system.position2D.x * this.zoom;
    const targetY = system.position2D.y * this.zoom;
    
    this.x = this.width / 2 - targetX;
    this.y = this.height / 2 + targetY;
  }
  
  /**
   * 平移
   */
  pan(deltaX, deltaY) {
    this.x += deltaX;
    this.y += deltaY;
  }
  
  /**
   * 缩放
   */
  zoomAt(factor, centerX, centerY) {
    const oldZoom = isValidNumber(this.zoom) && this.zoom > 0 
      ? this.zoom 
      : this.referenceZoom;
    
    const minZoom = this.referenceZoom * RENDER_CONFIG.MIN_ZOOM_RATIO;
    const maxZoom = this.referenceZoom * RENDER_CONFIG.MAX_ZOOM_RATIO;
    
    const newZoom = clamp(oldZoom * factor, minZoom, maxZoom);
    const zoomFactor = newZoom / oldZoom;
    
    this.x = centerX - (centerX - this.x) * zoomFactor;
    this.y = centerY - (centerY - this.y) * zoomFactor;
    this.zoom = newZoom;
  }
  
  /**
   * 获取缩放比例
   */
  getZoomRatio() {
    if (!isValidNumber(this.referenceZoom) || this.referenceZoom === 0) {
      return 1;
    }
    const ratio = this.zoom / this.referenceZoom;
    return clamp(ratio, RENDER_CONFIG.MIN_ZOOM_RATIO, RENDER_CONFIG.MAX_ZOOM_RATIO);
  }
  
  /**
   * 获取缩放百分比
   */
  getZoomPercentage() {
    return Math.round(this.getZoomRatio() * 100);
  }
  
  /**
   * 更新参考缩放
   */
  _updateReferenceZoom(bounds) {
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      const domainSize = Math.max(bounds.width, bounds.height);
      const viewportSize = Math.min(this.width, this.height);
      this.referenceZoom = (viewportSize / domainSize) * 0.9;
    }
  }
  
  /**
   * 限制缩放范围
   */
  clampZoom() {
    this.zoom = this._clampZoomValue(this.zoom);
  }
  
  /**
   * 限制缩放值
   */
  _clampZoomValue(zoom) {
    if (!isValidNumber(zoom) || zoom <= 0) {
      return this.referenceZoom;
    }
    const minZoom = this.referenceZoom * RENDER_CONFIG.MIN_ZOOM_RATIO;
    const maxZoom = this.referenceZoom * RENDER_CONFIG.MAX_ZOOM_RATIO;
    return clamp(zoom, minZoom, maxZoom);
  }
  
  /**
   * 调整大小
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
}
