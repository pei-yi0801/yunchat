import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// @ts-ignore
import { COLORS } from '@/src/constants';
import { useApp } from '@/src/contexts/AppContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { Permission } from '@/src/types/auth';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Search, UserX } from 'lucide-react-native';
import { TextInput } from 'react-native';

import { Blacklist } from '@/src/components/common/Blacklist';

export default function BlacklistScreen() {
    const router = useRouter();
    const { hasPermission } = useAuth();

    // 检查权限
    const canManageBlacklist = hasPermission(Permission.MANAGE_SETTINGS) ||
        hasPermission(Permission.MANAGE_SYSTEM);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '黑名单管理',
                    headerShown: true,
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                        >
                            <ArrowLeft size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    )
                }}
            />
            <Blacklist
                canManageBlacklist={canManageBlacklist}
                initialBlacklist={['cust_004', 'cust_005', 'cust_006']}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    backButton: {
        marginLeft: 8,
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