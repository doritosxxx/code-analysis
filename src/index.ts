import fs from 'fs/promises';
import path from 'path';

const REPOS_ROOT = path.resolve(__dirname, "../dataset/github");
const RESULTS_ROOT = path.resolve(__dirname, "../results");

async function getFiles(rootDir: string) {
    const names = await fs.readdir(rootDir);

    return names.map(name => path.resolve(rootDir, name));
}

async function getJavaFiles(rootDir: string) {
    const dirNames = await getFiles(rootDir);

    return dirNames.filter(dirName => dirName.endsWith('.java'));
}

async function getDirs(rootDir: string) {
    const dirNames = await getFiles(rootDir);
    const isDirArray = await Promise.all(
        dirNames.map(dirName => fs.stat(dirName).then(stats => stats.isDirectory()))
    );

    return dirNames.filter((_, i) => isDirArray[i]);
}

async function getRepoFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];

    async function pushRepoFiles(dir: string, files: string[]): Promise<void> {
        const [dirs, javaFiles] = await Promise.all([
            getDirs(dir),
            getJavaFiles(dir),
        ]);

        files.push(...javaFiles);

        await Promise.all(dirs.map(dir => pushRepoFiles(dir, files)));
    }

    await pushRepoFiles(rootDir, files);

    return files;
}

async function serializeResults(results: Record<string, number>[]) {
    await fs.mkdir(RESULTS_ROOT, {
        recursive: true,
    })

    const file = await fs.open(path.resolve(RESULTS_ROOT, "./nullReferences.csv"), 'w');

    try {
        for (const result of results) {
            for (const [path, metrics] of Object.entries(result)) {
                await file.write(`${path.slice(REPOS_ROOT.length).replace('\\', '/')},${metrics}\n`);
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
    /**
     * This will also match comments, variable names and string literals.
     * References should be filtered for more precise metrics.
     */
    const references = code.match(/\bnull\b/g) || [];

    return references.length;
}

async function main() {
    const repos = await getFiles(REPOS_ROOT);

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

    await serializeResults(results);
}

main();
