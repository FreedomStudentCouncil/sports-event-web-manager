import React, { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';
import { Snackbar, Alert, Box, Typography, CircularProgress, Button } from '@mui/material';
import { Save as SaveIcon, Warning as WarningIcon, Sync as SyncIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeContext } from './ThemeContext';

interface SaveHandler {
  handler: () => Promise<boolean>;
  scope: string;
}

interface AdminLayoutContextType {
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning', options?: any) => void;
  setSavingStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  savingStatus: 'idle' | 'saving' | 'saved' | 'error';
  registerSaveHandler: (handler: () => Promise<boolean>, scope: string) => void;
  unregisterSaveHandler: (scope: string) => void;
  save: (scope?: string) => Promise<boolean>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

type SavingStatus = 'idle' | 'saving' | 'saved' | 'error';

const AdminLayoutContext = createContext<AdminLayoutContextType | null>(null);

export const AdminLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 状態管理
  const [savingStatus, setSavingStatus] = useState<SavingStatus>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { alpha } = useThemeContext();
  
  // 参照
  const savingStatusRef = useRef<SavingStatus>('idle');
  const hasUnsavedChangesRef = useRef(false);
  const saveHandlersRef = useRef<Map<string, SaveHandler>>(new Map());
  const lastSavedRef = useRef<Date | null>(null);
  
  // スナックバーの状態
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
    icon?: React.ReactNode;
    progress?: number;
    action?: React.ReactNode;
  }>({
    open: false,
    message: '',
    severity: 'info',
    progress: 0,
  });

  // スナックバーを閉じる
  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // スナックバーの表示関数を先に定義
  const showSnackbar = useCallback((
    message: string, 
    severity: 'success' | 'error' | 'info' | 'warning',
    options?: {
      icon?: React.ReactNode;
      autoHideDuration?: number;
      progress?: boolean;
      action?: React.ReactNode;
    }
  ) => {
    setSnackbar(prev => ({
      open: true,
      message,
      severity,
      icon: options?.icon,
      progress: options?.progress ? 0 : undefined,
      action: options?.action
    }));

    if (options?.progress) {
      const interval = setInterval(() => {
        setSnackbar(prev => ({
          ...prev,
          progress: prev.progress !== undefined ? Math.min(100, prev.progress + 2) : 0,
        }));
      }, 50);

      setTimeout(() => {
        clearInterval(interval);
        handleSnackbarClose();
      }, options.autoHideDuration || 3000);
    }
  }, []);

  // 循環参照を避けるため、saveの型だけ先に宣言
  const saveRef = useRef<(scope?: string) => Promise<boolean>>(async () => false);

  // 保存状態更新関数を修正
  const updateSavingStatus = useCallback((status: SavingStatus): void => {
    // オフライン時は保存を許可しない
    if (status === 'saving' && !isOnline) {
      showSnackbar('オフライン状態では保存できません', 'error', {
        icon: <WarningIcon />,
        autoHideDuration: 4000
      });
      setSavingStatus('error');
      savingStatusRef.current = 'error';
      return;
    }

    // 以前の状態を保存
    const prevStatus = savingStatusRef.current;
    
    // 新しい状態を設定
    savingStatusRef.current = status;
    setSavingStatus(status);

    // 状態が変わった場合のみ通知
    if (prevStatus !== status) {
      switch (status) {
        case 'saving':
          showSnackbar('保存中...', 'info', {
            icon: <CircularProgress size={20} />,
            progress: true,
            autoHideDuration: 3000
          });
          break;
        case 'saved':
          showSnackbar('変更が保存されました', 'success', {
            icon: <SaveIcon />,
            autoHideDuration: 2000
          });
          lastSavedRef.current = new Date();
          hasUnsavedChangesRef.current = false;
          setHasUnsavedChanges(false);
          break;
        case 'error':
          showSnackbar('保存に失敗しました', 'error', {
            icon: <WarningIcon />,
            autoHideDuration: 4000,
            action: (
              <Button 
                size="small" 
                color="inherit" 
                onClick={() => saveRef.current()}
                startIcon={<SyncIcon />}
              >
                再試行
              </Button>
            )
          });
          break;
      }
    }
  }, [isOnline, showSnackbar, setHasUnsavedChanges]);

  // save関数の実装
  const save = useCallback(async (scope?: string): Promise<boolean> => {
    // オフライン時は保存不可
    if (!isOnline) {
      showSnackbar('オフライン状態では保存できません', 'error', {
        icon: <WarningIcon />
      });
      return false;
    }

    updateSavingStatus('saving');
    
    try {
      let success = true;
      
      // 特定のスコープのみ保存する場合
      if (scope) {
        const handler = saveHandlersRef.current.get(scope);
        if (handler) {
          console.log(`Executing save handler for scope "${scope}"`);
          success = await handler.handler();
        } else {
          // スコープが見つからない場合は、すべてのハンドラを試す
          console.warn(`Save handler for scope "${scope}" not found, trying all handlers`);
          const handlers = Array.from(saveHandlersRef.current.values());
          if (handlers.length > 0) {
            const results = await Promise.all(
              handlers.map(async ({ handler }) => {
                try {
                  return await handler();
                } catch (error) {
                  console.error('Error in save handler:', error);
                  return false;
                }
              })
            );
            success = results.every(result => result);
          } else {
            console.warn('No save handlers registered');
            success = false;
          }
        }
      } 
      // すべてのスコープの保存
      else {
        const handlers = Array.from(saveHandlersRef.current.values());
        console.log(`Executing all save handlers (${handlers.length})`);
        
        if (handlers.length === 0) {
          console.warn('No save handlers registered');
          success = false;
        } else {
          const results = await Promise.all(
            handlers.map(async ({ handler, scope }) => {
              try {
                console.log(`Executing handler for scope "${scope}"`);
                return await handler();
              } catch (error) {
                console.error(`Error in save handler for scope "${scope}":`, error);
                return false;
              }
            })
          );
          
          success = results.every(result => result);
        }
      }
      
      // 保存結果に基づいてステータス更新
      if (success) {
        updateSavingStatus('saved');
        lastSavedRef.current = new Date();
        setHasUnsavedChanges(false);
        hasUnsavedChangesRef.current = false;
      } else {
        updateSavingStatus('error');
      }
      
      return success;
    } catch (error) {
      console.error('Save error:', error);
      updateSavingStatus('error');
      return false;
    }
  }, [isOnline, showSnackbar, updateSavingStatus, setHasUnsavedChanges]);

  // saveRefを実装で更新
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // オンライン状態の監視
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      updateSavingStatus('error');
      showSnackbar('オフライン状態です。インターネット接続を確認してください', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateSavingStatus, showSnackbar]);

  // 未保存変更の警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 保存ハンドラの登録
  const registerSaveHandler = useCallback((handler: () => Promise<boolean>, scope: string): void => {
    // 既存のハンドラを置き換える（同じスコープの場合）
    if (saveHandlersRef.current.has(scope)) {
      saveHandlersRef.current.delete(scope);
    }
    saveHandlersRef.current.set(scope, { handler, scope });
  }, []);

  // 保存ハンドラの登録解除
  const unregisterSaveHandler = useCallback((scope: string): void => {
    saveHandlersRef.current.delete(scope);
  }, []);
  
  // コンテキスト値
  const value: AdminLayoutContextType = {
    showSnackbar,
    setSavingStatus: updateSavingStatus,
    savingStatus: savingStatusRef.current,
    registerSaveHandler,
    unregisterSaveHandler,
    save,
    hasUnsavedChanges,
    setHasUnsavedChanges: (value: boolean) => {
      setHasUnsavedChanges(value);
      hasUnsavedChangesRef.current = value;
    }
  };

  return (
    <AdminLayoutContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {/* 未保存の変更がある場合の通知 */}
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            style={{
              position: 'fixed',
              left: 24,
              bottom: 24,
              zIndex: 2000
            }}
          >
            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: 4,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                border: '1px solid',
                borderColor: 'divider',
                backdropFilter: 'blur(8px)',
                '&:hover': {
                  boxShadow: 6,
                }
              }}
            >
              <CircularProgress size={16} color="warning" />
              <Typography variant="body2" color="text.secondary">
                未保存の変更があります
              </Typography>
              <Button
                size="small"
                startIcon={<SaveIcon />}
                onClick={() => save()}
                variant="outlined"
                color="primary"
                sx={{ ml: 1 }}
              >
                保存
              </Button>
            </Box>
          </motion.div>
        )}

        {/* メインのスナックバー */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ mb: hasUnsavedChanges ? 8 : 3, ml: 3 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
          >
            <Alert 
              onClose={handleSnackbarClose} 
              severity={snackbar.severity}
              elevation={6}
              variant="filled"
              icon={snackbar.icon}
              action={snackbar.action}
              sx={{
                minWidth: 300,
                boxShadow: theme => `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
                borderRadius: 2,
                '& .MuiAlert-message': {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {snackbar.message}
                {snackbar.progress !== undefined && (
                  <Box
                    sx={{
                      height: 1,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      borderRadius: 0.5,
                      overflow: 'hidden',
                      width: 50,
                      ml: 1
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${snackbar.progress}%`,
                        bgcolor: 'rgba(255,255,255,0.8)',
                        transition: 'width 0.1s linear'
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Alert>
          </motion.div>
        </Snackbar>
      </AnimatePresence>
    </AdminLayoutContext.Provider>
  );
};

export const useAdminLayout = () => {
  const context = useContext(AdminLayoutContext);
  if (!context) {
    throw new Error('useAdminLayout must be used within AdminLayoutProvider');
  }
  return context;
};
