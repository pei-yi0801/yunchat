import React, { createContext, useContext, useState, useEffect } from 'react';
import { EncryptionMode } from '../services/encryptionService';

// 服务模块类型
type ServiceModule = {
    initEncryptionService?: (mode: EncryptionMode) => Promise<void>;
    initSyncManager?: () => Promise<void>;
    initSyncService?: () => Promise<void>;
    initialize?: () => Promise<void>;
    close?: () => Promise<void>;
    disconnectSocket?: () => Promise<void>;
    webSocketManager?: typeof import('../services/socketService').WebSocketManager;
    EncryptionMode?: typeof import('../services/encryptionService').EncryptionMode;
    SyncManager?: typeof import('../services/syncManager').SyncManager;
    // 使用自定义类型定义，避免跨模块类型不兼容
    registerSyncObserver?: (observer: (state: any) => void) => () => void;
};

// 服务状态类型
interface ServiceState {
    isInitialized: boolean;
    isConnected: boolean;
    error: Error | null;
    retryCount: number;
}

// 服务上下文类型
interface ServiceContextType {
    encryptionService: ServiceModule | null;
    syncManager: ServiceModule | null;
    syncService: ServiceModule | null;
    webSocketManager: ServiceModule | null;
    socketService: ServiceModule | null;
    serviceState: Record<string, ServiceState>;
    initializeServices: () => Promise<void>;
    retryInitialization: (serviceName: string) => Promise<void>;
    closeServices: () => Promise<void>;
}

// 创建上下文
const ServiceContext = createContext<ServiceContextType | null>(null);

// 最大重试次数
const MAX_RETRY_ATTEMPTS = 3;

// 服务提供者组件
export function ServiceProvider({ children }: { children: React.ReactNode }) {
    // 服务实例
    const [services, setServices] = useState<{
        encryptionService: ServiceModule | null;
        syncManager: ServiceModule | null;
        syncService: ServiceModule | null;
        webSocketManager: ServiceModule | null;
        socketService: ServiceModule | null;
    }>({
        encryptionService: null,
        syncManager: null,
        syncService: null,
        webSocketManager: null,
        socketService: null,
    });

    // 服务状态
    const [serviceState, setServiceState] = useState<Record<string, ServiceState>>({
        encryption: { isInitialized: false, isConnected: false, error: null, retryCount: 0 },
        syncManager: { isInitialized: false, isConnected: false, error: null, retryCount: 0 },
        syncService: { isInitialized: false, isConnected: false, error: null, retryCount: 0 },
        webSocket: { isInitialized: false, isConnected: false, error: null, retryCount: 0 },
        socket: { isInitialized: false, isConnected: false, error: null, retryCount: 0 },
    });

    // 加载服务模块
    useEffect(() => {
        const loadServices = async () => {
            try {
                const encryptionService = await import('../services/encryptionService');
                const syncManager = await import('../services/syncManager');
                const syncService = await import('../services/syncService');
                const socketService = await import('../services/socket');
                const { webSocketManager } = await import('../services/socketService');

                setServices({
                    encryptionService,
                    syncManager,
                    syncService,
                    webSocketManager,
                    socketService,
                });
            } catch (error) {
                console.error('加载服务模块时出错:', error);
            }
        };

        loadServices();
    }, []);

    // 初始化单个服务
    const initializeService = async (
        serviceName: string,
        service: ServiceModule | null,
        initFunction: () => Promise<void>
    ) => {
        try {
            await initFunction();
            setServiceState(prev => ({
                ...prev,
                [serviceName]: {
                    ...prev[serviceName],
                    isInitialized: true,
                    error: null,
                },
            }));
        } catch (error) {
            setServiceState(prev => ({
                ...prev,
                [serviceName]: {
                    ...prev[serviceName],
                    error: error as Error,
                },
            }));
            throw error;
        }
    };

    // 初始化所有服务
    const initializeServices = async () => {
        const { encryptionService, syncManager, syncService, webSocketManager } = services;

        try {
            // 初始化加密服务
            if (encryptionService?.initEncryptionService) {
                await initializeService('encryption', encryptionService, () =>
                    encryptionService.initEncryptionService!(encryptionService.EncryptionMode?.AES || EncryptionMode.AES)
                );
            }

            // 初始化同步管理器
            if (syncManager?.initSyncManager) {
                await initializeService('syncManager', syncManager, syncManager.initSyncManager);
            }

            // 初始化同步服务
            if (syncService?.initSyncService) {
                await initializeService('syncService', syncService, syncService.initSyncService);
            }

            // 初始化WebSocket管理器
            if (webSocketManager?.initialize) {
                await initializeService('webSocket', webSocketManager, webSocketManager.initialize);
            }
        } catch (error) {
            console.error('初始化服务时出错:', error);
        }
    };

    // 重试初始化服务
    const retryInitialization = async (serviceName: string) => {
        const state = serviceState[serviceName];
        if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
            console.error(`${serviceName}服务初始化失败次数过多，停止重试`);
            return;
        }

        setServiceState(prev => ({
            ...prev,
            [serviceName]: {
                ...prev[serviceName],
                retryCount: prev[serviceName].retryCount + 1,
            },
        }));

        const service = services[serviceName as keyof typeof services];
        if (!service) return;

        try {
            switch (serviceName) {
                case 'encryption':
                    if (service.initEncryptionService) {
                        await service.initEncryptionService(service.EncryptionMode?.AES || EncryptionMode.AES);
                    }
                    break;
                case 'syncManager':
                    if (service.initSyncManager) {
                        await service.initSyncManager();
                    }
                    break;
                case 'syncService':
                    if (service.initSyncService) {
                        await service.initSyncService();
                    }
                    break;
                case 'webSocket':
                    if (service.initialize) {
                        await service.initialize();
                    }
                    break;
            }

            setServiceState(prev => ({
                ...prev,
                [serviceName]: {
                    ...prev[serviceName],
                    isInitialized: true,
                    error: null,
                },
            }));
        } catch (error) {
            console.error(`重试初始化${serviceName}服务失败:`, error);
        }
    };

    // 关闭服务
    const closeServices = async () => {
        const { webSocketManager, socketService } = services;

        try {
            if (webSocketManager?.close) {
                await webSocketManager.close();
            }
            if (socketService?.disconnectSocket) {
                await socketService.disconnectSocket();
            }

            // 重置服务状态
            setServiceState(prev => {
                const reset = Object.keys(prev).reduce((acc, key) => ({
                    ...acc,
                    [key]: { isInitialized: false, isConnected: false, error: null, retryCount: 0 },
                }), {});
                return reset;
            });
        } catch (error) {
            console.error('关闭服务时出错:', error);
        }
    };

    const contextValue: ServiceContextType = {
        encryptionService: services.encryptionService,
        syncManager: services.syncManager,
        syncService: services.syncService,
        webSocketManager: services.webSocketManager,
        socketService: services.socketService,
        serviceState,
        initializeServices,
        retryInitialization,
        closeServices,
    };

    return (
        <ServiceContext.Provider value={contextValue}>
            {children}
        </ServiceContext.Provider>
    );
}

// 自定义钩子
export function useService() {
    const context = useContext(ServiceContext);
    if (!context) {
        throw new Error('useService 必须在 ServiceProvider 内部使用');
    }
    return context;
}