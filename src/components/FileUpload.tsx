import { useCallback, useState } from "react";
import { Typography, Paper } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

interface FileUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function FileUpload({ file, onFileChange }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      onFileChange(selected);
    },
    [onFileChange]
  );

  return (
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
        accept=".xlsx,.csv"
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
            Drop your Excel (.xlsx) or CSV file here
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to browse
          </Typography>
        </>
      )}
    </Paper>
  );
}
