import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import theme from "./theme";
import { AnalysisProvider } from "./context/AnalysisContext";
import { FluidProvider } from "./context/FluidContext";
import AppLayout from "./components/AppLayout";
import UploadPage from "./pages/UploadPage";
import DashboardPage from "./pages/DashboardPage";
import ThermoPage from "./pages/ThermoPage";
import ScenariosPage from "./pages/ScenariosPage";
import SettingsPage from "./pages/SettingsPage";
import RagChatPage from "./pages/RagChatPage";
import { useBlockAltArrowHistoryNav } from "./hooks/useBlockAltArrowHistoryNav";
import { RagChatProvider } from "./context/RagChatContext";

function App() {
  useBlockAltArrowHistoryNav();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AnalysisProvider>
          <FluidProvider>
            <BrowserRouter>
              <RagChatProvider>
                <AppLayout>
                  <Routes>
                    <Route path="/"           element={<Navigate to="/configure" replace />} />
                    <Route path="/configure"  element={<UploadPage />} />
                    <Route path="/thermo"     element={<ThermoPage />} />
                    <Route path="/analysis"   element={<DashboardPage />} />
                    <Route path="/scenarios"  element={<ScenariosPage />} />
                    <Route path="/assistant"  element={<RagChatPage />} />
                    <Route path="/settings"   element={<SettingsPage />} />
                    {/* Legacy redirect for any old bookmarks */}
                    <Route path="/dashboard"  element={<Navigate to="/analysis" replace />} />
                  </Routes>
                </AppLayout>
              </RagChatProvider>
            </BrowserRouter>
          </FluidProvider>
        </AnalysisProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
