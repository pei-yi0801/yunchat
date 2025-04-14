import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/src/constants';
import { useApp } from '@/src/contexts/AppContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { Permission } from '@/src/types/auth';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Search, UserX } from 'lucide-react-native';
import { TextInput } from 'react-native';

type BlacklistProps = {
    canManageBlacklist?: boolean;
    initialBlacklist?: string[];
};

export function Blacklist({ canManageBlacklist = true, initialBlacklist = [] }: BlacklistProps) {
    const router = useRouter();
    const { agent } = useAuth();
    const { customers } = useApp();

    // 黑名单状态
    const [blacklistedUsers, setBlacklistedUsers] = useState<string[]>(initialBlacklist);
    const [searchQuery, setSearchQuery] = useState('');

    // 模拟获取黑名单数据
    useEffect(() => {
        setBlacklistedUsers(initialBlacklist);
    }, [initialBlacklist]);

    // 从黑名单中移除用户
    const handleRemoveFromBlacklist = (id: string) => {
        if (!canManageBlacklist) {
            Alert.alert('权限不足', '您没有管理黑名单的权限');
            return;
        }

        Alert.alert(
            '确认操作',
            '确定要将此用户从黑名单中移除吗？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '确定',
                    onPress: () => {
                        setBlacklistedUsers(blacklistedUsers.filter(userId => userId !== id));
                        Alert.alert('成功', '已将用户从黑名单中移除');
                    }
                }
            ]
        );
    };

    // 根据搜索过滤黑名单
    const filteredBlacklist = blacklistedUsers.filter(id =>
        id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>黑名单管理</Text>
                <Text style={styles.subtitle}>
                    当前黑名单用户数: {blacklistedUsers.length}
                </Text>
            </View>

            <View style={styles.searchContainer}>
                <Search size={20} color={COLORS.gray} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="搜索黑名单用户..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {filteredBlacklist.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <UserX size={40} color={COLORS.gray} />
                    <Text style={styles.emptyText}>
                        {searchQuery ? '没有找到匹配的用户' : '黑名单为空'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredBlacklist}
                    keyExtractor={(item: string) => item}
                    renderItem={({ item }: { item: string }) => (
                        <View style={styles.blacklistItem}>
                            <View>
                                <Text style={styles.blacklistUserId}>ID: {item}</Text>
                                <Text style={styles.blacklistUserInfo}>
                                    添加时间: {new Date().toLocaleDateString()}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleRemoveFromBlacklist(item)}
                                disabled={!canManageBlacklist}
                            >
                                <Text style={styles.removeButtonText}>移除</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    contentContainerStyle={styles.blacklistContainer}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.gray,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.gray5,
        borderRadius: 8,
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: COLORS.text,
    },
    blacklistContainer: {
        padding: 16,
    },
    blacklistItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    blacklistUserId: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text,
        marginBottom: 4,
    },
    blacklistUserInfo: {
        fontSize: 14,
        color: COLORS.gray,
    },
    removeButton: {
        backgroundColor: COLORS.danger,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 4,
    },
    removeButtonText: {
        color: COLORS.white,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: COLORS.gray,
        textAlign: 'center',
    },
});