import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const FIELD = "grid min-w-0 gap-1.5";
const LABEL =
  "flex items-baseline justify-between gap-3 text-[0.9375rem] font-bold leading-[1.3] text-ink";
const SUPPORTING = "text-[0.8125rem] font-medium leading-[1.45] text-ink-muted";
const FRAME =
  "flex min-h-target min-w-0 items-stretch rounded-sm border-2 border-ink-muted bg-raised focus-within:border-focus focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-focus data-[invalid=true]:border-error forced-colors:border-[FieldText] print:border-black";
const CONTROL =
  "min-h-10 min-w-0 w-full border-0 bg-transparent px-3 py-2.5 text-ink outline-0 placeholder:text-ink-muted";
const ERROR = "text-[0.8125rem] font-bold leading-[1.45] text-error";

interface FieldFrameProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: (descriptionId: string | undefined, invalid: boolean) => ReactNode;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  optional = false,
  children,
}: FieldFrameProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={FIELD}>
      <label className={LABEL} htmlFor={id}>
        <span>{label}</span>
        {optional ? <span className={SUPPORTING}>Optional</span> : null}
      </label>
      {hint ? (
        <span className={SUPPORTING} id={hintId}>
          {hint}
        </span>
      ) : null}
      {children(describedBy, Boolean(error))}
      {error ? (
        <span className={ERROR} id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export interface InputFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "prefix"
> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function InputField({
  id,
  label,
  hint,
  error,
  optional,
  prefix,
  suffix,
  className,
  ...props
}: InputFieldProps) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
    >
      {(describedBy, invalid) => (
        <div className={FRAME} data-invalid={invalid || undefined}>
          {prefix ? (
            <span
              className="inline-flex shrink-0 items-center border-r border-rule px-3 text-sm font-bold text-ink-muted"
              aria-hidden="true"
            >
              {prefix}
            </span>
          ) : null}
          <input
            {...props}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={[CONTROL, className ?? ""].filter(Boolean).join(" ")}
            id={id}
          />
          {suffix ? (
            <span
              className="inline-flex shrink-0 items-center border-l border-rule px-3 text-sm font-bold text-ink-muted"
              aria-hidden="true"
            >
              {suffix}
            </span>
          ) : null}
        </div>
      )}
    </FieldFrame>
  );
}

export interface TextareaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
    >
      {(describedBy, invalid) => (
        <textarea
          {...props}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={[
            "min-h-30 w-full resize-y rounded-sm border-2 border-ink-muted bg-raised p-3 text-ink placeholder:text-ink-muted aria-[invalid=true]:border-error focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus forced-colors:border-[FieldText] print:border-black",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          id={id}
        />
      )}
    </FieldFrame>
  );
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
    >
      {(describedBy, invalid) => (
        <span className={FRAME + " relative"}>
          <select
            {...props}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={[
              "min-h-10 w-full cursor-pointer appearance-none border-0 bg-transparent py-2.5 pr-11 pl-3 text-ink outline-0 aria-[invalid=true]:text-error",
              className ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
            id={id}
          >
            {children}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-0 flex w-target items-center justify-center text-xl"
            aria-hidden="true"
          >
            ⌄
          </span>
        </span>
      )}
    </FieldFrame>
  );
}

export interface CheckboxFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type"
> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function CheckboxField({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: CheckboxFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1">
      <label
        className="inline-flex min-h-target cursor-pointer items-start gap-3 py-2.5 text-[0.9375rem] font-semibold leading-[1.45] text-ink"
        htmlFor={id}
      >
        <input
          {...props}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={[
            "size-[1.375rem] shrink-0 cursor-pointer rounded-[2px] border-2 border-ink-muted accent-accent focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus forced-colors:border-[FieldText]",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          id={id}
          type="checkbox"
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <span className={SUPPORTING + " ml-[2.125rem]"} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className={ERROR + " ml-[2.125rem]"} id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
