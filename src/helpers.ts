import fs from 'fs/promises';
import path from 'path';

export const REPOS_ROOT = path.resolve(__dirname, "../dataset/github");
export const DATA_ROOT = path.resolve(__dirname, "../dataset/data");
export const RESULTS_ROOT = path.resolve(__dirname, "../results");

export async function getDirectoryContent(rootDir: string) {
    const names = await fs.readdir(rootDir);

    return names.map(name => path.resolve(rootDir, name));
}

export async function getFilesAndDirs(rootDir: string): Promise<{
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

export async function getRepoFiles(rootDir: string): Promise<string[]> {
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


