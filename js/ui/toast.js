/**
 * Toast 提示组件
 */

export class Toast {
  constructor(element) {
    this.element = element;
    this.hideTimer = null;
  }
  
  /**
   * 显示提示
   */
  show(message, type = 'info', duration = 3000) {
    // 清除之前的定时器
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
    
    // 设置内容和样式
    this.element.textContent = message;
    this.element.className = 'toast show';
    
    if (type === 'error') {
      this.element.style.borderColor = '#ff4444';
      this.element.style.color = '#ff8888';
    } else {
      this.element.style.borderColor = '';
      this.element.style.color = '';
    }
    
    // 自动隐藏
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, duration);
  }
  
  /**
   * 隐藏提示
   */
  hide() {
    this.element.classList.remove('show');
  }
}

/**
 * 创建 Toast 便捷函数
 */
export function createToast(container) {
  const element = document.createElement('div');
  element.id = 'toast';
  element.className = 'toast';
  container.appendChild(element);
  
  return new Toast(element);
}
