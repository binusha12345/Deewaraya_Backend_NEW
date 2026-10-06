const EARTH_RADIUS_KM = 6371;
const MIN_SEGMENT_DISTANCE_KM = 0.01;
const MAX_SPEED_KMH = 100;

const haversineDistanceKm = (first, second) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const rawHaversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const haversine = Math.min(1, Math.max(0, rawHaversine));

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getTrackableSegmentDistanceKm = (previous, next) => {
  const distanceKm = haversineDistanceKm(previous, next);
  if (distanceKm < MIN_SEGMENT_DISTANCE_KM) return null;

  const elapsedHours =
    (new Date(next.recordedAt).getTime() - new Date(previous.recordedAt).getTime()) /
    3_600_000;
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return null;
  if (distanceKm / elapsedHours > MAX_SPEED_KMH) return null;

  return distanceKm;
};

const calculateTripDistanceKm = (points = []) => {
  let distanceKm = 0;
  let previous = points[0];

  for (const point of points.slice(1)) {
    const segmentDistanceKm = getTrackableSegmentDistanceKm(previous, point);
    if (segmentDistanceKm === null) continue;

    distanceKm += segmentDistanceKm;
    previous = point;
  }

  return distanceKm;
};

module.exports = { calculateTripDistanceKm, getTrackableSegmentDistanceKm };
