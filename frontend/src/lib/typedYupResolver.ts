import { yupResolver } from '@hookform/resolvers/yup';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { AnyObjectSchema, ValidateOptions } from 'yup';

type ResolverOptions = {
  mode?: 'async' | 'sync';
  raw?: boolean;
};

export const typedYupResolver = <TFieldValues extends FieldValues>(
  schema: AnyObjectSchema,
  schemaOptions?: ValidateOptions,
  resolverOptions?: ResolverOptions
): Resolver<TFieldValues> => {
  const resolve = yupResolver as unknown as (
    schema: AnyObjectSchema,
    schemaOptions?: ValidateOptions,
    resolverOptions?: ResolverOptions
  ) => Resolver<TFieldValues>;

  return resolve(schema, schemaOptions, resolverOptions);
};
