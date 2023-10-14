import * as fs from 'fs/promises'

export function parseLine<T extends string[] | readonly string[] = string[]>(line: string): T {
    return line.split(',').filter((chunk, i, array) => {
        if (chunk.endsWith('\\') && i + 1 < array.length) {
            array[i + 1] = chunk.slice(0, -1) + ',' + array[i + 1];
            return false;
        }

        return true;
    }) as T;
}

export async function readCSV<T extends string[] | readonly string[] = string[]>(path: string): Promise<T[]> {
    const content = await fs.readFile(path, "utf-8");

    return content.trim().split('\n').map<T>(parseLine);
}

export function stringifyLine<T extends string[] | readonly string[] = string[]>(line: T) {
    return line.map(chunk => chunk.replace(',', '\\,')).join(',');
}

export async function writeCSV<T extends string[] | readonly string[] = string[]>(path: string, content: T[]): Promise<void> {
    return fs.writeFile(path, content.map(stringifyLine).join('\n'));
}
