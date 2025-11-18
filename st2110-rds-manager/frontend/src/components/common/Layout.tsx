import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import StorageIcon from '@mui/icons-material/Storage'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ScheduleIcon from '@mui/icons-material/Schedule'
import HistoryIcon from '@mui/icons-material/History'
import BugReportIcon from '@mui/icons-material/BugReport'

const DRAWER_WIDTH = 240

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'RDS Management', icon: <StorageIcon />, path: '/rds' },
  { text: 'Node Operations', icon: <AccountTreeIcon />, path: '/nodes' },
  { text: 'Schedules', icon: <ScheduleIcon />, path: '/schedules' },
  { text: 'Logs', icon: <HistoryIcon />, path: '/logs' },
  { text: 'Test RDS', icon: <BugReportIcon />, path: '/test-rds' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            ST2110 RDS Manager
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </>
  )
}
