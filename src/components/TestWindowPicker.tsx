import { Stack } from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { type Dayjs } from "dayjs";

interface TestWindowPickerProps {
  start: string;
  end: string;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
}

export default function TestWindowPicker({
  start,
  end,
  onStartChange,
  onEndChange,
}: TestWindowPickerProps) {
  return (
    <Stack spacing={2}>
      <DateTimePicker
        label="Test Start"
        value={start ? dayjs(start) : null}
        onChange={(val: Dayjs | null) =>
          onStartChange(val ? val.toISOString() : "")
        }
        slotProps={{ textField: { size: "small", fullWidth: true } }}
      />
      <DateTimePicker
        label="Test End"
        value={end ? dayjs(end) : null}
        onChange={(val: Dayjs | null) =>
          onEndChange(val ? val.toISOString() : "")
        }
        slotProps={{ textField: { size: "small", fullWidth: true } }}
      />
    </Stack>
  );
}
