// Package livekitbot joins LiveKit rooms as a hidden participant, forwards every
// subscribed audio track to an STT stream and publishes captions back over the
// room data channel.
package livekitbot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"time"

	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media/oggwriter"

	"github.com/messenger/media-ai-service/internal/bus"
	"github.com/messenger/media-ai-service/internal/stt"
)

// CaptionTopic is the LiveKit data-channel topic the web client subscribes to.
const CaptionTopic = "captions"

// Caption is the JSON frame sent over the data channel for live subtitles.
type Caption struct {
	ParticipantID   string  `json:"participantId"`
	ParticipantName string  `json:"participantName"`
	Text            string  `json:"text"`
	StartMs         int     `json:"startMs"`
	EndMs           int     `json:"endMs"`
	IsFinal         bool    `json:"isFinal"`
	Language        string  `json:"language,omitempty"`
	Confidence      float32 `json:"confidence,omitempty"`
}

// Session is one bot attached to one LiveKit room.
type Session struct {
	roomName      string
	callSessionID string
	room          *lksdk.Room
	sttFactory    stt.Factory
	publisher     *bus.Bus

	cancel context.CancelFunc

	mu       sync.Mutex
	segments []bus.Segment
	wg       sync.WaitGroup
}

// Join connects the bot to a room using the short-lived token minted by api-core.
func Join(
	ctx context.Context,
	url, token, roomName, callSessionID string,
	factory stt.Factory,
	publisher *bus.Bus,
) (*Session, error) {
	ctx, cancel := context.WithCancel(ctx)

	s := &Session{
		roomName:      roomName,
		callSessionID: callSessionID,
		sttFactory:    factory,
		publisher:     publisher,
		cancel:        cancel,
	}

	room, err := lksdk.ConnectToRoomWithToken(url, token, &lksdk.RoomCallback{
		ParticipantCallback: lksdk.ParticipantCallback{
			OnTrackSubscribed: func(
				track *webrtc.TrackRemote,
				pub *lksdk.RemoteTrackPublication,
				rp *lksdk.RemoteParticipant,
			) {
				if track.Kind() != webrtc.RTPCodecTypeAudio {
					return
				}
				s.wg.Add(1)
				go func() {
					defer s.wg.Done()
					if err := s.handleAudioTrack(ctx, track, rp); err != nil && ctx.Err() == nil {
						slog.Error("audio track pipeline failed",
							"room", roomName, "participant", rp.Identity(), "err", err)
					}
				}()
			},
		},
		OnDisconnected: func() {
			slog.Info("bot disconnected", "room", roomName)
			cancel()
		},
	}, lksdk.WithAutoSubscribe(true))
	if err != nil {
		cancel()
		return nil, fmt.Errorf("connect to room %s: %w", roomName, err)
	}

	s.room = room
	slog.Info("bot joined room", "room", roomName, "identity", room.LocalParticipant.Identity())
	return s, nil
}

// handleAudioTrack repackages the incoming Opus RTP stream into an Ogg container
// (what STT vendors accept) and pumps it through the STT stream.
func (s *Session) handleAudioTrack(
	ctx context.Context,
	track *webrtc.TrackRemote,
	rp *lksdk.RemoteParticipant,
) error {
	pr, pw := io.Pipe()

	// The STT stream must be consuming `pr` before anything is written: io.Pipe is
	// unbuffered, and oggwriter emits its header the moment it is constructed —
	// building the writer first deadlocks the track goroutine on that first write.
	results, err := s.sttFactory().Run(ctx, pr)
	if err != nil {
		_ = pr.CloseWithError(err)
		_ = pw.CloseWithError(err)
		return fmt.Errorf("start stt stream: %w", err)
	}

	writer, err := oggwriter.NewWith(pw, 48000, track.Codec().Channels)
	if err != nil {
		_ = pw.CloseWithError(err)
		return fmt.Errorf("ogg writer: %w", err)
	}

	// RTP -> Ogg
	go func() {
		defer func() {
			_ = writer.Close()
			_ = pw.Close()
		}()
		for {
			if ctx.Err() != nil {
				return
			}
			packet, _, readErr := track.ReadRTP()
			if readErr != nil {
				if readErr != io.EOF && ctx.Err() == nil {
					slog.Warn("rtp read stopped", "participant", rp.Identity(), "err", readErr)
				}
				return
			}
			if writeErr := writer.WriteRTP(packet); writeErr != nil {
				slog.Warn("ogg write failed", "err", writeErr)
				return
			}
		}
	}()

	for res := range results {
		s.emitCaption(rp, res)
		if res.IsFinal {
			s.appendSegment(rp, res)
		}
	}
	return nil
}

// emitCaption pushes the caption over the LiveKit data channel. Interim results
// go out lossy (they are superseded within milliseconds), finals go reliable.
func (s *Session) emitCaption(rp *lksdk.RemoteParticipant, res stt.Result) {
	payload, err := json.Marshal(Caption{
		ParticipantID:   rp.Identity(),
		ParticipantName: rp.Name(),
		Text:            res.Text,
		StartMs:         res.StartMs,
		EndMs:           res.EndMs,
		IsFinal:         res.IsFinal,
		Language:        res.Language,
		Confidence:      res.Confidence,
	})
	if err != nil {
		slog.Error("marshal caption", "err", err)
		return
	}

	opts := []lksdk.DataPublishOption{lksdk.WithDataPublishTopic(CaptionTopic)}
	if !res.IsFinal {
		opts = append(opts, lksdk.WithDataPublishReliable(false))
	}
	if err := s.room.LocalParticipant.PublishDataPacket(lksdk.UserData(payload), opts...); err != nil {
		slog.Error("publish caption", "err", err)
		return
	}
	slog.Debug("caption published", "participant", rp.Identity(), "final", res.IsFinal, "text", res.Text)
}

func (s *Session) appendSegment(rp *lksdk.RemoteParticipant, res stt.Result) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.segments = append(s.segments, bus.Segment{
		SpeakerIdentity: rp.Identity(),
		SpeakerName:     rp.Name(),
		Text:            res.Text,
		StartMs:         res.StartMs,
		EndMs:           res.EndMs,
		Confidence:      res.Confidence,
		Language:        res.Language,
	})
}

// Leave disconnects the bot and hands the accumulated transcript to api-core.
func (s *Session) Leave(ctx context.Context) {
	s.cancel()
	if s.room != nil {
		s.room.Disconnect()
	}

	// Give the per-track goroutines a moment to flush their final results.
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		slog.Warn("timed out waiting for stt streams to drain", "room", s.roomName)
	}

	s.mu.Lock()
	segments := s.segments
	s.segments = nil
	s.mu.Unlock()

	payload := bus.TranscriptPayload{
		RoomName:      s.roomName,
		CallSessionID: s.callSessionID,
		Segments:      segments,
		Final:         true,
	}
	if err := s.publisher.PublishTranscript(ctx, payload); err != nil {
		slog.Error("publish final transcript", "room", s.roomName, "err", err)
		return
	}
	slog.Info("final transcript published", "room", s.roomName, "segments", len(segments))
}
