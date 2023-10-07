import fs from 'fs/promises';
import path from 'path';

import {
    REPOS_ROOT,
    RESULTS_ROOT,
    getDirectoryContent,
    getRepoFiles
} from './helpers';

function flattenResults(results: Record<string, number>[]): [string, number][] {
    const flattened = results.reduce((result, chunk) => {
        result.push(...Object.entries(chunk));
        return result;
    }, [] as [string, number][]);

    return flattened.sort(([a], [b]) => a.localeCompare(b));
}

async function serializeResults(results: [string, number][]) {
    await fs.mkdir(RESULTS_ROOT, {
        recursive: true,
    })

    const file = await fs.open(path.resolve(RESULTS_ROOT, "./nullReferences.csv"), 'w');

    await file.write("repository,file,nullReferences\n");

    try {
        for (const [path, metrics] of results) {
            const truncatedPath = path.slice(REPOS_ROOT.length + 1).replace(/\\/g, '/');

            const [, repository, javaPath] = truncatedPath.match(/^([\w\d.-]+\/[\w\d.-]+)(\/.*)$/i) || [];
            await file.write(`${repository},${javaPath},${metrics}\n`);
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

    console.log(`Finished indexing files. ${filesPerRepo.length} repos found.`)

    const repoParsers = filesPerRepo.map((repoFiles) => async () => {
        const metrics = await Promise.all(
            repoFiles.map(path => fs.readFile(path, { encoding: 'utf-8' }).then(countNullReferences))
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

    await serializeResults(flattenResults(results));
}

main();
