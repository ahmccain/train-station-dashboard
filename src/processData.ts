import * as fs from 'fs/promises';
import Papa from 'papaparse';
import { main as getFilteredTapData, CombinedTapRow } from './preprocessTapData';
import { main as getFilteredStopData, StopDataRow } from './preprocessStopData';
import { main as getStopTimeFullData, loadStopTimeData, StopTimeRow} from './preprocessStopTimeData';
import { main as getFilteredTripData } from './preprocessTripData';

type Stop = {
  id: string;
  name: string;
  stationId: string;
  stopTimeCount: number;
}

export type TrainStation = {
  id: string;
  name: string;
  platforms: Stop[];
  nonPlatforms: Stop[];
  entries: string;
  exits: string;
  dailyTaps: number;
  totalPlatformsStopTimeCount: number;
  totalNonPlatformsStopTimeCount: number;
  lat: number;
  long: number;
  platformRatio: number;
  nonPlatformRatio: number;
}

// returns 3 maps as stationId:TrainStation, platformId:stationId, nonPlatformId:stationId. (misses some bus stops)
function linkIdToStations(stationMap: Map<string, CombinedTapRow>, stopData: StopDataRow[]) {
  const idStationMap = new Map<string, TrainStation>();
  const platformStationIdMap = new Map<string, string>();
  const stopStationIdMap = new Map<string, string>();
  
  // 4 cases, typical stations, domestic, international and platform
  for (const row of stopData) {
    const stationNameInTapData = row.stop_name.replace('Station', '').trim();
    if ((stationMap.has(stationNameInTapData) && row.location_type === '1')) {
      idStationMap.set(row.stop_id, {
        id: row.stop_id,
        name: stationNameInTapData,
        platforms: [],
        nonPlatforms: [],
        entries: stationMap.get(stationNameInTapData)!.entries,
        exits: stationMap.get(stationNameInTapData)!.exits,
        totalPlatformsStopTimeCount: 0,
        totalNonPlatformsStopTimeCount: 0,
        lat: parseFloat(row.stop_lat),
        long: parseFloat(row.stop_lon),
        dailyTaps: 0,
        platformRatio: 0,
        nonPlatformRatio: 0
      });
    } else if (row.stop_name === 'Sydney Domestic Airport Station') {
      idStationMap.set(row.stop_id, {
        id: row.stop_id,
        name: 'Domestic',
        platforms: [],
        nonPlatforms: [],
        entries: stationMap.get('Domestic')!.entries,
        exits: stationMap.get('Domestic')!.exits,
        totalPlatformsStopTimeCount: 0,
        totalNonPlatformsStopTimeCount: 0,
        lat: -33.93362984,
        long: 151.18065972,
        dailyTaps: 0,
        platformRatio: 0,
        nonPlatformRatio: 0
      });
    } else if (row.stop_name === 'Sydney International Airport Station') {
      idStationMap.set(row.stop_id, {
        id: row.stop_id,
        name: 'International',
        platforms: [],
        nonPlatforms: [],
        entries: stationMap.get('International')!.entries,
        exits: stationMap.get('International')!.exits,
        totalPlatformsStopTimeCount: 0,
        totalNonPlatformsStopTimeCount: 0,
        lat: -33.93497091,
        long: 151.16584068,
        dailyTaps: 0,
        platformRatio: 0,
        nonPlatformRatio: 0
      });
    } else if (row.stop_name.includes('Platform')) {
      platformStationIdMap.set(row.stop_id, row.parent_station);
      const platform: Stop = {
        id: row.stop_id,
        name: row.stop_name,
        stationId: row.parent_station,
        stopTimeCount: 0
      };
      idStationMap.get(row.parent_station)!.platforms.push(platform);
    } else {
      // non platform but is linked to parent station
      stopStationIdMap.set(row.stop_id, row.parent_station);
      const nonPlatform: Stop = {
        id: row.stop_id,
        name: row.stop_name,
        stationId: row.parent_station,
        stopTimeCount: 0
      };
      idStationMap.get(row.parent_station)!.nonPlatforms.push(nonPlatform);
    }
  }
  return { idStationMap, platformStationIdMap, stopStationIdMap };
}

