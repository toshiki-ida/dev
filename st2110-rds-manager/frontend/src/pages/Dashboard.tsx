import { Typography, Paper, Box } from '@mui/material'

export default function Dashboard() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography>Dashboard content will be implemented in later phases.</Typography>
      </Paper>
    </Box>
  )
}
