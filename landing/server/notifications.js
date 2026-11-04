import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DAY = 86400000;

const eventTitles = {
  requested: 'New booking request',
  confirmed: 'Booking approved',
  'approved-new-time': 'Booking approved for a new time',
  declined: 'Booking declined',
  'new-time': 'New time proposed',
  scheduled: 'Your garage scheduled an appointment',
  'customer-approved': 'Customer approved the appointment',
  'customer-declined': 'Customer declined the appointment',
  stage: 'Repair progress updated',
  ready: 'Your car is ready for pickup',
  note: 'Mechanic note',
  moved: 'Appointment moved',
  cancelled: 'Appointment cancelled',
  'no-show': 'Marked as no-show',
  completed: 'Service completed',
  rescheduled: 'Reschedule requested',
  review: 'New review',
  reply: 'The garage replied to your review',
  invoice: 'New invoice',
  'payment-reminder': 'Payment reminder',
  'record-added': 'Service record added',
  'invoice-paid': 'Invoice paid',
  'quote-accepted': 'Quote accepted',
};

const linkFor = (item) => {
  if (item.link) return item.link;
  if (item.type === 'reminder' || item.type === 'overdue') return '#reminders';
  return '#bookings';
};

const areaFor = (item) => {
  const link = linkFor(item).replace(/^.*#/, '');
  if (link) return link.split(/[?&/]/)[0];
  return 'overview';
};

export function registerNotifications(app, ctx) {
  const { one, all, run, id, clock, outboxPath, appOrigin, production, sendNotificationEmail } =
    ctx;
  const now = () => new Date(clock()).toISOString();

  const localMailer = async (message) => {
    if (production) return false;
    await mkdir(outboxPath, { recursive: true });
    await writeFile(
      join(outboxPath, `notification-${id()}.json`),
      JSON.stringify(message, null, 2),
      'utf8',
    );
    return true;
  };
  const mailer = sendNotificationEmail || localMailer;

  const replyReminders = async (user) => {
    const driver = user.role === 'driver';
    const scope = driver ? user.id : user.garage_id;
    if (!scope) return [];
    const rows = await all(
      `SELECT m.id,m.body,m.created_at,m.booking_id,m.sender_id,b.driver_id,b.service,g.name garage_name,u.name driver_name
       FROM messages m
       JOIN bookings b ON b.id=m.booking_id
       JOIN garages g ON g.id=b.garage_id
       JOIN users u ON u.id=b.driver_id
       WHERE ${driver ? 'b.driver_id' : 'b.garage_id'}=?
         AND m.created_at=(SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.booking_id=m.booking_id)
       ORDER BY m.created_at DESC LIMIT 50`,
      scope,
    );
    const threshold = driver ? 24 * 3600000 : 2 * 3600000;
    return rows
      .filter((row) => {
        const waiting = driver ? row.sender_id !== user.id : row.sender_id === row.driver_id;
        return waiting && clock() - Date.parse(row.created_at) >= threshold;
      })
      .map((row) => ({
        id: `reply:${row.id}:${user.id}`,
        type: 'reply-reminder',
        title: 'A message is waiting for your reply',
        body: `${row.service} · ${driver ? row.garage_name : row.driver_name}`,
        at: new Date(Date.parse(row.created_at) + threshold).toISOString(),
        booking_id: row.booking_id,
        link: '#bookings',
      }));
  };

  const rawFeed = async (user) => {
    const driver = user.role === 'driver';
    const column = driver ? 'b.driver_id' : 'b.garage_id';
    const scope = driver ? user.id : user.garage_id;
    if (!scope && !driver) return [];
    const today = now().slice(0, 10);
    const soon = new Date(clock() + 7 * DAY).toISOString().slice(0, 10);
    const [messages, events, reminders, notices, waitingReplies] = await Promise.all([
      all(
        `SELECT m.id,m.body,m.created_at at,m.booking_id,u.name sender_name
       FROM messages m JOIN bookings b ON b.id=m.booking_id JOIN users u ON u.id=m.sender_id
       WHERE ${column}=? AND m.sender_id<>? ORDER BY m.created_at DESC LIMIT 100`,
        scope,
        user.id,
      ),
      all(
        `SELECT e.id,e.kind,e.detail,e.at,e.booking_id,b.service,g.name garage_name,u.name driver_name
       FROM booking_events e JOIN bookings b ON b.id=e.booking_id JOIN garages g ON g.id=b.garage_id JOIN users u ON u.id=b.driver_id
       WHERE ${column}=? AND e.actor_id<>? ORDER BY e.at DESC LIMIT 100`,
        scope,
        user.id,
      ),
      all(
        'SELECT id,title,due_date FROM reminders WHERE user_id=? AND done=0 AND due_date<=? ORDER BY due_date LIMIT 100',
        user.id,
        soon,
      ),
      all(
        'SELECT id,kind,title,body,at,link FROM notices WHERE user_id=? ORDER BY at DESC LIMIT 100',
        user.id,
      ),
      replyReminders(user),
    ]);
    return [
      ...notices.map((notice) => ({
        id: `notice:${notice.id}`,
        type: notice.kind,
        title: notice.title,
        body: notice.body,
        at: notice.at,
        link: notice.link,
      })),
      ...messages.map((message) => ({
        id: `message:${message.id}`,
        type: 'message',
        title: `Message from ${message.sender_name}`,
        body: message.body.slice(0, 140),
        at: message.at,
        booking_id: message.booking_id,
        link: '#bookings',
      })),
      ...events.map((event) => ({
        id: `booking:${event.id}`,
        type: event.kind,
        title: eventTitles[event.kind] || 'Booking updated',
        body: `${event.service} · ${driver ? event.garage_name : event.driver_name}`,
        detail: event.detail || '',
        at: event.at,
        booking_id: event.booking_id,
        link: '#bookings',
      })),
      ...reminders.map((reminder) => ({
        id: `reminder:${reminder.id}`,
        type: reminder.due_date < today ? 'overdue' : 'reminder',
        title: reminder.due_date < today ? 'Reminder overdue' : 'Reminder due soon',
        body: reminder.title,
        at: new Date(Date.parse(`${reminder.due_date}T00:00:00Z`) - 7 * DAY).toISOString(),
        due_date: reminder.due_date,
        link: '#reminders',
      })),
      ...waitingReplies,
    ]
      .filter((item) => item.at <= now())
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  };

  const deliver = async (user, item) => {
    const enabled = item.type === 'message' ? !!user.email_chat : !!user.email_updates;
    if (!enabled) return '';
    const existing = await one(
      "SELECT status FROM notification_deliveries WHERE user_id=? AND source_id=? AND channel='email'",
      user.id,
      item.id,
    );
    if (existing) return existing.status;
    const status = user.demo_world
      ? 'demo'
      : (await mailer({
            to: user.email,
            subject: item.title,
            text: `${item.body}\n\nOpen MotoDoc: ${new URL(`/app${linkFor(item)}`, appOrigin).href}`,
            notification_id: item.id,
          }))
        ? 'sent'
        : '';
    if (status)
      await run(
        "INSERT INTO notification_deliveries(id,user_id,source_id,channel,status,sent_at) VALUES(?,?,?,'email',?,?)",
        id(),
        user.id,
        item.id,
        status,
        now(),
      );
    return status;
  };

  const feedFor = async (user) => {
    const seen =
      (await one('SELECT seen_at FROM notification_reads WHERE user_id=?', user.id))?.seen_at || '';
    const items = (await rawFeed(user)).slice(0, 100);
    const emailStatuses = await Promise.all(items.map((item) => deliver(user, item)));
    const enriched = items.map((item, index) => {
      const emailStatus = emailStatuses[index];
      return {
        ...item,
        link: linkFor(item),
        area: areaFor(item),
        email_sent: emailStatus === 'sent' || emailStatus === 'demo',
      };
    });
    const unreadItems = enriched.filter((item) => item.at > seen);
    const counts = unreadItems.reduce((result, item) => {
      result[item.area] = (result[item.area] || 0) + 1;
      return result;
    }, {});
    return { items: enriched, unread: unreadItems.length, seen_at: seen, counts };
  };

  app.get('/api/notifications', async (req, res) => res.json(await feedFor(req.user)));
  app.post('/api/notifications/seen', async (req, res) => {
    await run(
      'INSERT INTO notification_reads(user_id,seen_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET seen_at=excluded.seen_at',
      req.user.id,
      now(),
    );
    res.json({ ok: true });
  });

  return { feedFor };
}
