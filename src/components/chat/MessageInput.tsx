import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import {
  Mic,
  Paperclip,
  Send,
  Image as ImageIcon,
  File,
  X,
} from 'lucide-react-native';
import { UPLOAD_CONFIG } from '../../services/config';
import { generateId, PREFIXES, MessageType } from '../../types';
import { WebSocketService } from '../../services/websocket';

// 获取WebSocket服务实例
const wsService = WebSocketService.getInstance();

// 创建一个辅助函数来处理触觉反馈
const triggerHaptic = (style?: any) => {
  // 只在iOS和Android平台上使用Haptics，跳过Web环境
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      if (style) {
        Haptics.impactAsync(style);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.log('Haptics not available:', error);
    }
  }
};

// 创建一个通知反馈的辅助函数
const triggerNotification = (type?: any) => {
  // 只在iOS和Android平台上使用Haptics，跳过Web环境
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      Haptics.notificationAsync(type || Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Haptics notification not available:', error);
    }
  }
};

interface MessageInputProps {
  sessionId: string;
  onSendMessage: (text: string, type: MessageType, attachments?: any[]) => void;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  sessionId,
  onSendMessage,
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled = false,
}) => {
  const [message, setMessage] = useState('');
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 处理输入变化，并发送"正在输入"状态
  const handleChangeText = (text: string) => {
    setMessage(text);

    if (!isTyping) {
      setIsTyping(true);
      wsService.sendTypingStatus(true, sessionId);
    }

    // 重置超时
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // 设置新的超时（2秒后发送停止输入）
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      wsService.sendTypingStatus(false, sessionId);
    }, 2000);
  };

  // 在组件卸载时清除超时
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // 发送文本消息
  const handleSendTextMessage = () => {
    if (message.trim() === '') {
      return;
    }

    onSendMessage(message, MessageType.TEXT);
    setMessage('');
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    inputRef.current?.blur();
  };

  // 选择图片
  const handleImagePicker = async () => {
    setIsAttachmentMenuOpen(false);

    try {
      // 使用字符串类型的MediaType替代废弃的MediaTypeOptions
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // 检查文件大小
        if (asset.fileSize && asset.fileSize > UPLOAD_CONFIG.MAX_SIZE) {
          alert(`图片大小不能超过${UPLOAD_CONFIG.MAX_SIZE / 1024 / 1024}MB`);
          return;
        }

        onSendMessage('图片消息', MessageType.IMAGE, [{
          url: asset.uri,
          type: 'image/jpeg',
          name: `image_${Date.now()}.jpg`,
          size: asset.fileSize,
        }]);

        triggerNotification(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('选择图片时出错:', error);
    }
  };

  // 选择文件
  const handleFilePicker = async () => {
    setIsAttachmentMenuOpen(false);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: UPLOAD_CONFIG.ALLOWED_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // 检查文件大小
        if (file.size && file.size > UPLOAD_CONFIG.MAX_SIZE) {
          alert(`文件大小不能超过${UPLOAD_CONFIG.MAX_SIZE / 1024 / 1024}MB`);
          return;
        }

        onSendMessage(`文件: ${file.name}`, MessageType.FILE, [{
          url: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name,
          size: file.size || 0,
        }]);

        triggerNotification(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('选择文件时出错:', error);
    }
  };

  // 处理录音按钮
  const handleRecordVoice = () => {
    if (isRecording) {
      onStopRecording?.();
    } else {
      onStartRecording?.();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        {/* 附件菜单 */}
        {isAttachmentMenuOpen && (
          <View style={styles.attachmentMenu}>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={handleImagePicker}
            >
              <View style={[styles.attachmentIcon, { backgroundColor: '#34C759' }]}>
                <ImageIcon size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={handleFilePicker}
            >
              <View style={[styles.attachmentIcon, { backgroundColor: '#007AFF' }]}>
                <File size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={() => setIsAttachmentMenuOpen(false)}
            >
              <View style={[styles.attachmentIcon, { backgroundColor: '#FF3B30' }]}>
                <X size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 输入区域 */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
            }}
            disabled={disabled}
          >
            <Paperclip size={24} color={disabled ? '#C7C7CC' : '#8E8E93'} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="输入消息..."
            placeholderTextColor="#8E8E93"
            value={message}
            onChangeText={handleChangeText}
            multiline
            editable={!disabled}
          />

          {message.trim() === '' ? (
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordingButton]}
              onPress={handleRecordVoice}
              disabled={disabled}
            >
              {isRecording ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Mic size={24} color={disabled ? '#C7C7CC' : '#FFFFFF'} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendTextMessage}
              disabled={disabled}
            >
              <Send size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  recordButton: {
    backgroundColor: '#8E8E93',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  attachmentMenu: {
    flexDirection: 'row',
    padding: 8,
    justifyContent: 'space-around',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginBottom: 8,
  },
  attachmentOption: {
    alignItems: 'center',
    padding: 8,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 10,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default MessageInput;