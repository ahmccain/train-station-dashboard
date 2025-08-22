/* eslint-disable no-undef */
/**
 * geoJSON simple
 */

// config map
let config = {
  minZoom: 2,
  maxZoom: 18,
};
// magnification with which the map will start
const zoom = 10;
// co-ordinates
const lat = -33.81749025;
const lng = 151.00532500;

// calling map
const map = L.map("map", config).setView([lat, lng], zoom);

// Used to load and display tile layers on the map
// Most tile servers require attribution, which you can set under `Layer`
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

function onEachFeature(feature, layer) {
    const { name, dailyTaps, platformRatio, nonPlatformRatio } = feature.properties;
    layer.bindTooltip(
      // `${name}<br>Daily taps: ${dailyTaps}<br>Platform Ratio: ${platformRatio}<br>Non Platform Ratio: ${nonPlatformRatio}`,
      `${name}<br>Daily taps: ${dailyTaps}<br>Platform Ratio: ${platformRatio}`,
      { permanent: true, direction: "top" }
    );
}

// adding geojson by fetch
// of course you can use jquery, axios etc.
fetch("../data/stations.geojson")
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    // use geoJSON
    L.geoJSON(data, {
      onEachFeature: onEachFeature,
    }).addTo(map);
  });

