import React from 'react';
import { Action, ResourceType, TopicMessage } from 'generated-sources';
import { Dropdown, DropdownItem } from 'components/common/Dropdown';
import { ActionDropdownItem } from 'components/common/ActionComponent';
import useDataSaver from 'lib/hooks/useDataSaver';
import useAppParams from 'lib/hooks/useAppParams';
import { RouteParamsClusterTopic } from 'lib/paths';
import { useTopicActions } from 'components/contexts/TopicActionsContext';

interface MessageActionsProps {
  message: TopicMessage;
}

const MessageActions: React.FC<MessageActionsProps> = ({ message }) => {
  const { topicName } = useAppParams<RouteParamsClusterTopic>();
  const { openSidebarWithMessage } = useTopicActions();

  const savedMessageJson = {
    Value: message.value,
    Offset: message.offset,
    Key: message.key,
    Partition: message.partition,
    Headers: message.headers,
    Timestamp: message.timestamp,
  };
  const savedMessage = JSON.stringify(savedMessageJson, null, '\t');
  const { copyToClipboard, saveFile } = useDataSaver(
    'topic-message',
    savedMessage || ''
  );

  return (
    <Dropdown>
      <DropdownItem aria-label="Copy to clipboard" onClick={copyToClipboard}>
        Copy to clipboard
      </DropdownItem>
      <DropdownItem aria-label="Save as a file" onClick={saveFile}>
        Save as a file
      </DropdownItem>
      <ActionDropdownItem
        aria-label="Reproduce message"
        onClick={() => {
          openSidebarWithMessage(message);
        }}
        permission={{
          resource: ResourceType.TOPIC,
          action: Action.MESSAGES_PRODUCE,
          value: topicName,
        }}
      >
        Reproduce message
      </ActionDropdownItem>
    </Dropdown>
  );
};

export default MessageActions;
