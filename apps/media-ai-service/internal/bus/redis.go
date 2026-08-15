// Package bus carries control commands and finished transcripts between
// api-core (Nest.js) and this service over Redis Pub/Sub.
package bus

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/redis/go-redis/v9"
)

// ControlCommand is published by api-core on `media:control`.
type ControlCommand struct {
	Action        string `json:"action"` // start_transcription | stop_transcription
	RoomName      string `json:"roomName"`
	CallSessionID string `json:"callSessionId"`
	BotToken      string `json:"botToken"`
}

// Segment mirrors one row of the transcript_segments table.
type Segment struct {
	SpeakerIdentity string  `json:"speakerIdentity"`
	SpeakerName     string  `json:"speakerName"`
	Text            string  `json:"text"`
	StartMs         int     `json:"startMs"`
	EndMs           int     `json:"endMs"`
	Confidence      float32 `json:"confidence,omitempty"`
	Language        string  `json:"language,omitempty"`
}

// TranscriptPayload is published on `transcripts:final` for persistence.
type TranscriptPayload struct {
	RoomName      string    `json:"roomName"`
	CallSessionID string    `json:"callSessionId,omitempty"`
	Segments      []Segment `json:"segments"`
	Summary       string    `json:"summary,omitempty"`
	Final         bool      `json:"final"`
}

type Bus struct {
	client       *redis.Client
	finalChannel string
}

func New(redisURL, finalChannel string) (*Bus, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	return &Bus{client: redis.NewClient(opts), finalChannel: finalChannel}, nil
}

func (b *Bus) Close() error { return b.client.Close() }

// Subscribe streams control commands until ctx is cancelled.
func (b *Bus) Subscribe(ctx context.Context, channel string, handler func(ControlCommand)) error {
	sub := b.client.Subscribe(ctx, channel)
	if _, err := sub.Receive(ctx); err != nil {
		return fmt.Errorf("subscribe %s: %w", channel, err)
	}
	defer sub.Close()

	slog.Info("listening for control commands", "channel", channel)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg, ok := <-sub.Channel():
			if !ok {
				return nil
			}
			var cmd ControlCommand
			if err := json.Unmarshal([]byte(msg.Payload), &cmd); err != nil {
				slog.Warn("dropping malformed control command", "err", err)
				continue
			}
			handler(cmd)
		}
	}
}

func (b *Bus) PublishTranscript(ctx context.Context, payload TranscriptPayload) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return b.client.Publish(ctx, b.finalChannel, raw).Err()
}
