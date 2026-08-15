package livekitbot

import (
	"context"
	"log/slog"
	"sync"

	"github.com/messenger/media-ai-service/internal/bus"
	"github.com/messenger/media-ai-service/internal/stt"
)

// Manager keeps one Session per LiveKit room and reacts to control commands.
type Manager struct {
	livekitURL string
	factory    stt.Factory
	publisher  *bus.Bus

	mu       sync.Mutex
	sessions map[string]*Session
}

func NewManager(livekitURL string, factory stt.Factory, publisher *bus.Bus) *Manager {
	return &Manager{
		livekitURL: livekitURL,
		factory:    factory,
		publisher:  publisher,
		sessions:   make(map[string]*Session),
	}
}

func (m *Manager) Handle(ctx context.Context, cmd bus.ControlCommand) {
	switch cmd.Action {
	case "start_transcription":
		m.start(ctx, cmd)
	case "stop_transcription":
		m.stop(ctx, cmd.RoomName)
	default:
		slog.Warn("unknown control action", "action", cmd.Action)
	}
}

func (m *Manager) start(ctx context.Context, cmd bus.ControlCommand) {
	m.mu.Lock()
	if _, exists := m.sessions[cmd.RoomName]; exists {
		m.mu.Unlock()
		slog.Debug("bot already attached", "room", cmd.RoomName)
		return
	}
	// Reserve the slot before the (slow) connect so concurrent commands cannot
	// spawn two bots for the same room.
	m.sessions[cmd.RoomName] = nil
	m.mu.Unlock()

	session, err := Join(ctx, m.livekitURL, cmd.BotToken, cmd.RoomName, cmd.CallSessionID, m.factory, m.publisher)
	if err != nil {
		m.mu.Lock()
		delete(m.sessions, cmd.RoomName)
		m.mu.Unlock()
		slog.Error("failed to attach bot", "room", cmd.RoomName, "err", err)
		return
	}

	m.mu.Lock()
	m.sessions[cmd.RoomName] = session
	m.mu.Unlock()
}

func (m *Manager) stop(ctx context.Context, roomName string) {
	m.mu.Lock()
	session := m.sessions[roomName]
	delete(m.sessions, roomName)
	m.mu.Unlock()

	if session == nil {
		return
	}
	session.Leave(ctx)
}

// Shutdown drains every active session; used on SIGTERM.
func (m *Manager) Shutdown(ctx context.Context) {
	m.mu.Lock()
	sessions := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		if s != nil {
			sessions = append(sessions, s)
		}
	}
	m.sessions = make(map[string]*Session)
	m.mu.Unlock()

	var wg sync.WaitGroup
	for _, s := range sessions {
		wg.Add(1)
		go func(s *Session) {
			defer wg.Done()
			s.Leave(ctx)
		}(s)
	}
	wg.Wait()
}
