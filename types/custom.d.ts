declare module 'react-native-safe-area-context';
declare module '@expo-google-fonts/inter';
declare module 'lucide-react-native';
declare module 'expo-image-picker';
declare module 'expo-document-picker';
declare module 'expo-haptics';
declare module 'expo-clipboard';
declare module 'react-native-modal';
declare module 'nanoid';
declare module 'nanoid/non-secure';

// 为React Native添加类型声明
declare module 'react-native' {
    import React from 'react';

    export interface ViewProps {
        style?: any;
        pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface TextProps {
        style?: any;
        numberOfLines?: number;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface TextInputProps {
        style?: any;
        value?: string;
        onChangeText?: (text: string) => void;
        placeholder?: string;
        multiline?: boolean;
        secureTextEntry?: boolean;
        autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
        autoCorrect?: boolean;
        keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
        clearButtonMode?: 'never' | 'while-editing' | 'unless-editing' | 'always';
        placeholderTextColor?: string;
        editable?: boolean;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface TouchableOpacityProps {
        style?: any;
        onPress?: () => void;
        activeOpacity?: number;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface ImageProps {
        source: { uri: string } | number;
        style?: any;
        resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
        [key: string]: any;
    }

    export interface ScrollViewProps {
        style?: any;
        contentContainerStyle?: any;
        horizontal?: boolean;
        showsHorizontalScrollIndicator?: boolean;
        showsVerticalScrollIndicator?: boolean;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface SwitchProps {
        value?: boolean;
        onValueChange?: (value: boolean) => void;
        style?: any;
        [key: string]: any;
    }

    export interface FlatListProps<T> {
        data: ReadonlyArray<T>;
        renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement | null;
        keyExtractor: (item: T, index: number) => string;
        style?: any;
        contentContainerStyle?: any;
        horizontal?: boolean;
        showsHorizontalScrollIndicator?: boolean;
        showsVerticalScrollIndicator?: boolean;
        ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
        ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
        ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
        refreshing?: boolean;
        onRefresh?: () => void;
        onEndReached?: () => void;
        onEndReachedThreshold?: number;
        initialNumToRender?: number;
        maxToRenderPerBatch?: number;
        windowSize?: number;
        removeClippedSubviews?: boolean;
        [key: string]: any;
    }

    export interface PressableProps {
        style?: any | ((state: { pressed: boolean }) => any);
        onPress?: () => void;
        children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
        [key: string]: any;
    }

    export interface KeyboardAvoidingViewProps extends ViewProps {
        behavior?: 'height' | 'position' | 'padding';
        keyboardVerticalOffset?: number;
    }

    export interface ActivityIndicatorProps {
        size?: 'small' | 'large' | number;
        color?: string;
        animating?: boolean;
        style?: any;
        [key: string]: any;
    }

    export interface RefreshControlProps {
        refreshing: boolean;
        onRefresh: () => void;
        tintColor?: string;
        title?: string;
        titleColor?: string;
        colors?: string[];
        progressBackgroundColor?: string;
        [key: string]: any;
    }

    export type StyleSheetType = {
        create: <T extends { [key: string]: any }>(styles: T) => T;
        compose: (style1: any, style2: any) => any;
        flatten: (style: any) => any;
    };

    export const StyleSheet: StyleSheetType;

    export type PlatformType = {
        OS: 'ios' | 'android' | 'web';
        select: <T>(obj: { ios?: T; android?: T; web?: T; default?: T }) => T;
    };

    export const Platform: PlatformType;

    export type DimensionsType = {
        get: (dimension: 'window' | 'screen') => { width: number; height: number; scale: number; fontScale: number };
        addEventListener: (type: string, handler: Function) => { remove: () => void };
    };

    export const Dimensions: DimensionsType;

    export type KeyboardType = {
        dismiss: () => void;
        addListener: (eventType: string, listener: Function) => { remove: () => void };
    };

    export const Keyboard: KeyboardType;

    export class View extends React.Component<ViewProps> { }
    export class Text extends React.Component<TextProps> { }
    export class TextInput extends React.Component<TextInputProps> {
        blur(): void;
        focus(): void;
        clear(): void;
        isFocused(): boolean;
    }
    export class TouchableOpacity extends React.Component<TouchableOpacityProps> { }
    export class Image extends React.Component<ImageProps> { }
    export class ScrollView extends React.Component<ScrollViewProps> { }
    export class Switch extends React.Component<SwitchProps> { }
    export class FlatList<T> extends React.Component<FlatListProps<T>> { }
    export class Pressable extends React.Component<PressableProps> { }
    export class KeyboardAvoidingView extends React.Component<KeyboardAvoidingViewProps> { }
    export class ActivityIndicator extends React.Component<ActivityIndicatorProps> { }
    export class RefreshControl extends React.Component<RefreshControlProps> { }

    export const Alert: {
        alert: (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>, options?: { cancelable?: boolean }) => void;
    };

    export const useColorScheme: () => 'light' | 'dark' | null;
}

// 为react-native-svg添加类型声明
declare module 'react-native-svg' {
    import React from 'react';

    export interface SvgProps {
        width?: number | string;
        height?: number | string;
        viewBox?: string;
        fill?: string;
        stroke?: string;
        style?: any;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface PathProps {
        d: string;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        strokeLinecap?: 'butt' | 'round' | 'square';
        strokeLinejoin?: 'miter' | 'round' | 'bevel';
        [key: string]: any;
    }

    export interface CircleProps {
        cx?: number | string;
        cy?: number | string;
        r?: number | string;
        fill?: string;
        stroke?: string;
        [key: string]: any;
    }

    export interface RectProps {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        rx?: number | string;
        ry?: number | string;
        fill?: string;
        stroke?: string;
        [key: string]: any;
    }

    export class Svg extends React.Component<SvgProps> { }
    export class Path extends React.Component<PathProps> { }
    export class Circle extends React.Component<CircleProps> { }
    export class Rect extends React.Component<RectProps> { }
    export class G extends React.Component<SvgProps> { }
    export class Line extends React.Component<any> { }
    export class Polygon extends React.Component<any> { }

    const SvgComponent: typeof Svg;
    export default SvgComponent;
}

// 明确声明expo-router模块及其常用导出
declare module 'expo-router' {
    import { ComponentType } from 'react';

    export const useRouter: () => {
        push: (route: string) => void;
        replace: (route: string) => void;
        back: () => void;
        navigate: (route: string) => void;
    };

    export const Slot: ComponentType<any>;
    export const Stack: {
        Screen: ComponentType<any>;
    } & ComponentType<any>;
    export const Tabs: {
        Screen: ComponentType<any>;
    } & ComponentType<any>;
    export const Link: ComponentType<any>;
    export const router: {
        push: (route: string) => void;
        replace: (route: string) => void;
        back: () => void;
        navigate: (route: string) => void;
    };
}

// 明确声明expo-secure-store模块
declare module 'expo-secure-store' {
    export function getItemAsync(key: string, options?: any): Promise<string | null>;
    export function setItemAsync(key: string, value: string, options?: any): Promise<void>;
    export function deleteItemAsync(key: string, options?: any): Promise<void>;
    export function isAvailableAsync(): Promise<boolean>;

    export const AFTER_FIRST_UNLOCK: string;
    export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: string;
    export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: string;
    export const WHEN_UNLOCKED: string;
    export const WHEN_UNLOCKED_THIS_DEVICE_ONLY: string;

    export interface SecureStoreOptions {
        keychainService?: string;
        keychainAccessible?: string;
    }
}

declare module '*.svg' {
    import React from 'react';
    import { SvgProps } from 'react-native-svg';
    const content: React.FC<SvgProps>;
    export default content;
}

declare module '*.png' {
    const value: any;
    export default value;
}

declare module '*.jpg' {
    const value: any;
    export default value;
}

declare module '*.json' {
    const value: any;
    export default value;
}

// WebSocket相关类型声明
declare module 'socket.io-client' {
    export function io(url: string, opts?: any): Socket;
    export interface Socket {
        on(event: string, callback: (data: any) => void): this;
        emit(event: string, data: any): boolean;
        connect(): void;
        disconnect(): void;
        connected: boolean;
    }
}

// 为WebSocketService添加类型声明
declare module '../services/websocket' {
    import { ConnectionStatus, ConnectionQuality, WSMessage } from '../src/types';

    export interface WSStatusListener {
        onStatusChange: (status: ConnectionStatus) => void;
        onConnectionQualityChange?: (quality: ConnectionQuality) => void;
        onOfflineMode?: () => void;
    }

    export interface WSMessageListener {
        onMessage: (message: WSMessage) => void;
        onMessageError?: (message: WSMessage) => void;
    }

    export class WebSocketService {
        static getInstance(): WebSocketService;
        isConnected(): boolean;
        connect(): Promise<boolean>;
        disconnect(): void;
        getStatus(): ConnectionStatus;
        getConnectionQuality(): ConnectionQuality;
        getCurrentLatency(): number;
        getPacketLoss(): number;
        addStatusListener(listener: WSStatusListener): void;
        removeStatusListener(listener: WSStatusListener): void;
        addMessageListener(listener: WSMessageListener): void;
        removeMessageListener(listener: WSMessageListener): void;
        addEventListener(event: string, callback: (data: any) => void): void;
        removeEventListener(event: string, callback: (data: any) => void): void;
        sendMessage(event?: string, data?: any): boolean;
        sendMessage(message: WSMessage): boolean;
        sendChatMessage(content: string, sessionId: string, contentType?: string): string;
        sendTypingStatus(isTyping: boolean, sessionId: string): void;
    }

    export function useWebSocket(): {
        status: ConnectionStatus;
        connectionQuality: ConnectionQuality;
        connect: () => Promise<boolean>;
        disconnect: () => void;
        sendMessage: (event: string, data: any) => boolean;
        addMessageListener: (listener: WSMessageListener) => void;
        removeMessageListener: (listener: WSMessageListener) => void;
        addStatusListener: (listener: WSStatusListener) => void;
        removeStatusListener: (listener: WSStatusListener) => void;
    };

    export { ConnectionQuality };
}