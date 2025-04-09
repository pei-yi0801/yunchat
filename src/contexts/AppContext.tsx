import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
// @ts-ignore
import { nanoid } from 'nanoid';
import { ChatSession, Customer, Message, ChatStatus, MessageType, MessageStatus, AgentStatus } from '../types';
import { generateId } from '../types';
import { useAuth } from './AuthContext';

// 定义上下文接口
interface AppContextType {
  sessions: ChatSession[];
  customers: Customer[];
  messages: Record<string, Message[]>;
  isLoading: boolean;
  agent: any; // 添加agent属性
  error: any; // 添加error属性

  // 会话管理
  createSession: (customerId: string, subject?: string) => Promise<string>;
  closeSession: (sessionId: string) => Promise<boolean>;
  assignSession: (sessionId: string, agentId: string) => Promise<boolean>;

  // 消息管理
  sendMessage: (sessionId: string, content: string, type?: MessageType) => Promise<Message | null>;
  markAsRead: (sessionId: string) => Promise<boolean>;

  // 数据加载
  loadMoreMessages: (sessionId: string) => Promise<boolean>;
  refreshSessions: () => Promise<void>;

  // 客户管理
  getCustomer: (customerId: string) => Customer | undefined;
  addCustomerNote: (customerId: string, note: string) => Promise<boolean>;

  // 添加会话解决方法
  resolveSession: (sessionId: string) => Promise<boolean>;
}

// 创建上下文
const AppContext = createContext<AppContextType | undefined>(undefined);

