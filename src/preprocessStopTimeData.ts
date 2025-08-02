import * as fs from 'fs/promises';
import Papa from 'papaparse';
import { TrainStation } from './processData';

//trip_id,arrival_time,departure_time,stop_id,stop_sequence,
// stop_headsign,pickup_type,drop_off_type,shape_dist_traveled,timepoint,stop_note

export type StopTimeRow = {
  trip_id: string,
  arrival_time: string,
  departure_time: string,
  stop_id: string,
  stop_sequence: string,
  stop_headsign: string,
  pickup_type: string,
  drop_off_type: string,
  shape_dist_traveled: string,
  timepoint: string,
  stop_note: string,
}

export async function loadStopTimeData(filePath: string): Promise<StopTimeRow[]> {
  try {
    const csvData = await fs.readFile(filePath, 'utf-8');
    const parsed = Papa.parse<StopTimeRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.error('CSV Parse Errors:', parsed.errors);
      return [];
    }

    return parsed.data;
  } catch (error) {
    console.error('Error reading stop time data:', error);
    return [];
  }
}
// one and done, don't rerun on original dataset
// changed from only platforms to now all stops (platforms/bus stands etc)
export async function main(maps: {idStationMap: Map<string, TrainStation>, platformStationIdMap: Map<string, string>, stopStationIdMap: Map<string, string>}) {
  const data = await loadStopTimeData('data/full_greater_sydney_gtfs_static_0/stop_times.txt');
  // filter stop times for platform ids and station ids (but no stations ids exist)
  // reduces from ~5m rows to ~1.3m
  const stopTimesForStopsWithStationTapData = data.filter(row => (maps.platformStationIdMap.has(row.stop_id) || maps.idStationMap.has(row.stop_id) || maps.stopStationIdMap.has(row.stop_id)));

  console.log(`Filtered ${stopTimesForStopsWithStationTapData.length} rows with matching stop times`);
  
  const csvOutput = Papa.unparse(stopTimesForStopsWithStationTapData);
  await fs.writeFile('data/stop-times-for-matching-stops.csv', csvOutput);
  console.log('Saved to stop-times-for-matching-stops.csv');
  return stopTimesForStopsWithStationTapData;
}