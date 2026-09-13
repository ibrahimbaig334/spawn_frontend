import type { SVGProps } from "react";
import type { TokenSocials } from "@/lib/api/dto";

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

export function GlobeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M2.5 10h15M10 2.5c2 2.2 3 4.8 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.8-3-7.5s1-5.3 3-7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </IconFrame>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="M3 3l14 14M17 3L3 17"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="2.4"
      />
    </IconFrame>
  );
}

export function TelegramIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="M17 3.5 2.8 9.3l4.6 1.6L9 16l2.6-3.4 3.4 2.6L17 3.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </IconFrame>
  );
}

export function DiscordIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path
        d="M6 4.5C8 3.5 12 3.5 14 4.5c2 2 3 4.5 3 7.5-1.3 1.7-3 2.6-5 3l-.7-1.8m-4.6 0L6 15c-2-.4-3.7-1.3-5-3 0-3 1-5.5 3-7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <circle cx="7.2" cy="11" r="1.1" fill="currentColor" />
      <circle cx="12.8" cy="11" r="1.1" fill="currentColor" />
    </IconFrame>
  );
}

export interface SocialLink {
  key: keyof TokenSocials;
  label: string;
  href: string;
}

/** Normalized, safe hrefs for a launch's socials (http(s) only). */
export function socialLinks(
  socials: TokenSocials | undefined,
): SocialLink[] {
  if (!socials) return [];
  const entries: Array<[SocialLink["key"], string]> = [
    ["website", socials.website ?? ""],
    ["x", socials.x ?? ""],
    ["telegram", socials.telegram ?? ""],
    ["discord", socials.discord ?? ""],
  ];
  return entries.flatMap(([key, value]) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const href = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return [{ key, label: key === "x" ? "X" : key[0]!.toUpperCase() + key.slice(1), href }];
  });
}

export const SOCIAL_META: Record<
  SocialLink["key"],
  { label: string; placeholder: string; icon: typeof GlobeIcon }
> = {
  website: {
    label: "Website",
    placeholder: "https://yoursite.io",
    icon: GlobeIcon,
  },
  x: { label: "X (Twitter)", placeholder: "https://x.com/handle", icon: XIcon },
  telegram: {
    label: "Telegram",
    placeholder: "https://t.me/group",
    icon: TelegramIcon,
  },
  discord: {
    label: "Discord",
    placeholder: "https://discord.gg/invite",
    icon: DiscordIcon,
  },
};
