import * as React from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Label } from '@/shared/ui/primitives/label'

type FieldState = { id: string; describedBy?: string; invalid: boolean; required: boolean }
const FieldContext = React.createContext<FieldState | null>(null)

type ControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
  'aria-required'?: React.AriaAttributes['aria-required']
}

/** Wires a control to the Field around it (id, hint and error, invalid, required); its own props win. */
function useFieldControl<P extends ControlProps>(props: P): P {
  const field = React.useContext(FieldContext)
  if (!field) return props
  const describedBy = [field.describedBy, props['aria-describedby']].filter(Boolean).join(' ')
  return {
    ...props,
    id: props.id ?? field.id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
    'aria-required': props['aria-required'] ?? (field.required || undefined)
  }
}

type FieldProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  label: React.ReactNode
  hint?: React.ReactNode
  /** Shown under the control with an icon; marks the control aria-invalid. */
  error?: React.ReactNode
  required?: boolean
  /** horizontal puts the label after the control: checkboxes and switches. */
  orientation?: 'vertical' | 'horizontal'
  /** The control's id; generated when omitted. */
  id?: string
  children: React.ReactNode
}

/** A label, one control, a hint and an error message, wired with aria-describedby and aria-invalid. */
function Field({
  label,
  hint,
  error,
  required = false,
  orientation = 'vertical',
  id,
  className,
  children,
  ...props
}: FieldProps): React.ReactElement {
  const auto = React.useId()
  const controlId = id ?? auto
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const state = React.useMemo(
    () => ({
      id: controlId,
      describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
      invalid: !!error,
      required
    }),
    [controlId, errorId, hintId, error, required]
  )
  const text = (
    <>
      {hint && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1 text-sm text-danger-text">
          <CircleAlertIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0">{error}</span>
        </p>
      )}
    </>
  )
  return (
    <FieldContext.Provider value={state}>
      <div
        data-slot="field"
        data-orientation={orientation}
        data-invalid={!!error || undefined}
        className={cn(
          orientation === 'vertical'
            ? 'flex min-w-0 flex-col gap-1.5'
            : 'grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5',
          className
        )}
        {...props}
      >
        {orientation === 'vertical' ? (
          <>
            <FieldLabel htmlFor={controlId} required={required}>
              {label}
            </FieldLabel>
            {children}
            {text}
          </>
        ) : (
          <>
            <div className="flex h-5 items-center">{children}</div>
            <FieldLabel
              htmlFor={controlId}
              required={required}
              className="min-h-5 text-base font-normal text-fg"
            >
              {label}
            </FieldLabel>
            <div className="col-start-2 flex flex-col gap-0.5">{text}</div>
          </>
        )}
      </div>
    </FieldContext.Provider>
  )
}

function FieldLabel({
  required,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Label> & { required?: boolean }): React.ReactElement {
  return (
    <Label className={cn('text-xs text-fg-secondary', className)} {...props}>
      <span className="min-w-0">
        {children}
        {required && (
          <span aria-hidden className="ms-0.5 text-danger-text">
            *
          </span>
        )}
      </span>
    </Label>
  )
}

/** A group of related controls under a legend: radio groups, a set of checkboxes. */
function Fieldset({
  legend,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<'fieldset'> & {
  legend: React.ReactNode
  description?: React.ReactNode
}): React.ReactElement {
  return (
    <fieldset
      data-slot="fieldset"
      className={cn('flex min-w-0 flex-col gap-2 disabled:opacity-50', className)}
      {...props}
    >
      <legend className="mb-1 text-xs font-medium text-fg-secondary">{legend}</legend>
      {description && <p className="-mt-1 text-sm text-fg-muted">{description}</p>}
      {children}
    </fieldset>
  )
}

/** A titled block of a form or settings page. */
function FormSection({
  title,
  description,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  title: React.ReactNode
  description?: React.ReactNode
}): React.ReactElement {
  const id = React.useId()
  return (
    <section
      data-slot="form-section"
      aria-labelledby={id}
      className={cn('flex flex-col gap-4 border-t border-border-subtle pt-6 first:border-0 first:pt-0', className)}
      {...props}
    >
      <header className="flex flex-col gap-1">
        <h3 id={id} className="text-lg">
          {title}
        </h3>
        {description && <p className="max-w-prose text-sm text-fg-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}

export { Field, FieldLabel, Fieldset, FormSection, useFieldControl }
