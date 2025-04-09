/**
 * 通知横幅组件
 * 显示系统通知、连接状态和消息提醒
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useWebSocket, WSStatusListener } from '../services/websocket';
import { ConnectionStatus, ConnectionQuality } from '../types';
import { COLORS } from '../constants';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react-native';

// 尝试导入传统Socket服务
let socketService: any = null;
try {
    socketService = require('../services/socket');
} catch (e) {
    console.log('传统Socket服务不可用');
}

// 通知类型
export enum NotificationType {
    INFO = 'info',
    SUCCESS = 'success',
    WARNING = 'warning',
    ERROR = 'error',
}

// 通知接口
export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    timestamp: number;
}

/**
 * 通知横幅组件
 */
export default function NotificationBanner() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null);
    const { status, connectionQuality, addStatusListener, removeStatusListener } = useWebSocket();

    // 添加通知
    const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
        const newNotification = {
            id: `notification_${Date.now()}`,
            timestamp: Date.now(),
            ...notification,
        };
        setNotifications(prev => [...prev, newNotification]);
    };

    // 关闭当前通知
    const dismissNotification = () => {
        setCurrentNotification(null);
        // 延迟显示下一条通知
        setTimeout(() => {
            if (notifications.length > 0) {
                const [next, ...rest] = notifications;
                setCurrentNotification(next);
                setNotifications(rest);
            }
        }, 300);
    };

    // 处理新的通知
    useEffect(() => {
        if (!currentNotification && notifications.length > 0) {
            const [first, ...rest] = notifications;
            setCurrentNotification(first);
            setNotifications(rest);
        }
    }, [notifications, currentNotification]);

    // 监听连接状态变化
    useEffect(() => {
        let lastConnectionQuality: ConnectionQuality = connectionQuality;

        const listener: WSStatusListener = {
            onStatusChange: (newStatus) => {
                switch (newStatus) {
                    case ConnectionStatus.CONNECTED:
                        addNotification({
                            title: '连接已恢复',
                            message: '与服务器的连接已成功建立',
                            type: NotificationType.SUCCESS,
                        });
                        break;
                    case ConnectionStatus.DISCONNECTED:
                        addNotification({
                            title: '连接已断开',
                            message: '与服务器的连接已断开，正在尝试重新连接',
                            type: NotificationType.WARNING,
                        });
                        break;
                }
            },
            onConnectionQualityChange: (quality) => {
                if (quality === ConnectionQuality.POOR &&
                    (lastConnectionQuality === ConnectionQuality.GOOD ||
                        lastConnectionQuality === ConnectionQuality.EXCELLENT)) {
                    addNotification({
                        title: '连接质量下降',
                        message: '当前网络连接质量较差，可能会影响通信',
                        type: NotificationType.WARNING,
                    });
                }

                lastConnectionQuality = quality;
            }
        };

        addStatusListener(listener);
        return () => removeStatusListener(listener);
    }, [addStatusListener, removeStatusListener]);

    // 监听传统Socket.io连接状态变化
    useEffect(() => {
        if (!socketService) return;

        // 上一次连接状态
        let lastConnected = false;

        // 定时检查Socket.io连接状态
        const checkInterval = setInterval(() => {
            try {
                if (socketService.isConnected) {
                    const isConnected = socketService.isConnected();

                    // 连接状态发生变化
                    if (isConnected !== lastConnected) {
                        lastConnected = isConnected;

                        if (isConnected) {
                            addNotification({
                                title: 'Socket.io已连接',
                                message: 'Socket.io连接已建立，可以进行实时通信',
                                type: NotificationType.SUCCESS,
                            });
                        } else {
                            addNotification({
                                title: 'Socket.io已断开',
                                message: 'Socket.io连接已断开，部分实时功能可能受影响',
                                type: NotificationType.WARNING,
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('检查Socket.io连接状态出错:', error);
            }
        }, 10000); // 每10秒检查一次

        return () => clearInterval(checkInterval);
    }, []);

    // 自动关闭通知
    useEffect(() => {
        if (currentNotification &&
            (currentNotification.type === NotificationType.SUCCESS ||
                currentNotification.type === NotificationType.INFO)) {
            const timer = setTimeout(dismissNotification, 5000);
            return () => clearTimeout(timer);
        }
    }, [currentNotification]);

    if (!currentNotification) return null;

    // 根据类型选择颜色和图标
    const getNotificationStyle = () => {
        switch (currentNotification.type) {
            case NotificationType.SUCCESS:
                return {
                    color: COLORS.success,
                    icon: CheckCircle
                };
            case NotificationType.WARNING:
                return {
                    color: COLORS.warning,
                    icon: AlertCircle
                };
            case NotificationType.ERROR:
                return {
                    color: COLORS.danger,
                    icon: AlertCircle
                };
            default:
                return {
                    color: COLORS.primary,
                    icon: Info
                };
        }
    };

    const { color, icon: Icon } = getNotificationStyle();

    return (
        <View style={[styles.container, { backgroundColor: color }]}>
            <View style={styles.content}>
                <Icon size={20} color={COLORS.white} />
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{currentNotification.title}</Text>
                    <Text style={styles.message}>{currentNotification.message}</Text>
                </View>
                <TouchableOpacity onPress={dismissNotification} style={styles.closeButton}>
                    <X size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 48 : 16,
    },
    textContainer: {
        flex: 1,
        marginHorizontal: 12,
    },
    title: {
        color: COLORS.white,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    message: {
        color: COLORS.white,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        opacity: 0.9,
    },
    closeButton: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    }
});