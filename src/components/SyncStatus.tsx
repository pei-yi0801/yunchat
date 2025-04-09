/**
* 同步状态组件
* 显示消息同步进度和状态
*/

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { COLORS } from '../constants';
import { registerSyncObserver, syncOfflineQueue, getSyncManager, SyncError } from '../services/syncManager';
import { ArrowUpDown, Check, AlertCircle, RefreshCw, AlertTriangle, Info } from 'lucide-react-native';

export default function SyncStatus() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [hasErrors, setHasErrors] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
    const [visible, setVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        // 注册同步状态观察者
        const unregister = registerSyncObserver((state) => {
            setIsSyncing(state.isSyncing);

            // 根据队列大小计算一个进度值 (0-100)
            // 如果正在同步且队列为空，显示100%完成
            // 如果队列有消息，则根据队列大小计算进度
            const syncProgress = state.isSyncing
                ? (state.queueSize === 0 ? 100 : 0)
                : (state.queueSize === 0 ? 100 : Math.max(0, 100 - state.queueSize * 10));

            setProgress(syncProgress);
            const hasErrorsNow = Array.isArray(state.errors) && state.errors.length > 0;
            setHasErrors(hasErrorsNow);

            // 使用queueSize作为待处理消息数量
            setPendingCount(state.queueSize);
            setErrorCount(Array.isArray(state.errors) ? state.errors.length : 0);

            if (Array.isArray(state.errors)) {
                setSyncErrors(state.errors);
            }

            if (state.lastSyncTime) {
                const date = new Date(state.lastSyncTime);
                setLastSyncTime(date.toLocaleTimeString());
            }

            // 如果开始同步，显示组件
            if (state.isSyncing) {
                setVisible(true);
                // 同步开始时自动折叠详情
                if (expanded) {
                    setExpanded(false);
                }
            } else if (syncProgress === 100 && !hasErrorsNow) {
                // 如果同步完成且没有错误，3秒后隐藏
                setTimeout(() => {
                    setVisible(false);
                }, 3000);
            } else if (hasErrorsNow) {
                // 如果有错误，保持可见
                setVisible(true);
            }
        });

        // 检查初始状态
        const initialState = getSyncManager().getState();
        if (initialState.isSyncing) {
            setVisible(true);
        }

        return unregister;
    }, [expanded]);

    // 手动触发同步
    const handleManualSync = () => {
        syncOfflineQueue();
    };

    // 切换详情显示
    const toggleDetails = () => {
        setShowDetails(!showDetails);
    };

    // 切换扩展显示
    const toggleExpanded = () => {
        setExpanded(!expanded);
    };

    // 状态图标
    const getStatusIcon = () => {
        if (isSyncing) {
            return <ActivityIndicator size="small" color={COLORS.white} />;
        } else if (hasErrors) {
            return <AlertCircle size={20} color={COLORS.white} />;
        } else if (progress === 100) {
            return <Check size={20} color={COLORS.white} />;
        } else {
            return <ArrowUpDown size={20} color={COLORS.white} />;
        }
    };

    // 状态文本
    const getStatusText = () => {
        if (isSyncing) {
            return `同步中 ${progress}%`;
        } else if (hasErrors) {
            return '同步出错';
        } else if (progress === 100) {
            return '已同步';
        } else if (pendingCount > 0) {
            return `待同步: ${pendingCount}`;
        } else {
            return '已同步';
        }
    };

    // 状态颜色
    const getStatusColor = () => {
        if (hasErrors) {
            return COLORS.danger;
        } else if (isSyncing) {
            return COLORS.warning;
        } else {
            return COLORS.success;
        }
    };

    if (!visible) return null;

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: getStatusColor() },
                expanded && styles.expandedContainer
            ]}
        >
            <TouchableOpacity
                style={styles.content}
                onPress={toggleDetails}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    {getStatusIcon()}
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.statusText}>{getStatusText()}</Text>
                    {showDetails && lastSyncTime && (
                        <Text style={styles.detailText}>上次同步: {lastSyncTime}</Text>
                    )}
                </View>

                <View style={styles.actionsContainer}>
                    {!isSyncing && pendingCount > 0 && (
                        <TouchableOpacity style={styles.actionButton} onPress={handleManualSync}>
                            <RefreshCw size={18} color={COLORS.white} />
                        </TouchableOpacity>
                    )}

                    {hasErrors && (
                        <TouchableOpacity
                            style={[styles.actionButton, { marginLeft: 8 }]}
                            onPress={toggleExpanded}
                        >
                            <Info size={18} color={COLORS.white} />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>

            {isSyncing && (
                <View style={styles.progressContainer}>
                    <View
                        style={[
                            styles.progressBar,
                            { width: `${progress}%` }
                        ]}
                    />
                </View>
            )}

            {expanded && hasErrors && (
                <View style={styles.errorsContainer}>
                    <Text style={styles.errorsTitle}>同步错误详情: ({errorCount}个错误)</Text>
                    <ScrollView style={styles.errorsScroll}>
                        {syncErrors.map((error, index) => (
                            <View key={index} style={styles.errorItem}>
                                <AlertTriangle size={14} color={COLORS.white} style={styles.errorIcon} />
                                <Text style={styles.errorText}>
                                    {error.messageId ? `消息 ${error.messageId}: ` : ''}
                                    {error.details || ''}
                                    {error.error?.message || (typeof error.error === 'string' ? error.error : JSON.stringify(error.error))}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleManualSync}
                    >
                        <Text style={styles.retryText}>重试同步</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        borderRadius: 8,
        overflow: 'hidden',
        elevation: 3,
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        } : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4
        }),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    content: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
    },
    iconContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 12,
    },
    statusText: {
        color: COLORS.white,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
    },
    detailText: {
        color: COLORS.white,
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        opacity: 0.8,
    },
    actionButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    progressContainer: {
        height: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        width: '100%',
    },
    progressBar: {
        height: 2,
        backgroundColor: COLORS.white,
    },
    expandedContainer: {
        // Add any necessary styles for the expanded container
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorsContainer: {
        padding: 12,
    },
    errorsTitle: {
        color: COLORS.white,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        marginBottom: 8,
    },
    errorsScroll: {
        maxHeight: 200,
    },
    errorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    errorIcon: {
        marginRight: 8,
    },
    errorText: {
        color: COLORS.white,
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
    },
    retryButton: {
        width: '100%',
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
        alignItems: 'center',
    },
    retryText: {
        color: COLORS.white,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
    },
});