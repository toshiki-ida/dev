import { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
  Box,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { RDSConnection } from '../../types';

interface RDSCardProps {
  connection: RDSConnection;
  onEdit: (connection: RDSConnection) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => Promise<void>;
}

export default function RDSCard({ connection, onEdit, onDelete, onTest }: RDSCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await onTest(connection.id);
      setTestResult({ success: true, message: 'Connection successful' });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const formatLastConnected = (date?: string) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Typography variant="h6" component="div">
            {connection.name}
          </Typography>
          <Chip
            label={connection.enabled ? 'Enabled' : 'Disabled'}
            color={connection.enabled ? 'success' : 'default'}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {connection.ipAddress}:{connection.port}
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Timeout: {connection.timeout}s
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Last Connected: {formatLastConnected(connection.lastConnected)}
        </Typography>

        {testResult && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            {testResult.success ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <ErrorIcon color="error" fontSize="small" />
            )}
            <Typography variant="caption" color={testResult.success ? 'success.main' : 'error.main'}>
              {testResult.message}
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Box>
          <IconButton
            size="small"
            color="primary"
            onClick={() => onEdit(connection)}
            title="Edit"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(connection.id)}
            title="Delete"
          >
            <DeleteIcon />
          </IconButton>
        </Box>

        <Button
          size="small"
          startIcon={testing ? <CircularProgress size={16} /> : <PlayArrowIcon />}
          onClick={handleTest}
          disabled={testing || !connection.enabled}
        >
          Test
        </Button>
      </CardActions>
    </Card>
  );
}
