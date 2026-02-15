/**
 * 数据加载模块 - 使用 EVE 原生 position2D 坐标
 */

class DataLoader {
    constructor() {
        this.systems = new Map();
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
        // 收集所有 position2D 坐标来确定缩放
        const positions2D = [];
        
        for (const [idStr, raw] of Object.entries(systemsData)) {
            const id = parseInt(idStr);
            if (id >= 31000000) continue; // 跳过虫洞
            
            if (raw.position2D) {
                positions2D.push(raw.position2D);
            }
        }
        
        // 计算 position2D 的范围
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const pos of positions2D) {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        }
        
        // 调整缩放因子 - 默认设置
        const maxRange = Math.max(maxX - minX, maxY - minY);
        this.coordinateScale = 1200 / maxRange;
        
        console.log('[DataLoader] position2D 范围:', { minX, maxX, minY, maxY });
        console.log('[DataLoader] 坐标缩放因子:', this.coordinateScale);
        
        // 处理星系数据
        for (const [idStr, raw] of Object.entries(systemsData)) {
            const id = parseInt(idStr);
            
            if (id >= 31000000) continue; // 跳过虫洞

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
                    x: pos2D.x * this.coordinateScale,
                    y: -pos2D.y * this.coordinateScale  // 翻转 Y，使 +Y 向上
                },
                stargateIDs: raw.stargateIDs || [],
                isBorder: raw.border || false,
                isHub: raw.hub || false,
                isRegional: raw.regional || false,
                isInternational: raw.international || false,
                borderConnections: []
            };

            this.systems.set(id, system);

            const region = this.regions.get(system.regionID);
            if (region) {
                region.systems.push(id);
            }
        }
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

        // 收集相邻星域的星系（用于显示）
        for (const system of systems) {
            const connections = this.connections.get(system.id) || [];
            for (const targetId of connections) {
                const target = this.systems.get(targetId);
                if (target && target.regionID !== regionId) {
                    // 标记为外部星系
                    if (!externalSystems.has(targetId)) {
                        externalSystems.set(targetId, {
                            ...target,
                            isExternal: true,  // 标记为外部星系
                            connectedFrom: system.id,  // 从哪个本星域星系连接过来
                            connectedFromName: system.name
                        });
                    }
                }
            }
        }

        const bounds = this.calculateBounds(systems);

        const internalConnections = [];
        const externalConnections = [];

        for (const system of systems) {
            const connections = this.connections.get(system.id) || [];
            for (const targetId of connections) {
                const target = this.systems.get(targetId);
                if (!target) continue;

                if (system.id >= targetId) continue;

                if (target.regionID === regionId) {
                    internalConnections.push({
                        from: system.id,
                        to: targetId,
                        fromPos: system.position2D,
                        toPos: target.position2D
                    });
                } else {
                    externalConnections.push({
                        from: system.id,
                        to: targetId,
                        fromPos: system.position2D,
                        toPos: target.position2D,
                        targetRegion: target.regionID,
                        targetRegionName: this.getRegionName(target.regionID),
                        targetSystem: target.name,
                        targetSystemObj: target  // 保存目标星系对象引用
                    });
                }
            }
        }

        return {
            region,
            systems,
            borderSystems,
            externalSystems: Array.from(externalSystems.values()), // 转换为数组
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

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
}

const dataLoader = new DataLoader();
