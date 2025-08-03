import * as fs from 'fs/promises';
import Papa from 'papaparse';
import { CombinedTapRow } from './preprocessTapData';

export type StopDataRow = {
  stop_id: string,
  stop_code: string,
  stop_name: string,
  stop_lat: string,
  stop_lon: string,
  location_type: string,
  parent_station: string,
  wheelchair_boarding: string,
  level_id: string,
  platform_code: string
};

async function loadStopData(filePath: string): Promise<StopDataRow[]> {
  try {
    const csvData = await fs.readFile(filePath, 'utf-8');
    const parsed = Papa.parse<StopDataRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.error('CSV Parse Errors: ', parsed.errors);
      return [];
    }

    return parsed.data;
  } catch (error) {
    console.error('Error reading stop data:', error);
    return [];
  }
}

// retrieve relevant data, stations (with tap data) and their platforms
function filterStationsStops(stopData: StopDataRow[], stationWithTapDataMap: Map<string, CombinedTapRow>) {
  
  // all stations found in tap data, 2 edge cases airport, location type 1 are physical stops?
  const stationsWithTapDataRows = stopData.filter(row => (stationWithTapDataMap.has(row.stop_name.replace('Station', '').trim()) && row.location_type === '1' && !row.stop_id.startsWith('G'))
                                                         || row.stop_name === 'Sydney Domestic Airport Station'
                                                         || row.stop_name === 'Sydney International Airport Station');
  // create set of id from stations with tap data
  const stationIdSet = new Set<string>;
  for (const row of stationsWithTapDataRows) {
    stationIdSet.add(row.stop_id);
  }
  // all platforms with station id existing in map
  const platformWithParentStationData = stopData.filter(row => (stationIdSet.has(row.parent_station) && row.stop_name.includes('Platform') && !row.stop_id.includes('_')));

  // all stops with station id existing in map, commented out some other forms of transport if needed
  const stopWithParentStationData = stopData.filter(row => (stationIdSet.has(row.parent_station) && !row.stop_name.includes('Platform') && !row.stop_id.includes('_')
                                                            // && !row.stop_name.includes('Light Rail')
                                                            // && !row.stop_name.includes('Wharf')
                                                            ));
  return stationsWithTapDataRows.concat(platformWithParentStationData).concat(stopWithParentStationData);
}

export async function main(tapDataMap: Map<string, CombinedTapRow>) {
  const data = await loadStopData('data/station-and-stops.csv');
  
  const stationAndStop = filterStationsStops(data, tapDataMap);
  // console.log(`Filtered ${stationAndStop.length} rows for Stations & Stops`);

  // const csvOutput = Papa.unparse(stationAndStop);
  // await fs.writeFile('data/station-and-stops.csv', csvOutput);
  // console.log('Saved to station-and-stops.csv');

  return stationAndStop;
}
