/**
 * Copyright 2026 Google LLC
 * Ambient declarations for hermetic test compilation.
 */

declare namespace JSX {
  interface Element {
    $$typeof: symbol;
    type: any;
    props: any;
    key: any;
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface IntrinsicAttributes {
    key?: any;
    children?: any;
    [prop: string]: any;
  }
}

declare namespace React {
  type ReactNode = any;
  type FC<P = any> = (props: P) => any;
  type ChangeEvent<T = any> = any;
  type MouseEvent<T = any> = any;
  type FormEvent<T = any> = any;
  type KeyboardEvent<T = any> = any;
  type ComponentType<P = any> = any;
  type ReactElement = any;
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  interface HTMLAttributes<T = any> {
    className?: string;
    style?: any;
    id?: string;
    onClick?: any;
    children?: any;
    [key: string]: any;
  }
}

declare module 'react' {
  export = React;
  export function useState<T>(initial?: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void];
  export function useEffect(callback: () => void | (() => void), deps?: any[]): void;
  export function useLayoutEffect(callback: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends Function>(callback: T, deps?: any[]): T;
  export function useRef<T>(initial?: T): { current: T };
  export function useContext<T>(context: any): T;
  export function createContext<T>(defaultValue: T): any;
  export const Fragment: any;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export function forwardRef<T, P = any>(render: (props: P, ref: any) => any): any;
  export function memo<T>(component: T): T;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'lucide-react' {
  export const Activity: any;
  export const AlertCircle: any;
  export const AlertTriangle: any;
  export const ArrowDown: any;
  export const ArrowLeft: any;
  export const ArrowRight: any;
  export const ArrowRightLeft: any;
  export const ArrowUp: any;
  export const ArrowUpDown: any;
  export const ArrowUpRight: any;
  export const BarChart2: any;
  export const BookOpen: any;
  export const Brain: any;
  export const Calendar: any;
  export const Check: any;
  export const CheckCircle2: any;
  export const ChevronDown: any;
  export const ChevronLeft: any;
  export const ChevronRight: any;
  export const ChevronUp: any;
  export const Clock: any;
  export const Compass: any;
  export const Crown: any;
  export const Droplet: any;
  export const ExternalLink: any;
  export const Eye: any;
  export const Flame: any;
  export const Globe: any;
  export const Hash: any;
  export const HelpCircle: any;
  export const Info: any;
  export const Layers: any;
  export const LayoutGrid: any;
  export const MapPin: any;
  export const Moon: any;
  export const Mountain: any;
  export const Orbit: any;
  export const RefreshCw: any;
  export const Scale: any;
  export const Search: any;
  export const Settings: any;
  export const Shield: any;
  export const SlidersHorizontal: any;
  export const Sparkles: any;
  export const Star: any;
  export const Sun: any;
  export const Swords: any;
  export const TrendingDown: any;
  export const TrendingUp: any;
  export const Trophy: any;
  export const User: any;
  export const Users: any;
  export const Wind: any;
  export const X: any;
  export const Zap: any;
  export const ZapOff: any;
  const icons: Record<string, any>;
  export default icons;
}

declare module 'clsx' {
  export function clsx(...args: any[]): string;
  export default clsx;
}

declare module 'tailwind-merge' {
  export function twMerge(...args: any[]): string;
}

declare namespace NodeJS {
  type Timeout = any;
}
