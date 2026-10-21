// Mirrors the enums defined in the server models.
export const ZONES = ['North', 'South', 'East', 'West', 'Central'];
export const SHIFTS = ['Morning', 'Afternoon', 'Night'];
export const VEHICLE_TYPES = ['Compactor', 'Tipper', 'Auto Tipper', 'Hook Loader', 'Dumper Placer', 'E-Rickshaw'];
export const VEHICLE_STATUS = ['Active', 'Maintenance', 'Idle'];
export const FUEL_TYPES = ['Diesel', 'CNG', 'Electric'];
export const PLANT_TYPES = [
  'Composting',
  'Biomethanation',
  'Material Recovery Facility',
  'Plastic Recycling',
  'Paper Recycling',
  'E-Waste',
  'Waste-to-Energy',
  'C&D Waste',
];
export const PLANT_STATUS = ['Operational', 'Maintenance', 'Offline'];
export const LANDFILL_STATUS = ['Active', 'Near Capacity', 'Closed', 'Under Remediation'];
export const LANDFILL_WASTE_TYPES = ['Mixed', 'Process Rejects', 'Inert', 'C&D Waste', 'Legacy Waste'];
export const ROLES = ['admin', 'supervisor', 'operator', 'citizen'];

export const REQUEST_TYPES = ['Overflowing bin', 'Missed collection', 'Illegal dumping', 'Dead animal', 'Other'];

// Plain-language labels and status tones for citizen requests.
export const REQUEST_STATUS = {
  Open: { label: 'Waiting for truck', tone: 'critical' },
  Dispatched: { label: 'Truck on the way', tone: 'warning' },
  'In progress': { label: 'Collecting', tone: 'info' },
  Resolved: { label: 'Done', tone: 'good' },
  Cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const ACTIVE_REQUEST = ['Open', 'Dispatched', 'In progress'];

// Live truck states from the dispatch simulation.
export const TRUCK_STATE = {
  idle: 'Free',
  to_job: 'On the way',
  collecting: 'Collecting',
  returning: 'Returning',
  off: 'Off duty',
};

export const STATUS_TONE = {
  Active: 'good',
  Operational: 'good',
  Maintenance: 'warning',
  Idle: 'neutral',
  Offline: 'critical',
  'Near Capacity': 'serious',
  Closed: 'neutral',
  'Under Remediation': 'info',
};

export const RANGE_PRESETS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

// Plain-language names for alert severity.
export const LEVEL_LABEL = { critical: 'Urgent', serious: 'High', warning: 'Medium', info: 'Low' };
