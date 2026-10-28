/**
 * Design system Artemis — componentes de interface.
 * Importe daqui: import { Button, Card, Field } from "@/components/ui";
 * Documentação: docs/02-design-system.md · Guia vivo: /design-system
 *
 * Componentes marcados como (cliente) usam "use client"; os demais funcionam em Server Components.
 */

export { Alert, type AlertProps, type AlertVariant } from "./alert";
export {
  Avatar,
  AvatarGroup,
  avatarTone,
  type AvatarProps,
  type AvatarGroupProps,
  type AvatarSize,
} from "./avatar";
export { Badge, badgeVariants, type BadgeProps, type BadgeVariant } from "./badge";
export {
  Button,
  ButtonLink,
  buttonVariants,
  type ButtonProps,
  type ButtonLinkProps,
  type ButtonSize,
  type ButtonVariant,
} from "./button";
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardLink,
  CardTitle,
  cardVariants,
  type CardProps,
} from "./card";
export {
  CategoryIcon,
  CATEGORY_ICONS,
  getCategoryIcon,
  type CategoryIconProps,
} from "./category-icon";
export { Checkbox, type CheckboxProps } from "./checkbox";
export {
  Chip,
  ChipLink,
  ChipToggle,
  chipVariants,
  type ChipProps,
  type ChipLinkProps,
  type ChipToggleProps,
} from "./chip";
export { ChipGroup, type ChipGroupProps, type ChipGroupOption } from "./chip-group"; // (cliente)
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmResult } from "./confirm-dialog"; // (cliente)
export { ConstellationPattern, type ConstellationPatternProps } from "./constellation-pattern";
export { Container, Section, type ContainerProps, type SectionProps } from "./container";
export { Dialog, type DialogProps } from "./dialog"; // (cliente)
export { DropdownMenu, type DropdownItem, type DropdownMenuProps } from "./dropdown-menu"; // (cliente)
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { Field, type FieldError, type FieldProps } from "./field";
export { FormMessage, type FormMessageProps, type FormMessageTone } from "./form-message";
export { Input, controlClasses, type InputProps } from "./input";
export { KeywordInput, type KeywordInputProps } from "./keyword-input"; // (cliente)
export { Kbd } from "./kbd";
export { Label, type LabelProps } from "./label";
export { Logo, LogoMark, LOGO_PATHS, type LogoProps, type LogoMarkProps } from "./logo";
export { Markdown, type MarkdownProps } from "./markdown";
export {
  ProgressMeter,
  ScoreMeter,
  scoreLabel,
  type ProgressMeterProps,
  type ScoreMeterProps,
} from "./meter";
export { PageHeader, type PageHeaderProps } from "./page-header";
export { Pagination, pageWindow, type PaginationProps } from "./pagination";
export {
  Radio,
  RadioGroup,
  type RadioProps,
  type RadioGroupProps,
  type RadioGroupOption,
} from "./radio";
export { Select, type SelectProps, type SelectOption } from "./select";
export { Separator, type SeparatorProps } from "./separator";
export { Skeleton, SkeletonCard, SkeletonText } from "./skeleton";
export { Spinner, type SpinnerProps } from "./spinner";
export { Stat, StatGroup, type StatProps } from "./stat";
export { Steps, type StepItem, type StepsProps } from "./steps";
export { SubmitButton, type SubmitButtonProps } from "./submit-button"; // (cliente)
export { Switch, type SwitchProps } from "./switch";
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableCaptionProps,
  type TableHeadProps,
  type TableProps,
} from "./table";
export { TabNav, type TabNavItem, type TabNavProps } from "./tab-nav";
export { Tabs, type TabItem, type TabsProps } from "./tabs"; // (cliente)
export { Textarea, type TextareaProps } from "./textarea"; // (cliente)
export { Tooltip, type TooltipProps } from "./tooltip";
export { VisuallyHidden } from "./visually-hidden";
export { VoteButton, type VoteButtonProps } from "./vote-button";
