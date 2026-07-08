import React from 'react';
import DatePicker, { DatePickerProps } from 'react-datepicker';

type SingleDatePickerProps = Omit<
  DatePickerProps,
  'onChange' | 'selectsMultiple' | 'selectsRange'
> & {
  onChange?: (
    date: Date | null,
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
  ) => void;
};

const SingleDatePicker: React.FC<SingleDatePickerProps> = (props) => {
  const datePickerProps = {
    ...props,
    selectsMultiple: false,
    selectsRange: false,
  } as DatePickerProps;

  return <DatePicker {...datePickerProps} />;
};

export default SingleDatePicker;
