import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { COLORS } from '@/src/constants';
import { useAuth } from '@/src/contexts/AuthContext';
import { Permission } from '@/types/auth';
import prompt from 'react-native-prompt-android';

declare module 'react-native-prompt-android' {
    type PromptTypeAndroid = 'default' | 'plain-text' | 'secure-text' | 'numeric' | 'email-address' | 'phone-pad' | 'login-password';
    type PromptType = PromptTypeAndroid;

    interface PromptOptions {
        title: string;
        message?: string;
        placeholder?: string;
        type?: PromptType;
    }

    export default function prompt(options: PromptOptions): Promise<string | null>;
    export default function prompt(title: string, message?: string, type?: PromptType): Promise<string | null>;
}

import * as SecureStore from 'expo-secure-store';

export default function AdminLayout() {
    const { user } = useAuth();

    useEffect(() => {
        const verifyAdminAccess = async () => {
            if (!user?.permissions?.includes(Permission.MANAGE_SYSTEM)) {
                router.replace('/login');
                return;
            }

            const storedPassword = await SecureStore.getItemAsync('adminReauth');
            if (!storedPassword) {
                try {
                    const input = await prompt({
                        title: '二次验证',
                        message: '请输入管理员密码继续访问',
                        placeholder: '当前账户密码',
                        type: 'secure-text'
                    });

                    if (!input) {
                        router.replace('/');
                        return;
                    }

                    if (input === 'admin123') {
                        await SecureStore.setItemAsync('adminReauth', 'verified', {
                            requireAuthentication: true
                        });
                    } else {
                        router.replace('/');
                    }
                } catch (error) {
                    console.error('二次验证失败:', error);
                    router.replace('/');
                }
            }
        };

        verifyAdminAccess();
    }, [user]);

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerStyle: {
                    backgroundColor: COLORS.white,
                },
                headerTitleStyle: {
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 18,
                    color: COLORS.text,
                },
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: '管理控制台',
                }}
            />
            <Stack.Screen
                name="console"
                options={{
                    title: '客服控制台',
                }}
            />
            <Stack.Screen
                name="blacklist"
                options={{
                    title: '黑名单管理',
                }}
            />
            <Stack.Screen
                name="share-links"
                options={{
                    title: '分享链接管理',
                }}
            />
        </Stack>
    );
}