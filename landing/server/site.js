import { z } from 'zod';
export { siteDefaults, mergeSite, siteStyle } from '../src/siteCore.js';

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #087658.');
const line = (max = 200) => z.string().trim().max(max);
const image = z
  .string()
  .regex(/^\/(assets\/[\w.-]+|api\/assets\/[0-9a-f-]{36})$/, 'Choose an uploaded image.');
const feature = z.object({ title: line(80), text: line(240) });
const page = z.object({ title: line(80), intro: line(400), updated: line(40), body: line(20000) });

const contentSchema = () =>
  z.object({
    hero: z.object({
      title: line(120),
      tagline: line(120),
      description: line(400),
      cta: line(40),
      secondary: line(60),
    }),
    drivers: z.object({
      eyebrow: line(40),
      title: line(120),
      text: line(400),
      features: z.array(feature).length(6),
    }),
    garages: z.object({
      eyebrow: line(40),
      title: line(120),
      text: line(400),
      cta: line(40),
      caption: line(120),
      features: z.array(feature).length(6),
    }),
    product: z.object({ eyebrow: line(40), title: line(120), text: line(400) }),
    closing: z.object({
      eyebrow: line(40),
      title: line(120),
      text: line(400),
      cta: line(40),
      secondary: line(60),
    }),
    faq: z.array(z.object({ question: line(200), answer: line(2000) })).max(20),
    legal: z.object({ privacy: page, terms: page, contact: page }),
  });

export const siteSchema = z.object({
  translations: z.object({
    fi: z.object({
      content: contentSchema(),
      strings: z
        .record(z.string().max(400), z.string().trim().max(4000))
        .refine((strings) => Object.keys(strings).length <= 3000, 'Too many translations.'),
      glossary: z.array(z.object({ match: line(60), en: line(400), fi: line(400) })).max(40),
    }),
  }),
  theme: z.object({
    light: z.object({
      primary: colour,
      primaryDark: colour,
      ink: colour,
      muted: colour,
      line: colour,
      surface: colour,
      tint: colour,
    }),
    dark: z.object({
      primary: colour,
      ink: colour,
      muted: colour,
      line: colour,
      surface: colour,
      card: colour,
      tint: colour,
    }),
    radius: z.object({
      card: z.number().int().min(0).max(32),
      hero: z.number().int().min(0).max(48),
      button: z.number().int().min(0).max(999),
    }),
  }),
  motion: z.object({
    enabled: z.boolean(),
    speed: z.number().min(0.5).max(2),
    distance: z.number().int().min(0).max(24),
    pixelFill: z.boolean(),
    openingScreen: z.boolean(),
    scrollReveal: z.boolean(),
  }),
  features: z.object({
    darkMode: z.boolean(),
    notifications: z.boolean(),
    googleSignIn: z.boolean(),
    carPhotos: z.boolean(),
    reviews: z.boolean(),
  }),
  images: z.object({ hero: image, auth: image, drivers: image, garages: image, product: image }),
  content: contentSchema(),
});
