import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useWebSocket, WSStatusListener } from '../services/websocket';
import { ConnectionStatus as ConnectionStatusEnum } from '../types';
import { COLORS } from '../constants';
import { AlertCircle, CheckCircle, Loader2, WifiOff, RefreshCw, Info } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';

// 尝试导入其他Socket服务（以确保向后兼容性）
let socketService: any = null;
try {
    socketService = require('../services/socket');
} catch (e) {
    console.log('传统Socket服务不可用');
}

// 尝试导入网络状态服务
let networkService: any = null;
try {
    networkService = require('../services/networkService');
} catch (e) {
    console.log('网络状态服务不可用');
}

/**
 * 连接状态指示器组件
 * 在界面顶部显示当前WebSocket连接状态
 */
export default function ConnectionStatusIndicator() {
    const { status, addStatusListener, removeStatusListener } = useWebSocket();
    const [visible, setVisible] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusEnum>(status);
    const [isOnline, setIsOnline] = useState(true);
    const { token, agent } = useAuth();

    // 尝试处理多个WebSocket服务连接状态
    const [traditionalSocketConnected, setTraditionalSocketConnected] = useState(false);

    // 重新连接函数
    const handleReconnect = useCallback(() => {
        try {
            setConnecting(true);

            // 尝试重连WebSocket服务
            if (socketService && typeof socketService.reconnect === 'function' && agent) {
                socketService.reconnect(token, agent.id)
                    .then(() => {
                        console.log('重连成功');
                        setConnecting(false);
                    })
                    .catch((error: any) => {
                        console.error('重连失败:', error);
                        setConnecting(false);
                    });
            }
        } catch (error) {
            console.error('尝试重连时出错:', error);
            setConnecting(false);
        }
    }, [token, agent]);

    // 监听主WebSocket连接状态变化
    useEffect(() => {
        const listener: WSStatusListener = {
            onStatusChange: (newStatus) => {
                setConnectionStatus(newStatus);
                handleStatusChange(newStatus);
            }
        };

        addStatusListener(listener);
        return () => removeStatusListener(listener);
    }, [addStatusListener, removeStatusListener]);

    // 监听传统Socket服务连接
    useEffect(() => {
        // 检查状态间隔
        const checkInterval = setInterval(() => {
            if (socketService && typeof socketService.isConnected === 'function') {
                const connected = socketService.isConnected();
                setTraditionalSocketConnected(connected);

                // 如果传统服务连接，但主服务未连接，更新可见性
                if (connected && connectionStatus !== ConnectionStatusEnum.CONNECTED) {
                    setVisible(true);
                    // 3秒后隐藏
                    setTimeout(() => setVisible(false), 3000);
                }
            }
        }, 5000);

        return () => clearInterval(checkInterval);
    }, [connectionStatus]);

    // 检查网络连接状态
    useEffect(() => {
        if (networkService && typeof networkService.isOnline === 'function') {
            const checkNetwork = async () => {
                try {
                    const online = await networkService.isOnline();
                    setIsOnline(online);

                    // 如果网络离线，显示状态
                    if (!online && !visible) {
                        setVisible(true);
                    }
                } catch (error) {
                    console.error('检查网络状态失败:', error);
                }
            };

            // 初始检查
            checkNetwork();

            // 设置定期检查
            const interval = setInterval(checkNetwork, 10000);
            return () => clearInterval(interval);
        }

        return undefined;
    }, [visible]);

    const handleStatusChange = (newStatus: ConnectionStatusEnum) => {
        // 显示状态指示器
        setVisible(true);

        // 根据状态设置自动隐藏
        if (newStatus === ConnectionStatusEnum.CONNECTED) {
            setTimeout(() => {
                setVisible(false);
            }, 3000);
        }
    };

    // 如果不可见，不渲染
    if (!visible) return null;

    // 获取综合连接状态（任一服务连接即可）
    const getCombinedStatus = () => {
        if (connectionStatus === ConnectionStatusEnum.CONNECTED || traditionalSocketConnected) {
            return ConnectionStatusEnum.CONNECTED;
        }
        if (connectionStatus === ConnectionStatusEnum.CONNECTING || connecting) {
            return ConnectionStatusEnum.CONNECTING;
        }
        return ConnectionStatusEnum.DISCONNECTED;
    };

    // 根据状态确定颜色、图标和文本
    const getStatusInfo = () => {
        const combinedStatus = getCombinedStatus();

        switch (combinedStatus) {
            case ConnectionStatusEnum.CONNECTED:
                return {
                    color: COLORS.success,
                    text: '已连接',
                    icon: CheckCircle,
                    description: '实时通信正常'
                };
            case ConnectionStatusEnum.CONNECTING:
                return {
                    color: COLORS.warning,
                    text: '正在连接...',
                    icon: Loader2,
                    description: '正在建立连接'
                };
            case ConnectionStatusEnum.DISCONNECTED:
                return {
                    color: COLORS.danger,
                    text: '未连接',
                    icon: WifiOff,
                    description: '点击右侧按钮重新连接'
                };
            default:
                return {
                    color: COLORS.gray,
                    text: '未知状态',
                    icon: AlertCircle,
                    description: '连接状态异常'
                };
        }
    };

    const { color, text, icon: Icon, description } = getStatusInfo();
    const combinedStatus = getCombinedStatus();

    // 如果网络离线但上一次连接状态为已连接，显示额外的网络离线指示
    const showOfflineMessage = !isOnline && connectionStatus === ConnectionStatusEnum.CONNECTED;

    return (
        <>
            <View
                style={[
                    styles.container,
                    {
                        backgroundColor: color,
                        transform: [{ translateY: 0 }]
                    }
                ]}
            >
                <View style={styles.content}>
                    <Icon size={20} color={COLORS.white} style={styles.icon} />

                    <View style={styles.textContainer}>
                        <Text style={styles.text}>{text}</Text>
                        <Text style={styles.description}>{description}</Text>
                    </View>

                    {combinedStatus === ConnectionStatusEnum.DISCONNECTED && (
                        <TouchableOpacity
                            style={styles.reconnectButton}
                            onPress={handleReconnect}
                            disabled={connecting}
                        >
                            {connecting ? (
                                <ActivityIndicator size="small" color={COLORS.white} />
                            ) : (
                                <RefreshCw size={18} color={COLORS.white} />
                            )}
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setVisible(false)}
                    >
                        <Text style={styles.closeText}>×</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {showOfflineMessage && (
                <View style={[styles.offlineContainer, { backgroundColor: COLORS.danger }]}>
                    <WifiOff size={16} color={COLORS.white} />
                    <Text style={styles.offlineText}>网络连接已断开</Text>
                </View>
            )}
        </>
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
        transition: 'all 0.3s ease-in-out',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingTop: Platform.OS === 'ios' ? 48 : 12,
    },
    icon: {
        marginLeft: 8,
    },
    textContainer: {
        marginLeft: 12,
        flex: 1,
    },
    text: {
        color: COLORS.white,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
    description: {
        color: COLORS.white,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        opacity: 0.9,
    },
    reconnectButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    closeButton: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: COLORS.white,
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: -2,
    },
    rotating: {
        // 在React Native中动画需要使用Animated API
        // 这里只是一个占位样式
    },
    offlineContainer: {
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
        transition: 'all 0.3s ease-in-out',
        padding: 12,
    },
    offlineText: {
        color: COLORS.white,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
    },
});