import { useEffect } from 'react';
import { useService } from '../../../contexts/ServiceContext';
import { useNotification, NotificationType } from '../../../services/notification';

export interface ServiceInitializerProps {
    onInitialized?: () => void;
    onError?: (error: Error) => void;
}

export function ServiceInitializer({
    onInitialized,
    onError,
}: ServiceInitializerProps) {
    const { initializeServices, closeServices } = useService();
    const { addNotification } = useNotification();

    useEffect(() => {
        const initialize = async () => {
            try {
                await initializeServices();
                addNotification({
                    title: '服务初始化',
                    message: '所有服务已成功初始化',
                    type: NotificationType.SUCCESS,
                    duration: 3000
                });
                onInitialized?.();
            } catch (error) {
                const err = error as Error;
                console.error('初始化服务时出错:', err);
                addNotification({
                    title: '服务初始化失败',
                    message: err.message || '初始化过程中发生错误',
                    type: NotificationType.ERROR
                });
                onError?.(err);
            }
        };

        initialize();

        return () => {
            closeServices().catch(error => {
                console.error('关闭服务时出错:', error);
                addNotification({
                    title: '服务关闭异常',
                    message: '关闭服务时发生错误',
                    type: NotificationType.WARNING,
                    duration: 3000
                });
            });
        };
    }, [initializeServices, closeServices, onInitialized, onError, addNotification]);

    return null;
}