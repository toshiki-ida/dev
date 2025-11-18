import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api/mock-rds';

interface MockServer {
  port: number;
  nodeCount: number;
  running: boolean;
}

interface Node {
  id: string;
  version: string;
  label: string;
  description: string;
  tags: Record<string, any>;
  type: string;
  caps?: Record<string, any>;
}

export default function TestRDS() {
  const queryClient = useQueryClient();
  const [port, setPort] = useState('8080');
  const [selectedPort, setSelectedPort] = useState<number | null>(null);

  // Node form state
  const [nodeForm, setNodeForm] = useState({
    label: '',
    description: '',
    type: 'sender',
    location: ''
  });

  // Fetch mock servers
  const { data: servers } = useQuery<MockServer[]>({
    queryKey: ['mock-servers'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}`);
      return res.data.data;
    },
    refetchInterval: 3000,
  });

  // Fetch nodes for selected server
  const { data: nodes } = useQuery<Node[]>({
    queryKey: ['mock-nodes', selectedPort],
    queryFn: async () => {
      if (!selectedPort) return [];
      const res = await axios.get(`${API_URL}/${selectedPort}/nodes`);
      return res.data.data;
    },
    enabled: !!selectedPort,
    refetchInterval: 2000,
  });

  // Start server mutation
  const startMutation = useMutation({
    mutationFn: async (port: number) => {
      const res = await axios.post(`${API_URL}/start`, { port });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-servers'] });
      toast.success('Mock RDS server started');
    },
    onError: (error: any) => {
      toast.error(`Failed to start: ${error.response?.data?.error || error.message}`);
    },
  });

  // Stop server mutation
  const stopMutation = useMutation({
    mutationFn: async (port: number) => {
      const res = await axios.post(`${API_URL}/${port}/stop`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-servers'] });
      setSelectedPort(null);
      toast.success('Mock RDS server stopped');
    },
    onError: (error: any) => {
      toast.error(`Failed to stop: ${error.response?.data?.error || error.message}`);
    },
  });

  // Add node mutation
  const addNodeMutation = useMutation({
    mutationFn: async ({ port, node }: { port: number; node: any }) => {
      const res = await axios.post(`${API_URL}/${port}/nodes`, node);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-nodes'] });
      toast.success('Node added');
      setNodeForm({ label: '', description: '', type: 'sender', location: '' });
    },
    onError: (error: any) => {
      toast.error(`Failed to add node: ${error.response?.data?.error || error.message}`);
    },
  });

  // Delete node mutation
  const deleteNodeMutation = useMutation({
    mutationFn: async ({ port, nodeId }: { port: number; nodeId: string }) => {
      const res = await axios.delete(`${API_URL}/${port}/nodes/${nodeId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-nodes'] });
      toast.success('Node deleted');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete node: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleStartServer = () => {
    const portNum = parseInt(port, 10);
    if (portNum < 1024 || portNum > 65535) {
      toast.error('Port must be between 1024 and 65535');
      return;
    }
    startMutation.mutate(portNum);
  };

  const handleAddNode = () => {
    if (!selectedPort) {
      toast.error('Please select a server first');
      return;
    }
    if (!nodeForm.label) {
      toast.error('Label is required');
      return;
    }

    const node = {
      label: nodeForm.label,
      description: nodeForm.description,
      type: nodeForm.type,
      tags: nodeForm.location ? { location: nodeForm.location } : {},
    };

    addNodeMutation.mutate({ port: selectedPort, node });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Test RDS Server
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        This page allows you to start mock NMOS IS-04 RDS servers for testing purposes.
      </Alert>

      <Grid container spacing={3}>
        {/* Left side: Server management */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Mock RDS Servers
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                label="Port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleStartServer}
                startIcon={<PlayArrowIcon />}
                disabled={startMutation.isPending}
              >
                Start
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            {servers && servers.length > 0 ? (
              <List>
                {servers.map((server) => (
                  <ListItem
                    key={server.port}
                    selected={selectedPort === server.port}
                    onClick={() => setSelectedPort(server.port)}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopMutation.mutate(server.port);
                        }}
                      >
                        <StopIcon />
                      </IconButton>
                    }
                    sx={{ cursor: 'pointer' }}
                  >
                    <ListItemText
                      primary={`Port ${server.port}`}
                      secondary={`${server.nodeCount} nodes`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary" align="center">
                No servers running
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Right side: Node management */}
        <Grid item xs={12} md={7}>
          {selectedPort ? (
            <Box>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Add Node to Port {selectedPort}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Label"
                      value={nodeForm.label}
                      onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Type"
                      value={nodeForm.type}
                      onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
                      select
                      SelectProps={{ native: true }}
                      fullWidth
                      size="small"
                    >
                      <option value="sender">Sender</option>
                      <option value="receiver">Receiver</option>
                      <option value="source">Source</option>
                      <option value="flow">Flow</option>
                      <option value="device">Device</option>
                      <option value="node">Node</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Description"
                      value={nodeForm.description}
                      onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Location (tag)"
                      value={nodeForm.location}
                      onChange={(e) => setNodeForm({ ...nodeForm, location: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddNode}
                      disabled={addNodeMutation.isPending}
                      fullWidth
                    >
                      Add Node
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Nodes ({nodes?.length || 0})
                </Typography>

                {nodes && nodes.length > 0 ? (
                  <Grid container spacing={2}>
                    {nodes.map((node) => (
                      <Grid item xs={12} sm={6} key={node.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1">{node.label}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {node.type}
                            </Typography>
                            <Typography variant="caption" display="block">
                              {node.description}
                            </Typography>
                            {node.tags?.location && (
                              <Typography variant="caption" color="text.secondary">
                                Location: {node.tags.location}
                              </Typography>
                            )}
                          </CardContent>
                          <CardActions>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                deleteNodeMutation.mutate({ port: selectedPort, nodeId: node.id })
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography color="text.secondary" align="center">
                    No nodes
                  </Typography>
                )}
              </Paper>
            </Box>
          ) : (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary" align="center">
                Select a server to manage nodes
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
