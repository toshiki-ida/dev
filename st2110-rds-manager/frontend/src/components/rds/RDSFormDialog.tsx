import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Grid,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { RDSConnection } from '../../types';

const rdsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  ipAddress: z
    .string()
    .min(1, 'IP address is required')
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address format'),
  port: z
    .number()
    .int()
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be at most 65535'),
  timeout: z
    .number()
    .int()
    .min(1, 'Timeout must be at least 1')
    .max(300, 'Timeout must be at most 300 seconds'),
  enabled: z.boolean(),
});

type RDSFormData = z.infer<typeof rdsSchema>;

interface RDSFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RDSFormData) => Promise<void>;
  initialData?: RDSConnection;
  title?: string;
}

export default function RDSFormDialog({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
}: RDSFormDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RDSFormData>({
    resolver: zodResolver(rdsSchema),
    defaultValues: {
      name: '',
      ipAddress: '',
      port: 8080,
      timeout: 30,
      enabled: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        ipAddress: initialData.ipAddress,
        port: initialData.port,
        timeout: initialData.timeout,
        enabled: initialData.enabled,
      });
    } else {
      reset({
        name: '',
        ipAddress: '',
        port: 8080,
        timeout: 30,
        enabled: true,
      });
    }
  }, [initialData, reset, open]);

  const handleFormSubmit = async (data: RDSFormData) => {
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title || (initialData ? 'Edit RDS Connection' : 'Add RDS Connection')}</DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Connection Name"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    autoFocus
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={8}>
              <Controller
                name="ipAddress"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="IP Address"
                    fullWidth
                    error={!!errors.ipAddress}
                    helperText={errors.ipAddress?.message}
                    placeholder="192.168.1.100"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="port"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Port"
                    type="number"
                    fullWidth
                    error={!!errors.port}
                    helperText={errors.port?.message}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="timeout"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Timeout (seconds)"
                    type="number"
                    fullWidth
                    error={!!errors.timeout}
                    helperText={errors.timeout?.message}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="enabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Enabled"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {initialData ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
