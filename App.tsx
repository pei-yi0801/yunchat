import { AuthProvider } from './src/contexts/AuthContext';
import { ServiceProvider } from './src/contexts/ServiceContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NotificationBanner from './src/components/NotificationBanner';
import ConnectionStatusIndicator from './src/components/ConnectionStatus';
import SyncStatus from './src/components/SyncStatus';
import { useEffect } from 'react';
import { useService } from './src/contexts/ServiceContext';

export default function App() {
    const { initializeServices, closeServices } = useService();

    // 初始化服务
    useEffect(() => {
        initializeServices().catch(error => {
            console.error('初始化服务时出错:', error);
        });

        return () => {
            closeServices().catch(error => {
                console.error('关闭服务时出错:', error);
            });
        };
    }, [initializeServices, closeServices]);

    return (
        <AuthProvider>
            <ServiceProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <ConnectionStatusIndicator />
                    <NotificationBanner />
                    <SyncStatus />
                </GestureHandlerRootView>
            </ServiceProvider>
        </AuthProvider>
    );
}