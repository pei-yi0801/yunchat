import { useState } from 'react';
import { ChatsScreen as CommonChatsScreen, Chat } from '@/src/components/common/ChatsScreen';

export default function ChatsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    // 在这里添加刷新逻辑
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleChatPress = (chat: Chat) => {
    // 在这里处理聊天项点击事件
    console.log('Chat pressed:', chat);
  };

  return (
    <CommonChatsScreen
      onRefresh={handleRefresh}
      refreshing={refreshing}
      onChatPress={handleChatPress}
    />
  );
}