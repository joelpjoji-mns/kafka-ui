import React from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { RouteParamsClusterTopic } from 'lib/paths';
import { Button } from 'components/common/Button/Button';
import Editor from 'components/common/Editor/Editor';
import InputWithOptions from 'components/common/InputWithOptions/InputWithOptions';
import Select from 'components/common/Select/Select';
import Switch from 'components/common/Switch/Switch';
import Tooltip from 'components/common/Tooltip/Tooltip';
import InfoIcon from 'components/common/Icons/InfoIcon';
import useAppParams from 'lib/hooks/useAppParams';
import { showAlert } from 'lib/errorHandling';
import {
  usePreviewTopicMessage,
  useSendMessage,
  useTopicDetails,
} from 'lib/hooks/api/topics';
import { InputLabel } from 'components/common/Input/InputLabel.styled';
import { useSerdes } from 'lib/hooks/api/topicMessages';
import {
  SerdeDescription,
  SerdeParameter,
  SerdeUsage,
  MessageFieldValidation,
  MessageValidationPreview,
} from 'generated-sources';
import { MessageFormData } from 'lib/interfaces/message';

import * as S from './SendMessage.styled';
import {
  getDefaultValues,
  getPartitionOptions,
  getSerdeOptions,
  validateBySchema,
} from './utils';

interface SendMessageProps {
  closeSidebar: () => void;
  messageData?: Partial<MessageFormData> | null;
}

interface PreviewState {
  fingerprint: string;
  result: MessageValidationPreview;
}

const previewFingerprint = ({
  key: formKey,
  content: formContent,
  headers: formHeaders,
  partition: formPartition,
  keySerde: formKeySerde,
  valueSerde: formValueSerde,
  keySerdeParams: formKeySerdeParams,
  valueSerdeParams: formValueSerdeParams,
}: Partial<MessageFormData>) =>
  JSON.stringify({
    key: formKey,
    content: formContent,
    headers: formHeaders,
    partition: formPartition,
    keySerde: formKeySerde,
    valueSerde: formValueSerde,
    keySerdeParams: formKeySerdeParams,
    valueSerdeParams: formValueSerdeParams,
  });

const previewFieldText = (label: string, field: MessageFieldValidation) => {
  if (field.status === 'VALIDATED') {
    const { schema } = field;
    const schemaDetails = [
      schema?.subject,
      schema?.id !== undefined ? `ID ${schema.id}` : undefined,
      schema?.version !== undefined ? `version ${schema.version}` : undefined,
      schema?.type,
    ]
      .filter(Boolean)
      .join(', ');
    return `${label}: validated by ${field.serde}${schemaDetails ? ` (${schemaDetails})` : ''}`;
  }
  if (field.status === 'SERIALIZED') {
    return `${label}: serialized by ${field.serde}; no schema metadata is available`;
  }
  if (field.status === 'SKIPPED') {
    return `${label}: skipped because no payload was supplied`;
  }
  return `${label}: ${field.errors?.join(', ') || 'serialization failed'}`;
};

const getSerdeParameters = (
  serdeName: string | undefined,
  serdeList: SerdeDescription[] | undefined
): SerdeParameter[] => {
  if (!serdeName || !serdeList) return [];
  const serde = serdeList.find((s) => s.name === serdeName);
  return serde?.parameters ?? [];
};

