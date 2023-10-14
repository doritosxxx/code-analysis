import * as path from 'path'

import { readCSV, writeCSV } from './csv';

import {
    RESULTS_ROOT,
} from './helpers';

async function main() {
    console.log("Reading csv");
    const csv = await readCSV(path.resolve(RESULTS_ROOT, "all.csv"));

    console.log("Compressing csv");
    const compressed = csv.map(([repo, path, ...metrics]) => metrics);

    console.log("Writing compressed csv");
    await writeCSV(path.resolve(RESULTS_ROOT, "all.compressed.csv"), compressed);

    console.log("Done");
}

main();