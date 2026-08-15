'use client';

import { useDataChannel } from '@livekit/components-react';
import { useEffect, useState } from 'react';

import type { Caption } from '@/lib/types';

const CAPTION_TOPIC = 'captions';
const MAX_HISTORY = 50;
const INTERIM_TTL_MS = 4000;

export interface CaptionLine extends Caption {
  key: string;
  receivedAt: number;
}

/**
 * Live subtitles delivered over the LiveKit data channel by media-ai-service.
 * Interim results for a speaker are replaced in place; only finals accumulate.
 */
export function useCaptions(): { lines: CaptionLine[]; interim: Record<string, CaptionLine> } {
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [interim, setInterim] = useState<Record<string, CaptionLine>>({});

  const { message } = useDataChannel(CAPTION_TOPIC);

  useEffect(() => {
    if (!message) return;

    let caption: Caption;
    try {
      caption = JSON.parse(new TextDecoder().decode(message.payload)) as Caption;
    } catch {
      return;
    }

    const line: CaptionLine = {
      ...caption,
      key: `${caption.participantId}:${caption.startMs}`,
      receivedAt: Date.now(),
    };

    if (caption.isFinal) {
      setLines((prev) => [...prev, line].slice(-MAX_HISTORY));
      setInterim((prev) => {
        const next = { ...prev };
        delete next[caption.participantId];
        return next;
      });
    } else {
      setInterim((prev) => ({ ...prev, [caption.participantId]: line }));
    }
  }, [message]);

  // Drop interim text that was never finalised (speaker dropped mid-sentence).
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - INTERIM_TTL_MS;
      setInterim((prev) => {
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, line]) => line.receivedAt > cutoff),
        );
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return { lines, interim };
}
