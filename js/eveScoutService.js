/**
 * EVE Scout API 服务模块
 * 提供公开虫洞签名数据的获取和管理
 */

class EveScoutService {
    constructor() {
        this.apiUrl = 'https://api.eve-scout.com/v2/public/signatures';
        this.cache = null;
        this.cacheTime = null;
        this.cacheDuration = 5 * 60 * 1000; // 5分钟缓存
        this.lastError = null;
    }

    /**
     * 获取虫洞签名数据
     * @returns {Promise<Array>} 虫洞记录列表
     */
    async fetchSignatures() {
        // 检查缓存
        if (this.cache && this.cacheTime && 
            (Date.now() - this.cacheTime) < this.cacheDuration) {
            console.log('[EveScout] 使用缓存数据');
            return this.cache;
        }

        try {
            console.log('[EveScout] 请求 API:', this.apiUrl);
            
            const response = await fetch(this.apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // 验证数据格式
            if (!Array.isArray(data)) {
                throw new Error('API 返回数据格式错误');
            }

            // 更新缓存
            this.cache = data;
            this.cacheTime = Date.now();
            this.lastError = null;

            console.log(`[EveScout] 获取到 ${data.length} 条虫洞记录`);
            return data;

        } catch (error) {
            console.error('[EveScout] API 请求失败:', error);
            this.lastError = error.message;
            
            // 如果有缓存，返回过期缓存作为降级
            if (this.cache) {
                console.log('[EveScout] 使用过期缓存');
                return this.cache;
            }
            
            throw error;
        }
    }

    /**
     * 将 API 数据转换为项目内部格式
     * @param {Object} apiData - API 返回的原始数据
     * @returns {Object} 转换后的虫洞记录
     */
    convertToWormholeRecord(apiData, dataLoader = null) {
        // 尺寸映射（英文到中文）
        const sizeMap = {
            'xlarge': '旗舰 (XL)',
            'large': '战列 (L)',
            'medium': '巡洋 (M)',
            'small': '护卫 (S)',
            'capital': '旗舰 (XL)',
            'frigate': '护卫 (S)'
        };

        // 虫洞等级/类型映射
        const classMap = {
            'highsec': '高安',
            'lowsec': '低安', 
            'nullsec': '00区',
            'c1': 'C1',
            'c2': 'C2',
            'c3': 'C3',
            'c4': 'C4',
            'c5': 'C5',
            'c6': 'C6',
            1: 'C1',
            2: 'C2',
            3: 'C3',
            4: 'C4',
            5: 'C5',
            6: 'C6',
            7: '高安',
            8: '低安',
            9: '00区',
            12: 'C12',
            13: 'C13',
            14: 'C14',
            15: 'C15',
            16: 'C16',
            17: 'C17',
            18: 'C18'
        };

        // 解析过期时间
        const expiresAt = new Date(apiData.expires_at).getTime();
        
        // 计算剩余时间（毫秒）
        const remainingMs = expiresAt - Date.now();

        // 转换星系名称为中文（如果可用）
        const fromSystemName = this.getSystemNameInChinese(
            apiData.in_system_id, 
            apiData.in_system_name,
            dataLoader
        );
        const toSystemName = this.getSystemNameInChinese(
            apiData.out_system_id, 
            apiData.out_system_name,
            dataLoader
        );

        // 转换虫洞等级为中文
        const inClass = apiData.in_system_class;
        const outClass = apiData.out_system_class;
        const inClassName = classMap[inClass] || (typeof inClass === 'number' ? `C${inClass}` : String(inClass));
        const outClassName = classMap[outClass] || (typeof outClass === 'number' ? `C${outClass}` : String(outClass));

        return {
            // 核心字段
            id: `es-${apiData.id}`,
            fromSystem: fromSystemName,
            toSystem: toSystemName,
            fromSignal: apiData.in_signature || '未知',
            toSignal: apiData.out_signature || '未知',
            type: apiData.wh_type || '未知',
            size: sizeMap[apiData.max_ship_size] || apiData.max_ship_size || '未知',
            maxLife: this.estimateMaxLife(apiData.remaining_hours),
            
            // 时间字段
            recordTime: new Date(apiData.created_at).getTime(),
            expiresAt: expiresAt,
            remainingMs: remainingMs,
            
            // 来源标记
            source: 'evescout',
            evescoutId: apiData.id,
            
            // 额外信息（中文）
            createdBy: apiData.created_by_name,
            updatedBy: apiData.updated_by_name,
            whExitsOutward: apiData.wh_exits_outward ? '是' : '否',
            inSystemClass: inClassName,
            outSystemClass: outClassName,
            inRegionName: this.getRegionNameInChinese(apiData.in_region_id, apiData.in_region_name, dataLoader),
            outRegionName: this.getRegionNameInChinese(apiData.out_region_id, apiData.out_region_name, dataLoader),
            outSystemId: apiData.out_system_id,
            inSystemId: apiData.in_system_id,
            signatureType: '虫洞',
            completed: apiData.completed ? '是' : '否'
        };
    }

    /**
     * 获取星系的中文名称
     * @param {number} systemId - 星系 ID
     * @param {string} defaultName - 默认名称（英文）
     * @param {Object} dataLoader - 数据加载器实例
     * @returns {string} 中文名称或默认名称
     */
    getSystemNameInChinese(systemId, defaultName, dataLoader = null) {
        // 特殊虫洞星系名称映射（来自 data/mapSolarSystems.yaml）
        // Thera: 31000005 -> 席拉
        // Turnur: 30002086 -> 图尔鲁尔
        const specialWormholeNames = {
            31000005: '席拉',      // Thera
            30002086: '图尔鲁尔'   // Turnur
        };
        
        // 优先处理特殊虫洞星系（不依赖 dataLoader）
        if (specialWormholeNames[systemId]) {
            return specialWormholeNames[systemId];
        }
        
        // 如果通过名称匹配到特殊星系
        if (defaultName === 'Turnur') return '图尔鲁尔';
        if (defaultName === 'Thera') return '席拉';
        
        // 优先使用传入的 dataLoader
        const dl = dataLoader || (typeof window !== 'undefined' && window.dataLoader);
        if (!dl) {
            return defaultName;
        }

        // 尝试在星系中查找（SystemsManager 有 get 方法）
        if (dl.systems && typeof dl.systems.get === 'function') {
            try {
                const system = dl.systems.get(systemId);
                if (system && system.name) {
                    return system.name;
                }
            } catch (e) {
                // 忽略错误
            }
        }
        
        // 备用：直接访问 SystemsManager 内部的 Map
        if (dl.systems) {
            // 尝试访问 systems Map (K-Space)
            if (dl.systems.systems && dl.systems.systems instanceof Map) {
                const system = dl.systems.systems.get(systemId);
                if (system && system.name) {
                    return system.name;
                }
            }
            // 尝试访问 wormholeSystems Map (J-Space)
            if (dl.systems.wormholeSystems && dl.systems.wormholeSystems instanceof Map) {
                const system = dl.systems.wormholeSystems.get(systemId);
                if (system && system.name) {
                    return system.name;
                }
            }
        }

        // 找不到对应的中文名称，返回默认名称
        return defaultName;
    }

    /**
     * 获取星域的中文名称
     * @param {number} regionId - 星域 ID
     * @param {string} defaultName - 默认名称（英文）
     * @param {Object} dataLoader - 数据加载器实例
     * @returns {string} 中文名称或默认名称
     */
    getRegionNameInChinese(regionId, defaultName, dataLoader = null) {
        // 优先使用传入的 dataLoader
        const dl = dataLoader || (typeof window !== 'undefined' && window.dataLoader);
        if (!dl) {
            return defaultName;
        }

        // 尝试在星域数据中查找（RegionsManager 有 get 方法）
        if (dl.regions && typeof dl.regions.get === 'function') {
            try {
                const region = dl.regions.get(regionId);
                if (region && region.name) {
                    return region.name;
                }
            } catch (e) {
                // 忽略错误
            }
        }
        
        // 备用：直接访问内部 Map
        if (dl.regions && dl.regions.regions && dl.regions.regions instanceof Map) {
            const region = dl.regions.regions.get(regionId);
            if (region && region.name) {
                return region.name;
            }
        }

        // 找不到对应的中文名称，返回默认名称
        return defaultName;
    }

    /**
     * 根据剩余小时数估算最大寿命
     * @param {number} remainingHours 
     * @returns {string} '1h' | '4h' | '1d' | '2d'
     */
    estimateMaxLife(remainingHours) {
        if (remainingHours <= 4) return '4小时';
        if (remainingHours <= 16) return '1天';
        return '2天';
    }

    /**
     * 批量转换 API 数据
     * @param {Array} apiDataList 
     * @param {Object} dataLoader - 数据加载器实例
     * @returns {Array}
     */
    convertAll(apiDataList, dataLoader = null) {
        return apiDataList
            .filter(item => item.signature_type === 'wormhole') // 只保留虫洞
            .map(item => this.convertToWormholeRecord(item, dataLoader));
    }

    /**
     * 获取转换后的虫洞记录
     * @param {Object} dataLoader - 数据加载器实例
     * @returns {Promise<Array>}
     */
    async getWormholeRecords(dataLoader = null) {
        const rawData = await this.fetchSignatures();
        return this.convertAll(rawData, dataLoader);
    }

    /**
     * 过滤与当前视图相关的虫洞
     * @param {Array} records - 所有虫洞记录
     * @param {number} currentRegionId - 当前星域ID
     * @param {string} currentRegionName - 当前星域名称
     * @returns {Array}
     */
    filterByRegion(records, currentRegionId, currentRegionName) {
        if (!records || records.length === 0) return [];
        
        return records.filter(record => {
            // 匹配星系名称（如果已知）
            const inSystem = dataLoader.systems.get(record.inSystemId);
            if (inSystem && inSystem.regionID === currentRegionId) {
                return true;
            }
            
            // 匹配星域名称（作为后备）
            if (record.inRegionName && 
                record.inRegionName.toLowerCase() === (currentRegionName || '').toLowerCase()) {
                return true;
            }
            
            return false;
        });
    }

    /**
     * 搜索包含指定星系的虫洞连接
     * @param {Array} records 
     * @param {string} systemName 
     * @returns {Array}
     */
    filterBySystem(records, systemName) {
        if (!records || !systemName) return [];
        
        const lowerName = systemName.toLowerCase();
        return records.filter(record => 
            record.fromSystem.toLowerCase() === lowerName ||
            record.toSystem.toLowerCase() === lowerName
        );
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache = null;
        this.cacheTime = null;
        console.log('[EveScout] 缓存已清除');
    }

    /**
     * 获取缓存状态
     * @returns {Object}
     */
    getCacheStatus() {
        if (!this.cache) {
            return { hasCache: false, age: null };
        }
        
        const age = this.cacheTime ? Date.now() - this.cacheTime : null;
        return {
            hasCache: true,
            age: age,
            ageText: age ? this.formatAge(age) : '未知',
            count: this.cache.length,
            isExpired: age > this.cacheDuration
        };
    }

    /**
     * 格式化时间间隔
     * @param {number} ms 
     * @returns {string}
     */
    formatAge(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}秒前`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}分钟前`;
        const hours = Math.floor(minutes / 60);
        return `${hours}小时前`;
    }

    /**
     * 检查 API 是否可用（健康检查）
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        try {
            const response = await fetch(this.apiUrl, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// 创建全局实例
const eveScoutService = new EveScoutService();
// Last modified: 2026年 2月20日 星期五 23时41分21秒 CST
