const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateTripDistanceKm,
  getTrackableSegmentDistanceKm,
} = require("../utils/tripDistance");

const point = (latitude, seconds) => ({
  latitude,
  longitude: 0,
  recordedAt: new Date(seconds * 1000),
});

test("counts normal movement segments", () => {
  const start = point(0, 0);
  const end = point(0.001, 60);

  assert.ok(getTrackableSegmentDistanceKm(start, end) > 0.1);
  assert.ok(calculateTripDistanceKm([start, end]) > 0.1);
});

test("ignores GPS drift under 10 metres without losing later movement", () => {
  const points = [
    point(0, 0),
    point(0.00005, 15),
    point(0.0002, 30),
  ];
  const distanceKm = calculateTripDistanceKm(points);

  assert.ok(distanceKm > 0.02);
  assert.ok(distanceKm < 0.025);
});

test("ignores impossible jumps and continues from the last accepted fix", () => {
  const points = [
    point(0, 0),
    point(1, 15),
    point(0.001, 60),
  ];
  const distanceKm = calculateTripDistanceKm(points);

  assert.ok(distanceKm > 0.1);
  assert.ok(distanceKm < 0.12);
});

test("ignores segments with invalid or non-increasing timestamps", () => {
  assert.equal(
    getTrackableSegmentDistanceKm(point(0, 10), point(0.001, 10)),
    null
  );
  assert.equal(
    getTrackableSegmentDistanceKm(point(0, 10), point(0.001, 9)),
    null
  );
});
