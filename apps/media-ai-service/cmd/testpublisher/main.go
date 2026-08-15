// Command testpublisher joins a room and publishes a synthetic Opus track. It
// exists to exercise the transcription pipeline (track subscribe -> Ogg -> STT ->
// data channel) on machines with no microphone.
//
//	LIVEKIT_URL=ws://localhost:7880 ROOM_TOKEN=<jwt> go run ./cmd/testpublisher
package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

// Minimal valid Opus frame (silence), 20 ms at 48 kHz.
var silenceFrame = []byte{0xf8, 0xff, 0xfe}

func main() {
	url := os.Getenv("LIVEKIT_URL")
	token := os.Getenv("ROOM_TOKEN")
	if url == "" || token == "" {
		slog.Error("LIVEKIT_URL and ROOM_TOKEN are required")
		os.Exit(1)
	}

	room, err := lksdk.ConnectToRoomWithToken(url, token, &lksdk.RoomCallback{})
	if err != nil {
		slog.Error("connect failed", "err", err)
		os.Exit(1)
	}
	defer room.Disconnect()

	track, err := lksdk.NewLocalSampleTrack(webrtc.RTPCodecCapability{
		MimeType:  webrtc.MimeTypeOpus,
		ClockRate: 48000,
		Channels:  2,
	})
	if err != nil {
		slog.Error("create track failed", "err", err)
		os.Exit(1)
	}

	if _, err = room.LocalParticipant.PublishTrack(track, &lksdk.TrackPublicationOptions{
		Name:   "synthetic-audio",
		Source: livekit.TrackSource_MICROPHONE,
	}); err != nil {
		slog.Error("publish failed", "err", err)
		os.Exit(1)
	}

	slog.Info("publishing synthetic audio", "room", room.Name())

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			slog.Info("stopping publisher")
			return
		case <-ticker.C:
			if err := track.WriteSample(media.Sample{
				Data:     silenceFrame,
				Duration: 20 * time.Millisecond,
			}, nil); err != nil {
				slog.Error("write sample failed", "err", err)
				return
			}
		}
	}
}
