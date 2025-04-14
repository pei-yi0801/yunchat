import { View, Text, StyleSheet, FlatList, Pressable, Image } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
// @ts-ignore
import { formatDistanceToNow } from 'date-fns';

export type ChatStatus = 'active' | 'pending' | 'resolved';

export interface Chat {
    id: string;
    customerName: string;
    lastMessage: string;
    timestamp: Date;
    status: ChatStatus;
    avatar: string;
    unreadCount: number;
}

const mockChats: Chat[] = [
    {
        id: '1',
        customerName: 'Sarah Johnson',
        lastMessage: 'I need help with my recent order #12345',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        status: 'active',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
        unreadCount: 3,
    },
    {
        id: '2',
        customerName: 'Michael Chen',
        lastMessage: 'When will my order be shipped?',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        status: 'pending',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
        unreadCount: 0,
    },
    {
        id: '3',
        customerName: 'Emily Davis',
        lastMessage: 'Thank you for your help!',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        status: 'resolved',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
        unreadCount: 0,
    },
];

const statusColors = {
    active: '#34C759',
    pending: '#FF9500',
    resolved: '#8E8E93',
} as const;

export interface ChatsScreenProps {
    chats?: Chat[];
    onChatPress?: (chat: Chat) => void;
    onRefresh?: () => void;
    refreshing?: boolean;
}

export function ChatsScreen({
    chats = mockChats,
    onChatPress,
    onRefresh,
    refreshing = false,
}: ChatsScreenProps) {
    const renderChatItem = useCallback(({ item }: { item: Chat }) => (
        <Pressable
            style={styles.chatItem}
            onPress={() => onChatPress?.(item)}
        >
            <View style={styles.avatarContainer}>
                <Image
                    source={{ uri: item.avatar }}
                    style={styles.avatar}
                    loadingIndicatorSource={require('../../../../assets/images/icon.png')}
                    defaultSource={require('../../../../assets/images/favicon.png')}
                />
                <View
                    style={[
                        styles.statusIndicator,
                        { backgroundColor: statusColors[item.status] },
                    ]}
                />
            </View>
            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={styles.customerName}>{item.customerName}</Text>
                    <Text style={styles.timestamp}>
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </Text>
                </View>
                <View style={styles.messageContainer}>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.lastMessage}
                    </Text>
                    {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    ), [onChatPress]);

    const keyExtractor = useCallback((item: Chat) => item.id, []);

    return (
        <View style={styles.container}>
            <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>暂无聊天记录</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    listContent: {
        padding: 16,
    },
    chatItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        elevation: 2,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    statusIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    chatInfo: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    customerName: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        color: '#000000',
    },
    timestamp: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: '#8E8E93',
    },
    messageContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        flex: 1,
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        color: '#3C3C43',
        marginRight: 8,
    },
    unreadBadge: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadCount: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: '#FFFFFF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 16,
        color: '#8E8E93',
    },
});