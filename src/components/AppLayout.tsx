import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Tooltip,
  Button,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import ScienceIcon from "@mui/icons-material/Science";
import BarChartIcon from "@mui/icons-material/BarChart";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { useMsal } from "@azure/msal-react";
import { useAnalysis } from "../context/AnalysisContext";

const DRAWER_WIDTH = 220;

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  disabled?: boolean;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { instance, accounts } = useMsal();
  const { result } = useAnalysis();

  const userName = accounts[0]?.name ?? accounts[0]?.username ?? "";

  const navItems: NavItem[] = [
    { label: "Configure",  path: "/configure",  icon: <TuneIcon /> },
    { label: "Thermo",     path: "/thermo",     icon: <ScienceIcon /> },
    { label: "Analysis",   path: "/analysis",   icon: <BarChartIcon />, disabled: !result },
    { label: "Scenarios",  path: "/scenarios",  icon: <FolderOpenIcon /> },
    { label: "Settings",   path: "/settings",   icon: <PersonIcon /> },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {/* App name */}
        <Box sx={{ px: 2.5, py: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary">
            MPFM Validation
          </Typography>
        </Box>

        <Divider />

        {/* Nav items */}
        <List sx={{ flex: 1, pt: 1 }}>
          {navItems.map(({ label, path, icon, disabled }) => {
            const active = location.pathname === path;
            const item = (
              <ListItemButton
                key={path}
                component={NavLink}
                to={path}
                disabled={disabled}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 1.5,
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? "primary.50" : "transparent",
                  "&:hover": { bgcolor: active ? "primary.50" : "action.hover" },
                  "&.Mui-disabled": { opacity: 0.4 },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: active ? "primary.main" : "inherit",
                  }}
                >
                  {icon}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 400,
                  }}
                />
              </ListItemButton>
            );

            return disabled ? (
              <Tooltip
                key={path}
                title="Run an analysis first to view results"
                placement="right"
              >
                <span>{item}</span>
              </Tooltip>
            ) : (
              item
            );
          })}
        </List>

        <Divider />

        {/* User / sign-out */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {userName}
          </Typography>
          <Button
            size="small"
            startIcon={<LogoutIcon fontSize="small" />}
            onClick={() => instance.logoutRedirect()}
            color="inherit"
            sx={{ color: "text.secondary", fontSize: "0.75rem" }}
          >
            Sign out
          </Button>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: "background.default",
          minHeight: "100vh",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
