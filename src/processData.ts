import * as fs from 'fs/promises';
import Papa from 'papaparse';
import { main as getFilteredTapData, CombinedTapRow } from './preprocessTapData';
import { main as getFilteredStopData, StopDataRow } from './preprocessStopData';
import { main as getStopTimeData, loadStopTimeData, StopTimeRow} from './preprocessStopTimeData';

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
  totalPlatformsStopTimeCount: number;
  totalNonPlatformsStopTimeCount: number;
}

// 2 maps, one of id:stationName and one of platformid:stationid
// make id:stationName first so that you can attach platform list after
function linkIdToStations(stationMap: Map<string, CombinedTapRow>, stopData: StopDataRow[]) {
  const idStationMap = new Map<string, TrainStation>();
  const platformStationIdMap = new Map<string, string>();
  const stopStationIdMap = new Map<string, string>();

  // 4 cases, typical stations, domestic, international and platform
  for (const row of stopData) {
    const stationNameInTapData = row.stop_name.replace('Station', '').trim();
    if ((stationMap.has(stationNameInTapData))) {
      idStationMap.set(row.stop_id, {
        id: row.stop_id,
        name: stationNameInTapData,
        platforms: [],
        nonPlatforms: [],
        entries: stationMap.get(stationNameInTapData)!.entries,
        exits: stationMap.get(stationNameInTapData)!.exits,
        totalPlatformsStopTimeCount: 0,
        totalNonPlatformsStopTimeCount: 0
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
        totalNonPlatformsStopTimeCount: 0
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
        totalNonPlatformsStopTimeCount: 0
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
}

function countStopTimesForStationsAndNonPlatforms(stopTimeData: StopTimeRow[], maps: {idStationMap: Map<string, TrainStation>, nonPlatformStationIdMap: Map<string, string>}) {
  const nonPlatformStationIdMap = maps.nonPlatformStationIdMap;
  const idStationMap = maps.idStationMap;
  for (const row of stopTimeData) {
    const stationId = nonPlatformStationIdMap.get(row.stop_id);
    const station = idStationMap.get(stationId!);

    station!.totalPlatformsStopTimeCount += 1;
    const nonPlatform = station!.nonPlatforms.find((nonPlatform) => nonPlatform.id === row.stop_id);
    nonPlatform!.stopTimeCount += 1;
  }
}

function logTapsToStopTimesRatio(idStationMap: Map<string, TrainStation>) {
  // arbitrary ratio assuming time period of stop_times is consistent amongst all stations. round <50 to 50 (probably too small to matter)
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
    const ratio = totalTaps/station.totalPlatformsStopTimeCount;
    if (0 < ratio && ratio < 1) {
      console.log(`${station.name} has a ratio of ${ratio} total taps to trains stopping`);
    }
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


async function main() {
  const tapDataMap = await getFilteredTapData();
  const stopData = await getFilteredStopData(tapDataMap);
  const tapDataWithIdMap = linkIdToStations(tapDataMap, stopData);
  const idStationMap = tapDataWithIdMap.idStationMap;
  const platformStationIdMap = tapDataWithIdMap.platformStationIdMap;

  // const stopTimeData = await getStopTimeData(tapDataWithIdMap);
  

  // already filtered so that every stop id is a platform found in a tap data station
  const stopTimeData = await loadStopTimeData('data/stop-times-for-matching-stops.csv');
  countStopTimesForStationsAndPlatforms(stopTimeData, tapDataWithIdMap);
  // logTapsToStopTimesRatio(idStationMap);
  logStopTimesForAllPlatforms(idStationMap);

}

main();