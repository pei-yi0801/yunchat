/**
 * 业务相关类型定义
 */

import { AgentStatus, MessageType } from './index';

/**
 * 客户信息接口
 */
export interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    lastContactAt?: string;
}

/**
 * 聊天会话接口
 */
export interface ChatSession {
    id: string;
    customerId: string;
    agentId?: string;
    status: 'active' | 'pending' | 'resolved';
    startedAt: string;
    endedAt?: string;
    metadata?: Record<string, any>;
}

/**
 * 消息接口
 */
export interface Message {
    id: string;
    sessionId: string;
    senderId: string;
    senderType: 'agent' | 'customer' | 'system';
    type: MessageType;
    content: string;
    timestamp: string;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    metadata?: Record<string, any>;
}

/**
 * 团队信息接口
 */
export interface Team {
    id: string;
    name: string;
    description?: string;
    members: string[];
    createdAt: string;
    updatedAt: string;
}

/**
 * 快捷回复类别
 */
export interface QuickReplyCategory {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * 快捷回复
 */
export interface QuickReply {
    id: string;
    categoryId: string;
    title: string;
    content: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

/**
 * 客服性能统计
 */
export interface AgentPerformance {
    agentId: string;
    period: 'daily' | 'weekly' | 'monthly';
    date: string;
    chatsHandled: number;
    avgResponseTime: number; // 毫秒
    avgResolutionTime: number; // 毫秒
    customerSatisfaction: number; // 1-5
    onlineTime: number; // 分钟
}

/**
 * 系统通知
 */
export interface SystemNotification {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'error' | 'success';
    targetUsers?: string[];
    isRead: boolean;
    createdAt: string;
    expiresAt?: string;
}

/**
 * 工作班次
 */
export interface Shift {
    id: string;
    agentId: string;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    notes?: string;
}

/**
 * 客户反馈
 */
export interface CustomerFeedback {
    id: string;
    sessionId: string;
    customerId: string;
    rating: number; // 1-5
    comment?: string;
    createdAt: string;
}