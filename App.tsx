import { AuthProvider } from './src/contexts/AuthContext';
import { ServiceProvider } from './src/contexts/ServiceContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NotificationBanner from './src/components/NotificationBanner';
import ConnectionStatusIndicator from './src/components/ConnectionStatus';
import SyncStatus from './src/components/SyncStatus';
import { ServiceInitializer } from './src/components/common/ServiceInitializer';
import { NotificationProvider } from './src/services/notification';

export default function App() {
    return (
        <ServiceProvider>
            <NotificationProvider>
                <ServiceInitializer
                    onError={(error) => {
                        console.error('服务初始化失败:', error);
                    }}
                    onInitialized={() => {
                        console.log('服务初始化成功');
                    }}
                />
                <AuthProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <ConnectionStatusIndicator />
                        <NotificationBanner />
                        <SyncStatus />
                    </GestureHandlerRootView>
                </AuthProvider>
            </NotificationProvider>
        </ServiceProvider>
    );
}