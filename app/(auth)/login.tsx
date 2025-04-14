import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
// @ts-ignore
import { useRouter } from 'expo-router';
import { Lock, UserCheck, Key } from 'lucide-react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { Permission } from '@/types/auth';

interface LoginErrors {
  agentId: string;
  agentName: string;
  apiKey: string;
  general?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, agent } = useAuth();

  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({
    agentId: '',
    agentName: '',
    apiKey: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 使用useMemo缓存表单是否有效的状态，避免重复计算
  const isFormValid = useMemo(() => {
    return !!agentId.trim() && !!agentName.trim() && apiKey.trim().length >= 10;
  }, [agentId, agentName, apiKey]);

  // 使用useCallback优化表单验证函数
  const validate = useCallback(() => {
    let isValid = true;
    const newErrors: LoginErrors = {
      agentId: '',
      agentName: '',
      apiKey: ''
    };

    if (!agentId.trim()) {
      newErrors.agentId = '请输入客服ID';
      isValid = false;
    }

    if (!agentName.trim()) {
      newErrors.agentName = '请输入您的姓名';
      isValid = false;
    }

    if (!apiKey.trim()) {
      newErrors.apiKey = '请输入有效的API密钥';
      isValid = false;
    } else if (apiKey.length < 10) {
      newErrors.apiKey = 'API密钥长度不足';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [agentId, agentName, apiKey]);

  const handleLogin = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const success = await login(agentId, agentName, apiKey);

      if (success) {
        // 使用try-catch包装路由导航，防止路由错误
        try {
          // 根据权限自动跳转
          if (agent?.permissions?.includes(Permission.MANAGE_AGENTS) || agent?.permissions?.includes(Permission.MANAGE_SYSTEM)) {
            router.replace('/admin');
          } else {
            router.replace('/(drawer)');
          }
        } catch (navError) {
          console.error('导航到主屏幕时出错:', navError);
          // 如果导航失败，尝试其他备选路由
          try {
            router.replace('/');
          } catch (fallbackError) {
            console.error('备选导航也失败:', fallbackError);
            Alert.alert('导航错误', '无法导航到主界面，请重启应用');
          }
        }
      } else {
        setErrors(prev => ({
          ...prev,
          general: '登录失败，请检查您的凭据是否正确'
        }));
        Alert.alert('登录失败', '无效的凭据，请检查您的客服ID和API密钥');
      }
    } catch (error) {
      console.error('登录错误:', error);

      // 根据错误类型提供更具体的错误消息
      let errorMessage = '登录过程中发生错误，请稍后重试';

      if (error instanceof Error) {
        if (error.message.includes('network')) {
          errorMessage = '网络连接错误，请检查您的网络连接';
        } else if (error.message.includes('timeout')) {
          errorMessage = '服务器响应超时，请稍后再试';
        }
      }

      setErrors(prev => ({
        ...prev,
        general: errorMessage
      }));

      Alert.alert('登录错误', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 使用isLoading和isSubmitting确定加载状态
  const isButtonDisabled = isLoading || isSubmitting || !isFormValid;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>客服登录</Text>
          <Text style={styles.headerSubtitle}>请使用您的客服ID和API密钥登录</Text>
        </View>

        {errors.general ? (
          <View style={styles.generalErrorContainer}>
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <UserCheck size={20} color="#007AFF" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="客服ID"
            value={agentId}
            onChangeText={setAgentId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />
        </View>
        {errors.agentId ? <Text style={styles.errorText}>{errors.agentId}</Text> : null}

        <View style={styles.inputContainer}>
          <UserCheck size={20} color="#007AFF" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="您的姓名"
            value={agentName}
            onChangeText={setAgentName}
            autoCorrect={false}
            editable={!isSubmitting}
          />
        </View>
        {errors.agentName ? <Text style={styles.errorText}>{errors.agentName}</Text> : null}

        <View style={styles.inputContainer}>
          <Key size={20} color="#007AFF" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="API密钥"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />
        </View>
        {errors.apiKey ? <Text style={styles.errorText}>{errors.apiKey}</Text> : null}

        <TouchableOpacity
          style={[styles.loginButton, isButtonDisabled && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isButtonDisabled}
        >
          {isLoading || isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>登录</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Lock size={16} color="#8E8E93" />
          <Text style={styles.infoText}>
            API密钥由系统管理员分配，请妥善保管
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
    color: '#000000',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#8E8E93',
    textAlign: 'center',
  },
  generalErrorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  generalErrorText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#FF3B30',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#000000',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 16,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  loginButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#8E8E93',
    marginLeft: 8,
    textAlign: 'center',
  },
});