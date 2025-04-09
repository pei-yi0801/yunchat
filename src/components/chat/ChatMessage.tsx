import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
// @ts-ignore
import { formatDistanceToNow } from 'date-fns';
import { MessageStatus, Message } from '../../types';
import { AudioWaveform, File, Check, CheckCheck } from 'lucide-react-native';

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

// 状态图标组件
const StatusIcon: React.FC<{ status: MessageStatus }> = ({ status }) => {
  switch (status) {
    case 'sending':
      return <View style={styles.statusDot} />;
    case 'sent':
      return <Check size={14} color="#8E8E93" />;
    case 'delivered':
      return <CheckCheck size={14} color="#8E8E93" />;
    case 'read':
      return <CheckCheck size={14} color="#34C759" />;
    case 'failed':
      return <Text style={styles.failedText}>!</Text>;
    default:
      return null;
  }
};

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isCurrentUser,
  onPress,
  onLongPress,
}) => {
  const renderMessageContent = () => {
    switch (message.contentType) {
      case 'text':
        return <Text style={styles.messageText}>{message.content}</Text>;

      case 'image':
        return (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: message.attachments?.[0]?.url }}
              style={styles.imageContent}
              resizeMode="cover"
            />
          </View>
        );

      case 'file':
        return (
          <View style={styles.fileContainer}>
            <File size={20} color={isCurrentUser ? '#FFFFFF' : '#007AFF'} />
            <Text style={[styles.fileName, isCurrentUser && styles.userFileName]}>
              {message.attachments?.[0]?.name}
            </Text>
          </View>
        );

      case 'audio':
        return (
          <View style={styles.voiceContainer}>
            <AudioWaveform size={20} color={isCurrentUser ? '#FFFFFF' : '#007AFF'} />
            <Text style={[styles.voiceText, isCurrentUser && styles.userVoiceText]}>
              语音消息
            </Text>
          </View>
        );

      case 'system':
        return (
          <View style={styles.systemContainer}>
            <Text style={styles.systemText}>{message.content}</Text>
          </View>
        );

      default:
        return <Text style={styles.messageText}>{message.content}</Text>;
    }
  };

  // 系统消息单独渲染
  if (message.contentType === 'system') {
    return (
      <View style={styles.systemWrapper}>
        {renderMessageContent()}
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.userContainer : styles.otherContainer
    ]}>
      <Pressable
        style={[
          styles.bubble,
          isCurrentUser ? styles.userBubble : styles.otherBubble,
          message.contentType === 'image' && styles.imageBubble,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        {renderMessageContent()}
      </Pressable>

      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </Text>
        {isCurrentUser && <StatusIcon status={message.status} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    minHeight: 36,
  },
  userBubble: {
    backgroundColor: '#007AFF',
  },
  otherBubble: {
    backgroundColor: '#F2F2F7',
  },
  imageBubble: {
    padding: 4,
    overflow: 'hidden',
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
    marginRight: 4,
    fontFamily: 'Inter_400Regular',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContent: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontFamily: 'Inter_400Regular',
  },
  userFileName: {
    color: '#FFFFFF',
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 100,
  },
  voiceText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontFamily: 'Inter_400Regular',
  },
  userVoiceText: {
    color: '#FFFFFF',
  },
  systemContainer: {
    padding: 8,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    borderRadius: 10,
    alignItems: 'center',
  },
  systemText: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
  },
  systemWrapper: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8E8E93',
  },
  failedText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: 'bold',
  },
});

export default ChatMessage;