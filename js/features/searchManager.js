/**
 * 搜索管理器
 */

import { debounce, highlightMatch } from '../core/utils.js';

export class SearchManager {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.results = [];
    this.onResults = null;
    this.onSelect = null;
    this.debouncedSearch = debounce(this._doSearch.bind(this), 200);
  }
  
  /**
   * 搜索星系
   */
  search(query) {
    if (!query || query.length < 2) {
      this._clearResults();
      return;
    }
    
    this.debouncedSearch(query);
  }
  
  /**
   * 执行搜索
   */
  _doSearch(query) {
    const results = this.dataLoader.searchSystems(query, 20);
    
    this.results = results.map(item => ({
      system: item,
      regionName: this._getRegionName(item),
      isWormhole: item.isWormhole || item.id >= 31000000,
      highlightedName: highlightMatch(item.name, query)
    }));
    
    if (this.onResults) {
      this.onResults(this.results, query);
    }
  }
  
  /**
   * 获取星域名称
   */
  _getRegionName(system) {
    if (system.isWormhole || system.id >= 31000000) {
      return '虫洞星系';
    }
    return this.dataLoader.getRegionName(system.regionID);
  }
  
  /**
   * 选择结果
   */
  select(result) {
    if (this.onSelect) {
      this.onSelect(result);
    }
    this._clearResults();
  }
  
  /**
   * 清空结果
   */
  _clearResults() {
    this.results = [];
    if (this.onResults) {
      this.onResults([], '');
    }
  }
  
  /**
   * 关闭搜索
   */
  close() {
    this._clearResults();
  }
  
  /**
   * 设置结果回调
   */
  onResultsCallback(callback) {
    this.onResults = callback;
  }
  
  /**
   * 设置选择回调
   */
  onSelectCallback(callback) {
    this.onSelect = callback;
  }
}
