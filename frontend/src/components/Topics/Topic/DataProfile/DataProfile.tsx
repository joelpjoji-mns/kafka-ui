import React from 'react';
import { Button } from 'components/common/Button/Button';
import ErrorPage from 'components/ErrorPage/ErrorPage';
import PageLoader from 'components/common/PageLoader/PageLoader';
import Select, { SelectOption } from 'components/common/Select/Select';
import {
  TopicDataProfileField,
  TopicDataProfileJsonField,
} from 'generated-sources';
import { useTopicDataProfile } from 'lib/hooks/api/topics';
import useAppParams from 'lib/hooks/useAppParams';
import { RouteParamsClusterTopic } from 'lib/paths';

import * as S from './DataProfile.styled';

const sampleOptions: SelectOption<number>[] = [
  { label: '100 records', value: 100 },
  { label: '250 records', value: 250 },
  { label: '500 records', value: 500 },
  { label: '1,000 records', value: 1_000 },
];

const numberFormatter = new Intl.NumberFormat();

const formatNumber = (value?: number) =>
  value === undefined || value === null
    ? 'Unavailable'
    : numberFormatter.format(value);

const formatBytes = (value?: number) => {
  if (value === undefined || value === null) return 'Unavailable';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length
  );
  const scaled = value / 1024 ** exponent;
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1)} ${units[exponent - 1]}`;
};

const FieldRow: React.FC<{
  name: string;
  field: TopicDataProfileField;
}> = ({ name, field }) => (
  <tr>
    <td>{name}</td>
    <td>{formatNumber(field.presentCount)}</td>
    <td>{formatNumber(field.nullCount)}</td>
    <td>{formatBytes(field.size.minBytes)}</td>
    <td>{formatBytes(field.size.averageBytes)}</td>
    <td>{formatBytes(field.size.p95Bytes)}</td>
    <td>{formatBytes(field.size.maxBytes)}</td>
  </tr>
);

const JsonFieldRow: React.FC<{ field: TopicDataProfileJsonField }> = ({
  field,
}) => (
  <tr>
    <td>{field.name}</td>
    <td>{formatNumber(field.presentCount)}</td>
    <td>{formatNumber(field.nullCount)}</td>
    <td>
      <S.TypeList>
        {field.types.map((type) => (
          <span key={type}>{type}</span>
        ))}
      </S.TypeList>
    </td>
  </tr>
);

const DataProfile: React.FC = () => {
  const params = useAppParams<RouteParamsClusterTopic>();
  const [sampleLimit, setSampleLimit] = React.useState(250);
  const { data, error, isLoading, isRefetching, refetch } = useTopicDataProfile(
    params,
    sampleLimit
  );

  if (isLoading) {
    return <PageLoader offsetY={300} />;
  }

  if (!data) {
    return (
      <ErrorPage
        offsetY={300}
        text={
          error?.message ||
          'Sampled data profile evidence is unavailable for this topic.'
        }
        onClick={() => refetch()}
      />
    );
  }

  const coverage =
    data.totalPartitions === 0
      ? 0
      : Math.round((data.sampledPartitions / data.totalPartitions) * 100);

  return (
    <S.Page>
      <S.Controls aria-label="Data profile controls">
        <S.ControlLabel>
          <span>Recent sample</span>
          <Select
            id="dataProfileSampleLimit"
            aria-label="Profile sample size"
            options={sampleOptions}
            value={sampleLimit}
            onChange={setSampleLimit}
            minWidth="160px"
          />
        </S.ControlLabel>
        <Button
          buttonType="secondary"
          buttonSize="M"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? 'Refreshing' : 'Refresh'}
        </Button>
        <S.SampledAt>
          Recent bounded sample collected{' '}
          {new Date(data.sampledAtMs).toLocaleTimeString()}
        </S.SampledAt>
      </S.Controls>

      <S.Summary aria-label="Data profile sampling summary">
        <S.Metric $tone={data.sampleLimitReached ? 'good' : 'warning'}>
          <strong>{formatNumber(data.sampledRecords)}</strong>
          <span>
            {data.sampleLimitReached
              ? `Sample limit ${formatNumber(data.sampleLimit)} reached`
              : `of ${formatNumber(data.sampleLimit)} requested`}
          </span>
        </S.Metric>
        <S.Metric $tone={coverage === 100 ? 'good' : 'warning'}>
          <strong>{coverage}%</strong>
          <span>
            {formatNumber(data.sampledPartitions)} of{' '}
            {formatNumber(data.totalPartitions)} partitions
          </span>
        </S.Metric>
        <S.Metric $tone="good">
          <strong>{formatNumber(data.json.parsedValueCount)}</strong>
          <span>JSON values parsed</span>
        </S.Metric>
        <S.Metric $tone="good">
          <strong>{formatNumber(data.headers.recordsWithHeaders)}</strong>
          <span>Records with headers</span>
        </S.Metric>
      </S.Summary>

      <S.Section aria-labelledby="data-profile-fields-heading">
        <S.SectionHeader>
          <S.SectionTitle id="data-profile-fields-heading">
            Presence and byte distribution
          </S.SectionTitle>
          <S.SectionHint>
            Aggregate sizes are calculated only from present keys and values.
          </S.SectionHint>
        </S.SectionHeader>
        <S.TableViewport>
          <S.Table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Present</th>
                <th>Null</th>
                <th>Min</th>
                <th>Average</th>
                <th>P95</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow name="Key" field={data.key} />
              <FieldRow name="Value" field={data.value} />
            </tbody>
          </S.Table>
        </S.TableViewport>
      </S.Section>

      <S.Split>
        <S.Section aria-labelledby="data-profile-headers-heading">
          <S.SectionHeader>
            <S.SectionTitle id="data-profile-headers-heading">
              Header presence
            </S.SectionTitle>
            <S.SectionHint>
              {formatNumber(data.headers.totalHeaders)} header entries in the
              sample
            </S.SectionHint>
          </S.SectionHeader>
          {data.headers.names.length === 0 ? (
            <S.Empty>No headers were present in the sampled records.</S.Empty>
          ) : (
            <S.NameList>
              {data.headers.names.map((header) => (
                <li key={header.name}>
                  <strong>{header.name}</strong>
                  <span>{formatNumber(header.occurrenceCount)} records</span>
                </li>
              ))}
            </S.NameList>
          )}
        </S.Section>

        <S.Section aria-labelledby="data-profile-json-heading">
          <S.SectionHeader>
            <S.SectionTitle id="data-profile-json-heading">
              JSON top-level shape
            </S.SectionTitle>
            <S.SectionHint>
              {formatNumber(data.json.objectValueCount)} object values detected
            </S.SectionHint>
          </S.SectionHeader>
          {data.json.topLevelFields.length === 0 ? (
            <S.Empty>
              No JSON object fields were detected in the sampled values.
            </S.Empty>
          ) : (
            <S.TableViewport>
              <S.Table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Present</th>
                    <th>Null</th>
                    <th>Observed types</th>
                  </tr>
                </thead>
                <tbody>
                  {data.json.topLevelFields.map((field) => (
                    <JsonFieldRow key={field.name} field={field} />
                  ))}
                </tbody>
              </S.Table>
            </S.TableViewport>
          )}
        </S.Section>
      </S.Split>
    </S.Page>
  );
};

export default DataProfile;
