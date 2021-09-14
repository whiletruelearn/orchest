import { createCss } from "@stitches/react";
import { mixins } from "stitches-mixins";

const colors = {
  white: "#FFFFFF",
  black: "#000000",
  blue50: "#e0eeff",
  blue100: "#b0ccff",
  blue200: "#7faaff",
  blue300: "#4381ff",
  blue400: "#1e65fe",
  blue500: "#074ce5",
  blue600: "#003bb3",
  blue700: "#002a81",
  blue800: "#001950",
  blue900: "#000820",
  gray50: "#fafafa",
  gray100: "#f5f5f5",
  gray200: "#eeeeee",
  gray300: "#e0e0e0",
  gray400: "#bdbdbd",
  gray500: "#9e9e9e",
  gray600: "#757575",
  gray700: "#616161",
  gray800: "#424242",
  gray900: "#212121",
  green50: "#ECFDF5",
  green100: "#D1FAE5",
  green200: "#A7F3D0",
  green300: "#6EE7B7",
  green400: "#34D399",
  green500: "#10B981",
  green600: "#059669",
  green700: "#047857",
  green800: "#065F46",
  green900: "#064E3B",
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red200: "#FECACA",
  red300: "#FCA5A5",
  red400: "#F87171",
  red500: "#EF4444",
  red600: "#DC2626",
  red700: "#B91C1C",
  red800: "#991B1B",
  red900: "#7F1D1D",
  yellow50: "#FFFBEB",
  yellow100: "#FEF3C7",
  yellow200: "#FDE68A",
  yellow300: "#FCD34D",
  yellow400: "#FBBF24",
  yellow500: "#F59E0B",
  yellow600: "#D97706",
  yellow700: "#B45309",
  yellow800: "#92400E",
  yellow900: "#78350F",
};

export const stitches = createCss({
  theme: {
    colors: {
      ...colors,
      primary: colors.blue300,
      background: colors.white,
      text: colors.black,
      textSecondary: colors.gray800,
      logo: colors.black,
      success: colors.green500,
      warning: colors.yellow500,
      error: colors.red500,
      // components
      alertTextInfo: colors.black,
      alertTextWarning: colors.yellow900,
      alertTextSecondaryInfo: colors.gray700,
      alertTextSecondaryWarning: colors.yellow800,
      alertBackgroundInfo: colors.gray50,
      alertBackgroundWarning: colors.yellow50,
      link: "$primary",
      linkHover: colors.blue400,
      progressBarBackground: colors.gray300,
      progressBarIndicator: colors.black,
      skeleton: colors.gray300,
    },
    space: {
      0: 0,
      1: "0.25rem",
      2: "0.5rem",
      3: "0.75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      7: "1.75rem",
      8: "2rem",
      9: "2.25rem",
      10: "2.5rem",
      11: "2.75rem",
      12: "3rem",
    },
    sizes: {
      "3xs": "12rem",
      "2xs": "16rem",
      xs: "20rem",
      sm: "24rem",
      md: "28rem",
      "3xl": "48rem",
      "4xl": "56rem",
    },
    fonts: {
      inter:
        'Inter, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    },
    fontWeights: {
      normal: 400,
      bold: 500,
    },
    fontSizes: {
      base: "1rem",
      xxs: "0.625rem",
      xs: "0.75rem",
      sm: "0.875rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
    },
    lineHeights: {
      base: "1.5rem",
      xs: "1rem",
      sm: "1.25rem",
      lg: "1.75rem",
      xl: "1.75rem",
      "2xl": "2rem",
      "3xl": "2.25rem",
      "4xl": "2.5rem",
      "5xl": "1",
    },
    radii: {
      xs: "0.125rem",
      sm: "0.25rem",
      md: "0.375rem",
      rounded: "9999px",
    },
    shadows: {
      base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);",
      "2xl": "0 25px 50px -12px rgba(0,0,0,0.25)",
    },
  },
  media: {
    hoverSafe: "(hover: hover)",
    motionSafe: "(prefers-reduced-motion: no-preference)",
    sm: "(min-width: 640px)",
    md: "(min-width: 768px)",
    lg: "(min-width: 1024px)",
    xl: "(min-width: 1280px)",
    "2xl": "(min-width: 1536px)",
  },
  utils: {
    include: mixins(),
    inset:
      (config) =>
      (
        value:
          | keyof typeof config["theme"]["space"]
          | (string & {})
          | (number & {})
      ) => ({
        top: value,
        right: value,
        bottom: value,
        left: value,
      }),
  },
});

export const { styled, css, theme, getCssString, global, keyframes, config } =
  stitches;
