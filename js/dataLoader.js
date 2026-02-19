/**
 * 数据加载模块 - 使用 SDE position2D 坐标
 */

class DataLoader {
    constructor() {
        this.systems = new Map();
        this.wormholeSystems = new Map(); // 虫洞星系 (J-space)
        this.regions = new Map();
        this.constellations = new Map();
        this.connections = new Map();
        this.loaded = false;
    }

    async loadAll() {
        try {
            console.log('[DataLoader] 开始加载数据...');
            
            const [systemsData, stargatesData, regionsData, constellationsData] = await Promise.all([
                this.loadYAML('data/mapSolarSystems.yaml'),
                this.loadYAML('data/mapStargates.yaml'),
                this.loadJSONL('data/mapRegions.jsonl'),
                this.loadJSONL('data/mapConstellations.jsonl')
            ]);

            this.processRegions(regionsData);
            this.processConstellations(constellationsData);
            this.processSystems(systemsData);
            this.processConnections(stargatesData);

            this.loaded = true;
            console.log('[DataLoader] 数据加载完成:');
            console.log(`  - 星域: ${this.regions.size}`);
            console.log(`  - 星系: ${this.systems.size}`);
            console.log(`  - 连接: ${this.countConnections()}`);
            
            return true;
        } catch (error) {
            console.error('[DataLoader] 数据加载失败:', error);
            throw error;
        }
    }

