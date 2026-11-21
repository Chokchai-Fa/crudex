export type DemoRole = 'teacher' | 'principal';
const roleKey = 'crudex.session.role';

export function demoRole(): DemoRole | null {
  const role = sessionStorage.getItem(roleKey);
  return role === 'teacher' || role === 'principal' ? role : null;
}

export function signInDemo(role: DemoRole) {
  sessionStorage.setItem(roleKey, role);
}

export function signOutDemo() {
  sessionStorage.removeItem(roleKey);
  window.location.replace('/');
}
