import { Facebook, Globe, Instagram, Music2, Youtube, type LucideIcon } from "lucide-react";

/** A storefront social platform. `key` is the editor/payload field (lowercase);
 * `code` is the backend enum value returned in the `socials` map (uppercase). */
export interface SocialDef {
  key: "instagram" | "tiktok" | "facebook" | "youtube" | "website";
  code: string;
  label: string;
  icon: LucideIcon;
  placeholder: string;
}

export const SOCIALS: SocialDef[] = [
  { key: "instagram", code: "INSTAGRAM", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourbrand" },
  { key: "tiktok", code: "TIKTOK", label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@yourbrand" },
  { key: "facebook", code: "FACEBOOK", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourbrand" },
  { key: "youtube", code: "YOUTUBE", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@yourbrand" },
  { key: "website", code: "WEBSITE", label: "Website", icon: Globe, placeholder: "https://yourbrand.com" },
];
