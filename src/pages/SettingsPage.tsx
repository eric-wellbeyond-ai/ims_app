import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Divider,
  Avatar,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { useMsal } from "@azure/msal-react";

export default function SettingsPage() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const displayName = account?.name ?? "—";
  const email = account?.username ?? "—";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <PersonIcon color="primary" />
        <Typography variant="h4">Settings</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Account
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
            {initials}
          </Avatar>
          <Box>
            <Typography fontWeight={600}>{displayName}</Typography>
            <Typography variant="body2" color="text.secondary">{email}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={() => instance.logoutRedirect()}
        >
          Sign out
        </Button>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          About
        </Typography>
        <Typography variant="body2" color="text.secondary">
          MPFM Validation — multiphase flow meter validation tool.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Thermodynamic calculations via Peng-Robinson EOS with binary interaction parameters.
        </Typography>
      </Paper>
    </Container>
  );
}
