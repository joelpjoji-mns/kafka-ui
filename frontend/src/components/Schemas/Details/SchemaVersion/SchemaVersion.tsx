import React from 'react';
import { Button } from 'components/common/Button/Button';
import EditorViewer from 'components/common/EditorViewer/EditorViewer';
import { SchemaSubject } from 'generated-sources';
import { Row } from '@tanstack/react-table';

interface Props {
  row: Row<SchemaSubject>;
  onViewImpact?: (version: number) => void;
}

const SchemaVersion: React.FC<Props> = ({ row, onViewImpact }) => {
  const version = Number(row?.original?.version);

  return (
    <>
      {onViewImpact && Number.isInteger(version) && version > 0 && (
        <Button
          buttonSize="M"
          buttonType="secondary"
          onClick={() => onViewImpact(version)}
        >
          View Impact
        </Button>
      )}
      <EditorViewer
        data={row?.original?.schema}
        schemaType={row?.original?.schemaType}
      />
    </>
  );
};

export default SchemaVersion;
