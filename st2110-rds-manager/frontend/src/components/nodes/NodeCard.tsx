import { Card, CardContent, Typography, Chip, IconButton, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { Node } from '../../types';

interface NodeCardProps {
  node: Node;
  rdsId: string;
  onDelete?: (rdsId: string, nodeId: string) => void;
  isDragging?: boolean;
}

export default function NodeCard({ node, rdsId, onDelete, isDragging }: NodeCardProps) {
  const getTypeColor = (type: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'> = {
      sender: 'primary',
      receiver: 'secondary',
      source: 'success',
      flow: 'warning',
      device: 'info',
      node: 'error',
    };
    return colors[type] || 'default';
  };

  return (
    <Card
      sx={{
        mb: 1,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DragIndicatorIcon sx={{ color: 'text.disabled', cursor: 'grab' }} />

          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" component="div">
                {node.label}
              </Typography>
              <Chip label={node.type} color={getTypeColor(node.type)} size="small" />
            </Box>

            {node.description && (
              <Typography variant="caption" color="text.secondary" display="block">
                {node.description}
              </Typography>
            )}

            {node.tags && Object.keys(node.tags).length > 0 && (
              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {Object.entries(node.tags).slice(0, 3).map(([key, value]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${value}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {onDelete && (
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(rdsId, node.id);
              }}
              title="Delete node"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