    async loadYAML(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
        }
        const text = await response.text();
        return jsyaml.load(text);
    }

    async loadJSONL(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
        }
        const text = await response.text();
        return text
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    }

    processRegions(regionsData) {
        for (const item of regionsData) {
            const id = item._key;
            this.regions.set(id, {
                id,
                name: item.name?.zh || item.name?.en || `Region ${id}`,
                nameEn: item.name?.en || '',
                description: item.description?.zh || item.description?.en || '',
                constellationIDs: item.constellationIDs || [],
                factionID: item.factionID,
                wormholeClassID: item.wormholeClassID,
                systems: []
            });
        }
    }

    processConstellations(constellationsData) {
        for (const item of constellationsData) {
            const id = item._key;
            this.constellations.set(id, {
                id,
                name: item.name?.zh || item.name?.en || `Constellation ${id}`,
                regionID: item.regionID,
                systemIDs: item.solarSystemIDs || []
            });
        }
    }

    processSystems(systemsData) {
        // 使用 SDE 中的 position2D 坐标（使用原始坐标）
        console.log('[DataLoader] 使用 SDE position2D 坐标系统');
        
        for (const [idStr, raw] of Object.entries(systemsData)) {
            const id = parseInt(idStr);
            
            // 使用 SDE 中的原始 position2D 坐标
            const pos2D = raw.position2D || { x: 0, y: 0 };
            
            const system = {
                id,
                name: raw.name?.zh || raw.name?.en || `System ${id}`,
                nameEn: raw.name?.en || '',
                constellationID: raw.constellationID,
                regionID: raw.regionID,
                securityStatus: raw.securityStatus ?? 0,
                securityClass: this.getSecurityClass(raw.securityStatus),
                position2D: {
                    x: pos2D.x,
                    y: pos2D.y
                },
                stargateIDs: raw.stargateIDs || [],
                isBorder: raw.border || false,
                isHub: raw.hub || false,
                isRegional: raw.regional || false,
                isInternational: raw.international || false,
                borderConnections: [],
                isWormhole: id >= 31000000 // 标记虫洞星系
            };

            if (id >= 31000000) {
                // 虫洞星系单独存储
                this.wormholeSystems.set(id, system);
            } else {
                // K-Space 星系
                this.systems.set(id, system);
                const region = this.regions.get(system.regionID);
                if (region) {
                    region.systems.push(id);
                }
            }
        }
        
        console.log(`[DataLoader] 加载了 ${this.wormholeSystems.size} 个虫洞星系`);
    }

    getSecurityClass(securityStatus) {
        if (securityStatus === undefined || securityStatus === null) return 'null';
        if (securityStatus >= 0.5) return 'high';
        if (securityStatus >= 0.1) return 'low';
        return 'null';
    }

    processConnections(stargatesData) {
        for (const systemId of this.systems.keys()) {
            this.connections.set(systemId, []);
        }

        for (const [, gate] of Object.entries(stargatesData)) {
            const fromSystemId = gate.solarSystemID;
            const toSystemId = gate.destination?.solarSystemID;

            if (!fromSystemId || !toSystemId) continue;
            
            if (!this.systems.has(fromSystemId) || !this.systems.has(toSystemId)) {
                continue;
            }

            const fromConnections = this.connections.get(fromSystemId);
            const toConnections = this.connections.get(toSystemId);

            if (fromConnections && !fromConnections.includes(toSystemId)) {
                fromConnections.push(toSystemId);
            }
            if (toConnections && !toConnections.includes(fromSystemId)) {
                toConnections.push(fromSystemId);
            }
        }

        // 标记入口星系
        for (const [systemId, connectedIds] of this.connections) {
            const system = this.systems.get(systemId);
            if (!system) continue;

            for (const connectedId of connectedIds) {
                const connectedSystem = this.systems.get(connectedId);
                if (connectedSystem && connectedSystem.regionID !== system.regionID) {
                    system.isBorder = true;
                    system.borderConnections.push({
                        systemId: connectedId,
                        systemName: connectedSystem.name,
                        regionId: connectedSystem.regionID,
                        regionName: this.getRegionName(connectedSystem.regionID)
                    });
                }
            }
        }
    }

    getRegionName(regionId) {
        const region = this.regions.get(regionId);
        return region ? region.name : `Region ${regionId}`;
    }

    countConnections() {
        let count = 0;
        for (const connections of this.connections.values()) {
            count += connections.length;
        }
        return count / 2;
    }

    getRegionList() {
        const list = [];
        for (const region of this.regions.values()) {
            list.push({
                id: region.id,
                name: region.name,
                systemCount: region.systems.length
            });
        }
        return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }

    getRegionData(regionId) {
        const region = this.regions.get(regionId);
        if (!region) return null;

        const systems = [];
        const borderSystems = [];
        const externalSystems = new Map(); // 相邻星域的星系

        // 收集当前星域的所有星系
        for (const systemId of region.systems) {
            const system = this.systems.get(systemId);
            if (system) {
                systems.push(system);
                if (system.isBorder) {
                    borderSystems.push(system);
                }
            }
        }

        const bounds = this.calculateBounds(systems);

        // 收集每个边界星系的所有连接角度（用于避免重叠）
        const borderSystemAngles = new Map(); // systemId -> [angles]
        
        for (const system of systems) {
            if (!system.isBorder) continue;
            
            const angles = [];
            const connections = this.connections.get(system.id) || [];
            
            for (const targetId of connections) {
                const target = this.systems.get(targetId);
                if (!target) continue;
                
                // 只记录内部连接的角度
                if (target.regionID === regionId) {
                    const angle = Math.atan2(
                        target.position2D.y - system.position2D.y,
                        target.position2D.x - system.position2D.x
                    );
                    angles.push(angle);
                }
            }
            
            borderSystemAngles.set(system.id, angles);
        }

        // 计算外部星系的放置位置
        // 策略：基于边界星系到星域中心的方向向外延伸，在可用间隙中均匀分布
        const MIN_ANGLE_GAP = 1.05; // 最小角度间隔（约60度）
        // 星门连接外部星系使用与路径外部星系相同的距离
        const domainScale = Math.max(bounds.width, bounds.height);
        const EXTERNAL_DISTANCE_MIN = domainScale * 0.06; // 6% 星域大小
        const EXTERNAL_DISTANCE_MAX = domainScale * 0.10; // 10% 星域大小
        const EXTERNAL_DISTANCE_DEFAULT = domainScale * 0.08; // 8% 星域大小
        
        // 预计算每个边界星系的外向方向（远离星域中心）
        const borderSystemOutboundAngles = new Map();
        for (const system of systems) {
            if (!system.isBorder) continue;
            const dirX = system.position2D.x - bounds.centerX;
            const dirY = system.position2D.y - bounds.centerY;
            const angle = Math.atan2(dirY, dirX);
            borderSystemOutboundAngles.set(system.id, angle);
        }
        
        // 预计算每个边界星系的所有外部连接角度
        const borderSystemExternalAngles = new Map(); // systemId -> [angles]
        
        // 全局已放置的位置（用于避免外部星系与任何星系重叠）
        const globalExternalPositions = [];
        const MIN_EXTERNAL_GAP = domainScale * 0.01; // 1% 星域大小
        
        // 首先将所有本星域星系位置加入全局检查
        for (const system of systems) {
            globalExternalPositions.push({ x: system.position2D.x, y: system.position2D.y });
        }
        
        const calculateExternalPosition = (borderSystem, targetSystem, connectionIndex, totalConnections) => {
            const internalAngles = borderSystemAngles.get(borderSystem.id) || [];
            const outboundAngle = borderSystemOutboundAngles.get(borderSystem.id) || 0;
            
            // 获取已分配的外部角度
            const assignedAngles = borderSystemExternalAngles.get(borderSystem.id) || [];
            
            // 所有禁止角度 = 内部角度 + 已分配的外部角度
            const blockedAngles = [...internalAngles, ...assignedAngles];
            
            // 生成候选角度
            const candidateAngles = [];
            
            if (blockedAngles.length === 0) {
                candidateAngles.push(outboundAngle);
            } else {
                // 排序阻挡角度
                const sorted = [...blockedAngles].sort((a, b) => a - b);
                
                // 检查所有间隙
                for (let i = 0; i < sorted.length; i++) {
                    const current = sorted[i];
                    const next = sorted[(i + 1) % sorted.length];
                    let gapStart = current;
                    let gapEnd = next;
                    if (gapEnd <= gapStart) gapEnd += Math.PI * 2;
                    
                    const gapSize = gapEnd - gapStart;
                    if (gapSize >= MIN_ANGLE_GAP) {
                        // 在间隙中心放置
                        const centerAngle = gapStart + gapSize / 2;
                        const normalizedAngle = ((centerAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
                        const diff = Math.abs(normalizedAngle - outboundAngle);
                        const wrappedDiff = Math.min(diff, Math.PI * 2 - diff);
                        candidateAngles.push(normalizedAngle);
                    }
                }
                
                // 如果没有合适间隙，使用外向方向偏移
                if (candidateAngles.length === 0) {
                    for (let i = 0; i < 8; i++) {
                        candidateAngles.push(outboundAngle + (i - 4) * 0.4);
                    }
                }
            }
            
            // 尝试不同的距离，找到不与全局位置冲突的最佳位置
            let bestAngle = candidateAngles[0] || outboundAngle;
            let bestDistance = EXTERNAL_DISTANCE_DEFAULT;
            let found = false;
            
            // 计算步长（基于距离范围的 1/10）
            const step = (EXTERNAL_DISTANCE_MAX - EXTERNAL_DISTANCE_MIN) / 10;
            
            for (const angle of candidateAngles) {
                for (let dist = EXTERNAL_DISTANCE_MIN; dist <= EXTERNAL_DISTANCE_MAX; dist += step) {
                    const x = borderSystem.position2D.x + Math.cos(angle) * dist;
                    const y = borderSystem.position2D.y + Math.sin(angle) * dist;
                    
                    // 检查与全局位置的距离
                    let tooClose = false;
                    for (const pos of globalExternalPositions) {
                        const dx = x - pos.x;
                        const dy = y - pos.y;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < MIN_EXTERNAL_GAP) {
                            tooClose = true;
                            break;
                        }
                    }
                    
                    if (!tooClose) {
                        bestAngle = angle;
                        bestDistance = dist;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            
            // 记录已分配的角度
            assignedAngles.push(bestAngle);
            borderSystemExternalAngles.set(borderSystem.id, assignedAngles);
            
            const result = {
                x: borderSystem.position2D.x + Math.cos(bestAngle) * bestDistance,
                y: borderSystem.position2D.y + Math.sin(bestAngle) * bestDistance
            };
            
            // 记录到全局位置
            globalExternalPositions.push(result);
            
            return result;
        };

        // 收集相邻星域的星系（用于显示）- 使用虚拟坐标（靠近边界星系）
        for (const system of systems) {
            const connections = this.connections.get(system.id) || [];
            
            for (const targetId of connections) {
                const target = this.systems.get(targetId);
                if (target && target.regionID !== regionId) {
                    // 使用虚拟坐标，每个连接独立显示
                    const uniqueKey = `${system.id}-${targetId}`;
                    
                    if (!externalSystems.has(uniqueKey)) {
                        // 计算虚拟位置（靠近边界星系）
                        const virtualPos = calculateExternalPosition(system, target, 0, 1);
                        
                        externalSystems.set(uniqueKey, {
                            ...target,
                            isExternal: true,
                            connectedFrom: system.id,
                            connectedFromName: system.name,
                            // 使用虚拟坐标（靠近边界星系）
                            position2D: virtualPos,
                            uniqueKey: uniqueKey
                        });
                    }
                }
            }
        }

        const internalConnections = [];
        const externalConnections = [];

        for (const system of systems) {
            const connections = this.connections.get(system.id) || [];
            for (const targetId of connections) {
                const target = this.systems.get(targetId);
                if (!target) continue;

                if (target.regionID === regionId) {
                    // 内部连接：避免重复
                    if (system.id >= targetId) continue;
                    internalConnections.push({
                        from: system.id,
                        to: targetId,
                        fromPos: system.position2D,
                        toPos: target.position2D
                    });
                } else {
                    // 外部连接：每个边界星系到外部星系的连接都要画
                    // 使用唯一键查找对应的外部星系实例
                    const uniqueKey = `${system.id}-${targetId}`;
                    const externalInstance = externalSystems.get(uniqueKey);
                    if (externalInstance) {
                        externalConnections.push({
                            from: system.id,
                            to: targetId,
                            fromPos: system.position2D,
                            toPos: externalInstance.position2D,
                            targetRegion: target.regionID,
                            targetRegionName: this.getRegionName(target.regionID),
                            targetSystem: target.name,
                            targetSystemObj: target
                        });
                    }
                }
            }
        }

        return {
            region,
            systems,
            borderSystems,
            externalSystems: Array.from(externalSystems.values()),
            bounds,
            internalConnections,
            externalConnections
        };
    }

    calculateBounds(systems) {
        if (systems.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const system of systems) {
            const { x, y } = system.position2D;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        
        let width = maxX - minX;
        let height = maxY - minY;
        
        // 如果只有一个系统（width/height 为 0），设置默认大小
        // 使用 SDE 坐标系中的合理范围（约 1e16 量级）
        if (width === 0) {
            width = 1e16;
            minX = minX - width / 2;
            maxX = maxX + width / 2;
        }
        if (height === 0) {
            height = 1e16;
            minY = minY - height / 2;
            maxY = maxY + height / 2;
        }

        return {
            minX, maxX, minY, maxY,
            width,
            height,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    /**
     * 获取虫洞星域数据 - 只显示目标虫洞星系 + 连接的 K-Space 入口星系
     * @param {number} targetSystemId - 目标虫洞星系 ID
     * @returns {Object} 虫洞星域数据
     */
    getWormholeRegionData(targetSystemId) {
        const wormholeSystem = this.wormholeSystems.get(targetSystemId);
        if (!wormholeSystem) return null;
        
        // 创建虚拟的虫洞星域
        const region = {
            id: `wormhole-${targetSystemId}`,
            name: `${wormholeSystem.name} (虫洞)`,
            nameEn: wormholeSystem.nameEn,
            isWormholeRegion: true,
            systems: [targetSystemId]
        };
        
        // 虫洞星系作为主系统
        const mainSystem = {
            ...wormholeSystem,
            isBorder: true // 标记为边界星系，用于显示连接
        };
        
        // 收集所有连接到该虫洞的 K-Space 星系（通过路径记录）
        // 这里先返回基础数据，外部星系由调用者提供
        const systems = [mainSystem];
        
        const bounds = this.calculateBounds(systems);
        
        return {
            region,
            systems,
            borderSystems: [mainSystem],
            externalSystems: [], // 由调用者填充
            bounds,
            internalConnections: [],
            externalConnections: []
        };
    }
    
    /**
     * 为虫洞星系构建外部连接（K-Space 入口）
     * @param {number} wormholeId - 虫洞星系 ID
     * @param {Array} connectedKSpaceSystems - 连接的 K-Space 星系列表 [{system, signal}]
     * @returns {Object} 包含外部星系和连接的数据
     */
    buildWormholeExternalConnections(wormholeId, connectedKSpaceSystems) {
        const wormholeSystem = this.wormholeSystems.get(wormholeId);
        if (!wormholeSystem) return null;
        
        const externalSystems = [];
        const externalConnections = [];
        
        // 计算虚拟位置：围绕虫洞星系均匀分布
        const centerX = wormholeSystem.position2D.x;
        const centerY = wormholeSystem.position2D.y;
        const radius = 5e15; // 虚拟半径，约 5e15 单位
        
        const count = connectedKSpaceSystems.length;
        
        for (let i = 0; i < count; i++) {
            const { system, signal } = connectedKSpaceSystems[i];
            const angle = (i * 2 * Math.PI) / count - Math.PI / 2; // 从上方开始
            
            const virtualPos = {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            };
            
            const externalSystem = {
                ...system,
                isExternal: true,
                connectedFrom: wormholeId,
                connectedFromName: wormholeSystem.name,
                position2D: virtualPos,
                uniqueKey: `wormhole-${wormholeId}-${system.id}`,
                wormholeSignal: signal // 虫洞信号编号
            };
            
            externalSystems.push(externalSystem);
            
            externalConnections.push({
                from: wormholeId,
                to: system.id,
                fromPos: wormholeSystem.position2D,
                toPos: virtualPos,
                targetRegion: system.regionID,
                targetRegionName: this.getRegionName(system.regionID),
                targetSystem: system.name,
                targetSystemObj: system,
                isWormholeConnection: true,
                signal: signal
            });
        }
        
        return { externalSystems, externalConnections };
    }
    
    /**
     * 搜索星系（包括虫洞星系）
     * @param {string} query - 搜索关键词
     * @param {number} limit - 最大结果数
     * @returns {Array} 匹配的星系列表
     */
    searchAllSystems(query, limit = 20) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // 搜索 K-Space 星系
        for (const system of this.systems.values()) {
            if (results.length >= limit) break;
            
            const nameMatch = system.name.toLowerCase().includes(lowerQuery);
            const nameEnMatch = system.nameEn && system.nameEn.toLowerCase().includes(lowerQuery);
            
            if (nameMatch || nameEnMatch) {
                results.push({
                    ...system,
                    searchMatch: system.name
                });
            }
        }
        
        // 搜索虫洞星系（JXXXXXX 格式）
        for (const system of this.wormholeSystems.values()) {
            if (results.length >= limit) break;
            
            const nameMatch = system.name.toLowerCase().includes(lowerQuery);
            const nameEnMatch = system.nameEn && system.nameEn.toLowerCase().includes(lowerQuery);
            
            if (nameMatch || nameEnMatch) {
                results.push({
                    ...system,
                    searchMatch: system.name,
                    isWormhole: true
                });
            }
        }
        
        return results;
    }
}

const dataLoader = new DataLoader();