// 模拟数据生成函数
const generateMockData = () => {
  // 生成模拟客户
  const mockCustomers: Customer[] = [
    {
      id: 'cust_001',
      name: '李小姐',
      email: 'customer1@example.com',
      phone: '13800138001',
      avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
      firstContact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30天前
      lastContact: new Date(Date.now() - 1000 * 60 * 5), // 5分钟前
      tags: ['vip', '退款问题'],
      notes: '客户需要特殊关注',
    },
    {
      id: 'cust_002',
      name: '陈先生',
      email: 'customer2@example.com',
      phone: '13900139002',
      avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
      firstContact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15天前
      lastContact: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
      tags: ['新客户'],
      notes: '',
    },
    {
      id: 'cust_003',
      name: '王女士',
      email: 'customer3@example.com',
      phone: '13700137003',
      avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
      firstContact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5天前
      tags: ['商品咨询'],
    },
  ];

  // 生成模拟会话
  const mockSessions: ChatSession[] = [
    {
      id: 'sess_001',
      customerId: 'cust_001',
      agentId: 'agent_001',
      status: ChatStatus.ACTIVE,
      startTime: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
      tags: ['退款', '紧急'],
      subject: '订单退款问题',
      priority: 'high',
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5分钟前
      unreadCount: 2,
    },
    {
      id: 'sess_002',
      customerId: 'cust_002',
      status: ChatStatus.PENDING,
      startTime: new Date(Date.now() - 1000 * 60 * 15), // 15分钟前
      tags: ['产品咨询'],
      subject: '关于新品上架时间',
      priority: 'medium',
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 15), // 15分钟前
      unreadCount: 1,
    },
    {
      id: 'sess_003',
      customerId: 'cust_003',
      agentId: 'agent_002',
      status: ChatStatus.RESOLVED,
      startTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2小时前
      endTime: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
      tags: ['商品信息'],
      subject: '商品尺码咨询',
      priority: 'low',
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
      unreadCount: 0,
    },
  ];

  // 生成模拟消息
  const mockMessages: Record<string, Message[]> = {
    'sess_001': [
      {
        id: 'msg_001_1',
        sessionId: 'sess_001',
        senderType: 'customer',
        content: '您好，我需要申请退款，订单号是 #12345。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_001_2',
        sessionId: 'sess_001',
        senderType: 'agent',
        content: '您好，李小姐。我这边会为您查询退款相关信息，请稍等。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_001_3',
        sessionId: 'sess_001',
        senderType: 'agent',
        content: '我已经查到您的订单信息，系统显示您的退款申请已经提交，正在处理中。预计1-3个工作日内会退回到您的支付账户。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_001_4',
        sessionId: 'sess_001',
        senderType: 'customer',
        content: '好的，谢谢您。我等待退款到账。如果超过3天还没收到，我再联系您。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_001_5',
        sessionId: 'sess_001',
        senderType: 'customer',
        content: '请问您能加快处理吗？我这边比较急。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5分钟前
        status: 'delivered' as MessageStatus,
      },
    ],
    'sess_002': [
      {
        id: 'msg_002_1',
        sessionId: 'sess_002',
        senderType: 'customer',
        content: '您好，我想了解一下新款手机什么时候上架？',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15分钟前
        status: 'delivered' as MessageStatus,
      },
    ],
    'sess_003': [
      {
        id: 'msg_003_1',
        sessionId: 'sess_003',
        senderType: 'customer',
        content: '您好，我想问一下你们的T恤尺码表在哪里可以查看？',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2小时前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_003_2',
        sessionId: 'sess_003',
        senderType: 'agent',
        content: '您好，您可以在商品详情页面下滑，有尺码指南可以参考。或者我可以为您发送尺码对照表。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 118).toISOString(), // 118分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_003_3',
        sessionId: 'sess_003',
        senderType: 'agent',
        content: '这是我们的尺码对照表，请查收。',
        contentType: 'image',
        timestamp: new Date(Date.now() - 1000 * 60 * 115).toISOString(), // 115分钟前
        status: 'read' as MessageStatus,
        attachments: [
          {
            url: 'https://example.com/size-chart.jpg',
            type: 'image/jpeg',
            name: '尺码对照表.jpg',
            size: 245000,
          },
        ],
      },
      {
        id: 'msg_003_4',
        sessionId: 'sess_003',
        senderType: 'customer',
        content: '谢谢，我已经看到了。我身高165cm，体重50kg，应该买M码对吗？',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(), // 110分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_003_5',
        sessionId: 'sess_003',
        senderType: 'agent',
        content: '是的，根据您提供的身高体重，建议您选择M码。如果您喜欢宽松一点的版型，也可以考虑L码。',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 105).toISOString(), // 105分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_003_6',
        sessionId: 'sess_003',
        senderType: 'customer',
        content: '明白了，我会选择M码的。非常感谢您的帮助！',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 100).toISOString(), // 100分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_003_7',
        sessionId: 'sess_003',
        senderType: 'agent',
        content: '不客气，如果您有其他问题，随时可以联系我们。祝您购物愉快！',
        contentType: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(), // 95分钟前
        status: 'read' as MessageStatus,
      },
      {
        id: 'msg_003_8',
        sessionId: 'sess_003',
        senderType: 'system',
        content: '会话已结束',
        contentType: 'system',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30分钟前
        status: 'read' as MessageStatus,
      },
    ],
  };

  return { mockCustomers, mockSessions, mockMessages };
};

