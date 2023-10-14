import fs from 'fs/promises';
import path from 'path';

import { createSemaphore } from './semaphore';
import * as csv from './csv';

import {
    REPOS_ROOT,
    RESULTS_ROOT,
    getDirectoryContent,
    getRepoFiles
} from './helpers';

async function serializeResults(results: Record<string, number>[]) {
    await fs.mkdir(RESULTS_ROOT, {
        recursive: true,
    })

    const file = await fs.open(path.resolve(RESULTS_ROOT, "./nullReferences.csv"), 'w');

    await file.write("repository,file,nullReferences\n");

    try {
        for (const i in results) {
            const entries = Object.entries(results[i]);

            console.log(`chunk [${+ i + 1}/${results.length}] with ${entries.length} files`);

            const lines = entries.map(([path, metric]) => {
                const truncatedPath = path.slice(REPOS_ROOT.length + 1).replace(/\\/g, '/');

                const [, repository, javaPath] = truncatedPath.match(/^([^\/]+\/[^\/]+)(\/.+)$/) || [];

                return [repository, javaPath, metric.toString()] as const;
            }).sort(([, path1], [, path2]) => path1.localeCompare(path2));

            for (const line of lines) {
                await file.write(csv.stringifyLine(line));
                await file.write('\n')
            }
        }
    }
    catch (error) {
        throw error;
    }
    finally {
        await file.close();
    }
}

function countNullReferences(code: string): number {
    const codeWithoutComments = code.replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\/\/.*/g, '');

    const references = codeWithoutComments.match(/\bnull\b/g) || [];

    return references.length;
}

async function main() {
    const repos = await getDirectoryContent(REPOS_ROOT);

    const filesPerRepo = await Promise.all(repos.map(getRepoFiles));

    console.log(`Finished indexing files. ${filesPerRepo.length} repos found.`);

    const semaphore = createSemaphore(512);

    const repoParsers = filesPerRepo.map((repoFiles) => async () => {
        const metrics = await Promise.all(
            repoFiles
                .map(path => semaphore
                    .callWithLock(() => fs.readFile(path, { encoding: 'utf-8' }))
                    .then(countNullReferences)
                )
        );

        const result: Record<string, number> = {};

        repoFiles.forEach((path, i) => {
            result[path] = metrics[i];
        });

        return result;
    });

    const results = [];

    for (let index = 0; index < repoParsers.length; index++) {
        const parser = repoParsers[index];
        results.push(await parser());

        console.log(`[${index + 1}/${repoParsers.length}]`);
    }

    console.log("Serializing results");

    await serializeResults(results);
}

main();
