/**
 * 星门连线层渲染器
 */

import { RenderLayer } from './base.js';

export class ConnectionsLayer extends RenderLayer {
  constructor(ctx, viewport) {
    super(ctx, viewport);
    this.styles = {
      internal: {
        color: 'rgba(255, 255, 255, 0.35)',
        width: 0.8
      },
      external: {
        color: 'rgba(255, 255, 255, 0.35)',
        width: 0.8,
        dash: [3, 3]
      }
    };
  }
  
  render(data) {
    if (!data) return;
    
    this._drawInternalConnections(data.internalConnections);
    this._drawExternalConnections(data.externalConnections);
  }
  
  /**
   * 绘制内部连接
   */
  _drawInternalConnections(connections) {
    if (!connections || connections.length === 0) return;
    
    const { ctx } = this;
    const style = this.styles.internal;
    
    ctx.strokeStyle = style.color;
    ctx.lineWidth = this.getScaledSize(style.width);
    ctx.setLineDash([]);
    
    ctx.beginPath();
    for (const conn of connections) {
      const from = this.worldToScreen(conn.fromPos);
      const to = this.worldToScreen(conn.toPos);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
  }
  
  /**
   * 绘制外部连接
   */
  _drawExternalConnections(connections) {
    if (!connections || connections.length === 0) return;
    
    const { ctx } = this;
    const style = this.styles.external;
    
    ctx.strokeStyle = style.color;
    ctx.lineWidth = this.getScaledSize(style.width);
    const dashScale = this.getScaledSize(1);
    ctx.setLineDash(style.dash.map(d => d * dashScale));
    
    ctx.beginPath();
    for (const conn of connections) {
      const from = this.worldToScreen(conn.fromPos);
      const to = this.worldToScreen(conn.toPos);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
    
    ctx.setLineDash([]);
  }
}
