import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  CopyIcon,
  LockKeyIcon,
  PauseCircleIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { api } from './api.js';
import { Brand } from './Brand.jsx';
import { Status } from './DashParts.jsx';
import { toast } from './Toasts.jsx';
import { AREAS, ASSIGNABLE, ROLES } from './team.js';
import './team.css';

const roleName = (role) => ROLES[role]?.[0] || role;
const inviteLink = (code) => `${location.origin}/auth?invite=${code}`;
const SENSITIVE = ['wallet', 'team'];
const areaOptions = AREAS.map(([value, label]) => ({ value, label }));

async function copy(code) {
  try {
    await navigator.clipboard.writeText(inviteLink(code));
    toast('Invite link copied. Share it with them by message or email.');
  } catch {
    window.prompt('Copy this invite link', inviteLink(code));
  }
}

function AreaList({ keys }) {
  return AREAS.filter(([k]) => keys.includes(k)).map(([key, label], i) => (
    <span key={key}>
      {i > 0 && <span>, </span>}
      <span>{label}</span>
    </span>
  ));
}

export function TeamPanel({ open, user }) {
  const [team, setTeam] = useState(null),
    [error, setError] = useState('');
  const load = useCallback(
    () =>
      api('/team')
        .then((t) => {
          setTeam(t);
          setError('');
        })
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const call = async (path, method, body, done) => {
    await api(path, { method, body });
    toast(done);
    await load();
  };
  const invite = () =>
    open({
      silent: true,
      title: 'Invite a team member',
      note: 'They get a link to set their own password. MotoDoc doesn’t email it yet, so copy the link and send it to them.',
      values: { role: 'mechanic' },
      fields: [
        { name: 'name', label: 'Name', required: true, maxLength: 100 },
        { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 254 },
        { name: 'phone', label: 'Phone (optional)', type: 'tel', maxLength: 30 },
        {
          name: 'role',
          label: 'Role',
          required: true,
          options: ASSIGNABLE.map((r) => ({ value: r, label: `${roleName(r)} — ${ROLES[r][1]}` })),
        },
      ],
      submit: 'Create invite',
      save: async (d) => {
        const { code } = await api('/team/invites', { method: 'POST', body: d });
        await load();
        await copy(code);
      },
    });
  const access = (m) => {
    const missing = SENSITIVE.filter((k) => !m.permissions.includes(k));
    open({
      silent: true,
      title: `Access for ${m.name}`,
      note: 'Choose what they can see and change. The owner always has full access.',
      values: { permissions: m.permissions },
      fields: [
        { name: 'permissions', label: 'Areas', type: 'checkboxes', options: areaOptions },
        ...(missing.length
          ? [
              {
                name: 'confirm',
                label: 'Payouts and team changes',
                type: 'checkboxes',
                options: [
                  {
                    value: 'yes',
                    label:
                      'I understand that Wallet & payouts or Team & access lets them see earnings or change who has access.',
                  },
                ],
              },
            ]
          : []),
      ],
      submit: 'Save access',
      save: async (d) => {
        const adding = d.permissions.filter((k) => missing.includes(k));
        if (adding.length && !d.confirm?.includes('yes'))
          throw new Error('Tick the box to confirm giving payouts or team access.');
        await call(
          `/team/members/${m.id}`,
          'PUT',
          { permissions: d.permissions },
          `Access updated for ${m.name}`,
        );
      },
    });
  };
  const role = (m) =>
    open({
      silent: true,
      title: `Change ${m.name}’s role`,
      note: 'Changing the role resets their access to that role’s usual areas. You can fine-tune it afterwards.',
      values: { role: m.role },
      fields: [
        {
          name: 'role',
          label: 'Role',
          required: true,
          options: ASSIGNABLE.map((r) => ({ value: r, label: roleName(r) })),
        },
      ],
      submit: 'Change role',
      save: (d) =>
        call(
          `/team/members/${m.id}`,
          'PUT',
          { role: d.role },
          `${m.name} is now ${roleName(d.role)}`,
        ),
    });
  const pause = (m) =>
    open({
      silent: true,
      title: m.active ? `Pause ${m.name}’s access?` : `Turn ${m.name}’s access back on?`,
      note: m.active
        ? 'They’ll be signed out straight away and can’t use the garage account until you turn access back on.'
        : 'They can sign in again with their own password.',
      submit: m.active ? 'Pause access' : 'Turn access on',
      save: () =>
        call(
          `/team/members/${m.id}`,
          'PUT',
          { active: !m.active },
          m.active ? `${m.name}’s access is paused` : `${m.name}’s access is back on`,
        ),
    });
  const remove = (m) =>
    open({
      silent: true,
      title: `Remove ${m.name} from the team?`,
      note: 'They’ll be signed out and lose access to your garage. Their past work stays in your records.',
      submit: 'Remove from team',
      save: () =>
        call(`/team/members/${m.id}`, 'DELETE', {}, `${m.name} was removed from the team`),
    });
  const cancel = (i) =>
    open({
      silent: true,
      title: `Cancel ${i.name}’s invite?`,
      note: 'The invite link stops working straight away.',
      submit: 'Cancel invite',
      save: () => call(`/team/invites/${i.code}`, 'DELETE', {}, 'Invite cancelled'),
    });
  const resend = async (i) => {
    try {
      await api(`/team/invites/${i.code}/resend`, { method: 'POST', body: {} });
      await load();
      await copy(i.code);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (error)
    return (
      <p role="alert" className="dash-error">
        {error}
      </p>
    );
  if (!team) return <p className="dash-help">Loading your team…</p>;
  const people = [team.owner, ...team.members];
  const rows = [...people, ...team.invites];
  return (
    <>
      <div className="dash-stats team-stats">
        {[
          [UsersThreeIcon, 'People', people.length],
          [ShieldCheckIcon, 'Active', people.filter((p) => p.status === 'active').length],
          [PlusIcon, 'Pending invites', team.invites.length],
        ].map(([Icon, label, value]) => (
          <article key={label}>
            <Icon size={23} />
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="dash-section-heading">
        <h2>Your team</h2>
        <button className="button button-small" onClick={invite}>
          Invite someone <PlusIcon size={16} />
        </button>
      </div>
      <div className="dash-list">
        {rows.map((p) => {
          const isOwner = p.role === 'owner',
            isInvite = p.status === 'invited',
            isMe = p.id === user.id;
          return (
            <article className="dash-row team-row" key={p.code || p.id}>
              <div className="dash-row-body">
                <div className="dash-row-title">
                  <h3>
                    {p.name}
                    {isMe && <span className="team-you"> (you)</span>}
                  </h3>
                  <span className="team-role">{roleName(p.role)}</span>
                  <Status>{p.status}</Status>
                </div>
                <p>{[p.email, p.phone].filter(Boolean).join(' · ')}</p>
                <p className="team-areas">
                  {isOwner ? (
                    'Full access to everything'
                  ) : p.permissions.length ? (
                    <AreaList keys={p.permissions} />
                  ) : (
                    'No areas yet'
                  )}
                </p>
              </div>
              {!isOwner && !isMe && (
                <div className="dash-row-actions">
                  {isInvite ? (
                    <>
                      <button className="dash-text-button" onClick={() => copy(p.code)}>
                        <CopyIcon size={15} /> Copy invite link
                      </button>
                      <button className="dash-text-button" onClick={() => resend(p)}>
                        Resend
                      </button>
                      <button className="dash-text-button muted" onClick={() => cancel(p)}>
                        Cancel invite
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="dash-text-button" onClick={() => access(p)}>
                        Access
                      </button>
                      <button className="dash-text-button" onClick={() => role(p)}>
                        Edit role
                      </button>
                      <button className="dash-text-button" onClick={() => pause(p)}>
                        {p.active ? 'Pause' : 'Activate'}
                      </button>
                      <button className="dash-text-button muted" onClick={() => remove(p)}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="dash-section-heading">
        <h2>Roles</h2>
      </div>
      <div className="team-roles">
        {Object.entries(ROLES).map(([key, [label, about, areas]]) => (
          <article key={key}>
            <h3>{label}</h3>
            <p>{about}</p>
            <p className="team-areas">
              <AreaList keys={areas} />
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

export function NoAccess() {
  return (
    <div className="team-state">
      <LockKeyIcon size={34} />
      <h2>You don’t have access to this page</h2>
      <p>Ask the garage owner to give you access under Team & access.</p>
      <a className="button button-small" href="#overview">
        Back to overview <ArrowRightIcon size={16} />
      </a>
    </div>
  );
}

export function TeamGate({ user, onLogout }) {
  const paused = user.teamStatus === 'paused';
  return (
    <main className="team-gate">
      <Brand />
      <div className="team-state">
        {paused ? <PauseCircleIcon size={38} /> : <UserMinusIcon size={38} />}
        <h1>{paused ? 'Your access is paused' : 'You’re no longer on this team'}</h1>
        <p>
          {paused
            ? 'The garage owner has paused your access for now. Ask them to turn it back on.'
            : 'The garage owner removed you from the team. Ask them for a new invite if this is a mistake.'}
        </p>
        <button className="button button-small" onClick={onLogout}>
          Log out
        </button>
      </div>
    </main>
  );
}
