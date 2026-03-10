import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

interface FileUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

// ---------------------------------------------------------------------------
// TSV paste parser
// ---------------------------------------------------------------------------

interface ParseOk  { ok: true;  file: File; summary: string }
interface ParseErr { ok: false; error: string }

function parseTsvTemplate(raw: string): ParseOk | ParseErr {
  // Normalise line endings
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // Trim trailing blank lines
  const rows = lines.map((l) => l.split("\t"));
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));

  if (nonEmpty.length < 4) {
    return {
      ok: false,
      error:
        "Pasted data must have at least 4 rows (3 header rows + at least 1 data row). " +
        "Make sure you copy the header rows from the template.",
    };
  }

  const meters    = nonEmpty[0].slice(1).map((v) => v.trim());
  const variables = nonEmpty[1].slice(1).map((v) => v.trim());

  if (meters.length === 0 || meters.every((m) => m === "")) {
    return {
      ok: false,
      error: "No column headers found. Copy from the template including the meter and variable rows.",
    };
  }

  const dataRows = nonEmpty.slice(3).filter((r) => r[0] && r[0].trim() !== "");
  if (dataRows.length === 0) {
    return { ok: false, error: "No data rows found after the 3 header rows." };
  }

  const channels = meters
    .map((m, i) => `${m}/${variables[i] ?? ""}`)
    .filter((_, i) => meters[i] !== "")
    .join(", ");

  const blob = new Blob([raw], { type: "text/tab-separated-values" });
  const file = new File([blob], "pasted_data.tsv", {
    type: "text/tab-separated-values",
  });

  return {
    ok: true,
    file,
    summary: `${dataRows.length} data rows · ${meters.length} channels (${channels})`,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UploadTab({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      onFileChange(selected);
    },
    [onFileChange],
  );

  return (
    <Box>
      {/* Template download */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Don't have data ready?
        </Typography>
        <Button
          size="small"
          startIcon={<DownloadIcon fontSize="small" />}
          component={Link}
          href="/meter_data_template.xlsx"
          download="meter_data_template.xlsx"
          sx={{ textTransform: "none" }}
        >
          Download template
        </Button>
      </Box>

      {/* Drop zone */}
      <Paper
        variant="outlined"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        sx={{
          p: 4,
          textAlign: "center",
          cursor: "pointer",
          bgcolor: dragOver ? "action.hover" : "background.paper",
          borderStyle: "dashed",
          borderColor: dragOver ? "primary.main" : "divider",
          transition: "all 0.2s",
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.csv,.tsv"
          hidden
          onChange={handleFileInput}
        />
        <CloudUploadIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
        {file ? (
          <Typography variant="body1" fontWeight={500}>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </Typography>
        ) : (
          <>
            <Typography variant="body1">
              Drop your file here (.xlsx, .csv, or .tsv)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to browse
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}

function PasteTab({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
}) {
  const [parseResult, setParseResult] = useState<ParseOk | ParseErr | null>(
    null,
  );
  const areaRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData("text");
      if (!text) return;
      const result = parseTsvTemplate(text);
      setParseResult(result);
      if (result.ok) {
        onFileChange(result.file);
      }
    },
    [onFileChange],
  );

  const handleClick = () => {
    areaRef.current?.focus();
  };

  const isPasted = parseResult?.ok && file?.name === "pasted_data.tsv";

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        In Excel, select your data including the 3 header rows (meter, variable,
        unit) and all data rows, then paste below with{" "}
        <Box component="kbd" sx={{ fontFamily: "monospace", fontSize: "0.85em" }}>
          Ctrl+V
        </Box>
        .{" "}
        <Button
          size="small"
          startIcon={<DownloadIcon fontSize="small" />}
          component={Link}
          href="/meter_data_template.xlsx"
          download="meter_data_template.xlsx"
          sx={{ textTransform: "none", verticalAlign: "baseline" }}
        >
          Download template
        </Button>
      </Typography>

      <Paper
        ref={areaRef}
        variant="outlined"
        tabIndex={0}
        onPaste={handlePaste}
        onClick={handleClick}
        sx={{
          p: 3,
          minHeight: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "text",
          outline: "none",
          borderStyle: "dashed",
          "&:focus": { borderColor: "primary.main" },
          transition: "border-color 0.2s",
          textAlign: "center",
        }}
      >
        {isPasted ? (
          <>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body1" fontWeight={500} color="success.main">
              Data pasted successfully
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {(parseResult as ParseOk).summary}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
              Paste again to replace
            </Typography>
          </>
        ) : (
          <>
            <ContentPasteIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
            <Typography variant="body1">Click here, then paste</Typography>
            <Typography variant="body2" color="text.secondary">
              Ctrl+V / ⌘V
            </Typography>
          </>
        )}
      </Paper>

      {parseResult && !parseResult.ok && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {parseResult.error}
        </Alert>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FileUpload({ file, onFileChange }: FileUploadProps) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          icon={<CloudUploadIcon fontSize="small" />}
          iconPosition="start"
          label="Upload file"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
        <Tab
          icon={<ContentPasteIcon fontSize="small" />}
          iconPosition="start"
          label="Paste from Excel"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
      </Tabs>

      {tab === 0 ? (
        <UploadTab file={file} onFileChange={onFileChange} />
      ) : (
        <PasteTab file={file} onFileChange={onFileChange} />
      )}
    </Box>
  );
}
