export type TourId = "buyer" | "seller" | "admin";

export type TooltipPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  target?: string;
  title: string;
  content: string;
  preferredPlacement?: TooltipPlacement;
  iconName?: string;
}

export interface TourConfig {
  id: TourId;
  name: string;
  badge: string;
  steps: TourStep[];
}
