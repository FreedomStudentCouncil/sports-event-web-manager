import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  IconButton,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Event as EventIcon,
  SportsSoccer as SportIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  Add as AddIcon,
  Save as SaveIcon,
  Help as HelpIcon,
  Home as HomeIcon,
  AccountCircle
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useDatabase } from '../../hooks/useDatabase';
import { Event, Sport } from '../../types';
import { useAdminLayout } from '../../contexts/AdminLayoutContext';
import CreateEventDialog from '../admin/dialogs/CreateEventDialog';
import CreateSportDialog from '../admin/dialogs/CreateSportDialog';

// AdminLayout の props 型定義を明示的に追加
interface AdminLayoutProps {
  children: React.ReactNode;
}

// drawerWidthを小さく
const drawerWidth = 240;

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { mode, toggleColorMode, alpha } = useThemeContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { showSnackbar, savingStatus, setSavingStatus, save, hasUnsavedChanges, registerSaveHandler } = useAdminLayout(); // コンテキストから機能を取得
  
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // ユーザーメニュー
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // イベント展開状態
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  
  // データ取得
  const { data: events, loading: eventsLoading } = useDatabase<Record<string, Event>>('/events');
  const { data: sports, loading: sportsLoading } = useDatabase<Record<string, Sport>>('/sports');

  // 現在のパスに基づいて適切なイベントを展開
  useEffect(() => {
    if (events && sports) {
      if (location.pathname.includes('/admin/events/')) {
        const eventId = location.pathname.split('/').pop();
        if (eventId && events[eventId]) {
          setExpandedEventIds(prev => prev.includes(eventId) ? prev : [...prev, eventId]);
        }
      }
      
      if (location.pathname.includes('/admin/sports/')) {
        const sportId = location.pathname.split('/').pop();
        if (sportId && sports[sportId]) {
          const sport = sports[sportId];
          const eventId = sport.eventId;
          if (eventId && events[eventId]) {
            setExpandedEventIds(prev => prev.includes(eventId) ? prev : [...prev, eventId]);
          }
        }
      }
    }
  }, [location.pathname, events, sports]);
  
  // レイアウト全体の保存ハンドラを登録
  useEffect(() => {
    // このコンポーネント固有の保存処理（必要に応じて実装）
    const handleLayoutSave = async () => {
      console.log('レイアウト設定の保存');
      // 実際には何も保存しない
      return true;
    };
    
    registerSaveHandler(handleLayoutSave, 'layout');
    
    // クリーンアップ関数は不要（コンポーネントがアンマウントされないため）
  }, [registerSaveHandler]);
  
  // 手動保存
  const handleManualSave = async () => {
    // 新しい保存メカニズムを使用
    try {
      await save();
      setLastSaved(new Date());
    } catch (error) {
      console.error('Manual save error:', error);
    }
  };
  
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const handleEventClick = (eventId: string) => {
    // 現在のパスがイベント編集ページで、かつ別のイベントを選択した場合
    if (location.pathname.includes('/admin/events/') && !location.pathname.includes(eventId)) {
      // 未保存の変更がある場合は確認
      if (hasUnsavedChanges) {
        const confirmNavigation = window.confirm(t('admin.unsavedChangesWarning'));
        if (!confirmNavigation) {
          return; // ナビゲーションをキャンセル
        }
        
        // 保存状態をリセット（これにより前のページのデータがコピーされるのを防ぐ）
        setSavingStatus('idle');
      }
    }
    
    // URLを変更するが、同じページでのデータ更新を避けるためreplace: trueを使用
    navigate(`/admin/events/${eventId}`, { replace: true });
    
    // ブラウザの履歴をクリアせずに新しいリクエストとしてページをリロード
    // これにより、前のページの状態が新しいページに引き継がれるのを防ぐ
    setTimeout(() => {
      window.location.href = `/admin/events/${eventId}`;
    }, 100);
  };
  
  const handleEventToggle = (eventId: string, e: React.MouseEvent) => {
    // クリックイベントが親要素に伝播しないようにする
    e.stopPropagation();
    
    // イベントID展開のトグル処理のみ行う
    setExpandedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId) 
        : [...prev, eventId]
    );
  };
  
  const handleSportClick = (sportId: string) => {
    // 現在のパスと異なる場合のみナビゲーション
    if (location.pathname !== `/admin/sports/${sportId}`) {
      // 未保存の変更がある場合は確認
      if (hasUnsavedChanges) {
        const confirmNavigation = window.confirm(t('admin.unsavedChangesWarning'));
        if (!confirmNavigation) {
          return; // ナビゲーションをキャンセル
        }
        
        // 保存状態をリセット
        setSavingStatus('idle');
      }
      
      // まずURLを変更
      navigate(`/admin/sports/${sportId}`, { replace: true });
      
      // ブラウザの履歴をクリアせずに新しいリクエストとしてページをリロード
      // これにより、前のページの状態が新しいページに引き継がれるのを防ぐ
      setTimeout(() => {
        window.location.href = `/admin/sports/${sportId}`;
      }, 100);
    }
  };

  const handleCreateEvent = () => {
    setEventDialogOpen(true);
  };
  
  const handleCreateSport = (eventId: string) => {
    setSelectedEventId(eventId);
    setSportDialogOpen(true);
  };

  // ユーザーメニュー
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  // イベントごとの競技リストを取得
  const getSportsByEventId = (eventId: string) => {
    if (!sports) return [];
    return Object.values(sports).filter(sport => sport.eventId === eventId);
  };

  // ダイアログの状態
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [sportDialogOpen, setSportDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // 成功時のハンドラー
  const handleEventSuccess = () => {
    setEventDialogOpen(false);
    showSnackbar(t('admin.eventCreated'), 'success');
  };

  const handleSportSuccess = (sportId: string) => {
    setSportDialogOpen(false);
    showSnackbar(t('admin.sportCreated'), 'success');
    navigate(`/admin/sports/${sportId}`);
  };

  

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* トップツールバー（常時表示） */}
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{
          zIndex: theme.zIndex.drawer + 2,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(8px)',
          '& .MuiToolbar-root': {
            minHeight: 48, // ツールバーの高さを小さく
          }
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48 }}>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t('admin.title')}
          </Typography>
          
          {/* 保存状態表示 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            {hasUnsavedChanges && (
              <Chip 
                label={t('admin.unsavedChanges')} 
                color="warning" 
                size="small" 
                sx={{ mr: 1 }}
              />
            )}
            {savingStatus === 'saving' ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                <Typography variant="body2">{t('admin.saving')}</Typography>
              </Box>
            ) : savingStatus === 'saved' ? (
              <Typography variant="body2" color="text.secondary">
                {lastSaved && t('admin.lastSaved', { time: lastSaved.toLocaleTimeString() })}
              </Typography>
            ) : savingStatus === 'error' ? (
              <Typography variant="body2" color="error">
                {t('admin.saveError')}
              </Typography>
            ) : null}
          </Box>
          
          {/* アクションボタン群 */}
          <Tooltip title={t('admin.home')}>
            <IconButton color="inherit" onClick={() => navigate('/')}>
              <HomeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.settings')}>
            <IconButton color="inherit" onClick={() => navigate('/admin/settings')}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.help')}>
            <IconButton color="inherit" onClick={() => navigate('/admin/help')}>
              <HelpIcon />
            </IconButton>
          </Tooltip>
          {/* ユーザーメニュー */}
          <IconButton
            size="large"
            edge="end"
            onClick={handleUserMenuOpen}
            color="inherit"
          >
            <Avatar 
              sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
              alt={currentUser?.email || 'User'}
            >
              {currentUser?.email?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleUserMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {currentUser?.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              {t('auth.logout')}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* サイドバー（折りたたみ可能） */}
      <Drawer
        variant="permanent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? drawerWidth : theme.spacing(7),
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
          '& .MuiDrawer-paper': {
            position: 'relative', // 追加：absoluteからrelativeに変更
            width: drawerOpen ? drawerWidth : theme.spacing(7),
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
            borderRight: `1px solid ${theme.palette.divider}`,
            height: '100%',
          },
          '& .MuiListItemText-root': {
            opacity: drawerOpen ? 1 : 0,
            transition: theme.transitions.create('opacity', {
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
          '& .MuiListItemIcon-root': {
            minWidth: theme.spacing(5),
            justifyContent: drawerOpen ? 'initial' : 'center',
          },
          '& .MuiListItemButton-root': {
            py: 0.5, // リストアイテムの高さを小さく
            minHeight: 40,
            borderRadius: 1,
            mx: 1,
            my: 0.5,
          },
          '& .MuiListItemButton-root.Mui-selected': {
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.2),
            }
          }
        }}
      >
        <Toolbar variant="dense" /> {/* トップバーのスペース確保 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: drawerOpen ? 'space-between' : 'center',
          padding: theme.spacing(0, 1),
          minHeight: 48,
        }}>
          {drawerOpen && (
            <Typography variant="h6" sx={{ ml: 2 }}>
              {t('app.name')}
            </Typography>
          )}
          <IconButton onClick={handleDrawerToggle}>
            {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
        </Box>
        <Divider />
        
        {/* ダッシュボードリンク */}
        <List>
          <ListItem disablePadding>
            <ListItemButton 
              selected={location.pathname === '/admin'}
              onClick={() => navigate('/admin')}
            >
              <ListItemIcon>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary={t('admin.dashboard')} />
            </ListItemButton>
          </ListItem>
        </List>
        
        <Divider />
        
        {/* イベントリスト */}
        <List
          subheader={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
              <Typography variant="subtitle2">
                {t('admin.events')}
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreateEvent}
              >
                {t('admin.create')}
              </Button>
            </Box>
          }
        >
          {eventsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : events && Object.values(events).length > 0 ? (
            Object.values(events).map((event) => (
              <React.Fragment key={event.id}>
                <ListItem disablePadding>
                  <ListItemButton 
                    onClick={() => handleEventClick(event.id)}
                    selected={location.pathname === `/admin/events/${event.id}`}
                  >
                    <ListItemIcon>
                      <EventIcon color={event.isActive ? "primary" : "inherit"} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={event.name} 
                      secondary={new Date(event.date).toLocaleDateString()}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => handleEventToggle(event.id, e)}
                      sx={{ ml: 'auto' }}
                    >
                      {expandedEventIds.includes(event.id) ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </ListItemButton>
                </ListItem>
                
                {/* 競技リスト（展開されている場合のみ表示） */}
                <Collapse in={expandedEventIds.includes(event.id)} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {/* 競技作成ボタン */}
                    <ListItem disablePadding>
                      <ListItemButton sx={{ pl: 4 }} onClick={() => handleCreateSport(event.id)}>
                        <ListItemIcon>
                          <AddIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={t('admin.createSport')}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItemButton>
                    </ListItem>
                    
                    {/* 競技一覧 */}
                    {getSportsByEventId(event.id).map((sport) => (
                      <ListItem disablePadding key={sport.id}>
                        <ListItemButton 
                          sx={{ pl: 4 }}
                          selected={location.pathname === `/admin/sports/${sport.id}`}
                          onClick={() => handleSportClick(sport.id)}
                          disabled={location.pathname === `/admin/sports/${sport.id}`}
                        >
                          <ListItemIcon>
                            <SportIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={sport.name}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                    
                    {getSportsByEventId(event.id).length === 0 && (
                      <ListItem sx={{ pl: 4 }}>
                        <ListItemText 
                          secondary={t('admin.noSportsInEvent')}
                          secondaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </React.Fragment>
            ))
          ) : (
            <ListItem sx={{ pl: 2 }}>
              <ListItemText secondary={t('admin.noEvents')} />
            </ListItem>
          )}
        </List>
      </Drawer>
      
      {/* メインコンテンツ */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2, // パディングを小さく
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          height: '100%',
          overflow: 'auto',
          pt: { xs: 6, sm: 6 }, // 上部余白を小さく
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>

      {/* ダイアログの追加 */}
      <CreateEventDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        onSuccess={handleEventSuccess}
      />

      <CreateSportDialog
        open={sportDialogOpen}
        onClose={() => setSportDialogOpen(false)}
        onSuccess={handleSportSuccess}
        eventId={selectedEventId}
      />
    </Box>
  );
};

export default AdminLayout;
