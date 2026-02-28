/**
 * EVE Regional Map - Supabase 服务
 * 提供虫洞数据的云端存储和实时同步
 */

class SupabaseService {
    constructor() {
        this.supabase = null;
        this.subscriptions = [];
        this.initialized = false;
    }

    /**
     * 初始化 Supabase 客户端
     */
    init(supabaseUrl, supabaseKey) {
        if (this.initialized) return true;
        
        // 检查是否加载了 supabase-js
        if (typeof supabase === 'undefined') {
            console.error('[Supabase] supabase-js 库未加载');
            return false;
        }
        
        try {
            this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
            this.initialized = true;
            console.log('[Supabase] 初始化成功');
            return true;
        } catch (e) {
            console.error('[Supabase] 初始化失败:', e);
            return false;
        }
    }

    /**
     * 获取所有有效虫洞
     */
    async getActiveWormholes() {
        if (!this.initialized) {
            console.warn('[Supabase] 未初始化');
            return [];
        }
        
        try {
            const { data, error } = await this.supabase
                .from('WormholeRecord')
                .select('*')
                .eq('isExpired', false)
                .gt('expiresAt', new Date().toISOString())
                .order('createdAt', { ascending: false });
            
            if (error) {
                console.error('[Supabase] 获取虫洞失败:', error);
                return [];
            }
            
            console.log('[Supabase] 获取到', data?.length || 0, '条有效虫洞');
            return data || [];
        } catch (e) {
            console.error('[Supabase] 获取虫洞异常:', e);
            return [];
        }
    }

    /**
     * 创建虫洞记录
     */
    async createWormhole(record) {
        if (!this.initialized) {
            console.warn('[Supabase] 未初始化');
            return null;
        }
        
        try {
            // 计算过期时间
            const expiresAt = new Date(Date.now() + (record.lifetime || 1440) * 60000);
            
            // 手动生成 UUID
            const id = this.generateUUID();
            const now = new Date().toISOString();
            
            const { data, error } = await this.supabase
                .from('WormholeRecord')
                .insert({
                    id: id,
                    createdAt: now,
                    updatedAt: now,
                    fromSystemId: record.fromSystemId,
                    fromSystemName: record.fromSystemName,
                    toSystemId: record.toSystemId,
                    toSystemName: record.toSystemName,
                    fromSignal: record.fromSignal,
                    toSignal: record.toSignal,
                    size: record.size,
                    mass: record.mass,
                    lifetime: record.lifetime,
                    source: record.source || 'manual',
                    createdBy: record.createdBy,
                    expiresAt: expiresAt.toISOString()
                })
                .select()
                .single();
            
            if (error) {
                console.error('[Supabase] 创建虫洞失败:', error);
                return null;
            }
            
            console.log('[Supabase] 创建虫洞成功:', data.id);
            return data;
        } catch (e) {
            console.error('[Supabase] 创建虫洞异常:', e);
            return null;
        }
    }
    
    /**
     * 生成 UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 标记虫洞为过期
     */
    async expireWormhole(id) {
        if (!this.initialized) return false;
        
        try {
            const { error } = await this.supabase
                .from('WormholeRecord')
                .update({ isExpired: true })
                .eq('id', id);
            
            if (error) {
                console.error('[Supabase] 标记过期失败:', error);
                return false;
            }
            
            return true;
        } catch (e) {
            console.error('[Supabase] 标记过期异常:', e);
            return false;
        }
    }

    /**
     * 删除虫洞
     */
    async deleteWormhole(id) {
        if (!this.initialized) return false;
        
        try {
            const { error } = await this.supabase
                .from('WormholeRecord')
                .delete()
                .eq('id', id);
            
            if (error) {
                console.error('[Supabase] 删除虫洞失败:', error);
                return false;
            }
            
            console.log('[Supabase] 删除虫洞:', id);
            return true;
        } catch (e) {
            console.error('[Supabase] 删除虫洞异常:', e);
            return false;
        }
    }

    /**
     * 订阅虫洞变化（实时同步）
     */
    subscribeToWormholes(callbacks) {
        if (!this.initialized) {
            console.warn('[Supabase] 未初始化，无法订阅');
            return null;
        }
        
        const { onInsert, onUpdate, onDelete } = callbacks;
        
        // 订阅 INSERT 事件
        const insertChannel = this.supabase
            .channel('wormholes-insert')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'WormholeRecord' },
                (payload) => {
                    console.log('[Supabase] 收到新虫洞:', payload.new);
                    if (onInsert) onInsert(payload.new);
                }
            )
            .subscribe();
        
        // 订阅 UPDATE 事件
        const updateChannel = this.supabase
            .channel('wormholes-update')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'WormholeRecord' },
                (payload) => {
                    console.log('[Supabase] 虫洞更新:', payload.new);
                    if (onUpdate) onUpdate(payload.new);
                }
            )
            .subscribe();
        
        // 订阅 DELETE 事件
        const deleteChannel = this.supabase
            .channel('wormholes-delete')
            .on('postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'WormholeRecord' },
                (payload) => {
                    console.log('[Supabase] 虫洞删除:', payload.old);
                    if (onDelete) onDelete(payload.old);
                }
            )
            .subscribe();
        
        this.subscriptions.push(insertChannel, updateChannel, deleteChannel);
        
        return {
            unsubscribe: () => {
                insertChannel.unsubscribe();
                updateChannel.unsubscribe();
                deleteChannel.unsubscribe();
            }
        };
    }

    /**
     * 取消所有订阅
     */
    unsubscribeAll() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
        console.log('[Supabase] 已取消所有订阅');
    }

    /**
     * 将 EVE Scout 记录转换为虫洞记录
     */
    convertEveScoutRecord(eveScoutRecord) {
        return {
            fromSystemId: eveScoutRecord.fromSystem?.id?.toString() || '',
            fromSystemName: eveScoutRecord.fromSystem?.name || '',
            toSystemId: eveScoutRecord.toSystem?.id?.toString() || '',
            toSystemName: eveScoutRecord.toSystem?.name || '',
            size: eveScoutRecord.wormholeSize || null,
            mass: null,
            lifetime: this.parseLifetime(eveScoutRecord.remainingHours),
            source: 'eve_scout'
        };
    }

    /**
     * 解析剩余时间
     */
    parseLifetime(remainingHours) {
        if (!remainingHours) return 1440; // 默认 24 小时
        return Math.floor(remainingHours * 60); // 转换为分钟
    }
}

// 导出单例
const supabaseService = new SupabaseService();

// 挂载到 window 对象（浏览器环境）
if (typeof window !== 'undefined') {
    window.supabaseService = supabaseService;
}

// 兼容 CommonJS 和 ES Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SupabaseService, supabaseService };
}
