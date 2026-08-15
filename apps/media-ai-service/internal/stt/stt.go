// Package stt abstracts the speech-to-text backend behind a streaming interface
// so the LiveKit side of the service never depends on a specific vendor.
package stt

import (
	"context"
	"io"
)

// Result is a single transcription chunk. Interim results are published as live
// captions; final ones are additionally persisted through api-core.
type Result struct {
	Text       string
	StartMs    int
	EndMs      int
	Confidence float32
	Language   string
	IsFinal    bool
}

// Stream consumes Ogg/Opus audio from r until it is closed or ctx is cancelled,
// emitting results on the returned channel. The channel is closed on exit.
type Stream interface {
	Run(ctx context.Context, r io.Reader) (<-chan Result, error)
}

// Factory builds a fresh Stream per audio track.
type Factory func() Stream
