import { type ReactNode, useEffect, useRef } from "react";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { type PublicClientApplication, InteractionStatus } from "@azure/msal-browser";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { loginRequest } from "./msalConfig";
import { useAuthFetch } from "./useAuthFetch";

// ---------------------------------------------------------------------------
// AuthGate: single component that handles all MSAL states
//   • inProgress !== None  → spinner  (startup, redirect processing, token refresh)
//   • accounts.length === 0 → login screen
//   • accounts.length  > 0 → render children + fire one-time claim
// ---------------------------------------------------------------------------

function AuthGate({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const authFetch = useAuthFetch();
  const claimedRef = useRef(false);

  // Claim any pre-auth (unowned) cases the first time a user authenticates
  useEffect(() => {
    if (accounts.length === 0 || claimedRef.current) return;
    claimedRef.current = true;
    authFetch("/api/cases/claim-unassigned", { method: "POST" }).catch(() => {
      // Non-fatal
    });
  }, [accounts.length, authFetch]);

  // During startup / redirect / silent token refresh — show a spinner so
  // the page is never blank.
  if (inProgress !== InteractionStatus.None) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Not authenticated → login screen
  if (accounts.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          mt: 12,
          gap: 3,
        }}
      >
        <Typography variant="h4">MPFM Validation</Typography>
        <Typography variant="body1" color="text.secondary">
          Sign in with your Microsoft work account to continue.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => instance.loginRedirect(loginRequest)}
        >
          Sign in with Microsoft
        </Button>
      </Box>
    );
  }

  // Authenticated → render the app
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({
  children,
  instance,
}: {
  children: ReactNode;
  instance: PublicClientApplication;
}) {
  return (
    <MsalProvider instance={instance}>
      <AuthGate>{children}</AuthGate>
    </MsalProvider>
  );
}