// 提供者组件
export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, agent } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // 加载初始数据
  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 实际应用中，这里应从API获取数据
        // 现在我们使用模拟数据
        const { mockCustomers, mockSessions, mockMessages } = generateMockData();

        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

        setCustomers(mockCustomers);
        setSessions(mockSessions);
        setMessages(mockMessages);
      } catch (error) {
        console.error('加载初始数据时出错:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [isAuthenticated]);

  // 创建会话
  const createSession = async (customerId: string, subject?: string): Promise<string> => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      throw new Error('客户不存在');
    }

    // 创建新会话
    const newSession: ChatSession = {
      id: generateId('SESSION'),
      customerId,
      status: ChatStatus.PENDING,
      startTime: new Date(),
      tags: [],
      priority: 'medium',
      unreadCount: 0,
      lastMessageTime: new Date(),
    };

    if (subject) {
      newSession.subject = subject;
    }

    // 创建系统消息
    const systemMessage: Message = {
      id: generateId('MESSAGE'),
      sessionId: newSession.id,
      senderType: 'system',
      content: '会话已创建',
      contentType: 'system',
      timestamp: new Date().toISOString(),
      status: 'delivered' as MessageStatus,
    };

    // 更新状态
    setSessions(prev => [newSession, ...prev]);
    setMessages(prev => ({
      ...prev,
      [newSession.id]: [systemMessage],
    }));

    return newSession.id;
  };

  // 关闭会话
  const closeSession = async (sessionId: string): Promise<boolean> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return false;
    }

    // 创建系统消息
    const systemMessage: Message = {
      id: generateId('MESSAGE'),
      sessionId,
      senderType: 'system',
      content: '会话已结束',
      contentType: 'system',
      timestamp: new Date().toISOString(),
      status: 'delivered' as MessageStatus,
    };

    // 更新会话状态
    const updatedSession: ChatSession = {
      ...session,
      status: ChatStatus.RESOLVED,
      endTime: new Date(),
      lastMessageTime: new Date(),
    };

    // 更新状态
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? updatedSession : s)
    );

    // 添加系统消息
    setMessages(prev => {
      const sessionMessages = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: [...sessionMessages, systemMessage],
      };
    });

    return true;
  };

  // 分配会话给客服
  const assignSession = async (sessionId: string, agentId: string): Promise<boolean> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return false;
    }

    // 更新会话
    const updatedSession: ChatSession = {
      ...session,
      agentId,
      status: ChatStatus.ACTIVE,
    };

    // 创建系统消息
    const systemMessage: Message = {
      id: generateId('MESSAGE'),
      sessionId,
      senderType: 'system',
      content: `会话已分配给客服`,
      contentType: 'system',
      timestamp: new Date().toISOString(),
      status: 'delivered' as MessageStatus,
    };

    // 更新状态
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? updatedSession : s)
    );

    // 添加系统消息
    setMessages(prev => {
      const sessionMessages = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: [...sessionMessages, systemMessage],
      };
    });

    return true;
  };

  // 发送消息
  const sendMessage = async (
    sessionId: string,
    content: string,
    type: MessageType = MessageType.TEXT
  ): Promise<Message | null> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return null;
    }

    // 将MessageType转换为contentType字符串
    let contentType = 'text';
    switch (type) {
      case MessageType.TEXT:
        contentType = 'text';
        break;
      case MessageType.IMAGE:
        contentType = 'image';
        break;
      case MessageType.FILE:
        contentType = 'file';
        break;
      case MessageType.VOICE:
        contentType = 'audio';
        break;
      case MessageType.VIDEO:
        contentType = 'video';
        break;
      case MessageType.SYSTEM:
        contentType = 'system';
        break;
    }

    // 创建新消息
    const newMessage: Message = {
      id: generateId('MESSAGE'),
      sessionId,
      senderType: 'agent',
      content,
      contentType: contentType as 'text' | 'image' | 'file' | 'audio' | 'video' | 'system',
      timestamp: new Date().toISOString(),
      status: 'sending' as MessageStatus,
    };

    // 更新消息列表
    setMessages(prev => {
      const sessionMessages = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: [...sessionMessages, newMessage],
      };
    });

    // 模拟消息发送延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 更新消息状态为已发送
    const sentMessage: Message = {
      ...newMessage,
      status: 'sent' as MessageStatus,
    };

    // 更新会话
    const updatedSession: ChatSession = {
      ...session,
      lastMessageTime: new Date(),
    };

    // 更新状态
    setMessages(prev => {
      const sessionMessages = prev[sessionId] || [];
      const updatedMessages = sessionMessages.map(msg =>
        msg.id === newMessage.id ? sentMessage : msg
      );
      return {
        ...prev,
        [sessionId]: updatedMessages,
      };
    });

    setSessions(prev =>
      prev.map(s => s.id === sessionId ? updatedSession : s)
    );

    return sentMessage;
  };

  // 标记会话为已读
  const markAsRead = async (sessionId: string): Promise<boolean> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return false;
    }

    // 更新会话
    const updatedSession: ChatSession = {
      ...session,
      unreadCount: 0,
    };

    // 更新消息状态 - 使用类型断言确保类型兼容
    const updatedMessages = (messages[sessionId] || []).map(msg => {
      if (msg.senderType === 'customer' && msg.status !== 'read' as MessageStatus) {
        return { ...msg, status: 'read' as MessageStatus };
      }
      return msg;
    });

    // 更新状态
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? updatedSession : s)
    );

    // 确保类型兼容性
    setMessages(prev => ({
      ...prev,
      [sessionId]: updatedMessages,
    }));

    return true;
  };

  // 加载更多消息
  const loadMoreMessages = async (sessionId: string): Promise<boolean> => {
    // 在实际应用中，这里应该从API加载更多历史消息
    // 现在我们只是模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 获取当前会话的消息数量
    const currentMessages = messages[sessionId] || [];

    // 如果消息数量已经很多，可以假设没有更多历史消息了
    // 这里设置一个阈值，例如超过50条消息就不再加载
    const messagesThreshold = 50;
    if (currentMessages.length >= messagesThreshold) {
      return false; // 返回false表示没有更多消息
    }

    // 如果模拟随机结果，有80%的概率还有更多消息
    // 在实际应用中，应该根据API的返回来确定是否有更多消息
    const randomHasMore = Math.random() < 0.8;

    return randomHasMore; // 返回是否有更多消息
  };

  // 刷新会话列表
  const refreshSessions = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // 在实际应用中，这里应该从API重新加载会话
      // 现在我们只是模拟延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('刷新会话列表时出错:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取客户信息
  const getCustomer = (customerId: string): Customer | undefined => {
    return customers.find(c => c.id === customerId);
  };

  // 添加客户备注
  const addCustomerNote = async (customerId: string, note: string): Promise<boolean> => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      return false;
    }

    // 更新客户信息
    const updatedCustomer: Customer = {
      ...customer,
      notes: customer.notes ? `${customer.notes}\n${note}` : note,
    };

    // 更新状态
    setCustomers(prev =>
      prev.map(c => c.id === customerId ? updatedCustomer : c)
    );

    return true;
  };

  // 添加会话解决方法
  const resolveSession = async (sessionId: string): Promise<boolean> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return false;
    }

    // 创建系统消息
    const systemMessage: Message = {
      id: generateId('MESSAGE'),
      sessionId,
      senderType: 'system',
      content: '会话已解决',
      contentType: 'system',
      timestamp: new Date().toISOString(),
      status: 'delivered' as MessageStatus,
    };

    // 更新会话状态
    const updatedSession: ChatSession = {
      ...session,
      status: ChatStatus.RESOLVED,
      endTime: new Date(),
      lastMessageTime: new Date(),
    };

    // 更新状态
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? updatedSession : s)
    );

    // 添加系统消息
    setMessages(prev => {
      const sessionMessages = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: [...sessionMessages, systemMessage],
      };
    });

    return true;
  };

  // 上下文值
  const contextValue: AppContextType = {
    sessions,
    customers,
    messages,
    isLoading,
    agent,
    error,
    createSession,
    closeSession,
    assignSession,
    sendMessage,
    markAsRead,
    loadMoreMessages,
    refreshSessions,
    getCustomer,
    addCustomerNote,
    resolveSession,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// 自定义钩子用于访问上下文
export function useApp() {
  const context = useContext(AppContext);

  if (context === undefined) {
    throw new Error('useApp 必须在 AppProvider 内部使用');
  }

  return context;
}