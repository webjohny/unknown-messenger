'use client';

import { useIdentityController, useRoomController } from '@/core';

import { CallStage } from './CallStage';
import { IconBack, IconCall, IconHangUp, IconSend } from './icons';
import css from './breeze.module.css';

/**
 * A guest arrives as `user3737`, which is a number and not a name. This is the
 * line that lets them fix it without an account — typed over in place, saved on
 * Enter or on the way out of the field.
 */
function Greeting() {
  const me = useIdentityController();
  if (!me.editable) return null;

  return (
    <div className={css.greeting}>
      <span>Привіт,</span>
      <input
        className={css.greetingInput}
        value={me.draft}
        maxLength={me.maxLength}
        disabled={me.pending}
        aria-label="Ваше ім’я в чаті"
        onChange={(event) => me.setDraft(event.target.value)}
        onBlur={me.save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') me.cancel();
        }}
      />
      <span className={me.error ? css.greetingError : css.greetingHint}>
        {me.error ?? (me.pending ? 'Зберігаємо…' : me.dirty ? 'Enter — зберегти' : 'можна змінити')}
      </span>
    </div>
  );
}

/** The right-hand pane: toolbar, transcript, composer — the 2003 arrangement. */
export function Conversation({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <div className={css.main}>
      <div className={css.toolbar}>
        <strong style={{ marginRight: 'auto' }}>
          {room.title}
          {room.peer && <span className={css.contactHint}> · @{room.peer.username}</span>}
        </strong>
        <button
          type="button"
          className={`${css.tool} ${room.inCall ? css.toolDanger : ''}`}
          onClick={room.toggleCall}
        >
          {room.inCall ? <IconHangUp /> : <IconCall />}
          {room.inCall ? 'Завершити дзвінок' : 'Відеодзвінок'}
        </button>
        <button type="button" className={css.tool} onClick={room.leave}>
          <IconBack />
          До списку
        </button>
      </div>

      {room.inCall && <CallStage roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.conversation}>
        <Greeting />

        <div className={css.transcript}>
          <p className={css.systemLine}>— Розмову розпочато —</p>

          {room.loadingHistory && <p className={css.systemLine}>Завантаження історії…</p>}

          {room.messages.map((message) =>
            message.call ? (
              <div key={message.id} className={css.callNotice}>
                <strong className={css.callNoticeText}>
                  {message.call.kind === 'started' ? <IconCall /> : <IconHangUp />}
                  {message.call.text}
                  {message.call.duration && ` · ${message.call.duration}`}
                  <span className={css.time}>{message.time}</span>
                </strong>
                {message.call.hint && <span>{message.call.hint}</span>}
                {message.call.live && !room.inCall && (
                  <button type="button" className={css.tool} onClick={room.joinCall}>
                    <IconCall />
                    Приєднатись
                  </button>
                )}
              </div>
            ) : (
              <div
                key={message.id}
                className={`${css.message} ${message.own ? css.messageOwn : ''}`}
              >
                <span className={css.messageDot} />
                <div>
                  <div className={css.says}>
                    {message.sender.displayName} says:
                    <span className={css.time}>{message.time}</span>
                  </div>
                  <div className={css.bubble}>{message.body}</div>
                </div>
              </div>
            ),
          )}

          <div ref={room.bottomRef} />
        </div>

        <div className={css.typing}>
          {room.typing.length > 0 && (
            <>
              <span className={css.typingDot} />
              {room.typing.join(', ')} пише повідомлення…
            </>
          )}
          {!room.connected && room.typing.length === 0 && 'З’єднання втрачено…'}
        </div>

        <form
          className={css.composer}
          onSubmit={(event) => {
            event.preventDefault();
            room.send();
          }}
        >
          <input
            className={css.input}
            value={room.draft}
            onChange={(event) => room.setDraft(event.target.value)}
            placeholder="Написати повідомлення…"
          />
          <button type="submit" className={css.send} disabled={!room.draft.trim()}>
            <IconSend />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
