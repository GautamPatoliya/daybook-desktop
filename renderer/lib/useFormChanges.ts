'use client';

import type { FieldValues, UseFormReturn } from 'react-hook-form';

export interface UseFormChangesConfig<T extends FieldValues> {
  /** React Hook Form methods instance */
  methods: UseFormReturn<T>;
}

export interface UseFormChangesResult {
  /** Whether the form has changes from default values */
  hasChanges: boolean;
}

/**
 * Tracks unsaved edits via react-hook-form `formState.isDirty`.
 *
 * @example
 * ```tsx
 * const methods = useForm({ defaultValues });
 * const { hasChanges } = useFormChanges({ methods });
 *
 * <Button disabled={!hasChanges || isSubmitting}>Save</Button>
 * {hasChanges && <Badge>Unsaved changes</Badge>}
 * ```
 */
export function useFormChanges<T extends FieldValues>({
  methods,
}: UseFormChangesConfig<T>): UseFormChangesResult {
  const { formState } = methods;
  const { isDirty } = formState;

  return {
    hasChanges: isDirty,
  };
}
