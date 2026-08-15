'use client';

import Link from 'next/link';

import { useChatListController, useInviteController } from '@/core';

import { IconContacts, IconLink, IconSearch } from './icons';
import css from './breeze.module.css';

/** "My Contacts": one buddy list, grouped like the original. */
export function ContactsPanel({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <div className={css.panel}>
      <div className={css.panelHead}>
        <IconContacts />
        My Contacts
      </div>

      <div className={css.searchRow}>
        <IconSearch />
        <input
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="Пошук людей і чатів…"
        />
      </div>

      <div className={css.inviteRow}>
        <button
          type="button"
          className={css.inviteButton}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'Створюємо…' : 'Анонімна лінка'}
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}

      <div className={css.scroll}>
        <div className={css.group}>
          <span className={css.groupIcon} />
          <span>Розмови ({list.chats.length})</span>
        </div>

        {list.loadingChats && <p className={css.note}>Завантаження…</p>}
        {!list.loadingChats && list.chats.length === 0 && (
          <p className={css.note}>Порожньо. Знайдіть когось через пошук.</p>
        )}

        {list.chats.map((chat) => (
          <Link
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.contact} ${chat.id === activeRoomId ? css.contactActive : ''}`}
          >
            <span className={css.dot} />
            <span className={css.contactName}>{chat.name}</span>
          </Link>
        ))}

        {list.searching && (
          <>
            <div className={css.group}>
              <span className={css.groupIcon} />
              <span>Знайдені люди</span>
            </div>

            {list.loadingPeople && <p className={css.note}>Пошук…</p>}
            {!list.loadingPeople && list.people.length === 0 && (
              <p className={css.note}>Нікого не знайдено</p>
            )}

            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.contact}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={`${css.dot} ${css.dotIdle}`} />
                <span className={css.contactName}>{person.name}</span>
                <span className={css.contactHint}>{list.opening ? '…' : 'Написати'}</span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.note}>Не вдалося відкрити чат</p>}
      </div>
    </div>
  );
}
