package stt

import (
	"context"
	"fmt"
	"io"
	"time"
)

// MockStream drains the audio and emits synthetic captions on a timer. It keeps
// the whole pipeline runnable without an STT vendor account.
type MockStream struct {
	Interval time.Duration
}

func NewMock() Stream {
	return &MockStream{Interval: 3 * time.Second}
}

func (m *MockStream) Run(ctx context.Context, r io.Reader) (<-chan Result, error) {
	out := make(chan Result, 8)

	// The reader must still be drained, otherwise the RTP writer blocks.
	go func() {
		_, _ = io.Copy(io.Discard, r)
	}()

	go func() {
		defer close(out)
		ticker := time.NewTicker(m.Interval)
		defer ticker.Stop()

		start := time.Now()
		n := 0
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				n++
				elapsed := time.Since(start)
				out <- Result{
					Text:       fmt.Sprintf("[mock stt] розпізнаний фрагмент #%d", n),
					StartMs:    int((elapsed - m.Interval).Milliseconds()),
					EndMs:      int(elapsed.Milliseconds()),
					Confidence: 0.9,
					Language:   "uk",
					IsFinal:    true,
				}
			}
		}
	}()

	return out, nil
}
