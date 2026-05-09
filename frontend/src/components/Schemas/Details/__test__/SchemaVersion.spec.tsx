import React from 'react';
import SchemaVersion from 'components/Schemas/Details/SchemaVersion/SchemaVersion';
import { render } from 'lib/testHelpers';
import { SchemaSubject } from 'generated-sources';
import { Row } from '@tanstack/react-table';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { jsonSchema } from './fixtures';

const renderComponent = (onViewImpact?: (version: number) => void) => {
  const row = {
    original: jsonSchema,
  };

  return render(
    <SchemaVersion
      row={row as Row<SchemaSubject>}
      onViewImpact={onViewImpact}
    />
  );
};

describe('SchemaVersion', () => {
  it('renders versions', async () => {
    renderComponent();
  });

  it('opens impact for the expanded version', async () => {
    const onViewImpact = jest.fn();
    renderComponent(onViewImpact);

    await userEvent.click(screen.getByRole('button', { name: 'View Impact' }));

    expect(onViewImpact).toHaveBeenCalledWith(Number(jsonSchema.version));
  });
});
