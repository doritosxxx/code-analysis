import * as fs from 'fs/promises'

import { DATA_ROOT, RESULTS_ROOT, getFilesAndDirs } from './helpers'

async function _getMetricsFilesDirs(path: string, result: string[]): Promise<any> {
    const {
        dirs,
        files,
    } = await getFilesAndDirs(path);

    result.push(...files.filter(file => file.endsWith('all.csv')));

    return Promise.all(dirs.map(dir => _getMetricsFilesDirs(dir, result)));
}

async function getMetricsFilesDirs() {
    const result: string[] = [];
    await _getMetricsFilesDirs(DATA_ROOT, result);
    return result;
}

async function readCSV<T extends string[] = string[]>(path: string): Promise<T[]> {
    const content = await fs.readFile(path, "utf-8");

    return content.trim().split('\n').map(line => line.split(',') as T);
}

function writeCSV<T extends string[] = string[]>(path: string, content: T[]): Promise<void> {
    return fs.writeFile(path, content.map(line => line.join(',')).join('\n'));
}

const getNullReferences = () => readCSV<[string, string, string]>(RESULTS_ROOT + "/nullReferences.csv");

const getAllMetrics = () => readCSV<string[]>(DATA_ROOT + "/all.csv");

async function main() {
    const [nullReferences, allMetrics] = await Promise.all([
        getNullReferences(),
        getAllMetrics()
    ]);

    const buckets = nullReferences.reduce((buckets, [repo, path, nulls], index) => {
        if (index === 0) {
            return buckets;
        }

        buckets[repo + path] = nulls;

        return buckets;
    }, {} as Record<string, string>);

    allMetrics.forEach((line, index) => {
        if (index === 0) {
            line.push('nullReferences');
            return;
        }

        const [repo, path] = line;

        let nulls: string | undefined = buckets[repo + path];

        if (nulls === undefined) {
            console.log(`Can not find null references for ${repo} ${path}`);
            nulls = '0';
        }

        line.push(nulls);
    });

    writeCSV(RESULTS_ROOT + "/all.csv", allMetrics);
}

main();
