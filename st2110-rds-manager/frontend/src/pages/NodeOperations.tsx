import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { rdsService } from '../services/rdsService';
import { nodesService } from '../services/nodesService';
import type { RDSConnection, Node } from '../types';
import NodeCard from '../components/nodes/NodeCard';

const ITEM_TYPE = 'NODE';

interface DraggableNodeProps {
  node: Node;
  rdsId: string;
  onDelete: (rdsId: string, nodeId: string) => void;
}

function DraggableNode({ node, rdsId, onDelete }: DraggableNodeProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { node, sourceRdsId: rdsId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div ref={drag}>
      <NodeCard node={node} rdsId={rdsId} onDelete={onDelete} isDragging={isDragging} />
    </div>
  );
}

interface DroppableRDSPanelProps {
  rds: RDSConnection;
  nodes: Node[];
  onDrop: (nodeItem: { node: Node; sourceRdsId: string }, targetRdsId: string) => void;
  onDelete: (rdsId: string, nodeId: string) => void;
}

function DroppableRDSPanel({ rds, nodes, onDrop, onDelete }: DroppableRDSPanelProps) {
  const [{ isOver }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item: { node: Node; sourceRdsId: string }) => onDrop(item, rds.id),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <Paper
      ref={drop}
      sx={{
        p: 2,
        height: '100%',
        bgcolor: isOver ? 'action.hover' : 'background.paper',
        border: isOver ? 2 : 1,
        borderColor: isOver ? 'primary.main' : 'divider',
        transition: 'all 0.2s',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{rds.name}</Typography>
        <Chip label={`${nodes.length} nodes`} color="primary" size="small" />
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        {rds.ipAddress}:{rds.port}
      </Typography>

      {isOver && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Drop here to copy node
        </Alert>
      )}

      <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
        {nodes.length === 0 ? (
          <Alert severity="info">No nodes found in this RDS</Alert>
        ) : (
          nodes.map((node) => (
            <DraggableNode key={node.id} node={node} rdsId={rds.id} onDelete={onDelete} />
          ))
        )}
      </Box>
    </Paper>
  );
}

export default function NodeOperations() {
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; rdsId: string; nodeId: string } | null>(null);

  const { data: rdsConnections, isLoading: rdsLoading } = useQuery<RDSConnection[]>({
    queryKey: ['rds-connections'],
    queryFn: rdsService.getAll,
  });

  const { data: allNodesData, isLoading: nodesLoading } = useQuery({
    queryKey: ['all-nodes'],
    queryFn: nodesService.getAllNodes,
    refetchInterval: 5000,
  });

  const copyMutation = useMutation({
    mutationFn: ({ sourceRdsId, targetRdsId, nodeId }: { sourceRdsId: string; targetRdsId: string; nodeId: string }) =>
      nodesService.copyNode(sourceRdsId, targetRdsId, nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-nodes'] });
      toast.success('Node copied successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to copy node: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ rdsId, nodeId }: { rdsId: string; nodeId: string }) =>
      nodesService.deleteNode(rdsId, nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-nodes'] });
      toast.success('Node deleted successfully');
      setDeleteDialog(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete node: ${error.message}`);
    },
  });

  const handleDrop = (item: { node: Node; sourceRdsId: string }, targetRdsId: string) => {
    if (item.sourceRdsId === targetRdsId) {
      toast.info('Source and target RDS are the same');
      return;
    }

    copyMutation.mutate({
      sourceRdsId: item.sourceRdsId,
      targetRdsId,
      nodeId: item.node.id,
    });
  };

  const handleDelete = (rdsId: string, nodeId: string) => {
    setDeleteDialog({ open: true, rdsId, nodeId });
  };

  const confirmDelete = () => {
    if (deleteDialog) {
      deleteMutation.mutate({ rdsId: deleteDialog.rdsId, nodeId: deleteDialog.nodeId });
    }
  };

  const enabledRDS = rdsConnections?.filter((rds) => rds.enabled) || [];

  if (rdsLoading || nodesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (enabledRDS.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Node Operations
        </Typography>
        <Alert severity="warning">
          No enabled RDS connections found. Please add and enable RDS connections in the RDS Management page.
        </Alert>
      </Box>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Node Operations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Drag and drop nodes between RDS to copy them. Click the delete icon to remove a node.
        </Typography>

        <Grid container spacing={3}>
          {allNodesData?.map((rdsData) => {
            const rds = enabledRDS.find((r) => r.id === rdsData.rdsId);
            if (!rds) return null;

            return (
              <Grid item xs={12} md={6} lg={4} key={rdsData.rdsId}>
                <DroppableRDSPanel
                  rds={rds}
                  nodes={rdsData.nodes}
                  onDrop={handleDrop}
                  onDelete={handleDelete}
                />
              </Grid>
            );
          })}
        </Grid>

        <Dialog open={deleteDialog?.open || false} onClose={() => setDeleteDialog(null)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this node? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button onClick={confirmDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DndProvider>
  );
}
