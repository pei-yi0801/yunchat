import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore
import { COLORS } from '@/src/constants';
import { useApp } from '@/src/contexts/AppContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { UserStatus } from '@/src/types/auth';
import { Stack, useRouter } from 'expo-router';
import { Bell, Check, ChevronDown, ChevronUp, Clock, HelpCircle, MessageSquare, Plus, Settings, Users, X } from 'lucide-react-native';

// 定义客服状态类型
enum AgentStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export default function AgentProfileScreen() {
  const router = useRouter();
  const { agent, logout } = useAuth();
  const { sessions } = useApp();

  // 将UserStatus转换为AgentStatus
  const getAgentStatus = (userStatus?: UserStatus): AgentStatus => {
    if (userStatus === UserStatus.ACTIVE) return AgentStatus.ONLINE;
    if (userStatus === UserStatus.INACTIVE) return AgentStatus.OFFLINE;
    return AgentStatus.ONLINE; // 默认
  };

  const [status, setStatus] = useState<AgentStatus>(getAgentStatus(agent?.status));
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [autoAssign, setAutoAssign] = useState(true);
  const [quickReply, setQuickReply] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([
    '您好，有什么可以帮您的？',
    '请稍等，我正在查询相关信息',
    '感谢您的耐心等待',
    '很抱歉给您带来不便'
  ]);
  const [showStatusOptions, setShowStatusOptions] = useState(false);

  const handleLogout = async () => {
    try {
      Alert.alert(
        '退出登录',
        '确定要退出当前账号吗？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定',
            onPress: async () => {
              await logout();
              router.replace('/');
            }
          }
        ]
      );
    } catch (error) {
      console.error('退出登录错误:', error);
    }
  };

  const handleAddQuickReply = () => {
    if (!quickReply.trim()) return;
    setQuickReplies([...quickReplies, quickReply]);
    setQuickReply('');
  };

  const handleRemoveQuickReply = (index: number) => {
    setQuickReplies(quickReplies.filter((_, i) => i !== index));
  };

  // 切换状态选项显示
  const toggleStatusOptions = () => {
    setShowStatusOptions(!showStatusOptions);
  };

  // 获取状态颜色
  const getStatusColor = (agentStatus: AgentStatus) => {
    switch (agentStatus) {
      case AgentStatus.ONLINE:
        return '#34C759'; // 绿色
      case AgentStatus.AWAY:
        return '#FF9500'; // 橙色
      case AgentStatus.BUSY:
        return '#FF3B30'; // 红色
      case AgentStatus.OFFLINE:
        return '#8E8E93'; // 灰色
      default:
        return '#34C759';
    }
  };

  // 获取状态文本
  const getStatusText = (agentStatus: AgentStatus) => {
    switch (agentStatus) {
      case AgentStatus.ONLINE:
        return '在线';
      case AgentStatus.AWAY:
        return '离开';
      case AgentStatus.BUSY:
        return '忙碌';
      case AgentStatus.OFFLINE:
        return '离线';
      default:
        return '在线';
    }
  };

  // 处理状态变更
  const handleStatusChange = (newStatus: AgentStatus) => {
    setStatus(newStatus);
    setShowStatusOptions(false);
  };

  // 统计数据
  const activeChats = sessions.filter(s => s.status === 'active' && s.agentId === agent?.id).length;
  const pendingChats = sessions.filter(s => s.status === 'pending').length;
  const resolvedChats = sessions.filter(s => s.status === 'resolved' && s.agentId === agent?.id).length;

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: '个人信息',
          headerShown: true,
        }}
      />

      <View style={styles.profileCard}>
        <Image
          source={
            agent?.avatar
              ? { uri: agent.avatar }
              : require('../../../assets/images/default-avatar.png')
          }
          style={styles.avatar}
        />

        <View style={styles.profileInfo}>
          <Text style={styles.name}>{agent?.displayName || '客服'}</Text>
          <Text style={styles.id}>ID: {agent?.id || 'Unknown'}</Text>
          <Text style={styles.status}>状态: {getStatusText(status)}</Text>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/agent/profile')}
        >
          <Text style={styles.editButtonText}>编辑</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusSelector}>
        <TouchableOpacity
          style={styles.statusButton}
          onPress={toggleStatusOptions}
        >
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(status) }
              ]}
            />
            <Text style={styles.statusText}>{getStatusText(status)}</Text>
          </View>
          {showStatusOptions ? (
            <ChevronUp size={20} color={COLORS.text} />
          ) : (
            <ChevronDown size={20} color={COLORS.text} />
          )}
        </TouchableOpacity>

        {showStatusOptions && (
          <View style={styles.statusOptions}>
            {Object.values(AgentStatus).map((agentStatus) => (
              <TouchableOpacity
                key={agentStatus}
                style={styles.statusOption}
                onPress={() => handleStatusChange(agentStatus)}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(agentStatus) }
                  ]}
                />
                <Text style={styles.statusOptionText}>
                  {getStatusText(agentStatus)}
                </Text>
                {status === agentStatus && (
                  <Check size={16} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 会话统计 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>会话统计</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#007AFF' }]}>
              <MessageSquare size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{activeChats}</Text>
            <Text style={styles.statLabel}>活跃会话</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#FF9500' }]}>
              <Clock size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{pendingChats}</Text>
            <Text style={styles.statLabel}>待处理</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#34C759' }]}>
              <Users size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{resolvedChats}</Text>
            <Text style={styles.statLabel}>已解决</Text>
          </View>
        </View>
      </View>

      {/* 设置选项 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>设置</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Bell size={20} color="#007AFF" />
            <Text style={styles.settingLabel}>通知提醒</Text>
          </View>
          <Switch
            value={enableNotifications}
            onValueChange={setEnableNotifications}
            trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Users size={20} color="#007AFF" />
            <Text style={styles.settingLabel}>自动分配会话</Text>
          </View>
          <Switch
            value={autoAssign}
            onValueChange={setAutoAssign}
            trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity style={styles.settingButton}>
          <Settings size={20} color="#007AFF" />
          <Text style={styles.settingButtonText}>更多设置</Text>
        </TouchableOpacity>
      </View>

      {/* 快捷回复 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>快捷回复</Text>

        <View style={styles.quickReplyInput}>
          <TextInput
            style={styles.input}
            placeholder="添加新的快捷回复..."
            value={quickReply}
            onChangeText={setQuickReply}
            multiline
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddQuickReply}
            disabled={!quickReply.trim()}
          >
            <Plus size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickReplies}>
          {quickReplies.map((reply, index) => (
            <View key={index} style={styles.quickReplyItem}>
              <Text style={styles.quickReplyText} numberOfLines={2}>
                {reply}
              </Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveQuickReply(index)}
              >
                <X size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {/* 帮助与支持 */}
      <TouchableOpacity style={styles.helpButton}>
        <HelpCircle size={20} color="#007AFF" />
        <Text style={styles.helpButtonText}>帮助与支持</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          当前会话数: {sessions.length}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#000000',
    marginBottom: 4,
  },
  id: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#8E8E93',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#8E8E93',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E1F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  statusSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#000000',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  statusOptionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#000000',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#000000',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#8E8E93',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#000000',
    marginLeft: 12,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#007AFF',
    marginLeft: 12,
  },
  quickReplyInput: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 40,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginLeft: 8,
  },
  quickReplies: {
    marginTop: 8,
  },
  quickReplyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  quickReplyText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#000000',
  },
  removeButton: {
    marginLeft: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  helpButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#007AFF',
    marginLeft: 8,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#8E8E93',
  },
});