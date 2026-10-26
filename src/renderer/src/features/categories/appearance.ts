import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleEllipsis,
  Coffee,
  Coins,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Laptop,
  Music,
  PawPrint,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Tag,
  Ticket,
  TrendingUp,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon
} from 'lucide-react'
import type { CategoryColor, CategoryIcon } from '@shared/categories'

export const categoryIconComponents: Record<CategoryIcon, LucideIcon> = {
  briefcase: Briefcase,
  banknote: Banknote,
  coins: Coins,
  'hand-coins': HandCoins,
  'trending-up': TrendingUp,
  gift: Gift,
  'shopping-cart': ShoppingCart,
  house: House,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  utensils: Utensils,
  coffee: Coffee,
  'heart-pulse': HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  scissors: Scissors,
  sofa: Sofa,
  film: Film,
  music: Music,
  'gamepad-2': Gamepad2,
  ticket: Ticket,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  laptop: Laptop,
  baby: Baby,
  'paw-print': PawPrint,
  wrench: Wrench,
  receipt: Receipt,
  repeat: Repeat,
  sparkles: Sparkles,
  tag: Tag,
  'circle-ellipsis': CircleEllipsis
}

/** "shopping-cart" → "Shopping cart", for screen readers. */
export function iconLabel(icon: CategoryIcon): string {
  const words = icon.replace(/-\d+$/, '').replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function colorLabel(color: CategoryColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

/** Sets `--cat` to the category colour, for `text-(color:--cat)` / `bg-(color:--cat)/15`. */
export function categoryColorStyle(color: CategoryColor): React.CSSProperties {
  return { '--cat': `var(--cat-${color})` } as React.CSSProperties
}
