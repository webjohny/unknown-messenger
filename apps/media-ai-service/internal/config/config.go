package config

import (
	"fmt"
	"os"
)

// Config is populated entirely from the environment; no secret is ever hardcoded.
type Config struct {
	LiveKitURL     string
	LiveKitAPIKey  string
	LiveKitSecret  string
	BotIdentity    string
	RedisURL       string
	ControlChannel string
	FinalChannel   string

	STTProvider    string
	DeepgramAPIKey string
	DeepgramModel  string
	DeepgramLang   string
}

func Load() (*Config, error) {
	cfg := &Config{
		LiveKitURL:     env("LIVEKIT_URL", "ws://localhost:7880"),
		LiveKitAPIKey:  os.Getenv("LIVEKIT_API_KEY"),
		LiveKitSecret:  os.Getenv("LIVEKIT_API_SECRET"),
		BotIdentity:    env("BOT_IDENTITY", "silent-bot"),
		RedisURL:       env("REDIS_URL", "redis://localhost:6379"),
		ControlChannel: env("REDIS_CONTROL_CHANNEL", "media:control"),
		FinalChannel:   env("REDIS_TRANSCRIPT_CHANNEL", "transcripts:final"),
		STTProvider:    env("STT_PROVIDER", "mock"),
		DeepgramAPIKey: os.Getenv("DEEPGRAM_API_KEY"),
		DeepgramModel:  env("DEEPGRAM_MODEL", "nova-2"),
		DeepgramLang:   env("DEEPGRAM_LANGUAGE", "uk"),
	}

	if cfg.LiveKitAPIKey == "" || cfg.LiveKitSecret == "" {
		return nil, fmt.Errorf("LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required")
	}
	if cfg.STTProvider == "deepgram" && cfg.DeepgramAPIKey == "" {
		return nil, fmt.Errorf("DEEPGRAM_API_KEY is required when STT_PROVIDER=deepgram")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
