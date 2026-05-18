import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE_URL = "https://caen.tech";

type OpenFeedbackSession = {
  speakers: string[];
  tags: string[];
  title: string;
  id: string;
  startTime: string;
  endTime: string;
  trackTitle: string;
  hideInFeedback?: boolean;
};

type OpenFeedbackSpeaker = {
  name: string;
  photoUrl?: string;
  socials: { name: string; link: string }[];
  id: string;
};

export const GET: APIRoute = async () => {
  const [allProgram, allSpeakers, allRooms] = await Promise.all([
    getCollection("program"),
    getCollection("speakers"),
    getCollection("rooms"),
  ]);

  const roomById = new Map(allRooms.map((r) => [r.data.id, r.data]));

  const sessions: Record<string, OpenFeedbackSession> = {};
  for (const item of allProgram) {
    const s = item.data;
    const trackTitle = roomById.get(s.roomId)?.name ?? "Espace Experiment";
    const hasSpeakers = s.speakerIds.length > 0;
    const session: OpenFeedbackSession = {
      speakers: s.speakerIds,
      tags: s.theme ? [s.theme] : [],
      title: s.title,
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      trackTitle,
    };
    if (!hasSpeakers) {
      session.hideInFeedback = true;
    }
    sessions[s.id] = session;
  }

  const speakers: Record<string, OpenFeedbackSpeaker> = {};
  for (const item of allSpeakers) {
    const sp = item.data;
    const speaker: OpenFeedbackSpeaker = {
      name: sp.name,
      socials: [],
      id: sp.id,
    };
    if (sp.photo) {
      speaker.photoUrl = sp.photo.startsWith("http")
        ? sp.photo
        : `${SITE_URL}${sp.photo}`;
    }
    speakers[sp.id] = speaker;
  }

  return new Response(JSON.stringify({ sessions, speakers }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
