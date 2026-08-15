package stt

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

const deepgramHost = "wss://api.deepgram.com/v1/listen"

// DeepgramStream streams Ogg/Opus straight to Deepgram's realtime endpoint.
// Deepgram sniffs the container, so no explicit encoding parameters are needed.
type DeepgramStream struct {
	APIKey   string
	Model    string
	Language string
}

func NewDeepgram(apiKey, model, language string) Stream {
	return &DeepgramStream{APIKey: apiKey, Model: model, Language: language}
}

type deepgramResponse struct {
	Type     string  `json:"type"`
	Start    float64 `json:"start"`
	Duration float64 `json:"duration"`
	IsFinal  bool    `json:"is_final"`
	Channel  struct {
		Alternatives []struct {
			Transcript string  `json:"transcript"`
			Confidence float32 `json:"confidence"`
		} `json:"alternatives"`
	} `json:"channel"`
}

func (d *DeepgramStream) Run(ctx context.Context, r io.Reader) (<-chan Result, error) {
	endpoint, err := url.Parse(deepgramHost)
	if err != nil {
		return nil, err
	}
	q := endpoint.Query()
	q.Set("model", d.Model)
	q.Set("language", d.Language)
	q.Set("interim_results", "true")
	q.Set("punctuate", "true")
	q.Set("smart_format", "true")
	endpoint.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, endpoint.String(), http.Header{
		"Authorization": []string{"Token " + d.APIKey},
	})
	if err != nil {
		return nil, fmt.Errorf("deepgram dial: %w", err)
	}

	out := make(chan Result, 32)

	// uplink: audio -> Deepgram
	go func() {
		defer func() {
			// CloseStream tells Deepgram to flush its final transcript.
			_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"CloseStream"}`))
		}()

		buf := make([]byte, 8192)
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			n, err := r.Read(buf)
			if n > 0 {
				if werr := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); werr != nil {
					slog.Error("deepgram write failed", "err", werr)
					return
				}
			}
			if err != nil {
				if err != io.EOF {
					slog.Error("audio read failed", "err", err)
				}
				return
			}
		}
	}()

	// keepalive: Deepgram drops idle sockets after ~10s of silence.
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"KeepAlive"}`))
			}
		}
	}()

	// downlink: Deepgram -> results
	go func() {
		defer close(out)
		defer conn.Close()

		for {
			_, payload, err := conn.ReadMessage()
			if err != nil {
				if ctx.Err() == nil {
					slog.Error("deepgram read failed", "err", err)
				}
				return
			}

			var resp deepgramResponse
			if err := json.Unmarshal(payload, &resp); err != nil {
				continue
			}
			if len(resp.Channel.Alternatives) == 0 {
				continue
			}
			alt := resp.Channel.Alternatives[0]
			if alt.Transcript == "" {
				continue
			}

			select {
			case out <- Result{
				Text:       alt.Transcript,
				StartMs:    int(resp.Start * 1000),
				EndMs:      int((resp.Start + resp.Duration) * 1000),
				Confidence: alt.Confidence,
				Language:   d.Language,
				IsFinal:    resp.IsFinal,
			}:
			case <-ctx.Done():
				return
			}
		}
	}()

	return out, nil
}
