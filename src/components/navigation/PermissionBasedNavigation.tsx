import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Permission, UserRole } from '../../types/auth';
import { COLORS } from '../../constants';

// 导航项配置接口
export interface NavigationItem {
    key: string;
    title: string;
    icon: React.ReactNode;
    path: string;
    requiredPermissions?: Permission[];
    requiredRoles?: UserRole[];
    hideIfNoPermission?: boolean; // 如果没有权限是否隐藏(而不是禁用)
    children?: NavigationItem[];
}

interface PermissionBasedNavigationProps {
    items: NavigationItem[];
    onNavigate: (path: string) => void;
    activePath?: string;
    renderIcon?: (icon: React.ReactNode, isActive: boolean) => React.ReactNode;
    orientation?: 'horizontal' | 'vertical';
    showLabels?: boolean;
    itemStyle?: object;
    activeItemStyle?: object;
}

/**
 * 基于权限的导航组件
 * 用于根据用户权限动态显示导航项
 */
const PermissionBasedNavigation: React.FC<PermissionBasedNavigationProps> = ({
    items,
    onNavigate,
    activePath,
    renderIcon,
    orientation = 'vertical',
    showLabels = true,
    itemStyle,
    activeItemStyle,
}) => {
    const { agent, hasPermission: checkPermission } = useAuth();

    // 检查用户是否有权限访问该项
    const hasAccessToItem = (item: NavigationItem): boolean => {
        // 检查所需角色
        if (item.requiredRoles && item.requiredRoles.length > 0) {
            if (!agent || !item.requiredRoles.includes(agent.role)) {
                return false;
            }
        }

        // 检查所需权限
        if (item.requiredPermissions && item.requiredPermissions.length > 0) {
            if (!agent) return false;

            return item.requiredPermissions.every(permission =>
                checkPermission(permission)
            );
        }

        // 默认情况下，如果没有指定权限或角色要求，则允许访问
        return true;
    };

    // 过滤掉无权访问且需要隐藏的项
    const visibleItems = items.filter(item =>
        hasAccessToItem(item) || !item.hideIfNoPermission
    );

    return (
        <View style={[
            styles.container,
            orientation === 'horizontal' ? styles.horizontal : styles.vertical
        ]}>
            {visibleItems.map(item => {
                const isActive = activePath === item.path;
                const canAccess = hasAccessToItem(item);

                return (
                    <TouchableOpacity
                        key={item.key}
                        style={[
                            styles.item,
                            orientation === 'horizontal' ? styles.horizontalItem : styles.verticalItem,
                            isActive && styles.activeItem,
                            isActive && activeItemStyle,
                            itemStyle,
                            !canAccess && styles.disabledItem
                        ]}
                        onPress={() => canAccess && onNavigate(item.path)}
                        disabled={!canAccess}
                    >
                        {renderIcon ? (
                            renderIcon(item.icon, isActive)
                        ) : (
                            <View style={styles.icon}>{item.icon}</View>
                        )}

                        {showLabels && (
                            <Text
                                style={[
                                    styles.label,
                                    isActive && styles.activeLabel,
                                    !canAccess && styles.disabledLabel
                                ]}
                            >
                                {item.title}
                            </Text>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.white,
    },
    horizontal: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: COLORS.separator,
    },
    vertical: {
        flexDirection: 'column',
    },
    item: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    horizontalItem: {
        flex: 1,
    },
    verticalItem: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'flex-start',
    },
    activeItem: {
        backgroundColor: COLORS.gray6,
    },
    disabledItem: {
        opacity: 0.5,
    },
    icon: {
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        color: COLORS.text,
        marginLeft: 8,
    },
    activeLabel: {
        color: COLORS.primary,
        fontWeight: '500',
    },
    disabledLabel: {
        color: COLORS.gray,
    },
});

export default PermissionBasedNavigation;