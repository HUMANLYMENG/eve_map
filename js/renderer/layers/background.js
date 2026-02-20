/**
 * 背景层渲染器
 */

import { RenderLayer } from './base.js';
import { RENDER_CONFIG } from '../../core/config.js';

export class BackgroundLayer extends RenderLayer {
  constructor(ctx, viewport) {
    super(ctx, viewport);
    this.gridSize = RENDER_CONFIG.GRID_SIZE;
  }
  
  render() {
    this._drawGradient();
    this._drawGrid();
  }
  
  /**
   * 绘制渐变背景
   */
  _drawGradient() {
    const { ctx, viewport } = this;
    const { width, height } = viewport;
    
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height)
    );
    gradient.addColorStop(0, '#1a1515');
    gradient.addColorStop(1, '#0a0808');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  /**
   * 绘制网格
   */
  _drawGrid() {
    const { ctx, viewport } = this;
    const gridSize = this.gridSize * viewport.zoom;
    
    if (gridSize < 30) return;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    
    const offsetX = viewport.x % gridSize;
    const offsetY = viewport.y % gridSize;
    
    ctx.beginPath();
    for (let x = offsetX; x < viewport.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
    }
    for (let y = offsetY; y < viewport.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.width, y);
    }
    ctx.stroke();
  }
}
