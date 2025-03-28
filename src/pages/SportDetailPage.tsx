import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardActionArea, 
  CardContent, 
  CardMedia,
  Fab, 
  Box, 
  CircularProgress,
  Stack,
  Paper,
  Tab,
  Tabs,
  Divider,
  Button
} from '@mui/material';
import { 
  AdminPanelSettings as AdminIcon,
  Login as LoginIcon,
  Schedule as ScheduleIcon,
  GridView as GridViewIcon,
  ViewTimeline as TimelineIcon,
  Leaderboard as LeaderboardIcon,
  CalendarToday as CalendarIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../hooks/useDatabase';
import { Event, Sport } from '../types';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import EventTimelineOverview from '../components/sports/EventTimelineOverview';
import EventOverallTimeline from '../components/sports/EventOverallTimeline';
import OverallScoreCard from '../components/scoreboard/OverallScoreCard';

const MotionCard = motion(Card);
const MotionFab = motion(Fab);

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data: events, loading: eventsLoading } = useDatabase<Record<string, Event>>('/events');
  const { data: sports, loading: sportsLoading } = useDatabase<Record<string, Sport>>('/sports');
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [activeSports, setActiveSports] = useState<Sport[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'overall-timeline'>('grid');

  useEffect(() => {
    if (events && sports) {
      // アクティブなイベントを見つける
      const activeEventObj = Object.values(events).find(event => event.isActive);
      if (activeEventObj) {
        setActiveEvent(activeEventObj);
        
        // アクティブなイベントに関連する競技を設定
        const relatedSports = Object.values(sports).filter(
          sport => sport.eventId === activeEventObj.id
        );
        setActiveSports(relatedSports);
      }
    }
  }, [events, sports]);

  // 表示モードの切り替え
  const handleViewChange = (event: React.SyntheticEvent, newValue: 'grid' | 'timeline' | 'overall-timeline') => {
    setViewMode(newValue);
  };

  // ログインボタンを別コンポーネントとして切り出し
  const FloatingButtons = () => (
    <Stack
      direction="column"
      spacing={2}
      sx={{ position: 'fixed', bottom: 30, right: 30 }}
    >
      {currentUser ? (
        <MotionFab
          color="primary"
          aria-label="admin"
          onClick={() => navigate('/admin')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <AdminIcon />
        </MotionFab>
      ) : (
        <MotionFab
          color="secondary"
          aria-label="login"
          onClick={() => navigate('/login')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <LoginIcon />
        </MotionFab>
      )}
    </Stack>
  );

  if (eventsLoading || sportsLoading) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
        <FloatingButtons />
      </>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          {activeEvent ? activeEvent.name : t('home.title')}
        </Typography>
        {activeEvent && (
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {activeEvent.description}
          </Typography>
        )}
      </Box>

      {activeSports.length > 0 && (
        <Box sx={{ mb: 4 }}>
          {/* 総合成績カードを追加 - 最初に表示 */}
          {activeEvent && activeEvent.overallScoreboard?.enabled && 
           activeEvent.overallScoreboard.displayOnHome && (
            <Box sx={{ mb: 4 }}>
              <OverallScoreCard event={activeEvent} sports={activeSports} />
            </Box>
          )}

          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={viewMode}
              onChange={handleViewChange}
              variant="fullWidth"
              indicatorColor="primary"
              textColor="primary"
              aria-label="view mode tabs"
            >
              <Tab 
                icon={<GridViewIcon />} 
                label={t('home.gridView')} 
                value="grid"
                iconPosition="start"
              />
              <Tab 
                icon={<ScheduleIcon />} 
                label={t('home.scheduleView')} 
                value="timeline"
                iconPosition="start"
              />
              <Tab 
                icon={<TimelineIcon />} 
                label={t('home.overallTimelineView')} 
                value="overall-timeline"
                iconPosition="start"
              />
            </Tabs>
          </Paper>

          {viewMode === 'grid' ? (
            <Grid container spacing={3}>
              {activeSports.map((sport, index) => (
                <Grid item xs={12} sm={6} md={4} key={sport.id}>
                  <MotionCard 
                    whileHover={{ scale: 1.05 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <CardActionArea component={RouterLink} to={`/sport/${sport.id}`}>
                      <CardMedia
                        component="img"
                        height="140"
                        image={sport.coverImageUrl || `https://source.unsplash.com/random?${sport.type || 'sports'}`}
                        alt={sport.name}
                      />
                      <CardContent>
                        <Typography gutterBottom variant="h5" component="div">
                          {sport.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {sport.description || t(`sports.${sport.type}`)}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </MotionCard>
                </Grid>
              ))}
            </Grid>
          ) : viewMode === 'timeline' ? (
            <Box>
              <EventTimelineOverview sports={activeSports} activeEvent={activeEvent} />
            </Box>
          ) : (
            <Box>
              <EventOverallTimeline sports={activeSports} activeEvent={activeEvent} />
            </Box>
          )}
        </Box>
      )}

      {activeSports.length === 0 && (
        <Box sx={{ textAlign: 'center', my: 8 }}>
          <Typography variant="h5" color="text.secondary">
            {t('sports.noSports')}
          </Typography>
        </Box>
      )}

      <FloatingButtons />
    </Container>
  );
};

export default HomePage;