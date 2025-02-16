import { Button, Select } from 'antd';
import { SelectValue } from 'antd/es/select';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React, { useEffect, useMemo, useState } from 'react';

import DatePickerFilter from 'components/DatePickerFilter';
import MultiSelect from 'components/MultiSelect';
import ResponsiveFilters from 'components/ResponsiveFilters';
import { V1TrialLogsFieldsResponse } from 'services/api-ts-sdk';
import { detApi } from 'services/apiConfig';
import { consumeStream } from 'services/utils';
import { alphanumericSorter } from 'utils/data';

import css from './TrialLogFilters.module.scss';

dayjs.extend(utc);

const { Option } = Select;

export enum LogLevelFromApi {
  Unspecified = 'LOG_LEVEL_UNSPECIFIED',
  Trace = 'LOG_LEVEL_TRACE',
  Debug = 'LOG_LEVEL_DEBUG',
  Info = 'LOG_LEVEL_INFO',
  Warning = 'LOG_LEVEL_WARNING',
  Error = 'LOG_LEVEL_ERROR',
  Critical = 'LOG_LEVEL_CRITICAL',
}

export interface TrialLogFiltersInterface {
  agentIds?: Array<string>,
  containerIds?: Array<string>,
  levels?: Array<LogLevelFromApi>,
  rankIds?: Array<number>,
  sources?: Array<string>,
  stdtypes?: Array<string>,
  timestampAfter?: Dayjs,
  timestampBefore?: Dayjs,
}

interface Props {
  filter: TrialLogFiltersInterface;
  onChange?: (newFilters: TrialLogFiltersInterface) => void;
  trialId: number;
}

const TrialLogFilters: React.FC<Props> = ({ filter, onChange, trialId }: Props) => {
  const [ availableFilters, setAvailableFilters ] = useState<V1TrialLogsFieldsResponse>();

  const broadcastChange = (newFilter: TrialLogFiltersInterface) => {
    if (typeof onChange === 'function') {
      onChange(newFilter);
    }
  };

  const onAgentChange = (value: SelectValue) => broadcastChange({
    ...filter,
    agentIds: (value as Array<string>).map((item) => String(item)),
  });

  const onClear = () => broadcastChange({});

  const onContainerChange = (value: SelectValue) => broadcastChange({
    ...filter,
    containerIds: (value as Array<string>).map((item) => String(item)),
  });

  const onRankChange = (value: SelectValue) => broadcastChange({
    ...filter,
    rankIds: (value as Array<string>).map((item) => Number(item)),
  });

  const onLevelChange = (value: SelectValue) => broadcastChange({
    ...filter,
    levels: (value as Array<string>).map((item) => String(item) as LogLevelFromApi),
  });

  const onDateChange = (key: string, date: Dayjs|null) => {
    let dateUtc = null;

    if (date) {
      // receiving a date with user timezone. need to keep the selected date/time but
      // set the timezone to UTC.
      const iso8601StringNoTz = date.format().substr(0, 19);
      dateUtc = dayjs.utc(iso8601StringNoTz);
    }

    broadcastChange({
      ...filter,
      [key]: dateUtc,
    });
  };

  const onAfterDateChange = (date: Dayjs|null) => onDateChange('timestampAfter', date);

  const onBeforeDateChange = (date: Dayjs|null) => onDateChange('timestampBefore', date);

  const logLevelList = useMemo(() => {
    return Object.entries(LogLevelFromApi)
      .filter(([ key ]) => key !== 'Unspecified')
      .map(([ key, value ]) => ({ label: key, value }));
  }, []);

  useEffect(() => {
    const canceler = new AbortController();

    consumeStream<V1TrialLogsFieldsResponse>(
      detApi.StreamingExperiments.determinedTrialLogsFields(
        trialId,
        true,
        { signal: canceler.signal },
      ),
      event => {
        if (event.rankIds) {
          event.rankIds.sort(alphanumericSorter);
        }
        if (event.agentIds) {
          event.agentIds.sort(alphanumericSorter);
        }
        if (event.containerIds) {
          event.containerIds.sort(alphanumericSorter);
        }
        setAvailableFilters(event);
      },
    );

    return () => canceler.abort();
  }, [ trialId ]);

  // Check for when filter options are not available.
  if (availableFilters &&
    (!availableFilters.agentIds || availableFilters.agentIds.length === 0) &&
    (!availableFilters.containerIds || availableFilters.containerIds.length === 0) &&
    (!availableFilters.rankIds || availableFilters.rankIds.length === 0)) {
    return null;
  }

  return (
    <ResponsiveFilters>
      <MultiSelect
        label="Agents"
        value={filter.agentIds || []}
        onChange={onAgentChange}
      >
        {(availableFilters?.agentIds || []).map((agentId) => (
          <Option key={agentId} value={agentId}>
            {agentId}
          </Option>
        ))}
      </MultiSelect>
      <MultiSelect
        label="Containers"
        value={filter.containerIds || []}
        onChange={onContainerChange}
      >
        {(availableFilters?.containerIds || []).map((containerId) => (
          <Option key={containerId} value={containerId}>
            {containerId}
          </Option>
        ))}
      </MultiSelect>
      <MultiSelect
        label="Ranks"
        value={filter.rankIds || []}
        onChange={onRankChange}
      >
        {(availableFilters?.rankIds || []).map((rankId) => (
          <Option key={rankId} value={rankId}>
            {rankId}
          </Option>
        ))}
      </MultiSelect>
      <MultiSelect
        label="Level"
        value={filter.levels || []}
        onChange={onLevelChange}
      >
        {logLevelList.map((logLevel) => (
          <Option key={logLevel.value} value={logLevel.value}>
            {logLevel.label}
          </Option>
        ))}
      </MultiSelect>
      <DatePickerFilter
        label="Start"
        value={filter.timestampAfter}
        onChange={onAfterDateChange}
      />
      <DatePickerFilter
        label="End"
        value={filter.timestampBefore}
        onChange={onBeforeDateChange}
      />
      <Button
        className={css.clearButton}
        onClick={onClear}
      >
        Clear
      </Button>
    </ResponsiveFilters>
  );
};

export default TrialLogFilters;