const SendMessage: React.FC<SendMessageProps> = ({
  closeSidebar,
  messageData = null,
}) => {
  const { clusterName, topicName } = useAppParams<RouteParamsClusterTopic>();
  const [searchParams] = useSearchParams();
  const urlKeySerde = searchParams.get('keySerde');
  const urlValueSerde = searchParams.get('valueSerde');
  const { data: topic } = useTopicDetails({ clusterName, topicName });
  const { data: serdes = {} } = useSerdes({
    clusterName,
    topicName,
    use: SerdeUsage.SERIALIZE,
  });
  const sendMessage = useSendMessage({ clusterName, topicName });
  const previewMessage = usePreviewTopicMessage({ clusterName, topicName });
  const [previewState, setPreviewState] = React.useState<PreviewState | null>(
    null
  );
  const defaultValues = React.useMemo(() => getDefaultValues(serdes), [serdes]);
  const partitionOptions = React.useMemo(
    () => getPartitionOptions(topic?.partitions || []),
    [topic]
  );

  const formDefaults = React.useMemo(
    () => ({
      ...defaultValues,
      ...(urlKeySerde ? { keySerde: urlKeySerde } : {}),
      ...(urlValueSerde ? { valueSerde: urlValueSerde } : {}),
      partition: Number(partitionOptions[0]?.value || 0),
      keepContents: false,
      ...messageData,
    }),
    [defaultValues, partitionOptions, messageData, urlKeySerde, urlValueSerde]
  );

  const {
    handleSubmit,
    formState: { isSubmitting },
    control,
    getValues,
    setValue,
  } = useForm<MessageFormData>({
    mode: 'onChange',
    defaultValues: formDefaults,
  });

  const keySerde = useWatch({ control, name: 'keySerde' });
  const valueSerde = useWatch({ control, name: 'valueSerde' });
  const key = useWatch({ control, name: 'key' });
  const content = useWatch({ control, name: 'content' });
  const headers = useWatch({ control, name: 'headers' });
  const partition = useWatch({ control, name: 'partition' });
  const keySerdeParams = useWatch({ control, name: 'keySerdeParams' });
  const valueSerdeParams = useWatch({ control, name: 'valueSerdeParams' });
  const currentPreviewFingerprint = previewFingerprint({
    key,
    content,
    headers,
    partition,
    keySerde,
    valueSerde,
    keySerdeParams,
    valueSerdeParams,
  });
  const preview =
    previewState?.fingerprint === currentPreviewFingerprint
      ? previewState.result
      : null;

  const keySerdeParameters = React.useMemo(
    () => getSerdeParameters(keySerde, serdes.key),
    [keySerde, serdes.key]
  );

  const valueSerdeParameters = React.useMemo(
    () => getSerdeParameters(valueSerde, serdes.value),
    [valueSerde, serdes.value]
  );

  const prevKeySerde = React.useRef(keySerde);
  React.useEffect(() => {
    if (prevKeySerde.current !== keySerde) {
      setValue('keySerdeParams', undefined);
      prevKeySerde.current = keySerde;
    }
  }, [keySerde, setValue]);

  const prevValueSerde = React.useRef(valueSerde);
  React.useEffect(() => {
    if (prevValueSerde.current !== valueSerde) {
      setValue('valueSerdeParams', undefined);
      prevValueSerde.current = valueSerde;
    }
  }, [valueSerde, setValue]);

  const renderParameters = (
    parameters: SerdeParameter[],
    prefix: 'keySerdeParams' | 'valueSerdeParams'
  ) => {
    return parameters.map((param) => {
      if (!param.allowedValues || param.allowedValues.length === 0) return null;
      const fieldName = `${prefix}.${param.name}`;
      const label = param.visibleName || param.name;
      const options = param.allowedValues.map((v) => ({
        label: v,
        value: v,
      }));
      return (
        <div key={fieldName}>
          <InputLabel>{label}</InputLabel>
          <Controller
            control={control}
            name={fieldName as keyof MessageFormData}
            render={({ field: { name, onChange, value } }) => (
              <InputWithOptions
                name={name}
                onChange={onChange}
                minWidth="100%"
                options={options}
                value={value as string}
                placeholder={`Search ${label.toLowerCase()}...`}
                inputSize="L"
              />
            )}
          />
        </div>
      );
    });
  };

  const submit = async ({
    keySerde: formKeySerde,
    valueSerde: formValueSerde,
    key: messageKey,
    content: messageContent,
    headers: messageHeaders,
    partition: messagePartition,
    keySerdeParams: messageKeySerdeParams,
    valueSerdeParams: messageValueSerdeParams,
    keepContents,
  }: MessageFormData) => {
    let errors: string[] = [];

    if (formKeySerde) {
      const selectedKeySerde = serdes.key?.find((k) => k.name === formKeySerde);
      errors = validateBySchema(messageKey, selectedKeySerde?.schema, 'key');
    }

    if (formValueSerde) {
      const selectedValue = serdes.value?.find(
        (v) => v.name === formValueSerde
      );
      errors = [
        ...errors,
        ...validateBySchema(messageContent, selectedValue?.schema, 'content'),
      ];
    }

    let parsedHeaders;
    if (messageHeaders) {
      try {
        parsedHeaders = JSON.parse(messageHeaders);
      } catch {
        errors.push('Wrong header format');
      }
    }

    if (errors.length > 0) {
      showAlert('error', {
        id: `${clusterName}-${topicName}-createTopicMessageError`,
        title: 'Validation Error',
        message: (
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ),
      });
      return;
    }
    try {
      await sendMessage.mutateAsync({
        key: messageKey || null,
        value: messageContent || null,
        headers: parsedHeaders,
        partition: messagePartition || 0,
        keySerde: formKeySerde,
        valueSerde: formValueSerde,
        ...(messageKeySerdeParams &&
        Object.keys(messageKeySerdeParams).length > 0
          ? { keySerdeProperties: messageKeySerdeParams }
          : {}),
        ...(messageValueSerdeParams &&
        Object.keys(messageValueSerdeParams).length > 0
          ? { valueSerdeProperties: messageValueSerdeParams }
          : {}),
      });
      if (!keepContents) {
        setValue('key', defaultValues.key || '');
        setValue('content', defaultValues.content || '');
        closeSidebar();
      }
    } catch {
      // do nothing
    }
  };

  const validatePreview = async () => {
    const values = getValues();
    let parsedHeaders;
    if (values.headers) {
      try {
        parsedHeaders = JSON.parse(values.headers);
      } catch {
        showAlert('error', {
          id: `${clusterName}-${topicName}-previewTopicMessageError`,
          title: 'Validation Error',
          message: 'Wrong header format',
        });
        return;
      }
    }

    try {
      const result = await previewMessage.mutateAsync({
        key: values.key || null,
        value: values.content || null,
        headers: parsedHeaders,
        partition: values.partition || 0,
        keySerde: values.keySerde,
        valueSerde: values.valueSerde,
        ...(values.keySerdeParams &&
        Object.keys(values.keySerdeParams).length > 0
          ? { keySerdeProperties: values.keySerdeParams }
          : {}),
        ...(values.valueSerdeParams &&
        Object.keys(values.valueSerdeParams).length > 0
          ? { valueSerdeProperties: values.valueSerdeParams }
          : {}),
      });
      setPreviewState({
        fingerprint: previewFingerprint(values),
        result,
      });
    } catch {
      setPreviewState(null);
    }
  };

  return (
    <S.Wrapper>
      <form onSubmit={handleSubmit(submit)}>
        <S.Columns>
          <S.FlexItem>
            <InputLabel id="partitionOptionsLabel">Partition</InputLabel>
            <Controller
              control={control}
              name="partition"
              render={({ field: { name, onChange, value } }) => (
                <Select
                  id="selectPartitionOptions"
                  aria-labelledby="partitionOptionsLabel"
                  name={name}
                  onChange={onChange}
                  minWidth="100%"
                  options={partitionOptions}
                  value={value}
                />
              )}
            />
          </S.FlexItem>
          <S.Flex>
            <S.FlexItem>
              <div>
                <InputLabel id="keySerdeOptionsLabel">Key Serde</InputLabel>
                <Controller
                  control={control}
                  name="keySerde"
                  render={({ field: { name, onChange, value } }) => (
                    <Select
                      id="selectKeySerdeOptions"
                      aria-labelledby="keySerdeOptionsLabel"
                      name={name}
                      onChange={onChange}
                      minWidth="100%"
                      options={getSerdeOptions(serdes.key || [])}
                      value={value}
                    />
                  )}
                />
              </div>
              {renderParameters(keySerdeParameters, 'keySerdeParams')}
            </S.FlexItem>
            <S.FlexItem>
              <div>
                <InputLabel id="valueSerdeOptionsLabel">Value Serde</InputLabel>
                <Controller
                  control={control}
                  name="valueSerde"
                  render={({ field: { name, onChange, value } }) => (
                    <Select
                      id="selectValueSerdeOptions"
                      aria-labelledby="valueSerdeOptionsLabel"
                      name={name}
                      onChange={onChange}
                      minWidth="100%"
                      options={getSerdeOptions(serdes.value || [])}
                      value={value}
                    />
                  )}
                />
              </div>
              {renderParameters(valueSerdeParameters, 'valueSerdeParams')}
            </S.FlexItem>
          </S.Flex>
        </S.Columns>
        <S.Columns>
          <div>
            <InputLabel>Key</InputLabel>
            <Controller
              control={control}
              name="key"
              render={({ field: { name, onChange, value } }) => (
                <Editor
                  readOnly={isSubmitting}
                  name={name}
                  onChange={onChange}
                  value={value}
                  height="40px"
                />
              )}
            />
          </div>
          <div>
            <InputLabel>Value</InputLabel>
            <Controller
              control={control}
              name="content"
              render={({ field: { name, onChange, value } }) => (
                <Editor
                  readOnly={isSubmitting}
                  name={name}
                  onChange={onChange}
                  value={value}
                  height="280px"
                />
              )}
            />
          </div>
        </S.Columns>
        <S.Columns>
          <div>
            <InputLabel>Headers</InputLabel>
            <Controller
              control={control}
              name="headers"
              render={({ field: { name, onChange, value } }) => (
                <Editor
                  readOnly={isSubmitting}
                  name={name}
                  onChange={onChange}
                  value={value || '{}'}
                  height="40px"
                />
              )}
            />
          </div>
        </S.Columns>
        <S.Columns>
          <S.Flex>
            <Controller
              control={control}
              name="keepContents"
              render={({ field: { name, onChange, value } }) => (
                <Switch name={name} onChange={onChange} checked={value} />
              )}
            />
            <InputLabel>Keep contents after producing a message</InputLabel>
            <Tooltip
              value={<InfoIcon />}
              content="When enabled, the form will remain populated after sending a message."
            />
          </S.Flex>
        </S.Columns>
        {preview && (
          <S.ValidationPreview aria-live="polite" role="status">
            <p>
              {preview.canSerialize
                ? 'Serialization preview completed without producing a message.'
                : 'Serialization preview found errors.'}
            </p>
            {preview.errors && preview.errors.length > 0 && (
              <ul>
                {preview.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <ul>
              <li>{previewFieldText('Key', preview.key)}</li>
              <li>{previewFieldText('Value', preview.value)}</li>
            </ul>
          </S.ValidationPreview>
        )}
        <S.Actions>
          <Button
            buttonSize="M"
            buttonType="secondary"
            disabled={isSubmitting}
            inProgress={previewMessage.isPending}
            onClick={validatePreview}
          >
            Validate Preview
          </Button>
          <Button
            buttonSize="M"
            buttonType="primary"
            type="submit"
            disabled={isSubmitting}
          >
            Produce Message
          </Button>
        </S.Actions>
      </form>
    </S.Wrapper>
  );
};

export default SendMessage;
