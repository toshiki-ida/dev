import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import Dashboard from './pages/Dashboard'
import RDSManagement from './pages/RDSManagement'
import NodeOperations from './pages/NodeOperations'
import ScheduleManagement from './pages/ScheduleManagement'
import Logs from './pages/Logs'
import TestRDS from './pages/TestRDS'
import Layout from './components/common/Layout'

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="rds" element={<RDSManagement />} />
          <Route path="nodes" element={<NodeOperations />} />
          <Route path="schedules" element={<ScheduleManagement />} />
          <Route path="logs" element={<Logs />} />
          <Route path="test-rds" element={<TestRDS />} />
        </Route>
      </Routes>
    </Box>
  )
}

export default App
