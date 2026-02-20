/**
 * 渲染层基类
 */

import { clamp } from '../../core/utils.js';

export class RenderLayer {
  constructor(ctx, viewport) {
    this.ctx = ctx;
    this.viewport = viewport;
    this.visible = true;
  }
  
  /**
   * 渲染方法（子类必须实现）
   */
  render(data) {
    throw new Error('子类必须实现 render 方法');
  }
  
  /**
   * 世界坐标转屏幕坐标
   */
  worldToScreen(worldPos) {
    return this.viewport.worldToScreen(worldPos);
  }
  
  /**
   * 获取缩放后的尺寸
   */
  getScaledSize(baseSize) {
    const ratio = this.viewport.getZoomRatio();
    return baseSize * clamp(ratio, 0.9, 9.0);
  }
  
  /**
   * 绘制圆角矩形
   */
  drawRoundedRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    const r = Math.min(radius, width / 2, height / 2);
    
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
