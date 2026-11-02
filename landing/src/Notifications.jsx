import {
  BellIcon,
  CalendarCheckIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  ClockCountdownIcon,
  EnvelopeSimpleIcon,
  GasPumpIcon,
  GiftIcon,
  MegaphoneIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  WarningCircleIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { toast } from './Toasts.jsx';
import './notifications.css';

const iconFor = (item) => {
  if (item.type === 'message' || item.type === 'reply-reminder') return ChatCircleIcon;
  if (item.type === 'reminder' || item.type === 'overdue') return ClockCountdownIcon;
  if (item.type === 'invoice' || item.type === 'payment-reminder') return ReceiptIcon;
  if (item.type === 'membership') return GiftIcon;
  if (item.type === 'market') return StorefrontIcon;
  if (item.type === 'fuel') return GasPumpIcon;
  if (item.type === 'announcement') return MegaphoneIcon;
  if (item.type === 'admin') return ShieldCheckIcon;
  if (['stage', 'ready', 'note', 'completed'].includes(item.type)) return WrenchIcon;
  if (['cancelled', 'declined', 'no-show', 'customer-declined'].includes(item.type))
    return WarningCircleIcon;
  if (['confirmed', 'approved-new-time', 'customer-approved'].includes(item.type))
    return CheckCircleIcon;
  return CalendarCheckIcon;
};

const dayKey = (value) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'Europe/Helsinki' });
const time = (value) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki',
  });
const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Helsinki',
  });

export function NotificationsPage({ feed, onSeen }) {
  if (feed.loading)
    return (
      <div className="notify-skeleton" role="status" aria-label="Loading notifications">
        <span />
        <span />
        <span />
      </div>
    );
  const today = dayKey(new Date());
  const groups = [
    ['Today', feed.items.filter((item) => dayKey(item.at) === today)],
    ['Earlier', feed.items.filter((item) => dayKey(item.at) !== today)],
  ].filter(([, items]) => items.length);
  const markAll = async () => {
    try {
      await api('/notifications/seen', { method: 'POST', body: {} });
      onSeen();
      toast('All notifications marked as read.');
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  if (!feed.items.length)
    return (
      <div className="dash-empty notify-empty">
        <BellIcon size={30} />
        <h2>You’re all caught up</h2>
        <p>Booking updates, messages, reminders and garage news will appear here.</p>
      </div>
    );

  return (
    <div className="notify-page">
      <div className="notify-toolbar">
        <p>{`${feed.unread} unread ${feed.unread === 1 ? 'update' : 'updates'}`}</p>
        <button className="dash-secondary" disabled={!feed.unread} onClick={markAll}>
          Mark all as read
        </button>
      </div>
      {groups.map(([label, items]) => (
        <section className="notify-group" key={label} aria-labelledby={`notify-${label}`}>
          <h2 id={`notify-${label}`}>{label}</h2>
          <div className="notify-list">
            {items.map((item) => {
              const Icon = iconFor(item);
              const unread = item.at > feed.seen_at;
              return (
                <a
                  className={`notify-row${unread ? ' unread' : ''}`}
                  href={item.link}
                  key={item.id}
                >
                  <span className={`notify-icon type-${item.type}`}>
                    <Icon size={21} weight="duotone" />
                  </span>
                  <span className="notify-copy">
                    <span className="notify-title">
                      <strong>{item.title}</strong>
                      {unread && <i aria-label="Unread" />}
                    </span>
                    <span>{item.body}</span>
                    {item.detail && <small>{item.detail}</small>}
                    <small className="notify-meta">
                      <span>{dayKey(item.at) === today ? time(item.at) : date(item.at)}</span>
                      {item.email_sent && (
                        <span>
                          <EnvelopeSimpleIcon size={14} /> Also sent by email
                        </span>
                      )}
                    </small>
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
