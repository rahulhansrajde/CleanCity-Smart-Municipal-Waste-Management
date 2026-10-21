// Which roles can open each page. The server enforces the same rules on its API.
export const PAGE_ACCESS = {
  dashboard: ['admin', 'supervisor'],
  map: ['admin', 'supervisor', 'operator'],
  requests: ['admin', 'supervisor', 'operator'],
  myRequests: ['citizen'],
  segregation: ['admin', 'supervisor', 'operator'],
  wards: ['admin', 'supervisor'],
  fleet: ['admin', 'supervisor'],
  plants: ['admin', 'supervisor', 'operator'],
  landfills: ['admin', 'supervisor', 'operator'],
  reports: ['admin', 'supervisor'],
  users: ['admin'],
};

export const canSee = (role, page) => !!PAGE_ACCESS[page]?.includes(role);

// Only admins and supervisors can run the dispatch simulation.
export const canControlSim = (role) => role === 'admin' || role === 'supervisor';

// First page a role lands on after signing in.
export function homeFor(role) {
  if (canSee(role, 'dashboard')) return '/';
  if (role === 'citizen') return '/my-requests';
  return '/segregation';
}
