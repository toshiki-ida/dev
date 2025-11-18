import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { rdsService } from '../services/rdsService';
import type { RDSConnection } from '../types';
import RDSCard from '../components/rds/RDSCard';
import RDSFormDialog from '../components/rds/RDSFormDialog';

export default function RDSManagement() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<RDSConnection | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: connections, isLoading, error } = useQuery({
    queryKey: ['rds-connections'],
    queryFn: rdsService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: rdsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rds-connections'] });
      toast.success('RDS connection created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RDSConnection> }) =>
      rdsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rds-connections'] });
      toast.success('RDS connection updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: rdsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rds-connections'] });
      toast.success('RDS connection deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const testMutation = useMutation({
    mutationFn: rdsService.testConnection,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['rds-connections'] });
        toast.success('Connection test successful');
      } else {
        toast.error(`Connection test failed: ${result.message}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Connection test failed: ${error.message}`);
    },
  });

  const handleAdd = () => {
    setEditingConnection(undefined);
    setFormOpen(true);
  };

  const handleEdit = (connection: RDSConnection) => {
    setEditingConnection(connection);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    if (editingConnection) {
      await updateMutation.mutateAsync({ id: editingConnection.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setFormOpen(false);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingId) {
      await deleteMutation.mutateAsync(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    await testMutation.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">Error loading RDS connections: {(error as Error).message}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">RDS Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add RDS Connection
        </Button>
      </Box>

      {connections && connections.length === 0 ? (
        <Alert severity="info">
          No RDS connections found. Click "Add RDS Connection" to get started.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {connections?.map((connection) => (
            <Grid item xs={12} sm={6} md={4} key={connection.id}>
              <RDSCard
                connection={connection}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onTest={handleTest}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <RDSFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingConnection}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this RDS connection? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