function countStopTimesForStationsAndPlatforms(stopTimeData: StopTimeRow[], maps: {idStationMap: Map<string, TrainStation>, platformStationIdMap: Map<string, string>, stopStationIdMap: Map<string, string>}) {
  const platformStationIdMap = maps.platformStationIdMap;
  const idStationMap = maps.idStationMap;
  const stopStationIdMap = maps.stopStationIdMap;

  for (const row of stopTimeData) {
    if (platformStationIdMap.has(row.stop_id)) {
      const stationId = platformStationIdMap.get(row.stop_id);
      const station = idStationMap.get(stationId!);

      station!.totalPlatformsStopTimeCount += 1;
      const platform = station!.platforms.find((platform) => platform.id === row.stop_id);
      platform!.stopTimeCount += 1;
    } else if (stopStationIdMap.has(row.stop_id)) {
      const stationId = stopStationIdMap.get(row.stop_id);
      const station = idStationMap.get(stationId!);

      station!.totalNonPlatformsStopTimeCount += 1;
      const stop = station!.nonPlatforms.find((nonPlatform) => nonPlatform.id === row.stop_id);
      stop!.stopTimeCount += 1;
    }
  }

  for (const station of idStationMap.values()) {
    let totalTaps = 0;
    if (station.entries === 'Less than 50') {
      totalTaps += 50;
    } else {
      totalTaps += parseInt(station.entries, 10);
    }
    if (station.exits === 'Less than 50') {
      totalTaps += 50;
    } else {
      totalTaps += parseInt(station.exits, 10);
    }
    const platformRatio = totalTaps/station.totalPlatformsStopTimeCount;
    // some stations have missing bus stands so ratio is at best lowest?
    const nonPlatformRatio = totalTaps/station.totalNonPlatformsStopTimeCount;
    // TODO look at miranda for missing bus stop links
    station.dailyTaps = Math.round(totalTaps/30);
    station.platformRatio = Math.round(platformRatio * 100) / 100;
    station.nonPlatformRatio = Math.round(nonPlatformRatio * 100) / 100;
  }
}

function logStopTimesForAllPlatforms(idStationMap: Map<string, TrainStation>) {
  for (const station of idStationMap.values()) {
    const platforms = station.nonPlatforms;
    for (const platform of platforms) {
      console.log(`${platform.name} has ${platform.stopTimeCount}`);
    }
  }
}

function stationToGeoJSON(station: TrainStation) {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [station.long, station.lat]
    },
    properties: {
      name: station.name,
      dailyTaps: station.dailyTaps,
      platformRatio: station.platformRatio,  
      nonPlatformRatio: station.nonPlatformRatio,   
    }
  };
}

function stationsToFeatureCollection(stations: TrainStation[]) {
  return {
    type: "FeatureCollection",
    features: stations.map(stationToGeoJSON)
  }
}

export async function main() {
  const tapDataMap = await getFilteredTapData();
  const stopData = await getFilteredStopData(tapDataMap);
  const tapDataWithIdMap = linkIdToStations(tapDataMap, stopData);
  const idStationMap = tapDataWithIdMap.idStationMap;

  // already filtered so that every stop id is a platform found in a tap data station
  const stopTimeData = await loadStopTimeData('data/stop-times-for-matching-stops.csv');
  countStopTimesForStationsAndPlatforms(stopTimeData, tapDataWithIdMap);
  // logStopTimesForAllPlatforms(idStationMap);

  const JSON_string = JSON.stringify(stationsToFeatureCollection(Array.from(idStationMap.values())));
  await fs.writeFile('data/stations.geojson', JSON_string);
  console.log('Saved to stations.geojson');

  return idStationMap;
}

main();