import fs from 'fs/promises';
import path from 'path';

const REPOS_ROOT = path.resolve(__dirname, "../dataset/github");
const RESULTS_ROOT = path.resolve(__dirname, "../results");

async function getDirectoryContent(rootDir: string) {
    const names = await fs.readdir(rootDir);

    return names.map(name => path.resolve(rootDir, name));
}

async function getFilesAndDirs(rootDir: string): Promise<{
    files: string[];
    dirs: string[];
}> {
    const dirNames = await getDirectoryContent(rootDir);

    const stats = await Promise.all(
        dirNames.map(dirName => fs.stat(dirName))
    );

    const files: string[] = [];
    const dirs: string[] = [];

    stats.forEach((stat, i) => {
        if (stat.isDirectory()) {
            dirs.push(dirNames[i]);
        } else if (stat.isFile()) {
            files.push(dirNames[i]);
        }
    })

    return {
        dirs,
        files,
    }
}

async function getRepoFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];

    async function pushRepoFiles(dir: string, result: string[]): Promise<void> {
        const {
            dirs,
            files,
        } = await getFilesAndDirs(dir);

        result.push(...files.filter(filename => filename.endsWith('.java')));

        await Promise.all(dirs.map(dir => pushRepoFiles(dir, result)));
    }

    await pushRepoFiles(rootDir, files);

    return files;
}

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

    try {
        for (const [path, metrics] of results) {
            await file.write(`${path.slice(REPOS_ROOT.length).replace(/\\/g, '/')},${metrics}\n`);
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
