import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button, 
  CircularProgress, 
  IconButton,
  Snackbar,
  Alert,
  Divider
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../hooks/useDatabase';
import { Sport } from '../../types';
import TournamentScoring from '../../components/admin/scoring/TournamentScoring';
import RoundRobinScoring from '../../components/admin/scoring/RoundRobinScoring';
import CustomScoring from '../../components/admin/scoring/CustomScoring';
import { useAdminLayout } from '../../contexts/AdminLayoutContext';


const ScoringPage: React.FC = () => {
  const { sportId } = useParams<{ sportId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sport, loading, updateData } = useDatabase<Sport>(`/sports/${sportId}`);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // 変更を自動保存するためのタイマーID
  const [autoSaveTimerId, setAutoSaveTimerId] = useState<NodeJS.Timeout | null>(null);
  
  // スポーツデータのローカルコピー
  const [localSport, setLocalSport] = useState<Sport | null>(null);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<Sport | null>(null);
  const isProcessingRef = useRef(false);

  const { registerSaveHandler, unregisterSaveHandler, save, setHasUnsavedChanges } = useAdminLayout();

  // リアルタイム更新用のフラグ
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const updateQueueRef = useRef<Sport[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false); // ダイアログの状態を追加

  // クラウドデータとローカルデータの同期を制御するuseEffect
  useEffect(() => {
    if (sport && (!localSport || JSON.stringify(sport) !== JSON.stringify(localSport))) {
      // クラウドからの新しいデータがある場合のみ更新
      const hasLocalChanges = isProcessingRef.current || pendingUpdateRef.current;
      if (!hasLocalChanges) {
        setLocalSport(JSON.parse(JSON.stringify(sport)));
      }
    }
  }, [sport, localSport]);

  // ローカルデータの状態管理を改善
  const [isLocalChange, setIsLocalChange] = useState(false);
  const [lastCloudUpdate, setLastCloudUpdate] = useState<number>(Date.now());
  const ignoreNextUpdateRef = useRef(false);

  // useEffectでsportの変更を監視
  useEffect(() => {
    if (!sport || ignoreNextUpdateRef.current) {
      ignoreNextUpdateRef.current = false;
      return;
    }

    // ダイアログが開いている場合は更新を延期
    if (isDialogOpen) {
      return;
    }

    // ローカルの変更中は更新をスキップ
    if (isLocalChange) {
      return;
    }

    const currentTime = Date.now();
    // 最後のクラウド更新から100ms以上経過している場合のみ更新
    if (currentTime - lastCloudUpdate > 100) {
      setLocalSport(JSON.parse(JSON.stringify(sport)));
      setLastCloudUpdate(currentTime);
    }
  }, [sport, isDialogOpen, isLocalChange]);

  // handleSportUpdateを改善
  const handleSportUpdate = useCallback(async (updatedSport: Sport) => {
    if (isProcessingRef.current) return false;
    
    try {
      isProcessingRef.current = true;
      setLocalSport(updatedSport);
      
      const success = await updateData(updatedSport);
      if (success) {
        setHasUnsavedChanges(false);
        return true;
      }
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [updateData, setHasUnsavedChanges]);

  useEffect(() => {
    if (sport && !localSport) {
      setLocalSport(JSON.parse(JSON.stringify(sport)));
    }
  }, [sport, localSport]);

  // スポーツデータが変更されたときの自動保存制御を改善
  useEffect(() => {
    if (!localSport || !sport || isProcessing) return;

    if (JSON.stringify(localSport) !== JSON.stringify(sport)) {
      if (autoSaveTimerId) {
        clearTimeout(autoSaveTimerId);
      }
      
      const timerId = setTimeout(() => {
        // ダイアログが開いていないことを確認してから自動保存
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs.length === 0) {
          handleSave();
        }
      }, 500);
      setAutoSaveTimerId(timerId);
    }

    return () => {
      if (autoSaveTimerId) {
        clearTimeout(autoSaveTimerId);
      }
    };
  }, [localSport, isProcessing]);

  const handleSave = async () => {
    if (!localSport || isProcessingRef.current) return false;

    try {
      isProcessingRef.current = true;
      setSaveStatus('saving');
      
      // ローカルの変更を保存
      const result = await updateData(localSport);
      
      if (result) {
        setSaveStatus('saved');
        setShowSnackbar(true);
        return true;
      } else {
        setSaveStatus('error');
        setShowSnackbar(true);
        return false;
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setShowSnackbar(true);
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleSnackbarClose = () => {
    setShowSnackbar(false);
  };

  

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      isProcessingRef.current = false;
      pendingUpdateRef.current = null;
    };
  }, [saveTimeout]);

  // 保存ハンドラーの登録を改善
  useEffect(() => {
    const saveHandler = async () => {
      if (!localSport || isProcessingRef.current) return false;
      
      try {
        const result = await handleSportUpdate(localSport);
        return !!result;
      } catch (error) {
        console.error('Save error:', error);
        return false;
      }
    };
    
    registerSaveHandler(saveHandler, `scoring_${sportId}`);
    
    return () => {
      unregisterSaveHandler(`scoring_${sportId}`);
    };
  }, [registerSaveHandler, unregisterSaveHandler, localSport, sportId, handleSportUpdate]);

  // クラウドデータとの同期を強化（改善版）
  useEffect(() => {
    if (!sport) return;

    // ダイアログが開いている場合は同期を延期
    if (isDialogOpen) {
      return;
    }

    // ローカルの変更中は更新をスキップ
    if (isProcessingRef.current) {
      return;
    }

    // スポーツデータの同期
    const currentSportStr = JSON.stringify(localSport);
    const newSportStr = JSON.stringify(sport);
    
    if (currentSportStr !== newSportStr) {
      setLocalSport(JSON.parse(newSportStr));
      setHasUnsavedChanges(false);
    }
  }, [sport, isDialogOpen, localSport, setHasUnsavedChanges]);

  // 更新キューのクリーンアップ
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateQueueRef.current = [];
      isProcessingRef.current = false;
    };
  }, []);

  // スコアリングコンポーネントのレンダリングを最適化
  const renderScoringComponent = useCallback(() => {
    if (!localSport) return null;

    const props = {
      sport: localSport,
      onUpdate: handleSportUpdate,
      key: `${localSport.id}-${Date.now()}`,
      onDialogOpen: () => setIsDialogOpen(true),
      onDialogClose: () => {
        setIsDialogOpen(false);
        // ダイアログが閉じられた後に最新データを同期
        if (sport) {
          setLocalSport(JSON.parse(JSON.stringify(sport)));
        }
      }
    };

    switch (localSport.type) {
      case 'tournament':
        return <TournamentScoring {...props} />;
      case 'roundRobin':
        return <RoundRobinScoring {...props} />;
      case 'custom':
        return <CustomScoring {...props} />;
      default:
        return null;
    }
  }, [localSport, handleSportUpdate, sport]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!sport || !localSport) {
    return (
      <Box sx={{ textAlign: 'center', my: 8 }}>
        <Typography variant="h5">
          {t('sports.notFound')}
        </Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/admin')}>
          {t('common.backToAdmin')}
        </Button>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/admin')} aria-label="back" sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {t('scoring.title', { name: localSport.name })}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? t('common.saving') : t('common.save')}
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t(`sports.${localSport.type}`)} - {t('scoring.updateScores')}
        </Typography>
        <Divider sx={{ my: 2 }} />

        {/* スポーツタイプに合わせたスコアリングコンポーネント */}
        {renderScoringComponent()}
      </Paper>

      {/* 保存状態通知 */}
      <Snackbar open={showSnackbar} autoHideDuration={4000} onClose={handleSnackbarClose}>
        <Alert 
          onClose={handleSnackbarClose} 
          severity={saveStatus === 'saved' ? 'success' : 'error'} 
          sx={{ width: '100%' }}
        >
          {saveStatus === 'saved' ? t('common.savedSuccess') : t('common.savedError')}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ScoringPage;
