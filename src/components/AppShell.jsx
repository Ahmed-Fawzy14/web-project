import { useEffect, useState } from 'react';
import { Bell, FlaskConical, Menu, ShoppingBag } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { timeAgo } from '../domain/format';
import { itemCount } from '../domain/orders';
import * as api from '../store/api';
import { useAppState, useCurrentUser } from '../store/store';
import { DemoControls } from './DemoControls';
import { Avatar } from './ui';

const ROLES = [
  { id: 'customer', label: 'Customer', home: '/' },
  { id: 'courier', label: 'Courier', home: '/courier' },
  { id: 'restaurant', label: 'Restaurant', home: '/restaurant' },
  { id: 'admin', label: 'Admin', home: '/admin' },
];

const NAVIGATION = {
  customer: [
    { to: '/', label: 'Outlets', end: true },
    { to: '/orders', label: 'My orders' },
    { to: '/wallet', label: 'Wallet' },
    { to: '/support', label: 'Support' },
  ],
  courier: [
    { to: '/courier', label: 'Jobs', end: true },
    { to: '/wallet', label: 'Wallet' },
    { to: '/support', label: 'Support' },
  ],
  restaurant: [{ to: '/restaurant', label: 'Dashboard' }],
  admin: [{ to: '/admin', label: 'Dashboard' }],
};

function DemoBar({ activeRole }) {
  const navigate = useNavigate();
  const [controlsOpen, setControlsOpen] = useState(false);

  const switchRole = (role) => {
    api.switchDemoRole(role.id);
    navigate(role.home);
  };

  return (
    <div className="demo-bar">
      <div className="container-xl d-flex flex-wrap align-items-center justify-content-between gap-1 py-1">
        <div className="d-flex align-items-center gap-1 flex-wrap" role="group" aria-label="Demo role switcher">
          <span className="demo-label">Demo role</span>
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`demo-role ${activeRole === role.id ? 'active' : ''}`}
              aria-pressed={activeRole === role.id}
              onClick={() => switchRole(role)}
            >
              {role.label}
            </button>
          ))}
        </div>
        <button type="button" className="demo-role" onClick={() => setControlsOpen(true)}>
          <FlaskConical size={13} aria-hidden="true" /> Demo controls
        </button>
      </div>
      <DemoControls open={controlsOpen} onClose={() => setControlsOpen(false)} />
    </div>
  );
}

function Notifications({ userId }) {
  const { notifications, now } = useAppState();
  const [open, setOpen] = useState(false);
  const mine = notifications.filter((n) => n.userId === userId);
  const unread = mine.filter((n) => !n.read).length;

  const toggle = () => {
    if (open) api.markNotificationsRead();
    setOpen(!open);
  };

  return (
    <div className="position-relative">
      <button
        type="button"
        className="btn btn-light position-relative"
        aria-expanded={open}
        aria-label={`Notifications, ${unread} unread`}
        onClick={toggle}
      >
        <Bell size={19} aria-hidden="true" />
        {unread > 0 && <span className="count-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notification-menu card shadow">
          <div className="fw-bold px-3 pt-3 pb-2">Notifications</div>
          {mine.length === 0 && <p className="text-body-secondary small px-3 pb-3 mb-0">You are all caught up.</p>}
          <ul className="list-unstyled mb-0">
            {mine.slice(0, 8).map((note) => (
              <li key={note.id} className={`px-3 py-2 border-top small ${note.read ? '' : 'bg-primary-subtle'}`}>
                {note.link ? <Link to={note.link} onClick={toggle}>{note.text}</Link> : note.text}
                <div className="text-body-secondary">{timeAgo(note.at, now)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, activeRole }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const otherRole = user.roles.find((r) => r !== activeRole && ['customer', 'courier'].includes(r) && ['customer', 'courier'].includes(activeRole));

  const signOut = () => {
    api.logout();
    navigate('/login');
  };
  const switchRole = () => {
    api.setActiveRole(otherRole);
    setOpen(false);
    navigate(otherRole === 'courier' ? '/courier' : '/');
  };

  return (
    <div className="position-relative">
      <button type="button" className="btn btn-link p-0 rounded-circle" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(!open)}>
        <Avatar name={user.name} />
      </button>
      {open && (
        <div className="account-menu card shadow">
          <div className="px-3 py-2 border-bottom">
            <div className="fw-bold text-truncate">{user.name}</div>
            <div className="small text-body-secondary text-capitalize">{activeRole}</div>
          </div>
          <div className="list-group list-group-flush">
            <Link className="list-group-item list-group-item-action" to="/profile" onClick={() => setOpen(false)}>Edit profile</Link>
            {otherRole && (
              <button type="button" className="list-group-item list-group-item-action" onClick={switchRole}>
                Switch to {otherRole} mode
              </button>
            )}
            {activeRole === 'customer' && !user.roles.includes('courier') && (
              <Link className="list-group-item list-group-item-action" to="/courier/register" onClick={() => setOpen(false)}>Become a courier</Link>
            )}
            <button type="button" className="list-group-item list-group-item-action" onClick={signOut}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const state = useAppState();
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeRole = state.session.activeRole;
  const links = user ? NAVIGATION[activeRole] ?? [] : [];
  const cartCount = itemCount(state.cart.lines);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <a className="visually-hidden-focusable" href="#main">Skip to content</a>
      <DemoBar activeRole={activeRole} />
      <nav className="navbar navbar-expand-md bg-white border-bottom sticky-top" aria-label="Main">
        <div className="container-xl">
          <Link className="navbar-brand fw-bold text-primary d-flex align-items-center gap-2" to={ROLES.find((r) => r.id === activeRole)?.home ?? '/login'}>
            <span className="brand-mark" aria-hidden="true">O</span> OtlobAUC
          </Link>
          <div className="d-flex align-items-center gap-2 order-md-last ms-auto ms-md-3">
            {user && activeRole === 'customer' && (
              <Link to="/checkout" className="btn btn-light position-relative" aria-label={`Cart, ${cartCount} items`}>
                <ShoppingBag size={19} aria-hidden="true" />
                {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
              </Link>
            )}
            {user && <Notifications userId={user.id} />}
            {user && <UserMenu user={user} activeRole={activeRole} />}
            {links.length > 0 && (
              <button
                type="button"
                className="btn btn-light d-md-none"
                aria-expanded={menuOpen}
                aria-controls="main-links"
                aria-label="Toggle navigation"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Menu size={19} aria-hidden="true" />
              </button>
            )}
          </div>
          <div id="main-links" className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`}>
            <ul className="navbar-nav ms-md-3">
              {links.map((link) => (
                <li className="nav-item" key={link.to}>
                  <NavLink className="nav-link" to={link.to} end={link.end}>{link.label}</NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
      <main id="main" className="container-xl flex-grow-1 py-4">
        <Outlet />
      </main>
      <footer className="border-top py-3 text-center small text-body-secondary">
        Milestone 1 demo. All people, outlets, prices and orders are fictional, and external services are simulated.
      </footer>
    </div>
  );
}
