// Command bot runs the media/AI microservice: it waits for control commands from
// api-core and attaches a hidden LiveKit participant that transcribes the call.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/messenger/media-ai-service/internal/bus"
	"github.com/messenger/media-ai-service/internal/config"
	"github.com/messenger/media-ai-service/internal/livekitbot"
	"github.com/messenger/media-ai-service/internal/stt"
)

func main() {
	level := slog.LevelInfo
	if os.Getenv("LOG_LEVEL") == "debug" {
		level = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "err", err)
		os.Exit(1)
	}

	publisher, err := bus.New(cfg.RedisURL, cfg.FinalChannel)
	if err != nil {
		slog.Error("redis connection failed", "err", err)
		os.Exit(1)
	}
	defer publisher.Close()

	manager := livekitbot.NewManager(cfg.LiveKitURL, sttFactory(cfg), publisher)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("media-ai-service started", "stt", cfg.STTProvider, "livekit", cfg.LiveKitURL)

	err = publisher.Subscribe(ctx, cfg.ControlChannel, func(cmd bus.ControlCommand) {
		manager.Handle(ctx, cmd)
	})

	// Sessions are drained with a fresh context: ctx is already cancelled here,
	// but the final transcripts still have to reach Redis.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	manager.Shutdown(shutdownCtx)

	if err != nil && ctx.Err() == nil {
		slog.Error("control loop failed", "err", err)
		os.Exit(1)
	}
	slog.Info("media-ai-service stopped")
}

func sttFactory(cfg *config.Config) stt.Factory {
	switch cfg.STTProvider {
	case "deepgram":
		return func() stt.Stream {
			return stt.NewDeepgram(cfg.DeepgramAPIKey, cfg.DeepgramModel, cfg.DeepgramLang)
		}
	default:
		return stt.NewMock
	}
}
