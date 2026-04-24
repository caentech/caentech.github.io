import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { file } from "astro/loaders";

const site = defineCollection({
  loader: file("src/data/site.json"),
  schema: z.object({
    id: z.string(),
    eventDate: z.string(),
    venue: z.object({
      name: z.string(),
      address: z.string(),
      city: z.string(),
      postalCode: z.string(),
    }),
    socialLinks: z.object({
      linkedin: z.string().url(),
      discord: z.string().url(),
      whatsapp: z.string().url(),
    }),
    billetterieUrl: z.string().url(),
    email: z.string().email(),
  }),
});

const speakers = defineCollection({
  loader: file("src/data/speakers.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    company: z.string(),
    bio: z.string(),
    photo: z.string().optional(),
    featured: z.boolean().optional(),
  }),
});

const program = defineCollection({
  loader: file("src/data/program.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    speakerIds: z.array(z.string()),
    startTime: z.string(),
    endTime: z.string(),
    roomId: z.string(),
    theme: z.string(),
    level: z.enum(["débutant", "intermédiaire", "avancé"]),
    type: z.enum(["conférence", "atelier"]),
    featured: z.boolean().optional(),
  }),
});

const rooms = defineCollection({
  loader: file("src/data/rooms.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    seats: z.number(),
    color: z.string(),
    order: z.number(),
  }),
});

const sponsors = defineCollection({
  loader: file("src/data/sponsors.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string(),
    url: z.string().url(),
    tier: z.enum(["gold", "silver", "bronze"]),
    bgColor: z.string().optional(),
  }),
});

const partners = defineCollection({
  loader: file("src/data/partners.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string(),
    url: z.string().url(),
    description: z.string(),
  }),
});

const team = defineCollection({
  loader: file("src/data/team.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    photo: z.string().optional(),
    contact: z.string().optional(),
    volunteer: z.boolean(),
  }),
});

const podcasts = defineCollection({
  loader: file("src/data/podcasts.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    image: z.string(),
    summary: z.string(),
    links: z.record(z.string(), z.string().url()),
  }),
});

const faq = defineCollection({
  loader: file("src/data/faq.json"),
  schema: z.object({
    id: z.string(),
    question: z.string(),
    answer: z.string(),
  }),
});

export const collections = {
  site,
  speakers,
  program,
  rooms,
  sponsors,
  partners,
  team,
  podcasts,
  faq,
};
