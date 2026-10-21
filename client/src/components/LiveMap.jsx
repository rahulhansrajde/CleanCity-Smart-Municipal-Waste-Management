import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleAlert, Factory, MapPin, Mountain, Truck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { REQUEST_STATUS, TRUCK_STATE } from '../utils/constants';
import { CITY_CENTER } from '../utils/geo';

// Standard OpenStreetMap tiles (no API key); dark mode inverts them with a CSS filter.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const BOUNDS = [
  [18.38, 73.66],
  [18.74, 74.1],
];

// Leaflet icons are plain HTML; cache one per visual state so markers aren't rebuilt every poll.
const icons = new Map();
function icon(key, build) {
  if (!icons.has(key)) icons.set(key, build());
  return icons.get(key);
}

const truckIcon = (state) =>
  icon(`truck-${state}`, () =>
    L.divIcon({
      className: 'map-marker truck-marker',
      html: renderToStaticMarkup(
        <span className={`mk truck ${state}`}>
          <Truck size={17} strokeWidth={2.4} />
        </span>
      ),
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      tooltipAnchor: [0, -18],
    })
  );

const pinIcon = (status, selected) =>
  icon(`pin-${status}-${selected ? 1 : 0}`, () =>
    L.divIcon({
      className: 'map-marker',
      html: renderToStaticMarkup(
        <span className={`pin s-${status.replace(' ', '-').toLowerCase()} ${selected ? 'selected' : ''}`}>
          <span>
            <CircleAlert size={14} strokeWidth={2.6} />
          </span>
        </span>
      ),
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      tooltipAnchor: [0, -30],
    })
  );

const placeIcon = (kind) =>
  icon(`place-${kind}`, () =>
    L.divIcon({
      className: 'map-marker',
      html: renderToStaticMarkup(
        <span className={`mk place ${kind}`}>{kind === 'plant' ? <Factory size={13} strokeWidth={2.4} /> : <Mountain size={13} strokeWidth={2.4} />}</span>
      ),
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      tooltipAnchor: [0, -14],
    })
  );

const pickIcon = () =>
  icon('pick', () =>
    L.divIcon({
      className: 'map-marker',
      html: renderToStaticMarkup(
        <span className="pin pick">
          <span>
            <MapPin size={14} strokeWidth={2.6} />
          </span>
        </span>
      ),
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    })
  );

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key]);
  return null;
}

function PickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export const truckState = (v) => (v.available || v.state !== 'idle' ? v.state : 'off');

/**
 * City map with live trucks and citizen requests.
 * `focus` = { key, lat, lng } flies the map there; `onPick` turns clicks into a location pick.
 */
export default function LiveMap({ vehicles = [], requests = [], places, focus, selectedId, onSelectRequest, onPick, pick, height = 560, zoom = 12 }) {
  const { theme } = useTheme();
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={[CITY_CENTER.lat, CITY_CENTER.lng]} zoom={zoom} minZoom={11} maxBounds={BOUNDS} maxBoundsViscosity={0.8} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer key={theme} url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} className={theme === 'dark' ? 'tiles-dark' : 'tiles-light'} />
        <FlyTo target={focus} />
        {onPick && <PickHandler onPick={onPick} />}

        {places?.plants?.map((p) => (
          <Marker key={p._id} position={[p.lat, p.lng]} icon={placeIcon('plant')}>
            <Tooltip direction="top">
              <b>{p.name}</b>
              <br />
              Recycling plant
            </Tooltip>
          </Marker>
        ))}
        {places?.landfills?.map((l) => (
          <Marker key={l._id} position={[l.lat, l.lng]} icon={placeIcon('landfill')}>
            <Tooltip direction="top">
              <b>{l.name}</b>
              <br />
              Landfill
            </Tooltip>
          </Marker>
        ))}

        {requests.map((r) => (
          <Marker
            key={r._id}
            position={[r.lat, r.lng]}
            icon={pinIcon(r.status, r._id === selectedId)}
            zIndexOffset={r._id === selectedId ? 1000 : 0}
            eventHandlers={onSelectRequest ? { click: () => onSelectRequest(r) } : undefined}
          >
            <Tooltip direction="top">
              <b>
                {r.code} · {r.type}
              </b>
              <br />
              {REQUEST_STATUS[r.status]?.label}
              {r.ward?.name ? ` · ${r.ward.name}` : ''}
            </Tooltip>
          </Marker>
        ))}

        {vehicles.map((v) =>
          v.target && (v.state === 'to_job' || v.state === 'returning') ? (
            <Polyline
              key={`line-${v._id}`}
              positions={[
                [v.lat, v.lng],
                [v.target.lat, v.target.lng],
              ]}
              pathOptions={{ className: `route ${v.state}`, weight: 3, dashArray: '6 8' }}
            />
          ) : null
        )}
        {vehicles.map((v) => (
          <Marker key={v._id} position={[v.lat, v.lng]} icon={truckIcon(truckState(v))} zIndexOffset={500}>
            <Tooltip direction="top">
              <b>{v.registrationNo}</b>
              <br />
              {TRUCK_STATE[truckState(v)]}
              {v.wardName ? ` · ${v.wardName} depot` : ''}
            </Tooltip>
          </Marker>
        ))}

        {pick && <Marker position={[pick.lat, pick.lng]} icon={pickIcon()} zIndexOffset={2000} />}
      </MapContainer>
    </div>
  );
}

export function MapLegend({ showPlaces = true, trucks = true }) {
  return (
    <div className="map-legend">
      {Object.entries(REQUEST_STATUS)
        .filter(([s]) => s !== 'Cancelled')
        .map(([s, v]) => (
          <span key={s} className="legend-item">
            <span className={`legend-pin s-${s.replace(' ', '-').toLowerCase()}`} />
            {v.label}
          </span>
        ))}
      {trucks && (
        <span className="legend-item">
          <span className="legend-truck" />
          Truck
        </span>
      )}
      {showPlaces && (
        <>
          <span className="legend-item">
            <span className="legend-place plant" /> Recycling plant
          </span>
          <span className="legend-item">
            <span className="legend-place landfill" /> Landfill
          </span>
        </>
      )}
    </div>
  );
}
