import * as fs from 'fs/promises';
import Papa from 'papaparse';

// Define the structure of one row (optional, but helpful)
type TapDataRow = {
  MonthYear: string;
  Station: string;
  Station_Type: string;
  Entry_Exit: string;
  Trip: string;
};

export type CombinedTapRow = {
  station: string;
  entries: string;
  exits: string;
}

async function loadTapData(filePath: string): Promise<TapDataRow[]> {
  try {
    const csvData = await fs.readFile(filePath, 'utf-8');
    const parsed = Papa.parse<TapDataRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.error('CSV Parse Errors:', parsed.errors);
      return [];
    }

    return parsed.data;
  } catch (error) {
    console.error('Error reading tap data:', error);
    return [];
  }
}

function combineEntriesAndExits(data: TapDataRow[]): Map<string, CombinedTapRow>{
  const stationMap = new Map<string, CombinedTapRow>();

  for (const row of data) {
    const station = row.Station.replace(/station/gi, '').trim();
    const trips = row.Trip;
    const entryOrExit = row.Entry_Exit;

    if (!stationMap.has(station)) {
      stationMap.set(station, {
        station: station,
        entries: '',
        exits: '',
      });
    }

    const current = stationMap.get(station)!;

    if (entryOrExit === 'Entry') {
      current.entries = trips; 
    } else if (entryOrExit === 'Exit') {
      current.exits = trips;
    }
  }
  return stationMap;
}

// Example usage
export async function main() {
  const data = await loadTapData('data/train-station-entries-and-exits-data_july-2025.csv');

  // Example: Filter Jun-25 entries
  const jun25 = data.filter(row => row.MonthYear.trim() === 'Jun-25');
  const stationMap = combineEntriesAndExits(jun25);
  
  // const jun25CombinedEntriesExits = Array.from(stationMap.values());
  // console.log(`Filtered and combined ${jun25CombinedEntriesExits.length} rows for Jun-25`);

  // Save to new file
  // const csvOutput = Papa.unparse(jun25CombinedEntriesExits);
  // await fs.writeFile('data/taps-jun25.csv', csvOutput);
  // console.log('Saved to taps-jun25.csv');

  return stationMap;
}
