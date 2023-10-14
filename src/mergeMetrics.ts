import * as path from 'path'

import { createSemaphore } from './semaphore';
import { readCSV, writeCSV } from './csv';
import { DATA_ROOT, RESULTS_ROOT, getFilesAndDirs } from './helpers'

async function getMetricsFiles() {
    const { dirs: authors } = await getFilesAndDirs(DATA_ROOT);

    const repos = await Promise
        .all(authors.map(getFilesAndDirs))
        .then(contents => contents.flatMap(({ dirs }) => dirs))

    return repos.map(repoRoot => {

        const match = repoRoot.replace(/\\/g, '/').match(/[^\/]+\/[^\/]+$/);

        if (!match) {
            console.log(`Can not find repo name for ${repoRoot}`);
        }

        return {
            repo: match ? match[0] : '',
            file: path.resolve(repoRoot, "all.csv"),
        }
    });
}

const getNullReferences = () => readCSV<[string, string, string]>(RESULTS_ROOT + "/nullReferences.csv");

async function main() {
    const [nullReferences, metricsFiles] = await Promise.all([
        getNullReferences(),
        getMetricsFiles()
    ]);

    const buckets = nullReferences.reduce((buckets, [repo, path, nulls], index) => {
        if (index === 0) {
            return buckets;
        }

        buckets[repo + path] = nulls;

        return buckets;
    }, {} as Record<string, string>);

    const semaphore = createSemaphore(512);
    let loaded = 0;

    console.log(`Loading ${metricsFiles.length} repos...`);

    let headers: string[] = [];

    const csvs = await Promise.all(metricsFiles.map(({ file, repo }) => semaphore
        .callWithLock(() => readCSV(file))
        .then(([first, ...rows]) => {
            console.log(`[${++loaded}/${metricsFiles.length}]`)

            if (headers.length === 0) {
                headers = first;
            }

            rows.map(row => {
                const path = row[0];

                let nulls: string | undefined = buckets[repo + path];

                if (nulls === undefined) {
                    console.log(`Can not find null references for ${repo} ${path}`);
                    nulls = '0';
                }

                return [repo, ...row, nulls];
            });

            return rows;
        })
    ));

    console.log(`Loaded ${csvs.length} repos`);

    const csv = csvs.flat(1);

    headers.push('nullReferences');
    csv.unshift(headers);

    writeCSV(RESULTS_ROOT + "/all.csv", csv);
}

main();
