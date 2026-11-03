
type BannerVariant = "info" | "warning" | "error";

type ButtonSize = "default" | "small";

type ButtonVariant = "primary" | "secondary" | "tertiary";


type IconProp = {
  path: string;
  position?: "after" | "before";
  size?: IconSize;
};

type IconSize = "small" | "default" | "large";

type NavListProp = NavListItem[];

type NavListItem = {
  /** An icon, for where the list shows them (the phone's bar). */
  icon?: string;
  title: string;
  link: string;
};

  label?: string;
  value: string;
};

type TextboxTypes =
  | "email"
  | "hidden"
  | "multiline"
  | "number"
  | "password"
  | "search"
  | "tel"
  | "text"
  | "url";

type TooltipType = "error" | "info" | "success" | "warning";

type ToastItem = {
  icon?: string;
  id: string;
  message: string;
  type: TooltipType;
};
