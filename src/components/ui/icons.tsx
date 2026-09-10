import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="20"
      viewBox="0 0 20 20"
      width="20"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="M3 10h13M11 5l5 5-5 5"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="2"
      />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="m3 10 4 4L17 4"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="2"
      />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="M10 3v14M3 10h14"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="2"
      />
    </IconFrame>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="M11 3h6v6M17 3l-8 8M16 11v6H3V4h6"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="2"
      />
    </IconFrame>
  );
}
