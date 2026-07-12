import 'react-datepicker/dist/react-datepicker.css';

import React, { useMemo } from 'react';
import DatePicker from 'react-datepicker';
import styled from 'styled-components';
import FlexBox from 'components/common/FlexBox/FlexBox';
import { Button } from 'components/common/Button/Button';

export interface TimeRangeSelectorProps {
  start: Date | null;
  end: Date | null;
  onApply: (start: Date | null, end: Date | null) => void;
  disabled?: boolean;
}

interface Preset {
  label: string;
  ms: number;
}

const PRESETS: Preset[] = [
  { label: 'Last 1h', ms: 60 * 60 * 1000 },
  { label: 'Last 1 day', ms: 24 * 60 * 60 * 1000 },
  { label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Last 1 month', ms: 30 * 24 * 60 * 60 * 1000 },
];

const RangeWrapper = styled(FlexBox)`
  border: 1px solid ${({ theme }) => theme.select.borderColor.normal};
  border-radius: 4px;
  padding: 2px 6px;
  background-color: ${({ theme }) => theme.input.backgroundColor.normal};
`;

const RangeLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.metrics.filters.color.normal};
  padding: 0 4px;
`;

const RangeDate = styled(DatePicker)`
  height: 26px;
  border: none;
  outline: none;
  background-color: transparent;
  color: ${({ theme }) => theme.input.color.normal};
  font-size: 13px;
  width: 170px;
  padding: 0 4px;

  &::placeholder {
    color: ${({ theme }) => theme.input.color.normal};
    opacity: 0.6;
  }
`;

const TimezoneBadge = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.metrics.filters.color.normal};
  opacity: 0.85;
  padding: 0 6px;
  white-space: nowrap;
`;

const PresetButton = styled.button<{ $active?: boolean }>`
  height: 26px;
  padding: 0 8px;
  border: 1px solid ${({ theme }) => theme.select.borderColor.normal};
  border-radius: 4px;
  background-color: ${({ $active, theme }) =>
    $active ? theme.layout.stuffColor : theme.input.backgroundColor.normal};
  color: ${({ theme }) => theme.input.color.normal};
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.layout.stuffColor};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ClearButton = styled(Button)`
  height: 26px;
`;

const detectTimezone = (): { tz: string; offset: string } => {
  let tz = 'UTC';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    tz = 'UTC';
  }
  // Format the current offset as +HH:MM / -HH:MM
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return { tz, offset: `UTC${sign}${hh}:${mm}` };
};

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  start,
  end,
  onApply,
  disabled,
}) => {
  const { tz, offset } = useMemo(detectTimezone, []);

  const activePresetLabel = useMemo(() => {
    if (!start || !end) return null;
    const diff = end.getTime() - start.getTime();
    const now = Date.now();
    // consider a preset active only if end is roughly "now"
    const endIsNow = Math.abs(now - end.getTime()) < 60 * 1000;
    if (!endIsNow) return null;
    const match = PRESETS.find((p) => Math.abs(p.ms - diff) < 1000);
    return match?.label ?? null;
  }, [start, end]);

  const applyPreset = (ms: number) => {
    const now = new Date();
    const from = new Date(now.getTime() - ms);
    onApply(from, now);
  };

  const setStart = (value: Date | null) => onApply(value, end);
  const setEnd = (value: Date | null) => onApply(start, value);

  return (
    <FlexBox gap="6px" alignItems="center" flexWrap="wrap">
      {PRESETS.map((preset) => (
        <PresetButton
          key={preset.label}
          type="button"
          disabled={disabled}
          $active={activePresetLabel === preset.label}
          onClick={() => applyPreset(preset.ms)}
          data-testid={`time-range-preset-${preset.label
            .toLowerCase()
            .replace(/\s+/g, '-')}`}
          title={`Show messages from the ${preset.label.toLowerCase()}`}
        >
          {preset.label}
        </PresetButton>
      ))}
      <RangeWrapper gap="2px" alignItems="center">
        <RangeLabel>From</RangeLabel>
        <RangeDate
          selected={start}
          onChange={setStart}
          showTimeInput
          timeInputLabel="Time:"
          dateFormat="MMM d, yyyy HH:mm"
          placeholderText="Start"
          disabled={disabled}
          isClearable
        />
        <RangeLabel>To</RangeLabel>
        <RangeDate
          selected={end}
          onChange={setEnd}
          showTimeInput
          timeInputLabel="Time:"
          dateFormat="MMM d, yyyy HH:mm"
          placeholderText="End"
          disabled={disabled}
          isClearable
        />
        <TimezoneBadge title={`Application timezone: ${tz} (${offset})`}>
          {tz} · {offset}
        </TimezoneBadge>
      </RangeWrapper>
      {(start || end) && (
        <ClearButton
          type="button"
          buttonType="secondary"
          buttonSize="S"
          onClick={() => onApply(null, null)}
        >
          Clear range
        </ClearButton>
      )}
    </FlexBox>
  );
};

export default TimeRangeSelector;
